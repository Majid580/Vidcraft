"""LangGraph state graph for the multi-agent orchestrator (FR-3).

Per ADR-001, orchestration uses an explicit LangGraph state graph rather
than a hand-rolled if/else pipeline, so the retry/branching logic planned
for later (the storyboard similarity-check retry loop, AI-008) has
somewhere principled to attach. Two nodes so far: Screenwriter (AI-004)
then Producer/Router (AI-005). Cinematographer (AI-007) is added as a
further node in this same graph, not as a separate pipeline.
"""

from langgraph.graph import END, StateGraph

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


def _producer_node(state: OrchestratorState) -> dict:
    routed_shots = assign_pathways(state["shots"], state["world_state"])
    return {"shots": routed_shots}


def build_graph():
    graph = StateGraph(OrchestratorState)
    graph.add_node("screenwriter", _screenwriter_node)
    graph.add_node("producer", _producer_node)
    graph.set_entry_point("screenwriter")
    graph.add_edge("screenwriter", "producer")
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
