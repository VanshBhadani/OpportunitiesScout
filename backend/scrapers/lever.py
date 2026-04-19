# ─────────────────────────────────────────────────────────────────
# scrapers/lever.py — Lever ATS public jobs API
#
# Lever is used by many growth-stage tech companies and exposes a
# FREE, no-auth public JSON API:
#   GET https://api.lever.co/v0/postings/{company}?mode=json
#
# Adding a new company = one entry in COMPANIES below.
# ─────────────────────────────────────────────────────────────────

import logging
from typing import Any
from backend.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

API = "https://api.lever.co/v0/postings/{company}"

COMPANIES: list[tuple[str, str]] = [
    # ── Big Tech ──────────────────────────────────────────────────
    ("netflix",       "Netflix"),
    ("databricks",    "Databricks"),
    ("scale",         "Scale AI"),
    ("openai",        "OpenAI"),
    ("anthropic",     "Anthropic"),
    ("mistral",       "Mistral AI"),
    # ── Fintech / Finance ────────────────────────────────────────
    ("wealthsimple",  "Wealthsimple"),
    ("wise",          "Wise"),
    ("monzo",         "Monzo"),
    ("revolut",       "Revolut"),
    # ── Infra / Dev Tools ────────────────────────────────────────
    ("vercel",        "Vercel"),
    ("linear",        "Linear"),
    ("retool",        "Retool"),
    ("supabase",      "Supabase"),
    ("render",        "Render"),
    # ── Misc high-growth ─────────────────────────────────────────
    ("airtable",      "Airtable"),
    ("lattice",       "Lattice"),
    ("webflow",       "Webflow"),
]

ENTRY_KEYWORDS = {
    "intern", "internship", "graduate", "new grad", "entry", "junior",
    "associate", "analyst", "apprentice", "trainee", "campus", "fresher",
    "student", "co-op", "coop",
}

SKIP_KEYWORDS = {
    "director", "vp ", "vice president", "principal engineer",
    "staff engineer", "distinguished", "head of", "svp", "evp", "cto", "cfo",
}


def _is_entry_level(title: str) -> bool:
    t = title.lower()
    if any(kw in t for kw in SKIP_KEYWORDS):
        return False
    return any(kw in t for kw in ENTRY_KEYWORDS)


class LeverScraper(BaseScraper):
    platform = "lever"

    async def scrape(self) -> list[dict[str, Any]]:
        results: list[dict] = []
        for slug, name in COMPANIES:
            url = API.format(company=slug)
            resp = await self._get(url, params={"mode": "json"})
            if resp is None:
                continue
            try:
                jobs = resp.json()
                if not isinstance(jobs, list):
                    continue
            except Exception as exc:
                logger.warning("[lever] JSON error for %s: %s", slug, exc)
                continue

            for job in jobs:
                parsed = self._parse_job(job, name)
                if parsed:
                    results.append(parsed)

            await self._delay(0.3, 0.8)

        logger.info("[lever] Scraped %d entry-level opportunities across %d companies",
                    len(results), len(COMPANIES))
        return results

    def _parse_job(self, job: dict, company: str) -> dict | None:
        try:
            title = (job.get("text") or "").strip()
            if not title:
                return None
            if not _is_entry_level(title):
                return None

            url = job.get("hostedUrl") or job.get("applyUrl") or ""

            # Location
            location_obj = job.get("workplaceType") or ""
            categories   = job.get("categories") or {}
            location     = categories.get("location") or location_obj or "Remote"

            # Tags from team + commitment
            tags = []
            if categories.get("team"):
                tags.append(categories["team"])
            if categories.get("commitment"):
                tags.append(categories["commitment"])

            # Description
            lists   = job.get("lists") or []
            desc_parts = []
            for lst in lists[:3]:
                content = lst.get("content", "")
                if content:
                    import re
                    desc_parts.append(re.sub(r"<[^>]+>", "", content).strip()[:300])
            description = " ".join(desc_parts) or f"Open role at {company}."

            return {
                "platform":     self.platform,
                "title":        title,
                "company":      company,
                "url":          url,
                "description":  description[:800],
                "requirements": "",
                "deadline":     None,
                "location":     location,
                "stipend":      "",
                "tags":         tags,
            }
        except Exception as exc:
            logger.debug("[lever] parse error: %s", exc)
            return None
