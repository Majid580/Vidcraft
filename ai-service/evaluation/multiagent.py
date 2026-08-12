"""Condition B: full multi-agent pipeline (EVAL-003, FR-12).

Thin evaluation-only wrapper around the production LangGraph orchestrator
(``orchestrator/graph.py``'s ``build_graph()`` -- screenwriter ->
cinematographer -> intent_check, AI-004/007/008). Calls the exact same
compiled graph ``generate_storyboard()`` does, not a reimplementation, but
also surfaces ``attempt_count``/``similarity_score`` -- present in the
graph's final state but stripped by ``generate_storyboard()``'s public
return shape -- since retry count and the intent-similarity verdict are
exactly what PROJECT_ARCHITECTURE.md Section 9 calls out as worth logging
for the evaluation study.

Per ADR-025, the fixed evaluation prompt is fed directly as the graph's
``clarified_prompt`` input: Condition A (``baseline.py``) also skips the
interactive clarification step (AI-003), so both conditions are compared
without introducing "was the prompt clarified?" as an extra, human-answered
variable.
"""

from orchestrator.graph import build_graph


def generate_multiagent(prompt: str) -> dict:
    """Run the full multi-agent pipeline (Condition B) on a raw prompt.

    Returns ``{"storyboard_id", "world_state", "shots", "attempt_count",
    "similarity_score"}``.
    """
    app = build_graph()
    result = app.invoke(
        {
            "clarified_prompt": prompt,
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
        "attempt_count": result["attempt_count"],
        "similarity_score": result["similarity_score"],
    }
