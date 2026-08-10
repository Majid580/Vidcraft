"""Fallback provider: any hosted OpenAI-compatible chat API (AI-006, ADR-015).

The secondary LLM used when Groq (primary) is unavailable. Deliberately a
REMOTE HTTP endpoint, never a local model — on-device inference slows the dev
machine and hurts UX (ADR-015). Speaks the OpenAI `/chat/completions` shape
with JSON mode, so it works unchanged against Groq (a second model), OpenRouter,
Together, Google Gemini's OpenAI-compat endpoint, OpenAI, etc. — the concrete
provider is pure env config (see config.FALLBACK_LLM_*). Uses httpx (already a
project dependency) rather than the openai SDK to avoid adding a package.
"""

import json

import httpx

from config import (
    FALLBACK_LLM_API_KEY,
    FALLBACK_LLM_BASE_URL,
    FALLBACK_LLM_MODEL,
    LLM_TIMEOUT_SECONDS,
)


class FallbackLLMError(RuntimeError):
    """Raised when the fallback API is unconfigured, unreachable, or returns bad output."""


def fallback_complete_json(system: str, user: str, temperature: float = 0.3) -> dict:
    """Call the configured OpenAI-compatible chat API in JSON mode; parse to a dict."""
    if not FALLBACK_LLM_API_KEY:
        raise FallbackLLMError(
            "No fallback API key configured. Set FALLBACK_LLM_API_KEY (or GROQ_API_KEY) "
            "in ai-service/.env — see .env.example."
        )
    try:
        response = httpx.post(
            f"{FALLBACK_LLM_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {FALLBACK_LLM_API_KEY}"},
            json={
                "model": FALLBACK_LLM_MODEL,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "response_format": {"type": "json_object"},
                "temperature": temperature,
            },
            timeout=LLM_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise FallbackLLMError(
            f"Fallback LLM request to {FALLBACK_LLM_BASE_URL} "
            f"(model '{FALLBACK_LLM_MODEL}') failed: {exc}"
        ) from exc

    try:
        content = response.json()["choices"][0]["message"]["content"]
        return json.loads(content)
    except (KeyError, IndexError, ValueError) as exc:
        raise FallbackLLMError(
            f"Fallback LLM returned an unparseable response: {exc}"
        ) from exc
