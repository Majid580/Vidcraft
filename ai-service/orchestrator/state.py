"""Shared state schema for the LangGraph orchestrator (AI-004/005/007).

One graph, one state shape, extended (not replaced) as agents are added:
Screenwriter (AI-004) populates world_state/shots; Cinematographer
(AI-007) refines per-shot camera + world_state.style_tokens via RAG;
Producer/Router (AI-005) overwrites each shot's pathway per the tiering
policy.
"""

from typing import TypedDict


class OrchestratorState(TypedDict):
    clarified_prompt: str
    storyboard_id: str
    world_state: dict
    shots: list[dict]
