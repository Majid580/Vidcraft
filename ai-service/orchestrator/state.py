"""Shared state schema for the LangGraph orchestrator (AI-004/007/008).

One graph, one state shape, extended (not replaced) as agents are added:
Screenwriter (AI-004) populates world_state/shots; Cinematographer
(AI-007) refines per-shot camera + world_state.style_tokens via RAG;
the intent-similarity check (AI-008) scores shots against the clarified
prompt and bounces back to the Screenwriter on drift, up to
MAX_STORYBOARD_RETRIES times (tracked via ``attempt_count``, incremented
by the Screenwriter node itself so the retry router just compares it
against a fixed ceiling rather than re-deriving "did a retry just
happen" from a value it doesn't control). Rendering pathway/provider is
not part of this state at all -- it's a user choice the backend applies
after the graph completes (FR-6, ADR-020; the former Producer/Router
node, AI-005, is retired).
"""

from typing import TypedDict


class OrchestratorState(TypedDict):
    clarified_prompt: str
    storyboard_id: str
    world_state: dict
    shots: list[dict]
    attempt_count: int
    similarity_score: float
