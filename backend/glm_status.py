# ─────────────────────────────────────────────────────────────────
# backend/glm_status.py — Global GLM concurrency tracker
#
# Since Z.AI allows only 1 concurrent GLM call, this module
# tracks how many GLM calls are currently in-flight and what
# they're doing. The frontend polls /api/glm/status every second
# to show a persistent "GLM busy" indicator.
# ─────────────────────────────────────────────────────────────────

import threading

_lock = threading.Lock()
_active: dict[str, str] = {}   # {call_id: label}  e.g. {"pipeline-1": "Eligibility check"}
_counter = 0                   # monotonic id for each call


def acquire(label: str) -> str:
    """
    Register a new GLM call. Returns a call_id you MUST pass to release().
    label — human-readable reason, e.g. "Eligibility check", "Resume parse", "Job tailor"
    """
    global _counter
    with _lock:
        _counter += 1
        call_id = str(_counter)
        _active[call_id] = label
    return call_id


def release(call_id: str) -> None:
    """Deregister a finished GLM call."""
    with _lock:
        _active.pop(call_id, None)


def status() -> dict:
    """Return current status snapshot (safe to call from any thread)."""
    with _lock:
        active_copy = dict(_active)
    count = len(active_copy)
    labels = list(active_copy.values())
    return {
        "active": count > 0,
        "count": count,
        # What are the active calls doing?  e.g. "Eligibility check", "Resume parse"
        "labels": labels,
        # Single human-readable summary for the UI pill
        "summary": labels[0] if count == 1 else f"{count} GLM calls" if count > 1 else None,
    }
