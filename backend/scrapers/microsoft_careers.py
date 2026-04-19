# ─────────────────────────────────────────────────────────────────
# scrapers/microsoft_careers.py — Microsoft Jobs API
#
# Endpoint: https://gcsservices.careers.microsoft.com/search/api/v1/job
# No auth required. Returns clean JSON.
# Filters to internship / new grad roles.
# ─────────────────────────────────────────────────────────────────

import logging
from typing import Any
from backend.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

API = "https://gcsservices.careers.microsoft.com/search/api/v1/job"

# Microsoft job type IDs: 1=Full time, 2=Part time, 4=Intern
INTERN_JOB_TYPE = 4


class MicrosoftCareersScraper(BaseScraper):
    platform = "microsoft"

    async def scrape(self) -> list[dict[str, Any]]:
        results: list[dict] = []

        # Fetch internship roles (jobType=4) + new grad keyword
        for query, job_type in [("intern", None), ("", INTERN_JOB_TYPE), ("new grad", None), ("student", None)]:
            params: dict = {
                "pg":  1,
                "pgSz": 20,
                "o":   "Relevance",
                "flt": "true",
            }
            if query:
                params["q"] = query
            if job_type:
                params["jobType"] = job_type

            resp = await self._get(API, params=params)
            if resp is None:
                continue
            try:
                data = resp.json()
                jobs = data.get("operationResult", {}).get("result", {}).get("jobs", [])
            except Exception as exc:
                logger.warning("[microsoft] JSON error: %s", exc)
                continue

            seen: set[str] = set()
            for job in jobs:
                job_id = str(job.get("jobId") or "")
                if job_id in seen:
                    continue
                seen.add(job_id)
                parsed = self._parse_job(job)
                if parsed:
                    results.append(parsed)

            await self._delay(1.0, 2.0)

        # Deduplicate by URL
        unique: dict[str, dict] = {}
        for r in results:
            unique[r["url"]] = r

        logger.info("[microsoft] Scraped %d opportunities", len(unique))
        return list(unique.values())

    def _parse_job(self, job: dict) -> dict | None:
        try:
            title = (job.get("title") or "").strip()
            if not title:
                return None

            job_id = job.get("jobId") or ""
            url = f"https://jobs.microsoft.com/en-us/job/{job_id}" if job_id else \
                  "https://jobs.microsoft.com/"

            location   = job.get("primaryLocation") or job.get("location") or "Global"
            discipline = job.get("discipline") or ""
            sub_disc   = job.get("subDiscipline") or ""

            tags = [t for t in [discipline, sub_disc] if t]

            description = (
                f"{job.get('jobSummary') or ''}"
            ).strip()[:800] or f"Microsoft position: {title}."

            requirements = (job.get("qualifications") or "")[:400]

            return {
                "platform":     self.platform,
                "title":        title,
                "company":      "Microsoft",
                "url":          url,
                "description":  description,
                "requirements": requirements,
                "deadline":     None,
                "location":     location,
                "stipend":      "",
                "tags":         tags,
            }
        except Exception as exc:
            logger.debug("[microsoft] parse error: %s", exc)
            return None
