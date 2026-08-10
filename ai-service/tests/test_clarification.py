import pytest

from clarification import agent


def test_generate_questions_returns_empty_when_no_flags(monkeypatch):
    called = False

    def fake_complete_json(system, user, temperature=0.3):
        nonlocal called
        called = True
        return {"questions": ["should not be reached"]}

    monkeypatch.setattr(agent, "complete_json", fake_complete_json)
    result = agent.generate_questions("a prompt", [], [])
    assert result == []
    assert called is False


def test_generate_questions_caps_at_max(monkeypatch):
    monkeypatch.setattr(
        agent, "complete_json",
        lambda system, user, temperature=0.3: {"questions": ["q1", "q2", "q3"]},
    )
    result = agent.generate_questions("a prompt", ["missing_setting"], ["add a setting"])
    assert result == ["q1", "q2"]


def test_generate_questions_filters_non_strings(monkeypatch):
    monkeypatch.setattr(
        agent, "complete_json",
        lambda system, user, temperature=0.3: {"questions": ["ok", 123, "", None]},
    )
    result = agent.generate_questions("a prompt", ["vague_action"], ["be specific"])
    assert result == ["ok"]


def test_build_brief_no_questions_is_noop(monkeypatch):
    called = False

    def fake_complete_json(system, user, temperature=0.3):
        nonlocal called
        called = True
        return {}

    monkeypatch.setattr(agent, "complete_json", fake_complete_json)
    result = agent.build_brief("a cat runs", [], [])
    assert result == {"brief": {}, "clarified_prompt": "a cat runs"}
    assert called is False


def test_build_brief_mismatched_lengths_raises():
    with pytest.raises(ValueError):
        agent.build_brief("a cat runs", ["Q1?", "Q2?"], ["only one answer"])


def test_build_brief_merges_answers(monkeypatch):
    monkeypatch.setattr(
        agent, "complete_json",
        lambda system, user, temperature=0.3: {
            "brief": {"setting": "outdoors, city street"},
            "clarified_prompt": "A cat runs down a busy city street.",
        },
    )
    result = agent.build_brief(
        "a cat runs", ["Indoors or outdoors?"], ["Outdoors, a city street"]
    )
    assert result["brief"] == {"setting": "outdoors, city street"}
    assert result["clarified_prompt"] == "A cat runs down a busy city street."


def test_build_brief_malformed_response_raises(monkeypatch):
    monkeypatch.setattr(
        agent, "complete_json",
        lambda system, user, temperature=0.3: {"brief": "not a dict", "clarified_prompt": "x"},
    )
    with pytest.raises(ValueError):
        agent.build_brief("a cat runs", ["Q?"], ["A"])


def test_build_brief_empty_clarified_prompt_raises(monkeypatch):
    monkeypatch.setattr(
        agent, "complete_json",
        lambda system, user, temperature=0.3: {"brief": {}, "clarified_prompt": "   "},
    )
    with pytest.raises(ValueError):
        agent.build_brief("a cat runs", ["Q?"], ["A"])
