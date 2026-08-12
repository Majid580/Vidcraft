"""EVAL-002 Condition A (single-shot baseline) unit tests.

Offline: the LLM call (complete_json) is monkeypatched, matching the
pattern used for AI-003/AI-004 (test_clarification.py, test_orchestrator.py).
"""

import pytest

from evaluation import baseline


def test_generate_baseline_returns_description_and_camera(monkeypatch):
    monkeypatch.setattr(
        baseline,
        "complete_json",
        lambda system, user, temperature=0.3: {
            "enhanced_description": "  A lush enhanced scene.  ",
            "camera": "  wide, static  ",
        },
    )
    result = baseline.generate_baseline("a scene")
    assert result == {"enhanced_description": "A lush enhanced scene.", "camera": "wide, static"}


def test_generate_baseline_is_a_single_call(monkeypatch):
    calls = []

    def fake_complete_json(system, user, temperature=0.3):
        calls.append((system, user))
        return {"enhanced_description": "desc", "camera": "medium, static"}

    monkeypatch.setattr(baseline, "complete_json", fake_complete_json)
    baseline.generate_baseline("a raw prompt")
    assert len(calls) == 1
    assert calls[0][1] == "a raw prompt"


def test_generate_baseline_rejects_missing_description(monkeypatch):
    monkeypatch.setattr(
        baseline, "complete_json",
        lambda system, user, temperature=0.3: {"camera": "wide, static"},
    )
    with pytest.raises(baseline.BaselineOutputError):
        baseline.generate_baseline("a scene")


def test_generate_baseline_rejects_blank_description(monkeypatch):
    monkeypatch.setattr(
        baseline, "complete_json",
        lambda system, user, temperature=0.3: {"enhanced_description": "   ", "camera": "wide"},
    )
    with pytest.raises(baseline.BaselineOutputError):
        baseline.generate_baseline("a scene")


def test_generate_baseline_rejects_missing_camera(monkeypatch):
    monkeypatch.setattr(
        baseline, "complete_json",
        lambda system, user, temperature=0.3: {"enhanced_description": "a scene description here"},
    )
    with pytest.raises(baseline.BaselineOutputError):
        baseline.generate_baseline("a scene")
