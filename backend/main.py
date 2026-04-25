# ─────────────────────────────────────────────────────────────────
# main.py — FastAPI application entry point
# Registers all API routes, starts the APScheduler, and initialises
# the SQLite database on startup via lifespan context manager.
#
# Routes:
#   Profile   : GET/POST/PUT  /api/profile
#   Opportunities: GET /api/opportunities, GET/DELETE /api/opportunities/{id}
#   Agent     : POST /api/agent/run, GET /api/agent/status/{id},
#               GET /api/agent/logs
#   Email     : POST /api/email/send-digest
# ─────────────────────────────────────────────────────────────────

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import date, datetime
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from backend.config import get_settings
from backend.db.database import get_db, init_db
from backend.db.models import Profile, Opportunity, RunLog
from backend.agent.runner import run_pipeline
from backend.email.digest import send_digest
from backend.scheduler import start_scheduler, stop_scheduler
from backend import glm_status
from backend.ai_provider import get_provider, set_provider
from backend import progress as run_progress

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger(__name__)
settings = get_settings()


# ── Robust GLM JSON extractor ───────────────────────────────────────────────
def _get_raw(msg) -> str:
    """
    Pull text from a GLM response message, checking both
    content (normal) and reasoning_content (reasoning model).
    """
    content   = (msg.content or "").strip()
    reasoning = (getattr(msg, "reasoning_content", "") or "").strip()
    return content or reasoning


def _extract_json(raw: str) -> dict:
    """
    Robustly extract the first JSON object from a GLM response string.
    Handles:
      - Wrapped in ```json ... ``` or ``` ... ``` code fences
      - Prefixed/suffixed with explanation text
      - Direct JSON string
      - Nested JSON within reasoning text
    Raises ValueError if nothing parseable is found.
    """
    import json as _json
    import re   as _re

    if not raw:
        raise ValueError("Empty GLM response")

    # 1. Strip markdown code fences (```json ... ``` or ``` ... ```)
    stripped = _re.sub(r"```(?:json)?\s*", "", raw).replace("```", "").strip()

    # 2. Try the whole stripped string directly
    try:
        result = _json.loads(stripped)
        if isinstance(result, dict):
            return result
    except _json.JSONDecodeError:
        pass

    # 3. Find the first {...} block using greedy DOTALL match
    match = _re.search(r"\{.*\}", stripped, _re.DOTALL)
    if match:
        try:
            result = _json.loads(match.group())
            if isinstance(result, dict):
                return result
        except _json.JSONDecodeError:
            pass

    # 4. Walk character by character to find a balanced { ... } (handles nested objects)
    depth, start = 0, -1
    for i, ch in enumerate(stripped):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}" and depth > 0:
            depth -= 1
            if depth == 0 and start != -1:
                candidate = stripped[start:i + 1]
                try:
                    result = _json.loads(candidate)
                    if isinstance(result, dict):
                        return result
                except _json.JSONDecodeError:
                    pass
                break

    raise ValueError(f"No valid JSON object found in GLM response. First 300 chars: {raw[:300]!r}")



# ── Lifespan ──────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Clean up zombie runs left over from a previous backend crash / restart
    _cleanup_zombie_runs()
    start_scheduler()
    logger.info("OpportunityScout API started")
    yield
    stop_scheduler()


def _cleanup_zombie_runs():
    """Mark any 'running' RunLog entries as failed — they can't still be
    running because we just started a fresh process."""
    from backend.db.database import SessionLocal
    from backend.db.models import RunLog
    db = SessionLocal()
    try:
        stuck = db.query(RunLog).filter(RunLog.status == "running").all()
        if stuck:
            for r in stuck:
                r.status = "failed"
                r.finished_at = datetime.utcnow()
                r.error_message = "Killed: backend restarted while run was in progress"
            db.commit()
            logger.info("Cleaned up %d zombie run(s) from previous session", len(stuck))
    finally:
        db.close()


# ── App ───────────────────────────────────────────────────────────

app = FastAPI(
    title="OpportunityScout API",
    description="AI-powered opportunity discovery for students",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════════
# Pydantic schemas
# ═══════════════════════════════════════════════════════════════════

class ProfileIn(BaseModel):
    name: str = ""
    email: str = ""
    cgpa: Optional[float] = None
    skills: list[str] = []
    preferred_roles: list[str] = []
    preferred_locations: list[str] = []
    resume_text: str = ""


class ProfileOut(ProfileIn):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OpportunityOut(BaseModel):
    id: int
    platform: str
    title: str
    company: Optional[str]
    url: str
    description: Optional[str]
    requirements: Optional[str]
    deadline: Optional[date]
    location: Optional[str]
    stipend: Optional[str]
    tags: list[str]
    eligibility_score: Optional[float]
    eligibility_reason: Optional[str]
    rank: Optional[int]
    is_eligible: bool
    scraped_at: Optional[datetime]
    is_sent: bool

    class Config:
        from_attributes = True

    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    from pydantic import field_validator

    @field_validator("tags", mode="before")
    @classmethod
    def sanitize_tags(cls, v):
        """Coerce tag items to strings — handles Amazon's dict tags like
        {'label': 'team-sde-primary', ...} that were stored in old runs."""
        if not isinstance(v, list):
            return []
        result = []
        for item in v:
            if isinstance(item, str):
                result.append(item)
            elif isinstance(item, dict):
                # Extract 'label' or first string value found
                label = item.get("label") or item.get("name") or item.get("title") or ""
                if label:
                    result.append(str(label))
        return result


class RunLogOut(BaseModel):
    id: int
    started_at: datetime
    finished_at: Optional[datetime]
    status: str
    opportunities_found: int
    opportunities_eligible: int
    error_message: Optional[str]

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════
# Profile routes
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/profile", response_model=ProfileOut, tags=["Profile"])
def get_profile(db: Session = Depends(get_db)):
    profile = db.query(Profile).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No profile found. Create one first.")
    return profile


@app.post("/api/profile", response_model=ProfileOut, status_code=201, tags=["Profile"])
def create_profile(data: ProfileIn, db: Session = Depends(get_db)):
    existing = db.query(Profile).first()
    if existing:
        raise HTTPException(status_code=409, detail="Profile already exists. Use PUT to update.")
    profile = Profile(**data.model_dump())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@app.put("/api/profile", response_model=ProfileOut, tags=["Profile"])
def update_profile(data: ProfileIn, db: Session = Depends(get_db)):
    profile = db.query(Profile).first()
    if not profile:
        profile = Profile(**data.model_dump())
        db.add(profile)
    else:
        for field, value in data.model_dump().items():
            setattr(profile, field, value)
        profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)
    return profile


@app.post("/api/profile/parse-resume", tags=["Profile"])
async def parse_resume(file: UploadFile = File(...)):
    """
    Upload a PDF resume → extract text → ask GLM to parse structured fields.
    Returns: { name, email, cgpa, skills, preferred_roles, resume_text }
    """
    import io, json, re
    import pdfplumber
    from openai import OpenAI

    # 1. Validate file type
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # 2. Extract text from PDF
    try:
        raw_bytes = await file.read()
        text_pages = []
        with pdfplumber.open(io.BytesIO(raw_bytes)) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text_pages.append(t)
        resume_text = "\n".join(text_pages).strip()
    except Exception as exc:
        logger.error("PDF extraction failed: %s", exc)
        raise HTTPException(status_code=422, detail=f"Could not read PDF: {exc}")

    if not resume_text:
        raise HTTPException(status_code=422, detail="PDF appears to have no extractable text (scanned image?).")

    # 3. Trim to ~4000 chars so we don't overflow the prompt
    resume_trimmed = resume_text[:4000]

    # 4. Ask NVIDIA/GLM to extract structured fields
    provider = get_provider()
    if provider == "glm":
        _api_key  = settings.zhipuai_api_key
        _base_url = settings.zhipuai_base_url
        _model    = settings.zhipuai_model
    else:
        _api_key  = settings.nvidia_api_key
        _base_url = settings.nvidia_base_url
        _model    = settings.nvidia_model

    prompt = (
        "Extract the following fields from this resume text. "
        "Return ONLY a raw JSON object — no markdown, no explanation:\n"
        '{"name": "Full Name or empty string", '
        '"email": "email or empty string", '
        '"cgpa": numeric float or null, '
        '"skills": ["list", "of", "technical", "skills"], '
        '"preferred_roles": ["inferred", "career", "roles"]}\n\n'
        f"Resume:\n{resume_trimmed}"
    )

    try:
        client = OpenAI(api_key=_api_key, base_url=_base_url)
        _call_id = glm_status.acquire("Resume parse")
        try:
            response = client.chat.completions.create(
                model=_model,
                messages=[
                    {"role": "system", "content": "You extract structured data from resumes. Always reply with ONLY a JSON object."},
                    {"role": "user",   "content": prompt},
                ],
                temperature=0.1,
                top_p=0.95,
                max_tokens=4096,
            )
        finally:
            glm_status.release(_call_id)
        msg = response.choices[0].message
        raw = _get_raw(msg)
        logger.debug("[parse-resume] GLM raw (first 400): %s", raw[:400])

        # Robust JSON extraction — handles markdown fences, reasoning models, etc.
        parsed = _extract_json(raw)
    except Exception as exc:
        logger.error("GLM resume parse failed: %s", exc)
        return JSONResponse({
            "name": "", "email": "", "cgpa": None,
            "skills": [], "preferred_roles": [],
            "resume_text": resume_text,
            "warning": "AI extraction failed — resume text extracted, fill fields manually."
        })

    return {
        "name":            str(parsed.get("name") or "").strip(),
        "email":           str(parsed.get("email") or "").strip(),
        "cgpa":            float(parsed["cgpa"]) if parsed.get("cgpa") else None,
        "skills":          [s for s in (parsed.get("skills") or []) if isinstance(s, str)][:30],
        "preferred_roles": [r for r in (parsed.get("preferred_roles") or []) if isinstance(r, str)][:10],
        "resume_text":     resume_text,   # full text for AI matching
    }


# ═══════════════════════════════════════════════════════════════════
# Opportunity routes
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/opportunities", response_model=list[OpportunityOut], tags=["Opportunities"])
def list_opportunities(
    platform: Optional[str] = Query(None),
    eligible: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    q = db.query(Opportunity)
    if platform:
        q = q.filter(Opportunity.platform == platform)
    if eligible is not None:
        q = q.filter(Opportunity.is_eligible == eligible)
    if search:
        like = f"%{search}%"
        q = q.filter(
            Opportunity.title.ilike(like) | Opportunity.company.ilike(like)
        )
    q = q.order_by(Opportunity.rank.asc().nulls_last(), Opportunity.scraped_at.desc())
    return q.offset(offset).limit(limit).all()


@app.get("/api/opportunities/{opp_id}", response_model=OpportunityOut, tags=["Opportunities"])
def get_opportunity(opp_id: int, db: Session = Depends(get_db)):
    opp = db.query(Opportunity).get(opp_id)
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return opp


@app.post("/api/opportunities/{opp_id}/tailor", tags=["Opportunities"])
def tailor_opportunity(opp_id: int, db: Session = Depends(get_db)):
    """
    Analyse a specific opportunity against the user's resume and profile.
    Returns:
      matching_skills  — resume skills that match this job
      missing_skills   — keywords in the job not found in the resume
      bullet_points    — 2-3 resume bullet points to highlight for this role
      pitch            — one-line cover letter opening sentence
      tip              — one actionable application tip
    """
    import json, re
    from openai import OpenAI

    opp = db.query(Opportunity).get(opp_id)
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    profile = db.query(Profile).first()
    if not profile:
        raise HTTPException(
            status_code=400,
            detail="No profile found. Set up your profile first."
        )

    # Build compact representations
    profile_snippet = (
        f"Name: {profile.name}\n"
        f"Skills: {', '.join(profile.skills or [])}\n"
        f"Preferred roles: {', '.join(profile.preferred_roles or [])}\n"
        f"CGPA: {profile.cgpa or 'N/A'}\n"
        f"Resume excerpt: {(profile.resume_text or '')[:1500]}"
    )

    opp_snippet = (
        f"Title: {opp.title}\n"
        f"Company: {opp.company or 'Unknown'}\n"
        f"Platform: {opp.platform}\n"
        f"Requirements: {(opp.requirements or '')[:600]}\n"
        f"Description: {(opp.description or '')[:400]}\n"
        f"Tags: {', '.join(opp.tags or [])}"
    )

    prompt = (
        "You are an expert career coach helping a student tailor their application.\n\n"
        f"=== STUDENT PROFILE ===\n{profile_snippet}\n\n"
        f"=== JOB / OPPORTUNITY ===\n{opp_snippet}\n\n"
        "Analyse this and return ONLY a raw JSON object (no markdown):\n"
        "{\n"
        '  "matching_skills": ["skill1", "skill2"],   // student skills that directly match this role\n'
        '  "missing_skills":  ["skill3", "skill4"],   // important job keywords missing from the resume\n'
        '  "bullet_points":   ["bullet1", "bullet2", "bullet3"],  // 2-3 strong resume bullet points the student can add/emphasise\n'
        '  "pitch":           "One compelling opening sentence for a cover letter.",\n'
        '  "tip":             "One specific actionable tip to improve the application."\n'
        "}"
    )

    try:
        _provider = get_provider()
        if _provider == "glm":
            _api_key  = settings.zhipuai_api_key
            _base_url = settings.zhipuai_base_url
            _model    = settings.zhipuai_model
        else:
            _api_key  = settings.nvidia_api_key
            _base_url = settings.nvidia_base_url
            _model    = settings.nvidia_model

        client = OpenAI(api_key=_api_key, base_url=_base_url)
        _call_id = glm_status.acquire("Job tailor")
        try:
            response = client.chat.completions.create(
                model=_model,
                messages=[
                    {"role": "system", "content": "You are a career coach. Reply with ONLY a JSON object, no markdown."},
                    {"role": "user",   "content": prompt},
                ],
                temperature=0.3,
                top_p=0.95,
                max_tokens=8192,
            )
        finally:
            glm_status.release(_call_id)
        msg = response.choices[0].message
        raw = _get_raw(msg)
        logger.debug("[tailor] GLM raw (first 400): %s", raw[:400])

        # Robust JSON extraction — handles markdown fences, reasoning models, etc.
        data = _extract_json(raw)

        return {
            "opportunity_id":  opp_id,
            "title":           opp.title,
            "company":         opp.company or "",
            "matching_skills": [s for s in (data.get("matching_skills") or []) if isinstance(s, str)],
            "missing_skills":  [s for s in (data.get("missing_skills")  or []) if isinstance(s, str)],
            "bullet_points":   [b for b in (data.get("bullet_points")   or []) if isinstance(b, str)],
            "pitch":           str(data.get("pitch") or ""),
            "tip":             str(data.get("tip")   or ""),
        }

    except Exception as exc:
        logger.error("Tailor endpoint failed for opp %d: %s", opp_id, exc)
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {exc}")


# ═══════════════════════════════════════════════════════════════════
# GLM status route
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/glm/status", tags=["GLM"])
def get_glm_status():
    """
    Returns the current GLM API concurrency state.
    Frontend polls this every second to show a global indicator.
    Response: { active: bool, count: int, labels: [...], summary: str|null }
    """
    return glm_status.status()



@app.delete("/api/opportunities", tags=["Opportunities"])
def delete_all_opportunities(db: Session = Depends(get_db)):
    """Delete every opportunity in the database."""
    deleted = db.query(Opportunity).delete()
    db.commit()
    return {"deleted": deleted, "message": f"Removed {deleted} opportunities."}


@app.delete("/api/opportunities/{opp_id}", status_code=204, tags=["Opportunities"])
def delete_opportunity(opp_id: int, db: Session = Depends(get_db)):
    opp = db.query(Opportunity).get(opp_id)
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    db.delete(opp)
    db.commit()



# ═══════════════════════════════════════════════════════════════════
# Agent routes
# ═══════════════════════════════════════════════════════════════════

# Global storage for background run state
_active_run: dict = {}


async def _background_pipeline(db_session_factory, run_id_holder: list):
    """Runs the pipeline in background and stores the run_id."""
    from backend.db.database import SessionLocal
    db = SessionLocal()
    try:
        run_id = await run_pipeline(db)
        run_id_holder.append(run_id)
    finally:
        db.close()


class RunConfig(BaseModel):
    max_process: Optional[int] = 50  # None = process every unscored opportunity


@app.post("/api/agent/run", tags=["Agent"])
async def trigger_agent(
    background_tasks: BackgroundTasks,
    config: RunConfig = RunConfig(),
    db: Session = Depends(get_db),
):
    """Trigger the full scrape → check → rank pipeline in the background."""
    run_log = RunLog(started_at=datetime.utcnow(), status="running")
    db.add(run_log)
    db.commit()
    db.refresh(run_log)
    run_id = run_log.id

    async def _run(rid: int, max_process: Optional[int]):
        from backend.db.database import SessionLocal
        db2 = SessionLocal()
        try:
            await run_pipeline(db2, existing_run_id=rid, max_process=max_process)
        except Exception as exc:
            logger.error("Background pipeline error: %s", exc)
            try:
                log_row = db2.query(RunLog).filter(RunLog.id == rid).first()
                if log_row and log_row.status == "running":
                    log_row.status = "failed"
                    log_row.finished_at = datetime.utcnow()
                    log_row.error_message = str(exc)
                    db2.commit()
            except Exception:
                pass
        finally:
            db2.close()

    background_tasks.add_task(_run, run_id, config.max_process)
    return {"run_log_id": run_id, "status": "started", "max_process": config.max_process}



@app.get("/api/agent/status/{run_id}", response_model=RunLogOut, tags=["Agent"])
def agent_status(run_id: int, db: Session = Depends(get_db)):
    # Use filter().first() (not .get()) to bypass SQLAlchemy identity map
    # and always get a fresh read from PostgreSQL
    log = db.query(RunLog).filter(RunLog.id == run_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Run log not found")
    return log


@app.get("/api/agent/logs", response_model=list[RunLogOut], tags=["Agent"])
def agent_logs(db: Session = Depends(get_db)):
    return db.query(RunLog).order_by(RunLog.started_at.desc()).limit(10).all()


@app.get("/api/agent/progress/{run_id}", tags=["Agent"])
def agent_progress(run_id: int):
    """Return in-memory live progress log for a running pipeline."""
    return {"run_id": run_id, "logs": run_progress.get_logs(run_id)}



# ═══════════════════════════════════════════════════════════════════
# Email routes
# ═══════════════════════════════════════════════════════════════════

@app.post("/api/email/send-digest", tags=["Email"])
def trigger_digest(db: Session = Depends(get_db)):
    try:
        send_digest(db)
        return {"message": "Digest sent successfully"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ═══════════════════════════════════════════════════════════════════
# Config routes
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/config/provider", tags=["Config"])
def get_active_provider():
    """Return the currently active AI provider."""
    return {"provider": get_provider()}


@app.post("/api/config/provider", tags=["Config"])
def set_active_provider(body: dict):
    """Set the active AI provider ('nvidia' or 'glm')."""
    provider = body.get("provider", "")
    try:
        new = set_provider(provider)
        logger.info("AI provider switched to: %s", new)
        return {"provider": new}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ── Dev entry point ────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
