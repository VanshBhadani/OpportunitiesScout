# ─────────────────────────────────────────────────────────────────
# scrapers/base.py — Abstract base class for all platform scrapers
# Defines shared httpx client config, random delay helper, and
# the interface every scraper must implement.
# ─────────────────────────────────────────────────────────────────

import asyncio
import random
import logging
from abc import ABC, abstractmethod
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# Realistic browser-like headers sent with every request
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Connection": "keep-alive",
    "DNT": "1",
}

TIMEOUT = httpx.Timeout(15.0, connect=10.0)


class BaseScraper(ABC):
    """
    Abstract base for all opportunity scrapers.
    Subclasses must implement `scrape()` and return a list of dicts
    conforming to the Opportunity model schema.
    """

    platform: str = "unknown"

    def __init__(self):
        self.client = httpx.AsyncClient(
            headers=DEFAULT_HEADERS,
            timeout=TIMEOUT,
            follow_redirects=True,
        )

    # ── Helpers ──────────────────────────────────────────────────

    async def _get(self, url: str, **kwargs) -> httpx.Response | None:
        """GET with error handling. Returns None on failure."""
        try:
            resp = await self.client.get(url, **kwargs)
            resp.raise_for_status()
            return resp
        except Exception as exc:
            logger.warning("[%s] GET %s failed: %s", self.platform, url, exc)
            return None

    @staticmethod
    async def _delay(min_s: float = 1.0, max_s: float = 2.5):
        """Random polite delay between requests."""
        await asyncio.sleep(random.uniform(min_s, max_s))

    async def close(self):
        await self.client.aclose()

    # ── Interface ─────────────────────────────────────────────────

    @abstractmethod
    async def scrape(self) -> list[dict[str, Any]]:
        """
        Scrape the platform and return a list of opportunity dicts.
        Must never raise — catch all exceptions and return [] on failure.
        """
        ...
