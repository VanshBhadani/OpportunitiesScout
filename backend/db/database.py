# ─────────────────────────────────────────────────────────────────
# db/database.py — SQLAlchemy engine + session factory
# Provides a get_db() dependency for FastAPI route injection
# ─────────────────────────────────────────────────────────────────

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from backend.config import get_settings

settings = get_settings()

# connect_args differs per dialect:
# SQLite needs check_same_thread=False; PostgreSQL does not support it.
_is_sqlite = settings.database_url.startswith("sqlite")
_connect_args = {"check_same_thread": False} if _is_sqlite else {}

engine = create_engine(
    settings.database_url,
    connect_args=_connect_args,
    echo=False,
    # Connection pool tuning for Supabase/PostgreSQL (ignored by SQLite)
    pool_pre_ping=True,
    pool_recycle=300,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


def get_db():
    """FastAPI dependency that yields a DB session and closes it on teardown."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables if they don't exist yet."""
    from backend.db import models  # noqa: F401 — import triggers model registration
    Base.metadata.create_all(bind=engine)
