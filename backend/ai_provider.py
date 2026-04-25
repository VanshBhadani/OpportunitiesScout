# ─────────────────────────────────────────────────────────────────
# backend/ai_provider.py — Global AI provider selection
#
# Stores the active LLM provider in a file so it persists across
# backend restarts without needing a DB migration.
# ─────────────────────────────────────────────────────────────────

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_STORE = Path(__file__).parent / ".ai_provider.json"
_VALID = {"nvidia", "glm"}
_DEFAULT = "nvidia"


def get_provider() -> str:
    """Return the active AI provider: 'nvidia' or 'glm'."""
    try:
        if _STORE.exists():
            data = json.loads(_STORE.read_text())
            p = data.get("provider", _DEFAULT)
            return p if p in _VALID else _DEFAULT
    except Exception:
        pass
    return _DEFAULT


def set_provider(provider: str) -> str:
    """Set and persist the active AI provider. Returns the new value."""
    if provider not in _VALID:
        raise ValueError(f"Invalid provider '{provider}'. Must be one of: {_VALID}")
    try:
        _STORE.write_text(json.dumps({"provider": provider}))
    except Exception as exc:
        logger.warning("Could not persist AI provider: %s", exc)
    return provider
