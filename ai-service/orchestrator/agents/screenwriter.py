"""Screenwriter agent (AI-004): decomposes a clarified prompt into a
3-5 shot storyboard draft.

Per proposal Section 6.3, the Screenwriter's role is narrative
decomposition + world_state (characters/setting) -- not per-shot
cinematography (Cinematographer, AI-007, RAG-grounded) or pathway
routing (Producer/Router, AI-005). This agent fills each shot's "camera"
with its own best-effort draft and "pathway" with DEFAULT_PATHWAY (see
ADR-012) so the output already matches the FR-3 storyboard shape on its
own; in the full graph (orchestrator/graph.py) the Cinematographer node
runs next and refines "camera" + populates "style_tokens" via RAG
retrieval, then the Producer/Router node overwrites "pathway" per its own
routing decision (see ADR-013).
"""

import uuid

from llm import complete_json

MIN_SHOTS = 3
MAX_SHOTS = 5
DEFAULT_PATHWAY = "remotion"

SCREENWRITER_SYSTEM_PROMPT = f"""You are the Screenwriter agent in a video-generation pipeline.
Given a clarified, single-paragraph video prompt, decompose it into a
storyboard of {MIN_SHOTS} to {MAX_SHOTS} shots that together tell the
described idea as a short sequence.

Produce:
- "world_state": {{"characters": string[], "setting": string}} -- character
  and setting descriptions that stay constant across every shot.
- "shots": a list of {{"description": string, "camera": string, "duration_s": number}}
  objects, {MIN_SHOTS}-{MAX_SHOTS} items, each with a distinct narrative
  beat, a working shot description, a camera framing (e.g. "wide, static",
  "close-up, slow dolly-in", "medium, static"), and an intended duration in
  seconds (2-6).

Respond ONLY with JSON of the exact shape:
{{"world_state": {{"characters": string[], "setting": string}}, "shots": [{{"description": string, "camera": string, "duration_s": number}}, ...]}}"""


class ScreenwriterOutputError(ValueError):
    """Raised when the LLM's storyboard output doesn't match the expected shape."""


def run_screenwriter(clarified_prompt: str) -> dict:
    """Decompose clarified_prompt into a draft storyboard.

    Returns a dict matching the FR-3 storyboard JSON shape (storyboard_id,
    world_state, shots[]).
    """
    result = complete_json(SCREENWRITER_SYSTEM_PROMPT, clarified_prompt)

    world_state = result.get("world_state")
    shots = result.get("shots")
    if not isinstance(world_state, dict) or not isinstance(shots, list):
        raise ScreenwriterOutputError(
            "LLM returned a malformed storyboard (missing world_state/shots)"
        )

    characters = world_state.get("characters")
    setting = world_state.get("setting")
    if (
        not isinstance(characters, list)
        or not isinstance(setting, str)
        or not setting.strip()
    ):
        raise ScreenwriterOutputError("LLM returned a malformed world_state")

    if not (MIN_SHOTS <= len(shots) <= MAX_SHOTS):
        raise ScreenwriterOutputError(
            f"LLM returned {len(shots)} shots, expected {MIN_SHOTS}-{MAX_SHOTS}"
        )

    built_shots = []
    for i, shot in enumerate(shots, start=1):
        if not isinstance(shot, dict):
            raise ScreenwriterOutputError(f"shot {i} is not an object")
        description = shot.get("description")
        camera = shot.get("camera")
        duration_s = shot.get("duration_s")
        if not isinstance(description, str) or not description.strip():
            raise ScreenwriterOutputError(f"shot {i} missing description")
        if not isinstance(camera, str) or not camera.strip():
            raise ScreenwriterOutputError(f"shot {i} missing camera")
        if not isinstance(duration_s, (int, float)) or duration_s <= 0:
            raise ScreenwriterOutputError(f"shot {i} missing/invalid duration_s")

        built_shots.append(
            {
                "shot_id": i,
                "description": description.strip(),
                "camera": camera.strip(),
                "duration_s": duration_s,
                "pathway": DEFAULT_PATHWAY,
            }
        )

    return {
        "storyboard_id": f"sb_{uuid.uuid4().hex[:8]}",
        "world_state": {
            "characters": [c for c in characters if isinstance(c, str) and c.strip()],
            "setting": setting.strip(),
            "style_tokens": [],
        },
        "shots": built_shots,
    }
