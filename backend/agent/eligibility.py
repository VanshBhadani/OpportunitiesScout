# ─────────────────────────────────────────────────────────────────
# agent/eligibility.py — GLM eligibility checker via Z.AI API
#
# Uses the OpenAI-compatible SDK pointing at:
#   base_url = https://api.z.ai/api/paas/v4/
#   model    = glm-4.7-flash  (configured in config.py / .env)
#
# BATCH MODE (primary):
#   Pack up to 50 opportunities into ONE prompt → 1 API call → parse array
#   → 50× faster, saves almost all free-tier quota
#
# FALLBACK:
#   Individual call per opportunity (legacy, used only if batch fails)
# ─────────────────────────────────────────────────────────────────

import json
import logging
import re
from typing import Any

from openai import OpenAI
from backend.config import get_settings
from backend import glm_status
from backend.ai_provider import get_provider, get_config

logger = logging.getLogger(__name__)
settings = get_settings()

_DEFAULT = {"eligible": False, "score": 0.0, "reason": "Could not evaluate"}

# GLM-4.7-flash is a reasoning model: it spends many tokens "thinking" before
# producing output. For a batch of N items:
#   prompt tokens  ≈ N × 50
#   reasoning tokens≈ 1000-2000 (internal, not controllable)
#   output tokens  ≈ N × 30
# At N=50 this can exceed 6000 tokens, causing the model to truncate and
# return empty content. Keeping N ≤ 15 keeps total well under 4096.
SUB_BATCH_SIZE = 10


# ─── Client factory ──────────────────────────────────────────────────

def _client() -> OpenAI:
    """Return an OpenAI-compatible client for whichever provider is active."""
    cfg = get_config()
    provider = cfg["provider"]
    if provider == "custom":
        return OpenAI(
            api_key=cfg["custom_api_key"],
            base_url=cfg["custom_base_url"],
            max_retries=4,
            timeout=90.0,
        )
    if provider == "glm":
        return OpenAI(
            api_key=settings.zhipuai_api_key,
            base_url=settings.zhipuai_base_url,
            max_retries=4,
            timeout=90.0,
        )
    # default: nvidia
    return OpenAI(
        api_key=settings.nvidia_api_key,
        base_url=settings.nvidia_base_url,
        max_retries=4,
        timeout=90.0,
    )


def _model() -> str:
    cfg = get_config()
    provider = cfg["provider"]
    if provider == "custom":
        return cfg["custom_model"]
    return settings.zhipuai_model if provider == "glm" else settings.nvidia_model



# ─── Helpers ──────────────────────────────────────────────────────

def _profile_text(profile: dict) -> str:
    skills  = ", ".join(profile.get("skills") or []) or "not specified"
    roles   = ", ".join(profile.get("preferred_roles") or []) or "not specified"
    cgpa    = profile.get("cgpa") or "N/A"
    resume  = (profile.get("resume_text") or "")[:250]
    return f"Skills: {skills}\nRoles: {roles}\nCGPA: {cgpa}\nResume: {resume}"


def _compact(idx: int, opp: dict) -> dict:
    """Minimal dict to minimize token usage."""
    desc = (opp.get("requirements") or opp.get("description") or "")[:180]
    return {
        "i":    idx,
        "t":    opp.get("title", "")[:90],
        "c":    opp.get("company", "")[:50],
        "d":    desc,
        "tags": (opp.get("tags") or [])[:5],
    }


def _extract_array(text: str) -> list | None:
    """
    Robustly extract a JSON array from LLM output.
    Handles markdown fences, leading/trailing text, and minor formatting.
    """
    if not text:
        return None

    # 1. Strip common markdown wrappers
    cleaned = re.sub(r"```(?:json)?", "", text, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"```", "", cleaned).strip()

    # 2. Try to find outermost [ ... ] block
    start = cleaned.find("[")
    if start == -1:
        return None

    # Walk to find matching closing bracket
    depth = 0
    end = -1
    for i, ch in enumerate(cleaned[start:], start):
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                end = i
                break

    if end == -1:
        return None

    candidate = cleaned[start:end + 1]

    # 3. Try direct parse
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass

    # 4. Repair: remove trailing commas before ] or }
    repaired = re.sub(r",\s*([}\]])", r"\1", candidate)
    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        pass

    return None


# ═══════════════════════════════════════════════════════════════════
# PRIMARY: Batch evaluation
# ═══════════════════════════════════════════════════════════════════

def _call_glm_batch(profile_str: str, compact_opps: list[dict]) -> list[dict] | None:
    """
    Make ONE GLM API call for a sub-batch (≤ SUB_BATCH_SIZE items).
    Returns parsed list of {i, eligible, score, reason} or None on failure.
    """
    n = len(compact_opps)
    system_msg = (
        "You are a career advisor. "
        "You ALWAYS respond with ONLY a raw JSON array — no markdown, "
        "no code fences, no explanation, just the JSON array."
    )
    user_msg = (
        f"Student profile:\n{profile_str}\n\n"
        f"Evaluate ALL {n} opportunities below for this student.\n"
        f"For each opportunity output: i (same index), eligible (true/false), "
        f"score (0.0-1.0), reason (≤8 words).\n\n"
        f"Return format (ONLY this):\n"
        f'[{{"i":0,"eligible":true,"score":0.85,"reason":"Strong ML match"}}, ...]\n\n'
        f"Include ALL {n} items. Opportunities:\n"
        f"{json.dumps(compact_opps, ensure_ascii=False)}"
    )

    cli = _client()
    call_id = glm_status.acquire("Eligibility check")
    try:
        response = cli.chat.completions.create(
            model=_model(),
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user",   "content": user_msg},
            ],
            temperature=0.1,
            top_p=0.95,
            max_tokens=8192,
        )
    finally:
        glm_status.release(call_id)

    msg    = response.choices[0].message
    finish = response.choices[0].finish_reason
    tokens = getattr(response.usage, "total_tokens", "?")

    raw = (msg.content or "").strip()
    if not raw:
        raw = (getattr(msg, "reasoning_content", "") or "").strip()

    logger.info("[eligibility] sub-batch %d opps | finish=%s | tokens=%s", n, finish, tokens)
    if finish == "length":
        logger.warning("[eligibility] Hit max_tokens — consider reducing SUB_BATCH_SIZE")

    arr = _extract_array(raw)
    if arr is None:
        logger.warning("[eligibility] Parse failed. First 300 chars: %s", raw[:300])
    return arr


def batch_check_eligibility(
    profile: dict,
    opportunities: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Evaluate ALL opportunities using GLM, splitting into sub-batches of
    SUB_BATCH_SIZE (default 15) to stay within the reasoning model's token budget.

    50 opps  → 4 API calls  (vs 50 individual calls)
    Returns list of {eligible, score, reason} in the same order as input.
    """
    if not opportunities:
        return []

    profile_str  = _profile_text(profile)
    all_results: list[dict] = []
    total        = len(opportunities)
    n_calls      = 0

    for start in range(0, total, SUB_BATCH_SIZE):
        sub_opps = opportunities[start : start + SUB_BATCH_SIZE]
        n        = len(sub_opps)

        # Re-index from 0 within this sub-batch
        compact  = [_compact(i, opp) for i, opp in enumerate(sub_opps)]

        # Small pause between sub-batches — reduces hammering ZhipuAI's free tier
        if start > 0:
            import time; time.sleep(0.8)

        try:
            arr = _call_glm_batch(profile_str, compact)
            n_calls += 1

            if arr is None:
                all_results.extend([dict(_DEFAULT)] * n)
                continue

            # Build result_map by local index
            result_map: dict[int, dict] = {}
            for item in arr:
                if not isinstance(item, dict):
                    continue
                idx = item.get("i")
                if idx is None:
                    continue
                try:
                    result_map[int(idx)] = {
                        "eligible": bool(item.get("eligible", False)),
                        "score":    min(1.0, max(0.0, float(item.get("score", 0.0)))),
                        "reason":   str(item.get("reason", ""))[:200],
                    }
                except (ValueError, TypeError):
                    continue

            for i in range(n):
                all_results.append(result_map.get(i, dict(_DEFAULT)))

        except Exception as exc:
            logger.error("[eligibility] Sub-batch call failed: %s", exc)
            all_results.extend([dict(_DEFAULT)] * n)

    n_elig = sum(1 for r in all_results if r["eligible"])
    logger.info(
        "[eligibility] Done: %d/%d eligible | %d API calls for %d opps",
        n_elig, total, n_calls, total,
    )
    return all_results



# ═══════════════════════════════════════════════════════════════════
# FALLBACK: Per-item evaluation
# ═══════════════════════════════════════════════════════════════════

def _keyword_prefilter(profile: dict, opp: dict) -> bool:
    """Quick keyword check — skip LLM only if clearly irrelevant."""
    text = " ".join([
        opp.get("title", ""),
        opp.get("description", ""),
        opp.get("requirements", ""),
        " ".join(opp.get("tags") or []),
    ]).lower()

    terms = set(
        (s.lower() for s in (profile.get("skills") or []))
    ) | set(
        (r.lower() for r in (profile.get("preferred_roles") or []))
    )

    if len(text.strip()) < 30:
        return True
    for t in terms:
        if t and t in text:
            return True
    return len(terms) < 3


def check_eligibility(profile: dict, opportunity: dict) -> dict[str, Any]:
    """Single-item eligibility check (fallback / legacy)."""
    try:
        if not _keyword_prefilter(profile, opportunity):
            return {"eligible": False, "score": 0.0, "reason": "No keyword overlap"}

        cli = _client()
        prompt = (
            f"Profile:\n{_profile_text(profile)}\n\n"
            f"Opportunity:\n"
            f"Title: {opportunity.get('title', '')}\n"
            f"Company: {opportunity.get('company', '')}\n"
            f"Details: {(opportunity.get('requirements') or opportunity.get('description', ''))[:350]}\n"
            f"Tags: {', '.join(opportunity.get('tags') or [])}\n\n"
            "Reply with ONLY JSON (no markdown): "
            '{"eligible": true/false, "score": 0.0-1.0, "reason": "one short sentence"}'
        )

        response = cli.chat.completions.create(
            model=_model(),
            messages=[
                {"role": "system", "content": "Reply with ONLY a JSON object."},
                {"role": "user",   "content": prompt},
            ],
            temperature=0.1,
            max_tokens=2048,  # reasoning model needs room for thinking + output
        )
        msg = response.choices[0].message
        text = (msg.content or "").strip() or (getattr(msg, "reasoning_content", "") or "").strip()
        match = re.search(r"\{.*?\}", text, re.DOTALL)
        if not match:
            return dict(_DEFAULT)
        data = json.loads(match.group())
        return {
            "eligible": bool(data.get("eligible", False)),
            "score":    float(data.get("score", 0.0)),
            "reason":   str(data.get("reason", ""))[:200],
        }

    except Exception as exc:
        logger.error("[eligibility] Single check failed: %s", exc)
        return dict(_DEFAULT)
