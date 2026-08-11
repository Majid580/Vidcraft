"""LangGraph state graph for the multi-agent orchestrator (FR-3).

Per ADR-001, orchestration uses an explicit LangGraph state graph rather
than a hand-rolled if/else pipeline, so the retry/branching logic (the
storyboard similarity-check retry loop, AI-008) has somewhere principled to
attach. Four nodes, in the order the proposal's Section 6.3 pipeline / the
Section 4.4 AI-pipeline diagram describe them: Screenwriter (AI-004,
narrative decomposition) -> Cinematographer (AI-007, RAG-grounded per-shot
camera/style) -> intent-similarity check (AI-008, bounces back to
Screenwriter on drift, bounded by MAX_STORYBOARD_RETRIES) -> Producer/Router
(AI-005, pathway assignment) -- routing runs last so it can see the
Cinematographer's grounded style_tokens (e.g. a "photorealistic" token
influencing the ADR-013 heuristic).
"""

import logging

from langgraph.graph import END, StateGraph

from config import MAX_STORYBOARD_RETRIES, STORYBOARD_SIMILARITY_THRESHOLD

from .agents.cinematographer import refine_cinematography
from .agents.producer import assign_pathways
from .agents.screenwriter import run_screenwriter
from .similarity import compute_similarity
from .state import OrchestratorState

logger = logging.getLogger(__name__)


def _screenwriter_node(state: OrchestratorState) -> dict:
    draft = run_screenwriter(state["clarified_prompt"])
    return {
        "storyboard_id": draft["storyboard_id"],
        "world_state": draft["world_state"],
        "shots": draft["shots"],
        "attempt_count": state["attempt_count"] + 1,
    }


def _cinematographer_node(state: OrchestratorState) -> dict:
    refined_shots, style_tokens = refine_cinematography(state["shots"], state["world_state"])
    world_state = {**state["world_state"], "style_tokens": style_tokens}
    return {"shots": refined_shots, "world_state": world_state}


# Total Screenwriter attempts allowed: the initial draft plus
# MAX_STORYBOARD_RETRIES revisions.
_MAX_ATTEMPTS = 1 + MAX_STORYBOARD_RETRIES


def _intent_check_node(state: OrchestratorState) -> dict:
    score = compute_similarity(state["clarified_prompt"], state["shots"])
    return {"similarity_score": score}


def _route_after_intent_check(state: OrchestratorState) -> str:
    if state["similarity_score"] >= STORYBOARD_SIMILARITY_THRESHOLD:
        return "producer"
    if state["attempt_count"] >= _MAX_ATTEMPTS:
        logger.warning(
            "Storyboard intent similarity %.3f stayed below threshold %.3f after "
            "%d attempts; finalizing the last attempt.",
            state["similarity_score"], STORYBOARD_SIMILARITY_THRESHOLD, state["attempt_count"],
        )
        return "producer"
    logger.warning(
        "Storyboard intent similarity %.3f below threshold %.3f; sending back to "
        "Screenwriter (attempt %d/%d).",
        state["similarity_score"], STORYBOARD_SIMILARITY_THRESHOLD,
        state["attempt_count"], _MAX_ATTEMPTS,
    )
    return "screenwriter"


def _producer_node(state: OrchestratorState) -> dict:
    routed_shots = assign_pathways(state["shots"], state["world_state"])
    return {"shots": routed_shots}


def build_graph():
    graph = StateGraph(OrchestratorState)
    graph.add_node("screenwriter", _screenwriter_node)
    graph.add_node("cinematographer", _cinematographer_node)
    graph.add_node("intent_check", _intent_check_node)
    graph.add_node("producer", _producer_node)
    graph.set_entry_point("screenwriter")
    graph.add_edge("screenwriter", "cinematographer")
    graph.add_edge("cinematographer", "intent_check")
    graph.add_conditional_edges(
        "intent_check",
        _route_after_intent_check,
        {"screenwriter": "screenwriter", "producer": "producer"},
    )
    graph.add_edge("producer", END)
    return graph.compile()


def generate_storyboard(clarified_prompt: str) -> dict:
    """Run the orchestrator graph end-to-end and return the storyboard JSON."""
    app = build_graph()
    result = app.invoke(
        {
            "clarified_prompt": clarified_prompt,
            "storyboard_id": "",
            "world_state": {},
            "shots": [],
            "attempt_count": 0,
            "similarity_score": 0.0,
        }
    )
    return {
        "storyboard_id": result["storyboard_id"],
        "world_state": result["world_state"],
        "shots": result["shots"],
    }
