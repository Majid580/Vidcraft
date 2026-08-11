import numpy as np
import pytest

from orchestrator import generate_storyboard, graph
from orchestrator.agents import cinematographer, screenwriter
from orchestrator.agents.cinematographer import (
    CinematographerOutputError,
    refine_cinematography,
)
from orchestrator.agents.screenwriter import ScreenwriterOutputError, run_screenwriter
from orchestrator.similarity import compute_similarity
from rag import VectorIndex

VALID_LLM_RESPONSE = {
    "world_state": {
        "characters": ["astronaut in a worn white EVA suit"],
        "setting": "rust-red Martian plain, distant low hills",
    },
    "shots": [
        {
            "description": "Wide shot: astronaut walks toward a damaged antenna tower.",
            "camera": "wide, low-angle, slow dolly-in",
            "duration_s": 4,
        },
        {
            "description": "Close shot: astronaut's gloved hands adjust a control panel.",
            "camera": "close-up, static",
            "duration_s": 3,
        },
        {
            "description": "Medium shot: the antenna lights up as repairs finish.",
            "camera": "medium, static",
            "duration_s": 3,
        },
    ],
}


def test_run_screenwriter_builds_storyboard_shape(monkeypatch):
    monkeypatch.setattr(
        screenwriter, "complete_json",
        lambda system, user, temperature=0.3: VALID_LLM_RESPONSE,
    )
    result = run_screenwriter("An astronaut repairs a broken antenna on Mars before nightfall.")

    assert result["storyboard_id"].startswith("sb_")
    assert result["world_state"]["setting"] == "rust-red Martian plain, distant low hills"
    assert result["world_state"]["style_tokens"] == []
    assert len(result["shots"]) == 3
    assert result["shots"][0]["shot_id"] == 1
    assert result["shots"][1]["shot_id"] == 2


def test_run_screenwriter_rejects_too_few_shots(monkeypatch):
    bad_response = {**VALID_LLM_RESPONSE, "shots": VALID_LLM_RESPONSE["shots"][:2]}
    monkeypatch.setattr(
        screenwriter, "complete_json",
        lambda system, user, temperature=0.3: bad_response,
    )
    with pytest.raises(ScreenwriterOutputError):
        run_screenwriter("a prompt")


def test_run_screenwriter_rejects_missing_world_state(monkeypatch):
    monkeypatch.setattr(
        screenwriter, "complete_json",
        lambda system, user, temperature=0.3: {"shots": VALID_LLM_RESPONSE["shots"]},
    )
    with pytest.raises(ScreenwriterOutputError):
        run_screenwriter("a prompt")


def test_run_screenwriter_rejects_shot_missing_camera(monkeypatch):
    bad_shots = [dict(s) for s in VALID_LLM_RESPONSE["shots"]]
    del bad_shots[0]["camera"]
    bad_response = {**VALID_LLM_RESPONSE, "shots": bad_shots}
    monkeypatch.setattr(
        screenwriter, "complete_json",
        lambda system, user, temperature=0.3: bad_response,
    )
    with pytest.raises(ScreenwriterOutputError):
        run_screenwriter("a prompt")


# --- Cinematographer (AI-007) ---
# A deterministic 2-axis embedder (mirrors tests/test_rag.py's fake_embed
# pattern) so RAG retrieval is exercised without loading the real
# all-MiniLM-L6-v2 model.

def fake_embed(texts) -> np.ndarray:
    rows = []
    for t in texts:
        low = t.lower()
        rows.append(
            [
                float("close" in low or "dolly" in low),
                float("wide" in low or "landscape" in low),
            ]
        )
    matrix = np.asarray(rows, dtype="float32") + 0.01
    return matrix / np.linalg.norm(matrix, axis=1, keepdims=True)


CINE_CORPUS = [
    {
        "text": "close-up dolly-in for emotional intimacy",
        "metadata": {"id": "close-dolly", "technique": "Close-up dolly"},
    },
    {
        "text": "wide landscape establishing shot",
        "metadata": {"id": "wide-landscape", "technique": "Wide shot"},
    },
]


def make_cine_index() -> VectorIndex:
    idx = VectorIndex(dim=2, embed_fn=fake_embed)
    idx.add(CINE_CORPUS)
    return idx


SHOT_A = {
    "shot_id": 1,
    "description": "An intimate conversation between two characters",
    "camera": "medium, static",
    "duration_s": 3,
}
SHOT_B = {
    "shot_id": 2,
    "description": "A sweeping vista of the landscape",
    "camera": "wide, static",
    "duration_s": 4,
}
CINE_WORLD_STATE = {"characters": ["a chef"], "setting": "a kitchen", "style_tokens": []}


def test_refine_cinematography_empty_shots_is_noop():
    assert refine_cinematography([], CINE_WORLD_STATE) == ([], [])


def test_refine_cinematography_empty_index_passes_through_unchanged():
    empty_index = VectorIndex(dim=2, embed_fn=fake_embed)
    shots, tokens = refine_cinematography([SHOT_A, SHOT_B], CINE_WORLD_STATE, index=empty_index)
    assert shots == [SHOT_A, SHOT_B]
    assert tokens == []


def test_refine_cinematography_grounds_camera_and_collects_tokens(monkeypatch):
    calls = []

    def fake_complete_json(system, user, temperature=0.3):
        calls.append(user)
        if "conversation" in user.lower():
            return {"camera": "close-up, slow dolly-in", "style_tokens": ["intimate", "dolly-in"]}
        return {"camera": "wide, static, establishing", "style_tokens": ["wide", "establishing"]}

    monkeypatch.setattr(cinematographer, "complete_json", fake_complete_json)
    shots, tokens = refine_cinematography([SHOT_A, SHOT_B], CINE_WORLD_STATE, index=make_cine_index())

    assert shots[0]["camera"] == "close-up, slow dolly-in"
    assert shots[1]["camera"] == "wide, static, establishing"
    assert shots[0]["shot_id"] == 1  # other fields untouched
    assert tokens == ["intimate", "dolly-in", "wide", "establishing"]
    assert len(calls) == 2


def test_refine_cinematography_merges_and_dedupes_existing_style_tokens(monkeypatch):
    monkeypatch.setattr(
        cinematographer, "complete_json",
        lambda system, user, temperature=0.3: {"camera": "close-up", "style_tokens": ["Intimate", "wide"]},
    )
    world_state = {**CINE_WORLD_STATE, "style_tokens": ["intimate", "cinematic"]}
    _, tokens = refine_cinematography([SHOT_A], world_state, index=make_cine_index())
    assert tokens == ["intimate", "cinematic", "wide"]  # case-insensitive dedup, first-seen casing wins


def test_refine_cinematography_rejects_missing_camera(monkeypatch):
    monkeypatch.setattr(
        cinematographer, "complete_json",
        lambda system, user, temperature=0.3: {"style_tokens": ["intimate"]},
    )
    with pytest.raises(CinematographerOutputError):
        refine_cinematography([SHOT_A], CINE_WORLD_STATE, index=make_cine_index())


def test_refine_cinematography_rejects_malformed_style_tokens(monkeypatch):
    monkeypatch.setattr(
        cinematographer, "complete_json",
        lambda system, user, temperature=0.3: {"camera": "close-up", "style_tokens": "not a list"},
    )
    with pytest.raises(CinematographerOutputError):
        refine_cinematography([SHOT_A], CINE_WORLD_STATE, index=make_cine_index())


def test_generate_storyboard_runs_the_graph_end_to_end(monkeypatch):
    monkeypatch.setattr(
        screenwriter, "complete_json",
        lambda system, user, temperature=0.3: VALID_LLM_RESPONSE,
    )
    # Empty index -> Cinematographer passes shots through unchanged (no LLM
    # call, no real model load); dedicated grounding behavior is covered by
    # the refine_cinematography unit tests and the grounding test below.
    monkeypatch.setattr(
        cinematographer, "_load_production_index",
        lambda: VectorIndex(dim=2, embed_fn=fake_embed),
    )
    result = generate_storyboard("An astronaut repairs a broken antenna on Mars before nightfall.")

    assert result["storyboard_id"].startswith("sb_")
    assert len(result["shots"]) == 3
    assert result["world_state"]["characters"] == ["astronaut in a worn white EVA suit"]


def test_generate_storyboard_grounds_camera_via_cinematographer(monkeypatch):
    monkeypatch.setattr(
        screenwriter, "complete_json",
        lambda system, user, temperature=0.3: VALID_LLM_RESPONSE,
    )
    monkeypatch.setattr(cinematographer, "_load_production_index", make_cine_index)
    monkeypatch.setattr(
        cinematographer, "complete_json",
        lambda system, user, temperature=0.3: {
            "camera": "grounded camera direction",
            "style_tokens": ["low-key", "dolly-in"],
        },
    )
    result = generate_storyboard("An astronaut repairs a broken antenna on Mars before nightfall.")

    assert all(shot["camera"] == "grounded camera direction" for shot in result["shots"])
    assert result["world_state"]["style_tokens"] == ["low-key", "dolly-in"]


# --- Intent-similarity check + retry loop (AI-008) ---

def fake_similarity_embed(texts) -> np.ndarray:
    """Deterministic embedder: 'aligned' text pairs share an axis, others don't."""
    rows = []
    for t in texts:
        low = t.lower()
        rows.append([float("aligned" in low), float("drift" in low)])
    matrix = np.asarray(rows, dtype="float32") + 0.01
    return matrix / np.linalg.norm(matrix, axis=1, keepdims=True)


def test_compute_similarity_empty_shots_returns_zero():
    assert compute_similarity("a prompt", [], embed_fn=fake_similarity_embed) == 0.0


def test_compute_similarity_scores_matching_text_higher():
    shots_aligned = [{"description": "an aligned shot"}]
    shots_drifted = [{"description": "a completely drifted shot"}]
    aligned_score = compute_similarity("aligned prompt", shots_aligned, embed_fn=fake_similarity_embed)
    drifted_score = compute_similarity("aligned prompt", shots_drifted, embed_fn=fake_similarity_embed)
    assert aligned_score > drifted_score


def _patch_full_graph(monkeypatch, similarity_scores):
    """Wire a fully-mocked graph run: fixed screenwriter/cinematographer
    output, empty RAG index (no LLM call), and a queue of canned similarity
    scores (one per intent_check invocation) so retry behavior is deterministic
    without a real embedder or LLM.
    """
    monkeypatch.setattr(
        screenwriter, "complete_json",
        lambda system, user, temperature=0.3: VALID_LLM_RESPONSE,
    )
    monkeypatch.setattr(
        cinematographer, "_load_production_index",
        lambda: VectorIndex(dim=2, embed_fn=fake_embed),
    )
    scores = iter(similarity_scores)
    calls = {"screenwriter": 0}
    original_screenwriter = screenwriter.run_screenwriter

    def counting_screenwriter(clarified_prompt):
        calls["screenwriter"] += 1
        return original_screenwriter(clarified_prompt)

    monkeypatch.setattr(graph, "run_screenwriter", counting_screenwriter)
    monkeypatch.setattr(graph, "compute_similarity", lambda prompt, shots: next(scores))
    return calls


def test_generate_storyboard_passes_on_first_try_above_threshold(monkeypatch):
    calls = _patch_full_graph(monkeypatch, [0.9])
    result = generate_storyboard("a prompt")
    assert calls["screenwriter"] == 1
    assert len(result["shots"]) == 3


def test_generate_storyboard_retries_screenwriter_on_low_similarity(monkeypatch):
    calls = _patch_full_graph(monkeypatch, [0.1, 0.9])
    result = generate_storyboard("a prompt")
    assert calls["screenwriter"] == 2
    assert len(result["shots"]) == 3


def test_generate_storyboard_finalizes_after_max_retries(monkeypatch):
    # MAX_STORYBOARD_RETRIES defaults to 2 -> 1 initial attempt + 2 retries = 3
    # screenwriter calls total, then finalizes with the last attempt rather
    # than looping forever, matching FR-8's retry-exhaustion behavior.
    calls = _patch_full_graph(monkeypatch, [0.1, 0.1, 0.1])
    result = generate_storyboard("a prompt")
    assert calls["screenwriter"] == 3
    assert len(result["shots"]) == 3
