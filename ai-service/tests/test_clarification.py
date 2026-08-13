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


def test_generate_questions_caps_at_budget_not_a_fixed_two(monkeypatch):
    # One flag on a long prompt = one gap = one question. Before ADR-031 this
    # returned two, padding a single real gap with an invented second one.
    monkeypatch.setattr(
        agent, "complete_json",
        lambda system, user, temperature=0.3: {"questions": ["q1", "q2", "q3"]},
    )
    long_prompt = " ".join(["word"] * 30)
    result = agent.generate_questions(long_prompt, ["missing_setting"], ["add a setting"])
    assert result == ["q1"]


def test_generate_questions_asks_more_of_a_vaguer_prompt(monkeypatch):
    # Four distinct flags = four gaps. The old fixed cap of 2 threw half the
    # analyzer's own evidence away.
    monkeypatch.setattr(
        agent, "complete_json",
        lambda system, user, temperature=0.3: {"questions": ["q1", "q2", "q3", "q4", "q5"]},
    )
    long_prompt = " ".join(["word"] * 30)
    flags = ["no_subject", "vague_action", "missing_setting", "low_visual_detail"]
    result = agent.generate_questions(long_prompt, flags, [])
    assert result == ["q1", "q2", "q3", "q4"]


def test_generate_questions_passes_the_budget_into_the_prompt(monkeypatch):
    seen = {}

    def fake(system, user, temperature=0.3):
        seen["system"] = system
        return {"questions": ["q1", "q2", "q3"]}

    monkeypatch.setattr(agent, "complete_json", fake)
    agent.generate_questions("short vague thing", ["no_subject"], [])
    # The model must be told the exact number; "at most N" produced 2 every time.
    assert "EXACTLY 2" in seen["system"]


class TestQuestionBudget:
    LONG = " ".join(["word"] * 30)

    def test_no_flags_means_no_questions(self):
        assert agent.question_budget(self.LONG, []) == 0

    def test_one_flag_one_question(self):
        assert agent.question_budget(self.LONG, ["no_subject"]) == 1

    def test_scales_with_distinct_flags(self):
        assert agent.question_budget(self.LONG, ["no_subject", "vague_action"]) == 2

    def test_duplicate_flags_count_once(self):
        # contradictory_descriptors is appended once per contradicting pair;
        # three contradictions are still one kind of question.
        dupes = ["contradictory_descriptors"] * 3
        assert agent.question_budget(self.LONG, dupes) == 1

    def test_short_prompt_earns_an_extra_question(self):
        # The analyzer cannot flag detail that was never written at all.
        assert agent.question_budget("a man walks", ["no_subject"]) == 2

    def test_low_overall_score_earns_an_extra_question(self):
        assert agent.question_budget(self.LONG, ["no_subject"], 20) == 2

    def test_a_healthy_score_adds_nothing(self):
        assert agent.question_budget(self.LONG, ["no_subject"], 85) == 1

    def test_short_and_weak_stack(self):
        assert agent.question_budget("a man walks", ["no_subject"], 20) == 3

    def test_never_exceeds_the_cap(self):
        flags = ["no_subject", "vague_action", "missing_setting",
                 "low_visual_detail", "temporal_ambiguity", "contradictory_descriptors"]
        assert agent.question_budget("a man", flags, 5) == agent.CLARIFICATION_MAX_QUESTIONS

    def test_cap_is_configurable(self):
        assert agent.question_budget(self.LONG, ["a", "b", "c", "d"], cap=2) == 2


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
