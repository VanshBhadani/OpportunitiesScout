# ─────────────────────────────────────────────────────────────────
# scheduler.py — APScheduler daily job runner (configurable)
# Default: 08:00 IST. Config stored in .scheduler_config.json.
# Exposed via GET/POST /api/scheduler/config → { enabled, hour, minute }
# ─────────────────────────────────────────────────────────────────

import asyncio
import json
import logging
from pathlib import Path
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None
_CONFIG_FILE = Path(__file__).parent / ".scheduler_config.json"
_JOB_ID = "daily_pipeline"

_DEFAULT_CONFIG = {"enabled": True, "hour": 8, "minute": 0}


# ── Config persistence ────────────────────────────────────────────

def load_config() -> dict:
    try:
        if _CONFIG_FILE.exists():
            data = json.loads(_CONFIG_FILE.read_text())
            return {
                "enabled": bool(data.get("enabled", True)),
                "hour":    int(data.get("hour", 8)),
                "minute":  int(data.get("minute", 0)),
            }
    except Exception:
        pass
    return dict(_DEFAULT_CONFIG)


def save_config(cfg: dict) -> None:
    try:
        _CONFIG_FILE.write_text(json.dumps(cfg))
    except Exception as exc:
        logger.warning("Could not persist scheduler config: %s", exc)


# ── Job ───────────────────────────────────────────────────────────

def _daily_job():
    """Synchronous wrapper — runs async pipeline then sends digest."""
    from backend.db.database import SessionLocal
    from backend.agent.runner import run_pipeline
    from backend.email.digest import send_digest

    db = SessionLocal()
    try:
        logger.info("[scheduler] Starting scheduled pipeline …")
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        run_id = loop.run_until_complete(run_pipeline(db))
        loop.close()
        logger.info("[scheduler] Pipeline finished, run_id=%s", run_id)
        send_digest(db)
        logger.info("[scheduler] Email digest sent")
    except Exception as exc:
        logger.error("[scheduler] Daily job failed: %s", exc)
    finally:
        db.close()


# ── Scheduler lifecycle ───────────────────────────────────────────

def start_scheduler():
    """Create and start the APScheduler instance using saved config."""
    global _scheduler
    cfg = load_config()
    _scheduler = BackgroundScheduler(timezone="Asia/Kolkata")

    if cfg["enabled"]:
        _scheduler.add_job(
            _daily_job,
            trigger=CronTrigger(hour=cfg["hour"], minute=cfg["minute"]),
            id=_JOB_ID,
            replace_existing=True,
        )
        logger.info(
            "Scheduler started — daily pipeline at %02d:%02d IST",
            cfg["hour"], cfg["minute"],
        )
    else:
        logger.info("Scheduler started — job DISABLED (no job scheduled)")

    _scheduler.start()


def stop_scheduler():
    """Gracefully shut down the scheduler."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


# ── Dynamic reschedule (called from API) ─────────────────────────

def apply_config(enabled: bool, hour: int, minute: int) -> dict:
    """
    Persist new config and live-update the running scheduler immediately.
    Returns the saved config dict.
    """
    cfg = {"enabled": enabled, "hour": hour, "minute": minute}
    save_config(cfg)

    if _scheduler and _scheduler.running:
        try:
            _scheduler.remove_job(_JOB_ID)
        except Exception:
            pass

        if enabled:
            _scheduler.add_job(
                _daily_job,
                trigger=CronTrigger(hour=hour, minute=minute),
                id=_JOB_ID,
                replace_existing=True,
            )
            logger.info(
                "[scheduler] Rescheduled → %02d:%02d IST (enabled)",
                hour, minute,
            )
        else:
            logger.info("[scheduler] Job disabled — removed from scheduler")

    return cfg
