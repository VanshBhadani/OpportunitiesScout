# ─────────────────────────────────────────────────────────────────
# agent/ranker.py — Opportunity scoring and ranking
# Score = (eligibility_score * 0.5) + (deadline_urgency * 0.3)
#         + (stipend_score * 0.2)
# Assigns integer rank (1 = best) to each opportunity, sorts list.
# ─────────────────────────────────────────────────────────────────

import re
import logging
from datetime import date
from typing import Any

logger = logging.getLogger(__name__)

# ── Scoring helpers ────────────────────────────────────────────────

def _deadline_urgency(deadline) -> float:
    """Return urgency score 0–1 based on days until deadline."""
    if deadline is None:
        return 0.1
    try:
        if isinstance(deadline, str):
            from datetime import datetime
            deadline = datetime.fromisoformat(deadline).date()
        days_left = (deadline - date.today()).days
        if days_left < 0:
            return 0.0   # already passed
        if days_left < 7:
            return 1.0
        if days_left < 14:
            return 0.7
        if days_left < 30:
            return 0.4
        return 0.1
    except Exception:
        return 0.1


def _stipend_score(stipend_str: str | None) -> float:
    """Normalize stipend string to a 0–1 score."""
    if not stipend_str:
        return 0.0
    # Extract the first number found (handles ₹10,000 / $500 etc.)
    numbers = re.findall(r"[\d,]+", stipend_str.replace(",", ""))
    if not numbers:
        return 0.05  # non-monetary prize / mention
    amount = int(numbers[0])
    # Normalise: cap at ₹100,000 (~$1200) or equivalent
    return min(amount / 100_000, 1.0)


# ── Main ranking function ─────────────────────────────────────────

def rank_opportunities(opportunities: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Score each opportunity and sort by composite score descending.
    Modifies dicts in-place (adds `rank` key) and returns sorted list.
    """
    for opp in opportunities:
        e_score = float(opp.get("eligibility_score") or 0.0)
        urgency = _deadline_urgency(opp.get("deadline"))
        s_score = _stipend_score(opp.get("stipend") or "")

        composite = (e_score * 0.5) + (urgency * 0.3) + (s_score * 0.2)
        opp["_composite"] = round(composite, 4)

    sorted_opps = sorted(opportunities, key=lambda x: x["_composite"], reverse=True)

    for rank_idx, opp in enumerate(sorted_opps, start=1):
        opp["rank"] = rank_idx
        opp.pop("_composite", None)

    logger.info("Ranked %d opportunities", len(sorted_opps))
    return sorted_opps
