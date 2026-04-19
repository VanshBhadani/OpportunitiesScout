# ─────────────────────────────────────────────────────────────────
# scrapers/internshala.py — Internshala internship scraper
# Uses HTML scraping (server-side rendered).
# Real CSS classes confirmed from live site inspection:
#   card: .individual_internship  |  link: .job-title-href
#   title: .job-internship-name   |  company: .company_name
#   stipend: .stipend             |  location: .locations
#   skills: .job_skill            |  meta: .individual_internship_details
#
# Deadlines are on detail pages (.apply_by), fetched concurrently.
# ─────────────────────────────────────────────────────────────────

import asyncio
import logging
import re
from datetime import datetime
from typing import Any

from bs4 import BeautifulSoup
from backend.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://internshala.com"

# "17 May' 26" → parse format
_DEADLINE_PATTERNS = [
    r"(\d{1,2}\s+\w+'\s*\d{2})",   # 17 May' 26
    r"(\d{1,2}\s+\w+\s+\d{4})",    # 17 May 2026
]


def _parse_internshala_date(raw: str) -> str | None:
    """
    Parse strings like "APPLY BY17 May' 26" or "17 May' 26" → "2026-05-17"
    """
    raw = raw.replace("APPLY BY", "").strip()
    for pattern in _DEADLINE_PATTERNS:
        m = re.search(pattern, raw)
        if m:
            candidate = m.group(1).strip()
            # Normalise "May' 26" → "May 2026"
            candidate = re.sub(r"'\s*(\d{2})$", r" 20\1", candidate)
            for fmt in ("%d %b %Y", "%d %B %Y"):
                try:
                    return datetime.strptime(candidate, fmt).date().isoformat()
                except ValueError:
                    continue
    return None


class IntershalaScraper(BaseScraper):
    platform = "internshala"

    async def scrape(self) -> list[dict[str, Any]]:
        results: list[dict] = []
        try:
            urls = [
                f"{BASE_URL}/internships/",
                f"{BASE_URL}/internships/page-2/",
            ]
            for url in urls:
                resp = await self._get(url)
                if resp is None:
                    continue
                parsed = self._parse_page(resp.text)
                results.extend(parsed)
                logger.debug("[internshala] %s → %d cards", url, len(parsed))
                await self._delay()
        except Exception as exc:
            logger.error("[internshala] Unexpected error: %s", exc)

        # ── Fetch deadlines concurrently ──────────────────────────
        # Only fetch for items that have a detail URL
        items_with_url = [r for r in results if r.get("url")]
        if items_with_url:
            logger.info("[internshala] Fetching deadlines for %d items concurrently…", len(items_with_url))
            deadlines = await self._fetch_deadlines_concurrent(items_with_url)
            for item, deadline in zip(items_with_url, deadlines):
                item["deadline"] = deadline

        logger.info("[internshala] Scraped %d opportunities", len(results))
        return results

    async def _fetch_deadlines_concurrent(self, items: list[dict]) -> list[str | None]:
        """Fetch all detail pages concurrently with a semaphore to avoid hammering the server."""
        sem = asyncio.Semaphore(8)   # max 8 parallel requests

        async def fetch_one(url: str) -> str | None:
            async with sem:
                try:
                    resp = await self._get(url)
                    if resp is None:
                        return None
                    soup = BeautifulSoup(resp.text, "lxml")
                    el = soup.select_one(".apply_by")
                    if el:
                        return _parse_internshala_date(el.get_text(strip=True))
                except Exception as exc:
                    logger.debug("[internshala] deadline fetch error for %s: %s", url, exc)
                return None

        tasks = [fetch_one(item["url"]) for item in items]
        return list(await asyncio.gather(*tasks))

    # ── Listing page parsing ─────────────────────────────────────

    def _parse_page(self, html: str) -> list[dict]:
        soup = BeautifulSoup(html, "lxml")
        cards = soup.select(".individual_internship")
        items: list[dict] = []

        for card in cards:
            try:
                # Title + URL
                title_el = card.select_one(".job-title-href") or card.select_one(".job-internship-name")
                title = title_el.get_text(strip=True) if title_el else ""

                url = ""
                anchor = title_el if title_el and title_el.name == "a" else None
                if anchor is None and title_el:
                    anchor = title_el.find_parent("a")
                if anchor is None:
                    anchor = card.select_one("a.job-title-href") or card.select_one("a[href*='/internship/']")
                if anchor and anchor.get("href"):
                    href = anchor["href"]
                    url = href if href.startswith("http") else f"{BASE_URL}{href}"

                # Company — strip nested badge text
                company_el = card.select_one(".company_name") or card.select_one(".company-name")
                if company_el:
                    for badge in company_el.select(".actively-hiring-badge, .status-success, span.badge"):
                        badge.decompose()
                    company = company_el.get_text(strip=True)
                else:
                    company = ""

                # Location
                loc_el = card.select_one(".locations")
                location = loc_el.get_text(" ", strip=True) if loc_el else "Remote"

                # Stipend
                stipend_el = card.select_one(".stipend")
                stipend = stipend_el.get_text(strip=True) if stipend_el else ""

                # Skills / tags
                skill_els = card.select(".job_skill")
                tags = [s.get_text(strip=True) for s in skill_els if s.get_text(strip=True)]

                # Duration / description from meta row
                meta_el = card.select_one(".individual_internship_details")
                description = meta_el.get_text(" ", strip=True)[:400] if meta_el else ""

                if not title:
                    continue

                items.append({
                    "platform": self.platform,
                    "title": title,
                    "company": company,
                    "url": url,
                    "description": description,
                    "requirements": "",
                    "deadline": None,   # filled in by _fetch_deadlines_concurrent
                    "location": location,
                    "stipend": stipend,
                    "tags": tags,
                })
            except Exception as exc:
                logger.debug("[internshala] Card parse error: %s", exc)
                continue

        return items
