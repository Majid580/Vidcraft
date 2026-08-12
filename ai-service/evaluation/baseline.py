"""Condition A: single-shot baseline enhancement (EVAL-002, FR-12).

The direct counterpoint to the multi-agent pipeline (AI-004 Screenwriter ->
AI-007 Cinematographer -> AI-008 intent-similarity retry loop) that FR-12's
comparative evaluation study measures against: ONE LLM call, no clarification
round-trip (AI-003), no RAG grounding (RAG-003/AI-007), no multi-shot
decomposition, no retry loop (AI-008). It takes the raw prompt exactly as
given in the fixed evaluation set and expands it into a single enhanced
scene description, matching "Condition A: single-shot baseline enhancement"
in PROJECT_ARCHITECTURE.md Section 4.7.
"""

from llm import complete_json

BASELINE_SYSTEM_PROMPT = """You are a single-pass prompt enhancer for a video generation system.
Given a short video scene idea, rewrite it as ONE richly detailed scene
description ready for a video generator: expand the subject, action,
setting, and visual/style detail in a single pass. Do not ask clarifying
questions and do not split it into multiple shots -- treat the whole idea
as one shot.

Respond ONLY with JSON of the exact shape:
{"enhanced_description": string, "camera": string}"""


class BaselineOutputError(ValueError):
    """Raised when the LLM's baseline output doesn't match the expected shape."""


def generate_baseline(prompt: str) -> dict:
    """Run Condition A on a single prompt: one LLM call, nothing else.

    Returns ``{"enhanced_description": str, "camera": str}``.
    """
    result = complete_json(BASELINE_SYSTEM_PROMPT, prompt)

    enhanced_description = result.get("enhanced_description")
    camera = result.get("camera")
    if not isinstance(enhanced_description, str) or not enhanced_description.strip():
        raise BaselineOutputError(
            "LLM returned a malformed baseline (missing enhanced_description)"
        )
    if not isinstance(camera, str) or not camera.strip():
        raise BaselineOutputError("LLM returned a malformed baseline (missing camera)")

    return {
        "enhanced_description": enhanced_description.strip(),
        "camera": camera.strip(),
    }
