"""Producer/Router agent (AI-005): assigns each shot's generation pathway.

Per proposal Section 6.3, decides per shot whether generation proceeds
via the free, guaranteed-consistency Remotion pathway or the external
API pathway, following the tiered cost strategy (Section 9: photorealistic
output goes to an external API; everything else stays on Remotion). This
overwrites the "remotion" placeholder the Screenwriter (AI-004, ADR-012)
puts on every shot.

Concrete Tier 1/2/3 providers are not selected yet (PROVIDER-001, open
question R-8) and the external API adapter layer doesn't exist yet
(BACKEND-005) -- so a shot routed to "external_api" here is a
forward-looking routing decision only, not something that can currently
be rendered. See ADR-013 for the routing heuristic and this limitation.
"""

import json

from llm import complete_json

PATHWAYS = {"remotion", "external_api"}

PRODUCER_SYSTEM_PROMPT = """You are the Producer/Router agent in a video-generation pipeline.
You will be given a storyboard's shots and world_state. VidCraft has two
generation pathways:
- "remotion": free, code-driven, stylized/animated rendering. Always
  available and guaranteed-consistency. Use this by default.
- "external_api": submits the shot to an external photorealistic
  video/image generation API. Only route a shot here if its description
  or the world_state's style_tokens explicitly call for photorealistic
  or live-action-style output; do not choose it for stylized, animated,
  illustrated, or otherwise non-photorealistic requests.

For each shot (by shot_id), decide its pathway.

Respond ONLY with JSON of the exact shape:
{"pathways": {"<shot_id>": "remotion" | "external_api", ...}}"""


class ProducerOutputError(ValueError):
    """Raised when the LLM's routing output doesn't match the expected shape."""


def assign_pathways(shots: list[dict], world_state: dict) -> list[dict]:
    """Return a new shots list with each shot's "pathway" assigned by the Producer/Router."""
    if not shots:
        return []

    user_content = json.dumps({"shots": shots, "world_state": world_state})
    result = complete_json(PRODUCER_SYSTEM_PROMPT, user_content)

    pathways = result.get("pathways")
    if not isinstance(pathways, dict):
        raise ProducerOutputError("LLM returned a malformed pathways object")

    routed_shots = []
    for shot in shots:
        key = str(shot["shot_id"])
        pathway = pathways.get(key)
        if pathway not in PATHWAYS:
            raise ProducerOutputError(
                f"shot {shot['shot_id']}: LLM returned an invalid pathway {pathway!r}"
            )
        routed_shots.append({**shot, "pathway": pathway})

    return routed_shots
