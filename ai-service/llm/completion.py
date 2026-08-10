"""Fallback-aware LLM entrypoint (AI-006).

``complete_json`` is the single call the rest of the app makes for structured
JSON completions. It tries the primary provider (Groq) first and, only when
Groq is unavailable, falls back to a secondary HOSTED provider (an
OpenAI-compatible API — never a local model, per ADR-015). Per ADR-002 the
fallback exists to absorb transient primary-provider outages (rate limits/429
— recall the 30 req/min free-tier cap — connection errors, 5xx, or a missing
key), not to routinely second-guess good Groq output.
"""

import json
import logging

import groq

from config import LLM_FALLBACK_ENABLED
from .groq_client import GroqConfigError, groq_complete_json
from .http_llm_client import fallback_complete_json

logger = logging.getLogger(__name__)


class LLMError(RuntimeError):
    """Raised when the primary provider fails and no fallback can serve the call."""


# Primary-provider failures that mean "Groq is unavailable, try the fallback."
# groq.APIError is the base for connection/status/rate-limit/5xx errors;
# GroqConfigError is our own missing-key signal; JSONDecodeError covers Groq
# returning a non-JSON body despite JSON mode. Anything else (e.g. a genuine
# bug in a caller) propagates unchanged rather than being masked by a fallback.
_FALLBACKABLE = (GroqConfigError, groq.APIError, json.JSONDecodeError)


def complete_json(system: str, user: str, temperature: float = 0.3) -> dict:
    """Structured JSON completion via Groq, falling back to a hosted secondary API.

    Signature-compatible with the original Groq-only ``complete_json`` so every
    existing caller and test is unaffected.
    """
    try:
        return groq_complete_json(system, user, temperature=temperature)
    except _FALLBACKABLE as primary_exc:
        if not LLM_FALLBACK_ENABLED:
            raise LLMError(
                f"Groq primary provider failed and fallback is disabled: {primary_exc}"
            ) from primary_exc
        logger.warning(
            "Groq primary provider failed (%s); falling back to the hosted secondary API.",
            primary_exc,
        )
        try:
            return fallback_complete_json(system, user, temperature=temperature)
        except Exception as fallback_exc:
            raise LLMError(
                f"Both providers failed. Primary (Groq): {primary_exc}. "
                f"Fallback: {fallback_exc}."
            ) from fallback_exc
