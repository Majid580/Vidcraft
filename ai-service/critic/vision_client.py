"""CRITIC-001 (FR-8): vision-capable quality gate for rendered shots.

Provider: Cloudflare Workers AI's @cf/meta/llama-4-scout-17b-16e-instruct
(ADR-026). The proposal left this provider TBD ("likely the fallback LLM if
it offers multimodal capability") — Groq's live model catalog has zero
vision-capable models today, so that assumption was checked and doesn't
hold. Cloudflare already has live-validated credentials (PROVIDER-001,
ADR-019) and llama-4-scout accepts an OpenAI-style image_url content part,
needs no gated per-model license click-through (unlike
@cf/meta/llama-3.2-11b-vision-instruct, which requires accepting a Community
License via the dashboard first), and returns clean structured verdicts.

Uses httpx (already a project dependency, see llm/http_llm_client.py) rather
than a new HTTP library.
"""

import json

import httpx

from config import CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CRITIC_VISION_MODEL

SYSTEM_PROMPT = (
    "You are a strict visual quality-control critic for short video shots. "
    "Compare the image to the intended shot description. Respond with ONLY "
    'a JSON object: {"pass": true|false, "reason": "<one sentence>"}. '
    "No markdown, no extra text."
)

_TIMEOUT_SECONDS = 60.0


class CriticConfigError(Exception):
    """Raised when Cloudflare credentials aren't configured."""


class CriticEvaluationError(Exception):
    """Raised when the vision model call fails or returns malformed output."""


def evaluate_frame(image_base64: str, description: str) -> dict:
    """Ask the vision model whether a rendered frame matches its intended
    shot description. Returns {"passed": bool, "reason": str}."""
    if not CLOUDFLARE_ACCOUNT_ID or not CLOUDFLARE_API_TOKEN:
        raise CriticConfigError(
            "CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN not configured in ai-service/.env"
        )

    url = (
        f"https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}"
        f"/ai/run/{CRITIC_VISION_MODEL}"
    )
    payload = {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": f"Intended shot description: {description}"},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
                    },
                ],
            },
        ],
        "max_tokens": 200,
    }

    try:
        response = httpx.post(
            url,
            headers={"Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}"},
            json=payload,
            timeout=_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as exc:
        raise CriticEvaluationError(f"Cloudflare vision request failed: {exc}") from exc

    data = response.json()

    if not data.get("success"):
        errors = data.get("errors") or [{"message": "unknown Cloudflare error"}]
        raise CriticEvaluationError(f"Cloudflare vision call failed: {errors[0]['message']}")

    verdict = (data.get("result") or {}).get("response")
    if isinstance(verdict, str):
        try:
            verdict = json.loads(verdict)
        except json.JSONDecodeError as exc:
            raise CriticEvaluationError(
                f"critic model returned non-JSON output: {verdict!r}"
            ) from exc

    if not isinstance(verdict, dict) or "pass" not in verdict:
        raise CriticEvaluationError(f"malformed critic response: {verdict!r}")

    return {"passed": bool(verdict["pass"]), "reason": str(verdict.get("reason", ""))}
