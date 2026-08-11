"""LangGraph state graph for the multi-agent orchestrator (FR-3).

Per ADR-001, orchestration uses an explicit LangGraph state graph rather
than a hand-rolled if/else pipeline, so the retry/branching logic planned
for later (the storyboard similarity-check retry loop, AI-008) has
somewhere principled to attach. Three nodes so far, in the order the
proposal's Section 6.3 pipeline describes them: Screenwriter (AI-004,
narrative decomposition) -> Cinematographer (AI-007, RAG-grounded per-shot
camera/style) -> Producer/Router (AI-005, pathway assignment) -- routing
runs last so it can see the Cinematographer's grounded style_tokens (e.g. a
"photorealistic" token influencing the ADR-013 heuristic).
"""

from langgraph.graph import END, StateGraph

from .agents.cinematographer import refine_cinematography
from .agents.producer import assign_pathways
from .agents.screenwriter import run_screenwriter
from .state import OrchestratorState


def _screenwriter_node(state: OrchestratorState) -> dict:
    draft = run_screenwriter(state["clarified_prompt"])
    return {
        "storyboard_id": draft["storyboard_id"],
        "world_state": draft["world_state"],
        "shots": draft["shots"],
    }


def _cinematographer_node(state: OrchestratorState) -> dict:
    refined_shots, style_tokens = refine_cinematography(state["shots"], state["world_state"])
    world_state = {**state["world_state"], "style_tokens": style_tokens}
    return {"shots": refined_shots, "world_state": world_state}


def _producer_node(state: OrchestratorState) -> dict:
    routed_shots = assign_pathways(state["shots"], state["world_state"])
    return {"shots": routed_shots}


def build_graph():
    graph = StateGraph(OrchestratorState)
    graph.add_node("screenwriter", _screenwriter_node)
    graph.add_node("cinematographer", _cinematographer_node)
    graph.add_node("producer", _producer_node)
    graph.set_entry_point("screenwriter")
    graph.add_edge("screenwriter", "cinematographer")
    graph.add_edge("cinematographer", "producer")
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
        }
    )
    return {
        "storyboard_id": result["storyboard_id"],
        "world_state": result["world_state"],
        "shots": result["shots"],
    }
