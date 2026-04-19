# ─────────────────────────────────────────────────────────────────
# scrapers/amazon_jobs.py — Amazon Jobs JSON API
#
# Endpoint: https://www.amazon.jobs/en/search.json
# No auth required. Returns JSON with job listings.
# Filters to intern / new grad / entry-level.
# ─────────────────────────────────────────────────────────────────

import logging
from typing import Any
from backend.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

API = "https://www.amazon.jobs/en/search.json"

QUERIES = ["intern", "new grad", "graduate", "associate engineer", "SDE intern"]


class AmazonJobsScraper(BaseScraper):
    platform = "amazon"

    # Amazon returns 403 without a proper Accept header
    _HEADERS = {
        "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept":          "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer":         "https://www.amazon.jobs/en/",
    }

    async def scrape(self) -> list[dict[str, Any]]:
        results: list[dict] = []
        seen: set[str] = set()

        for query in QUERIES:
            params = {
                "query":        query,
                "result_limit": 20,
                "sort":         "recent",
                "category[]":   "software-development",
            }
            resp = await self._get(API, params=params,
                                   headers=self._HEADERS)
            if resp is None:
                continue
            try:
                data = resp.json()
                jobs = data.get("jobs", [])
            except Exception as exc:
                logger.warning("[amazon] JSON error for '%s': %s", query, exc)
                continue

            for job in jobs:
                job_id = str(job.get("id") or job.get("job_id") or "")
                if job_id in seen:
                    continue
                seen.add(job_id)
                parsed = self._parse_job(job)
                if parsed:
                    results.append(parsed)

            await self._delay(1.5, 2.5)

        logger.info("[amazon] Scraped %d opportunities", len(results))
        return results

    def _parse_job(self, job: dict) -> dict | None:
        try:
            title = (job.get("title") or "").strip()
            if not title:
                return None

            job_id   = job.get("id") or job.get("job_id") or ""
            job_path = job.get("job_path") or f"/en/jobs/{job_id}"
            url      = f"https://www.amazon.jobs{job_path}"

            location = job.get("location") or job.get("normalized_location") or "Global"

            description = (job.get("description_short") or job.get("description") or
                           f"Amazon role: {title}.")[:800]

            tags = []
            category = job.get("category") or ""
            team     = job.get("team") or ""
            if category:
                tags.append(category)
            if team:
                tags.append(team)

            return {
                "platform":     self.platform,
                "title":        title,
                "company":      "Amazon",
                "url":          url,
                "description":  description,
                "requirements": "",
                "deadline":     None,
                "location":     location,
                "stipend":      "",
                "tags":         tags,
            }
        except Exception as exc:
            logger.debug("[amazon] parse error: %s", exc)
            return None
