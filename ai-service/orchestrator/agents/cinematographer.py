"""Cinematographer agent (AI-007): RAG-grounded per-shot camera + style.

Per proposal Section 6.3 / ADR-012, this agent's role is per-shot
cinematography (framing/angle/movement/lens/lighting), refining the
Screenwriter's (AI-004) best-effort `camera` draft and populating
`world_state.style_tokens` (left as `[]` by the Screenwriter) -- both
grounded in the curated cinematography corpus (RAG-002) via the persisted
vector index (RAG-003), not invented by the LLM alone.

Per shot: build a retrieval query from the shot's description + camera
draft + the storyboard's setting, fetch the top-k most relevant technique
passages from the vector index, then ask the LLM to refine the shot's
camera using ONLY those passages as grounding. Each shot also contributes
a few short style keywords, merged (with any pre-existing world_state
tokens) into the storyboard-level `style_tokens`.

Degrades gracefully: an empty/unbuilt index (`VectorIndex.search` short-
circuits to `[]`) or no shots leaves camera/style untouched rather than
raising -- RAG grounding is a refinement, not a hard requirement for the
pipeline to produce a storyboard.
"""

import json

from llm import complete_json
from rag import VectorIndex

# Indirection point so tests can swap in a fake pre-populated index without
# touching disk or loading the real ~90MB encoder (mirrors the injectable
# `embed_fn` pattern already used throughout `rag/`).
_load_production_index = VectorIndex.load

CINEMATOGRAPHER_SYSTEM_PROMPT = """You are the Cinematographer agent in a video-generation pipeline.
You are given one shot's working description and camera draft, the
storyboard's setting, and a short list of reference cinematography
techniques retrieved from a curated knowledge base (each with an id and
descriptive text).

Using ONLY the provided reference techniques as grounding -- do not invent
techniques not represented there -- refine the shot's camera direction into
a concise, concrete instruction (framing + angle/movement + lens/lighting as
relevant to the shot). Then list 2-4 short lowercase style keywords (e.g.
"low-key", "wide", "dolly-in", "shallow-focus") drawn from the techniques you
grounded the shot in.

Respond ONLY with JSON of the exact shape:
{"camera": string, "style_tokens": string[]}"""


class CinematographerOutputError(ValueError):
    """Raised when the LLM's cinematography output doesn't match the expected shape."""


def _build_query(shot: dict, world_state: dict) -> str:
    setting = world_state.get("setting", "")
    return f"{shot['description']} {shot.get('camera', '')} {setting}".strip()


def _dedupe(tokens) -> list[str]:
    seen = set()
    deduped = []
    for token in tokens:
        if not isinstance(token, str):
            continue
        cleaned = token.strip()
        key = cleaned.lower()
        if cleaned and key not in seen:
            seen.add(key)
            deduped.append(cleaned)
    return deduped


def refine_cinematography(
    shots: list[dict], world_state: dict, index: VectorIndex | None = None
) -> tuple[list[dict], list[str]]:
    """Ground each shot's camera + the storyboard's style_tokens in the RAG corpus.

    ``index`` is injectable (tests pass a small pre-populated ``VectorIndex``
    with a deterministic embedder); production callers omit it to lazily load
    the persisted RAG-003 index. Returns ``(refined_shots, style_tokens)``,
    where ``style_tokens`` merges any pre-existing ``world_state["style_tokens"]``
    with every shot's contributed keywords, deduplicated and order-preserving.
    """
    if not shots:
        return [], _dedupe(world_state.get("style_tokens", []))

    idx = index if index is not None else _load_production_index()

    refined_shots = []
    style_tokens = list(world_state.get("style_tokens", []))
    for shot in shots:
        hits = idx.search(_build_query(shot, world_state)) if len(idx) else []
        if not hits:
            refined_shots.append(shot)
            continue

        references = [
            {
                "id": hit["metadata"]["id"],
                "technique": hit["metadata"].get("technique", ""),
                "text": hit["text"],
            }
            for hit in hits
        ]
        user_content = json.dumps(
            {
                "shot": {"description": shot["description"], "camera": shot["camera"]},
                "setting": world_state.get("setting", ""),
                "reference_techniques": references,
            }
        )
        result = complete_json(CINEMATOGRAPHER_SYSTEM_PROMPT, user_content)

        camera = result.get("camera")
        if not isinstance(camera, str) or not camera.strip():
            raise CinematographerOutputError(
                f"shot {shot.get('shot_id')}: LLM returned a malformed camera value"
            )
        tokens = result.get("style_tokens")
        if not isinstance(tokens, list):
            raise CinematographerOutputError(
                f"shot {shot.get('shot_id')}: LLM returned malformed style_tokens"
            )

        style_tokens.extend(tokens)
        refined_shots.append({**shot, "camera": camera.strip()})

    return refined_shots, _dedupe(style_tokens)
