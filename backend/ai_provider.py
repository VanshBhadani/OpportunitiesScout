# ─────────────────────────────────────────────────────────────────
# backend/ai_provider.py — Global AI provider selection
#
# Stores provider + optional custom config in a JSON file.
# Provider options: "nvidia" | "glm" | "custom"
# ─────────────────────────────────────────────────────────────────

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_STORE = Path(__file__).parent / ".ai_provider.json"
_VALID = {"nvidia", "glm", "custom"}
_DEFAULT = "nvidia"

_DEFAULT_DATA = {
    "provider": _DEFAULT,
    "custom_api_key": "",
    "custom_base_url": "https://integrate.api.nvidia.com/v1",
    "custom_model": "",
}


def _load() -> dict:
    try:
        if _STORE.exists():
            data = json.loads(_STORE.read_text())
            if data.get("provider") not in _VALID:
                data["provider"] = _DEFAULT
            return {**_DEFAULT_DATA, **data}
    except Exception:
        pass
    return dict(_DEFAULT_DATA)


def _save(data: dict) -> None:
    try:
        _STORE.write_text(json.dumps(data))
    except Exception as exc:
        logger.warning("Could not persist AI provider config: %s", exc)


def get_provider() -> str:
    """Return the active AI provider: 'nvidia', 'glm', or 'custom'."""
    return _load()["provider"]


def get_config() -> dict:
    """Return the full provider config dict."""
    return _load()


def set_provider(provider: str, custom_api_key: str = "", custom_base_url: str = "", custom_model: str = "") -> dict:
    """Set and persist the active AI provider + optional custom config."""
    if provider not in _VALID:
        raise ValueError(f"Invalid provider '{provider}'. Must be one of: {_VALID}")
    data = _load()
    data["provider"] = provider
    if provider == "custom":
        data["custom_api_key"] = custom_api_key or data.get("custom_api_key", "")
        data["custom_base_url"] = custom_base_url or data.get("custom_base_url", "https://integrate.api.nvidia.com/v1")
        data["custom_model"] = custom_model or data.get("custom_model", "")
    _save(data)
    return data
