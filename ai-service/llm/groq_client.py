"""Thin wrapper over the Groq SDK for JSON-mode structured completions.

Primary-provider only (per ADR-002/dependency graph: fallback-provider
integration is AI-006's scope, not AI-003's).
"""

import functools
import json

from groq import Groq

from config import GROQ_API_KEY, GROQ_MODEL


class GroqConfigError(RuntimeError):
    """Raised when GROQ_API_KEY is not configured."""


@functools.lru_cache(maxsize=1)
def _get_client() -> Groq:
    if not GROQ_API_KEY:
        raise GroqConfigError(
            "GROQ_API_KEY is not set. Add it to ai-service/.env (see .env.example)."
        )
    return Groq(api_key=GROQ_API_KEY)


def complete_json(system: str, user: str, temperature: float = 0.3) -> dict:
    """Call the Groq chat API in JSON mode and parse the response into a dict."""
    client = _get_client()
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        response_format={"type": "json_object"},
        temperature=temperature,
    )
    return json.loads(response.choices[0].message.content)
