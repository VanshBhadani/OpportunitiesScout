# ─────────────────────────────────────────────────────────────────
# scheduler.py — APScheduler daily job runner
# Starts a BackgroundScheduler that fires the full pipeline +
# email digest at 08:00 every day.  Started from main.py lifespan.
# ─────────────────────────────────────────────────────────────────

import asyncio
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def _daily_job():
    """Synchronous wrapper that runs the async pipeline in a new event loop."""
    from backend.db.database import SessionLocal
    from backend.agent.runner import run_pipeline
    from backend.email.digest import send_digest

    db = SessionLocal()
    try:
        logger.info("[scheduler] Starting daily pipeline …")
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


def start_scheduler():
    """Create and start the APScheduler instance."""
    global _scheduler
    _scheduler = BackgroundScheduler(timezone="Asia/Kolkata")
    _scheduler.add_job(
        _daily_job,
        trigger=CronTrigger(hour=8, minute=0),
        id="daily_pipeline",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("Scheduler started — daily pipeline at 08:00 IST")


def stop_scheduler():
    """Gracefully shut down the scheduler."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
