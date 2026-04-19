# ─────────────────────────────────────────────────────────────────
# db/models.py — SQLAlchemy ORM table definitions
# Tables: Profile, Opportunity, RunLog
# ─────────────────────────────────────────────────────────────────

import json
from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Text, Date, DateTime, func
)
from sqlalchemy.types import TypeDecorator
from backend.db.database import Base


# ── Custom JSON column type ──────────────────────────────────────

class JSONList(TypeDecorator):
    """Stores Python list as JSON string in SQLite TEXT column."""
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return "[]"
        return json.dumps(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return []
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return []


# ── Profile ──────────────────────────────────────────────────────

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, default="")
    email = Column(String(200), nullable=False, default="")
    cgpa = Column(Float, nullable=True)
    skills = Column(JSONList, nullable=False, default=list)
    preferred_roles = Column(JSONList, nullable=False, default=list)
    preferred_locations = Column(JSONList, nullable=False, default=list)
    resume_text = Column(Text, nullable=True, default="")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


# ── Opportunity ───────────────────────────────────────────────────

class Opportunity(Base):
    __tablename__ = "opportunities"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String(50), nullable=False, index=True)   # internshala | unstop | devpost
    title = Column(String(500), nullable=False, default="")
    company = Column(String(300), nullable=True, default="")
    url = Column(Text, nullable=False, default="")
    description = Column(Text, nullable=True, default="")
    requirements = Column(Text, nullable=True, default="")
    deadline = Column(Date, nullable=True)
    location = Column(String(200), nullable=True, default="")
    stipend = Column(String(200), nullable=True, default="")     # raw string e.g. "₹10,000/month"
    tags = Column(JSONList, nullable=False, default=list)

    # AI fields
    eligibility_score = Column(Float, nullable=True, default=0.0)
    eligibility_reason = Column(Text, nullable=True, default="")
    rank = Column(Integer, nullable=True)
    is_eligible = Column(Boolean, nullable=False, default=False)

    scraped_at = Column(DateTime, server_default=func.now())
    is_sent = Column(Boolean, nullable=False, default=False)


# ── RunLog ────────────────────────────────────────────────────────

class RunLog(Base):
    __tablename__ = "run_logs"

    id = Column(Integer, primary_key=True, index=True)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    status = Column(String(20), nullable=False, default="running")  # running | completed | failed
    opportunities_found = Column(Integer, nullable=False, default=0)
    opportunities_eligible = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)
