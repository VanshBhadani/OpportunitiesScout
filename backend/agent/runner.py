# ─────────────────────────────────────────────────────────────────
# agent/runner.py — Orchestrates the full pipeline:
#   1. Load profile from DB
#   2. Run all scrapers concurrently
#   3. Deduplicate by URL
#   4. Persist new opportunities
#   5. Run eligibility + ranking (max 20 LLM calls per run)
#   6. Update DB with scores and ranks
#   7. Update RunLog record
# ─────────────────────────────────────────────────────────────────

import asyncio
import logging
import math
from datetime import datetime, date
from typing import Optional
from sqlalchemy.orm import Session

from backend.db.models import Profile, Opportunity, RunLog
from backend.scrapers.internshala import IntershalaScraper
from backend.scrapers.unstop import UnstopScraper
from backend.scrapers.devpost import DevpostScraper
from backend.scrapers.greenhouse import GreenhouseScraper
from backend.scrapers.lever import LeverScraper
from backend.agent.eligibility import batch_check_eligibility
from backend.agent.ranker import rank_opportunities
from backend import progress as run_progress

logger = logging.getLogger(__name__)

SUB_BATCH_SIZE = 10  # AI is called once per sub-batch of this size
SCRAPER_TIMEOUT = 240


async def _run_scrapers() -> list[dict]:
    """Run all scrapers concurrently.
    Uses asyncio.wait so completed scrapers are collected even if
    others are still running when the timeout fires.
    """
    scrapers = [
        # ── Original sources ──────────────────────────────────────
        IntershalaScraper(),
        UnstopScraper(),
        DevpostScraper(),
        # ── Greenhouse ATS (24 fintech/tech companies) ────────────
        GreenhouseScraper(),
        # ── Lever ATS (18 companies incl. OpenAI, Netflix) ───────
        LeverScraper(),
    ]

    # Wrap coroutines in named Tasks so we can inspect results
    tasks = {asyncio.ensure_future(s.scrape()): s for s in scrapers}
    all_opps: list[dict] = []

    try:
        done, pending = await asyncio.wait(
            tasks.keys(),
            timeout=SCRAPER_TIMEOUT,
        )

        if pending:
            logger.warning(
                "Scrapers timed out after %ds — %d finished, %d still running (cancelled)",
                SCRAPER_TIMEOUT, len(done), len(pending),
            )
            for t in pending:
                t.cancel()

        # Collect results from tasks that finished
        for task in done:
            exc = task.exception()
            if exc:
                logger.error("Scraper failed: %s", exc)
            else:
                result = task.result()
                if isinstance(result, list):
                    all_opps.extend(result)

    except Exception as exc:
        logger.error("Unexpected error in _run_scrapers: %s", exc)

    # Close all HTTP clients
    for s in scrapers:
        try:
            await s.close()
        except Exception:
            pass

    return all_opps


def _deduplicate(raw: list[dict], db: Session) -> list[dict]:
    """
    Remove already-stored opportunities from the new batch.
    Primary key: URL (when non-empty).
    Fallback key: (platform, title.lower()) — catches Internshala cards that
    may lack a URL on first scrape.
    """
    existing_urls: set[str] = {
        row[0] for row in db.query(Opportunity.url).all() if row[0]
    }
    existing_titles: set[tuple] = {
        (row[0], row[1].lower())
        for row in db.query(Opportunity.platform, Opportunity.title).all()
        if row[1]
    }

    seen_urls: set[str] = set()
    seen_titles: set[tuple] = set()
    unique: list[dict] = []

    for opp in raw:
        url = opp.get("url", "").strip()
        platform = opp.get("platform", "")
        title_key = (platform, opp.get("title", "").lower().strip())

        # Skip if URL already in DB or seen this batch
        if url and (url in existing_urls or url in seen_urls):
            continue
        # Skip if (platform, title) already in DB or seen this batch
        if title_key[1] and (title_key in existing_titles or title_key in seen_titles):
            continue

        unique.append(opp)
        if url:
            seen_urls.add(url)
        if title_key[1]:
            seen_titles.add(title_key)

    return unique


def _persist_opportunities(opps: list[dict], db: Session) -> list[Opportunity]:
    """Bulk-insert new opportunities and return ORM objects."""
    rows: list[Opportunity] = []
    for opp in opps:
        deadline = opp.get("deadline")
        if isinstance(deadline, str) and deadline:
            try:
                deadline = date.fromisoformat(deadline)
            except ValueError:
                deadline = None

        row = Opportunity(
            platform=opp.get("platform", "unknown"),
            title=opp.get("title", ""),
            company=opp.get("company", ""),
            url=opp.get("url", ""),
            description=opp.get("description", ""),
            requirements=opp.get("requirements", ""),
            deadline=deadline,
            location=opp.get("location", ""),
            stipend=opp.get("stipend", ""),
            tags=opp.get("tags", []),
            scraped_at=datetime.utcnow(),
        )
        db.add(row)
        rows.append(row)
    db.commit()
    for row in rows:
        db.refresh(row)
    return rows


def _profile_to_dict(profile: Profile) -> dict:
    return {
        "skills": profile.skills or [],
        "cgpa": profile.cgpa,
        "preferred_roles": profile.preferred_roles or [],
        "preferred_locations": profile.preferred_locations or [],
        "resume_text": profile.resume_text or "",
    }


def _opp_to_dict(opp: Opportunity) -> dict:
    return {
        "title": opp.title,
        "company": opp.company,
        "description": opp.description,
        "requirements": opp.requirements,
        "tags": opp.tags or [],
        "stipend": opp.stipend,
        "deadline": opp.deadline,
        "platform": opp.platform,
    }


async def run_pipeline(db: Session, existing_run_id: int | None = None, max_process: Optional[int] = 50) -> int:
    """
    Execute the full scrape → check → rank pipeline.
    max_process: how many unscored opportunities to check. None = all of them.
    Eligibility is checked in sub-batches of SUB_BATCH_SIZE (10).
    Returns the RunLog.id for status polling.
    """
    if existing_run_id is not None:
        # Reuse the RunLog already created by the API endpoint
        run_log = db.query(RunLog).get(existing_run_id)
        if run_log is None:
            run_log = RunLog(started_at=datetime.utcnow(), status="running")
            db.add(run_log)
            db.commit()
            db.refresh(run_log)
    else:
        run_log = RunLog(started_at=datetime.utcnow(), status="running")
        db.add(run_log)
        db.commit()
        db.refresh(run_log)
    run_id = run_log.id

    run_progress.init_run(run_id)

    try:
        # 1. Load profile
        run_progress.log(run_id, "init", "⚙️ Loading your profile...")
        profile_row = db.query(Profile).first()
        profile_dict = _profile_to_dict(profile_row) if profile_row else {}

        # 2. Scrape all platforms
        run_progress.log(run_id, "scraping", "🔍 Scraping Internshala, Unstop, Devpost, Greenhouse, Lever... (takes ~2 min)")
        raw_opps = await _run_scrapers()
        run_progress.log(run_id, "scraping", f"📥 Scraped {len(raw_opps)} total opportunities")

        # 3. Deduplicate
        new_opps = _deduplicate(raw_opps, db)
        run_progress.log(run_id, "saving", f"💾 {len(new_opps)} new unique opportunities (skipped duplicates)")
        logger.info("New unique opportunities: %d", len(new_opps))

        # 4. Persist
        opp_rows = _persist_opportunities(new_opps, db)
        run_log.opportunities_found = len(opp_rows)
        db.commit()

        # 5. Eligibility — process in sub-batches of SUB_BATCH_SIZE
        # Collect ALL unscored opps (new + previously stored)
        all_unscored = (
            db.query(Opportunity)
            .filter(Opportunity.eligibility_score.is_(None))
            .order_by(Opportunity.scraped_at.desc())
            .all()
        )
        # Apply user-chosen limit
        to_check = all_unscored if max_process is None else all_unscored[:max_process]
        total_to_check = len(to_check)
        num_batches = max(1, math.ceil(total_to_check / SUB_BATCH_SIZE))

        run_progress.log(
            run_id, "eligibility",
            f"🤖 Processing {total_to_check} opportunities in {num_batches} sub-batch{'es' if num_batches != 1 else ''} of {SUB_BATCH_SIZE}..."
        )
        logger.info("Eligibility: %d opps, %d sub-batches of %d", total_to_check, num_batches, SUB_BATCH_SIZE)

        eligible_count = 0
        for batch_num in range(num_batches):
            start = batch_num * SUB_BATCH_SIZE
            sub_batch = to_check[start : start + SUB_BATCH_SIZE]

            run_progress.log(
                run_id, "eligibility",
                f"  ⚡ Sub-batch {batch_num + 1}/{num_batches}: checking {len(sub_batch)} opportunities..."
            )

            batch_input = [_opp_to_dict(opp_row) for opp_row in sub_batch]
            results = batch_check_eligibility(profile_dict, batch_input)

            for opp_row, result in zip(sub_batch, results):
                opp_row.eligibility_score = result["score"]
                opp_row.eligibility_reason = result["reason"]
                opp_row.is_eligible = result["eligible"]
                if result["eligible"]:
                    eligible_count += 1

            db.commit()
            run_progress.log(
                run_id, "eligibility",
                f"  ✅ Sub-batch {batch_num + 1} done — {eligible_count} eligible so far"
            )
            # Update running count live
            run_log_live = db.query(RunLog).filter(RunLog.id == run_id).first()
            if run_log_live:
                run_log_live.opportunities_eligible = eligible_count
                db.commit()

        run_progress.log(run_id, "eligibility", f"✅ {eligible_count} / {total_to_check} total eligible")

        # 6. Rank all scored opps
        run_progress.log(run_id, "ranking", "📊 Ranking opportunities by fit score...")
        opp_dicts = []
        for opp_row in to_check:
            d = _opp_to_dict(opp_row)
            d["eligibility_score"] = opp_row.eligibility_score
            d["_id"] = opp_row.id
            opp_dicts.append(d)

        ranked = rank_opportunities(opp_dicts)
        for ranked_opp in ranked:
            opp_id = ranked_opp["_id"]
            for opp_row in to_check:
                if opp_row.id == opp_id:
                    opp_row.rank = ranked_opp.get("rank")
                    break
        db.commit()

        # 7. Finalise run log
        run_log_obj = db.query(RunLog).filter(RunLog.id == run_id).first()
        run_log_obj.finished_at = datetime.utcnow()
        run_log_obj.status = "completed"
        run_log_obj.opportunities_found = len(opp_rows)
        run_log_obj.opportunities_eligible = eligible_count
        db.commit()

        run_progress.log(run_id, "done", f"🏁 Done! Scraped {len(opp_rows)} new, checked {total_to_check}, eligible {eligible_count}")
        run_progress.cleanup_old()
        logger.info("Pipeline complete. Found=%d Eligible=%d", len(opp_rows), eligible_count)

    except Exception as exc:
        logger.exception("Pipeline failed: %s", exc)
        run_progress.log(run_id, "error", f"❌ Error: {exc}")
        run_log_obj = db.query(RunLog).filter(RunLog.id == run_id).first()
        if run_log_obj:
            run_log_obj.finished_at = datetime.utcnow()
            run_log_obj.status = "failed"
            run_log_obj.error_message = str(exc)
            db.commit()

    return run_id
