# ─────────────────────────────────────────────────────────────────
# scrapers/unstop.py — Unstop scraper using the public JSON API
# Endpoint: /api/public/opportunity/search-new
# Fetches competitions and jobs (2 pages each = up to ~80 items)
# ─────────────────────────────────────────────────────────────────

import logging
import re
from typing import Any
from backend.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://unstop.com"
API = f"{BASE_URL}/api/public/opportunity/search-new"


class UnstopScraper(BaseScraper):
    platform = "unstop"

    async def scrape(self) -> list[dict[str, Any]]:
        results: list[dict] = []
        try:
            for opp_type in ["competitions", "jobs"]:
                for page in range(1, 3):
                    params = {
                        "opportunity": opp_type,
                        "page": page,
                        "per_page": 20,
                    }
                    resp = await self._get(API, params=params)
                    if resp is None:
                        break
                    try:
                        data = resp.json()
                        items = data.get("data", {}).get("data", [])
                    except Exception as exc:
                        logger.warning("[unstop] JSON parse error on %s p%d: %s", opp_type, page, exc)
                        break

                    for item in items:
                        parsed = self._parse_item(item, opp_type)
                        if parsed:
                            results.append(parsed)

                    await self._delay()
        except Exception as exc:
            logger.error("[unstop] Unexpected error: %s", exc)

        logger.info("[unstop] Scraped %d opportunities", len(results))
        return results

    # ── Parsing ───────────────────────────────────────────────────

    def _parse_item(self, item: dict, opp_type: str) -> dict | None:
        try:
            title = item.get("title", "").strip()
            if not title:
                return None

            slug = item.get("public_url", "")
            url = f"{BASE_URL}/{slug}" if slug else ""

            org = item.get("organisation") or {}
            company = org.get("name", "").strip()

            # Deadline — ISO datetime string
            end_raw = item.get("end_date") or ""
            deadline = None
            if end_raw:
                # "2026-04-25T23:11:00+05:30" → "2026-04-25"
                deadline = end_raw[:10]

            # Prize / stipend
            stipend = ""
            prizes = item.get("prizes") or []
            for p in prizes:
                amt = p.get("amount") or p.get("prize_amount") or p.get("title") or ""
                if amt:
                    stipend = str(amt)
                    break

            # For jobs: salary
            if not stipend:
                job_detail = item.get("job_detail") or {}
                sal = job_detail.get("salary") or ""
                if sal:
                    stipend = str(sal)

            # Tags from required_skills or tags list
            tags: list[str] = []
            for s in (item.get("required_skills") or []):
                if isinstance(s, dict):
                    label = (s.get("label") or s.get("name") or "").strip()
                elif isinstance(s, str):
                    label = s.strip()
                else:
                    label = ""
                if label:
                    tags.append(label)
            for t in (item.get("tags") or []):
                if isinstance(t, dict):
                    label = (t.get("value") or t.get("name") or t.get("label") or "").strip()
                elif isinstance(t, str):
                    label = t.strip()
                else:
                    label = ""
                if label and label not in tags:
                    tags.append(label)

            # Eligibility / requirements
            req_parts = []
            for r in (item.get("regnRequirements") or []):
                if isinstance(r, dict):
                    val = r.get("value") or r.get("title") or ""
                elif isinstance(r, str):
                    val = r
                else:
                    val = ""
                if val:
                    req_parts.append(str(val))
            requirements = " | ".join(req_parts)

            description = (
                f"{opp_type.title()} on Unstop. "
                f"Organised by {company}. "
                f"Type: {item.get('subtype', opp_type)}"
            )

            return {
                "platform": self.platform,
                "title": title,
                "company": company,
                "url": url,
                "description": description,
                "requirements": requirements,
                "deadline": deadline,
                "location": "Online",
                "stipend": stipend,
                "tags": tags,
            }
        except Exception as exc:
            logger.debug("[unstop] Item parse error: %s", exc)
            return None
