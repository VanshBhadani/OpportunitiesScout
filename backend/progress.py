# backend/progress.py — In-memory progress log per run (no DB schema change needed)
from datetime import datetime

_store: dict[int, list[dict]] = {}


def init_run(run_id: int) -> None:
    _store[run_id] = []


def log(run_id: int, stage: str, message: str) -> None:
    if run_id not in _store:
        _store[run_id] = []
    _store[run_id].append({
        "stage": stage,
        "message": message,
        "ts": datetime.utcnow().isoformat(),
    })


def get_logs(run_id: int) -> list[dict]:
    return list(_store.get(run_id, []))


def cleanup_old(keep_last: int = 10) -> None:
    if len(_store) > keep_last:
        for k in sorted(_store.keys())[:-keep_last]:
            del _store[k]
