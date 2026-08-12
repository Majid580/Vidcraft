"""EVAL-003 Condition B (full multi-agent pipeline) unit tests.

Offline: mocks the same seams test_orchestrator.py mocks (Screenwriter's
complete_json, Cinematographer's production-index loader) since
generate_multiagent() calls the exact same orchestrator.graph.build_graph()
those tests exercise -- no network call, no real model load.
"""

import numpy as np

from evaluation import multiagent
from orchestrator.agents import cinematographer, screenwriter
from rag import VectorIndex

VALID_LLM_RESPONSE = {
    "world_state": {
        "characters": ["a lone hiker"],
        "setting": "misty mountain trail at dawn",
    },
    "shots": [
        {"description": "Wide shot of the hiker on the ridge.", "camera": "wide, static", "duration_s": 4},
        {"description": "Close-up of boots on wet stone.", "camera": "close-up, static", "duration_s": 3},
        {"description": "Medium shot as fog rolls in.", "camera": "medium, static", "duration_s": 3},
    ],
}


def fake_embed(texts) -> np.ndarray:
    rows = [[0.0, 0.0] for _ in texts]
    matrix = np.asarray(rows, dtype="float32") + 0.01
    return matrix / np.linalg.norm(matrix, axis=1, keepdims=True)


def test_generate_multiagent_returns_storyboard_and_diagnostics(monkeypatch):
    monkeypatch.setattr(
        screenwriter, "complete_json",
        lambda system, user, temperature=0.3: VALID_LLM_RESPONSE,
    )
    # Empty index -> Cinematographer passes shots through unchanged (no LLM
    # call), matching test_orchestrator.py's pattern for an isolated run.
    monkeypatch.setattr(
        cinematographer, "_load_production_index",
        lambda: VectorIndex(dim=2, embed_fn=fake_embed),
    )

    result = multiagent.generate_multiagent("a hiker crests a foggy ridge at dawn")

    assert result["storyboard_id"].startswith("sb_")
    assert len(result["shots"]) == 3
    assert result["world_state"]["setting"] == "misty mountain trail at dawn"
    assert result["attempt_count"] == 1
    assert isinstance(result["similarity_score"], float)


def test_generate_multiagent_feeds_the_raw_prompt_as_clarified_prompt(monkeypatch):
    seen = {}

    def fake_complete_json(system, user, temperature=0.3):
        seen["user"] = user
        return VALID_LLM_RESPONSE

    monkeypatch.setattr(screenwriter, "complete_json", fake_complete_json)
    monkeypatch.setattr(
        cinematographer, "_load_production_index",
        lambda: VectorIndex(dim=2, embed_fn=fake_embed),
    )

    multiagent.generate_multiagent("a raw, unclarified prompt text")

    assert seen["user"] == "a raw, unclarified prompt text"
