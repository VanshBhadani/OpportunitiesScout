# ─────────────────────────────────────────────────────────────────
# scrapers/devpost.py — Devpost hackathon scraper using public API
# Endpoint: /api/hackathons (returns JSON with hackathon list)
# Fetches 2 pages, extracts title, prize, deadline, themes, URL.
# ─────────────────────────────────────────────────────────────────

import logging
import re
from typing import Any
from backend.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://devpost.com"
API = f"{BASE_URL}/api/hackathons"


class DevpostScraper(BaseScraper):
    platform = "devpost"

    async def scrape(self) -> list[dict[str, Any]]:
        results: list[dict] = []
        try:
            for page in range(1, 3):
                params = {
                    "page": page,
                    "challenge_type": "all",
                    "sort_by": "Submission Deadline",
                }
                resp = await self._get(API, params=params)
                if resp is None:
                    break
                try:
                    data = resp.json()
                    hackathons = data.get("hackathons", [])
                except Exception as exc:
                    logger.warning("[devpost] JSON parse error on p%d: %s", page, exc)
                    break

                for hack in hackathons:
                    parsed = self._parse_item(hack)
                    if parsed:
                        results.append(parsed)

                await self._delay()
        except Exception as exc:
            logger.error("[devpost] Unexpected error: %s", exc)

        logger.info("[devpost] Scraped %d opportunities", len(results))
        return results

    # ── Parsing ───────────────────────────────────────────────────

    def _parse_item(self, item: dict) -> dict | None:
        try:
            title = item.get("title", "").strip()
            if not title:
                return None

            url = item.get("url", "").strip()
            company = item.get("organization_name", "Devpost").strip() or "Devpost"

            # Prize — strip HTML tags from prize_amount string
            prize_raw = item.get("prize_amount", "") or ""
            stipend = re.sub(r"<[^>]+>", "", prize_raw).strip()

            # Deadline — parse from "Feb 26 - Apr 29, 2026" style string
            deadline = self._parse_deadline(item.get("submission_period_dates", ""))

            # Themes / tags
            themes = item.get("themes") or []
            tags = [t.get("name", "") for t in themes if t.get("name")]

            # Location
            loc = item.get("displayed_location", {}) or {}
            location = loc.get("location", "Online") or "Online"

            description = (
                f"Hackathon on Devpost. "
                f"{item.get('registrations_count', 0)} participants registered. "
                f"Status: {item.get('open_state', 'unknown')}."
            )

            return {
                "platform": self.platform,
                "title": title,
                "company": company,
                "url": url,
                "description": description,
                "requirements": "",
                "deadline": deadline,
                "location": location,
                "stipend": stipend,
                "tags": tags,
            }
        except Exception as exc:
            logger.debug("[devpost] Item parse error: %s", exc)
            return None

    @staticmethod
    def _parse_deadline(text: str) -> str | None:
        """
        Parse last date from strings like:
          "Feb 26 - Apr 29, 2026"
          "Apr 30, 2026"
        Returns ISO date string "YYYY-MM-DD" or None.
        """
        if not text:
            return None
        try:
            from datetime import datetime
            # Try to extract "Month DD, YYYY" from the end of the string
            match = re.search(r"([A-Za-z]+ \d{1,2},?\s*\d{4})\s*$", text)
            if match:
                for fmt in ("%b %d, %Y", "%b %d %Y", "%B %d, %Y"):
                    try:
                        return datetime.strptime(match.group(1).strip(), fmt).date().isoformat()
                    except ValueError:
                        continue
        except Exception:
            pass
        return None
