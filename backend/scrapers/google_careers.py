# ─────────────────────────────────────────────────────────────────
# scrapers/google_careers.py — Google Careers unofficial JSON API
#
# Endpoint: https://careers.google.com/api/jobs/jobs-v1/search/
# No auth required. Returns JSON directly.
# Filters to internship + entry-level roles globally.
# ─────────────────────────────────────────────────────────────────

import logging
from typing import Any
from datetime import datetime
from backend.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

API = "https://careers.google.com/api/jobs/jobs-v1/search/"

ENTRY_QUERIES = [
    "intern",
    "student",
    "new grad",
    "associate",
]


class GoogleCareersScraper(BaseScraper):
    platform = "google"

    async def scrape(self) -> list[dict[str, Any]]:
        results: list[dict] = []
        seen_ids: set[str] = set()

        for query in ENTRY_QUERIES:
            params = {
                "q":        query,
                "hl":       "en_US",
                "jlo":      "en_US",
                "page_size": 20,
                "sort_by":  "date",
            }
            resp = await self._get(API, params=params)
            if resp is None:
                continue
            try:
                data = resp.json()
                jobs = data.get("jobs", [])
            except Exception as exc:
                logger.warning("[google] JSON error for query '%s': %s", query, exc)
                continue

            for job in jobs:
                job_id = job.get("job_id") or job.get("id") or ""
                if job_id in seen_ids:
                    continue
                seen_ids.add(job_id)
                parsed = self._parse_job(job)
                if parsed:
                    results.append(parsed)

            await self._delay(1.0, 2.0)

        logger.info("[google] Scraped %d opportunities", len(results))
        return results

    def _parse_job(self, job: dict) -> dict | None:
        try:
            title = (job.get("title") or "").strip()
            if not title:
                return None

            job_id = job.get("job_id") or ""
            url = f"https://careers.google.com/jobs/results/{job_id}" if job_id else \
                  "https://careers.google.com/jobs/results/"

            # Locations — can be list
            locs = job.get("locations") or []
            if isinstance(locs, list):
                location = ", ".join(locs[:2]) if locs else "Global"
            else:
                location = str(locs) or "Global"

            # Description
            description = (job.get("description") or f"Google role: {title}.")[:800]

            # Requirements
            qualifications = job.get("minimum_qualifications") or \
                             job.get("preferred_qualifications") or ""
            requirements   = str(qualifications)[:400]

            # Tags from categories / functions
            cats = job.get("categories") or []
            tags = cats if isinstance(cats, list) else []

            # Deadline — Google rarely publishes one
            deadline = None
            pub_date = job.get("publish_date") or ""
            if pub_date:
                try:
                    deadline = datetime.fromisoformat(pub_date[:10]).date().isoformat()
                except Exception:
                    pass

            return {
                "platform":     self.platform,
                "title":        title,
                "company":      "Google",
                "url":          url,
                "description":  description,
                "requirements": requirements,
                "deadline":     deadline,
                "location":     location,
                "stipend":      "",
                "tags":         tags,
            }
        except Exception as exc:
            logger.debug("[google] parse error: %s", exc)
            return None
