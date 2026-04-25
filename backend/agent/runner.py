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
from datetime import datetime, date
from sqlalchemy.orm import Session

from backend.db.models import Profile, Opportunity, RunLog
from backend.scrapers.internshala import IntershalaScraper
from backend.scrapers.unstop import UnstopScraper
from backend.scrapers.devpost import DevpostScraper
from backend.scrapers.greenhouse import GreenhouseScraper
from backend.scrapers.lever import LeverScraper
from backend.agent.eligibility import batch_check_eligibility
from backend.agent.ranker import rank_opportunities

logger = logging.getLogger(__name__)

# With batch mode, this is just ONE API call regardless of count.
LLM_BATCH_LIMIT = 50
SCRAPER_TIMEOUT = 240  # seconds — generous for Greenhouse/Lever network calls


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


async def run_pipeline(db: Session, existing_run_id: int | None = None) -> int:
    """
    Execute the full scrape → check → rank pipeline.
    If existing_run_id is provided, updates that RunLog instead of creating a new one.
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

    try:
        # 1. Load profile (use first profile if exists)
        profile_row = db.query(Profile).first()
        profile_dict = _profile_to_dict(profile_row) if profile_row else {}

        # 2. Scrape all platforms
        raw_opps = await _run_scrapers()

        # 3. Deduplicate
        new_opps = _deduplicate(raw_opps, db)
        logger.info("New unique opportunities: %d", len(new_opps))

        # 4. Persist
        opp_rows = _persist_opportunities(new_opps, db)

        run_log.opportunities_found = len(opp_rows)
        db.commit()

        # 5. Eligibility — BATCH MODE (single GLM call for all opportunities)
        # Also back-fill any previously stored but unscored opportunities.
        unscored_existing = (
            db.query(Opportunity)
            .filter(Opportunity.eligibility_score.is_(None))
            .filter(~Opportunity.id.in_([o.id for o in opp_rows]))  # exclude just-added
            .limit(LLM_BATCH_LIMIT)
            .all()
        )
        batch = (opp_rows + unscored_existing)[:LLM_BATCH_LIMIT]
        logger.info("Sending %d opportunities to GLM in ONE batch call", len(batch))

        # Build input dicts for GLM
        batch_input = [_opp_to_dict(opp_row) for opp_row in batch]

        # Single API call → returns list in same order as batch
        results = batch_check_eligibility(profile_dict, batch_input)

        # Write results back to DB rows
        eligible_count = 0
        for opp_row, result in zip(batch, results):
            opp_row.eligibility_score = result["score"]
            opp_row.eligibility_reason = result["reason"]
            opp_row.is_eligible = result["eligible"]
            if result["eligible"]:
                eligible_count += 1

        db.commit()

        # 6. Rank — build dicts for ranker, then write ranks back
        opp_dicts = []
        for opp_row in batch:
            d = _opp_to_dict(opp_row)
            d["eligibility_score"] = opp_row.eligibility_score
            d["_id"] = opp_row.id
            opp_dicts.append(d)

        ranked = rank_opportunities(opp_dicts)
        for ranked_opp in ranked:
            opp_id = ranked_opp["_id"]
            # Find and update the row
            for opp_row in batch:
                if opp_row.id == opp_id:
                    opp_row.rank = ranked_opp.get("rank")
                    break
        db.commit()

        # 7. Finalise run log
        run_log_obj = db.query(RunLog).get(run_id)
        run_log_obj.finished_at = datetime.utcnow()
        run_log_obj.status = "completed"
        run_log_obj.opportunities_found = len(opp_rows)
        run_log_obj.opportunities_eligible = eligible_count
        db.commit()

        logger.info("Pipeline complete. Found=%d Eligible=%d", len(opp_rows), eligible_count)

    except Exception as exc:
        logger.exception("Pipeline failed: %s", exc)
        run_log_obj = db.query(RunLog).get(run_id)
        if run_log_obj:
            run_log_obj.finished_at = datetime.utcnow()
            run_log_obj.status = "failed"
            run_log_obj.error_message = str(exc)
            db.commit()

    return run_id
