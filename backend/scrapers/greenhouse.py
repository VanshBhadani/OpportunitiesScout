# ─────────────────────────────────────────────────────────────────
# scrapers/greenhouse.py — Greenhouse ATS public jobs API
#
# Greenhouse is used by many top tech/fintech companies and exposes
# a FREE, no-auth public JSON API per company board:
#   GET https://boards-api.greenhouse.io/v1/boards/{company}/jobs
#
# Adding a new company = one entry in COMPANIES below.
# Filters to entry-level / internship roles automatically.
# ─────────────────────────────────────────────────────────────────

import logging
from typing import Any
from backend.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

API = "https://boards-api.greenhouse.io/v1/boards/{company}/jobs"

# ── Company roster ────────────────────────────────────────────────
# (board_slug, display_name)
COMPANIES: list[tuple[str, str]] = [
    # ── Fintech ──────────────────────────────────────────────────
    ("stripe",       "Stripe"),
    ("coinbase",     "Coinbase"),
    ("brex",         "Brex"),
    ("ramp",         "Ramp"),
    ("plaid",        "Plaid"),
    ("robinhood",    "Robinhood"),
    ("chime",        "Chime"),
    ("affirm",       "Affirm"),
    ("klarna",       "Klarna"),
    ("rippling",     "Rippling"),
    ("mercury",      "Mercury"),
    ("deel",         "Deel"),
    # ── Big Tech / SaaS ──────────────────────────────────────────
    ("notion",       "Notion"),
    ("figma",        "Figma"),
    ("datadog",      "Datadog"),
    ("hashicorp",    "HashiCorp"),
    ("mongodb",      "MongoDB"),
    ("gitlab",       "GitLab"),
    ("cloudflare",   "Cloudflare"),
    ("hubspot",      "HubSpot"),
    ("zendesk",      "Zendesk"),
    ("doordash",     "DoorDash"),
    ("airbnb",       "Airbnb"),
    ("lyft",         "Lyft"),
]

# Keywords that suggest entry-level / intern roles
ENTRY_KEYWORDS = {
    "intern", "internship", "graduate", "new grad", "entry", "junior",
    "associate", "analyst", "apprentice", "trainee", "campus", "fresher",
}

# Roles to skip (not relevant for a student)
SKIP_KEYWORDS = {
    "director", "vp ", "vice president", "principal engineer",
    "staff engineer", "distinguished", "cto", "cfo", "ceo",
    "head of", "svp", "evp",
}


def _is_entry_level(title: str) -> bool:
    t = title.lower()
    if any(kw in t for kw in SKIP_KEYWORDS):
        return False
    return any(kw in t for kw in ENTRY_KEYWORDS)


class GreenhouseScraper(BaseScraper):
    platform = "greenhouse"

    async def scrape(self) -> list[dict[str, Any]]:
        results: list[dict] = []
        for slug, name in COMPANIES:
            url = API.format(company=slug)
            resp = await self._get(url, params={"content": "true"})
            if resp is None:
                continue
            try:
                jobs = resp.json().get("jobs", [])
            except Exception as exc:
                logger.warning("[greenhouse] JSON error for %s: %s", slug, exc)
                continue

            for job in jobs:
                parsed = self._parse_job(job, name)
                if parsed:
                    results.append(parsed)

            await self._delay(0.3, 0.8)

        logger.info("[greenhouse] Scraped %d entry-level opportunities across %d companies",
                    len(results), len(COMPANIES))
        return results

    def _parse_job(self, job: dict, company: str) -> dict | None:
        try:
            title = (job.get("title") or "").strip()
            if not title:
                return None
            if not _is_entry_level(title):
                return None

            url        = job.get("absolute_url") or ""
            job_id     = job.get("id", "")
            location   = ""
            offices    = job.get("offices") or job.get("location") or []
            if isinstance(offices, list) and offices:
                location = offices[0].get("name", "") if isinstance(offices[0], dict) else ""
            elif isinstance(offices, dict):
                location = offices.get("name", "")

            departments = job.get("departments") or []
            tags = [d["name"] for d in departments if isinstance(d, dict) and d.get("name")]

            # Try to get description from content field (only when content=true)
            content     = job.get("content") or ""
            description = content[:800] if content else f"Entry-level position at {company}. See job listing for full details."
            requirements = ""

            return {
                "platform":     self.platform,
                "title":        title,
                "company":      company,
                "url":          url,
                "description":  description,
                "requirements": requirements,
                "deadline":     None,
                "location":     location or "Remote/Hybrid",
                "stipend":      "",
                "tags":         tags,
            }
        except Exception as exc:
            logger.debug("[greenhouse] parse error: %s", exc)
            return None
