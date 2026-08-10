import pytest

from analyzer import EmptyPromptError, score_prompt

EXPECTED_DIMENSIONS = {
    "subject_clarity",
    "action_specificity",
    "environment_detail",
    "visual_richness",
    "temporal_coherence",
}


def test_schema_shape():
    result = score_prompt("A tired old man repairs a broken clock in a dusty attic.")
    assert set(result.keys()) == {"overall_score", "dimensions", "flags", "suggestions"}
    assert set(result["dimensions"].keys()) == EXPECTED_DIMENSIONS
    assert 0 <= result["overall_score"] <= 100
    for value in result["dimensions"].values():
        assert 0 <= value <= 100
    assert len(result["flags"]) == len(result["suggestions"])


def test_well_formed_prompt_scores_highly_and_has_no_core_flags():
    prompt = (
        "A woman in a red coat walks briskly through a crowded Tokyo street "
        "at night, neon signs reflecting on the wet pavement."
    )
    result = score_prompt(prompt)
    assert result["overall_score"] > 50
    assert "missing_setting" not in result["flags"]
    assert "no_subject" not in result["flags"]


def test_missing_setting_and_vague_subject_flagged():
    result = score_prompt("Someone does something.")
    assert "missing_setting" in result["flags"]


def test_vague_action_flagged():
    result = score_prompt("The man moves in the room.")
    assert "vague_action" in result["flags"]


def test_contradictory_descriptors_flagged():
    result = score_prompt("A bright and dim room with a dim, bright light.")
    assert "contradictory_descriptors" in result["flags"]
    assert any("bright" in s and "dim" in s for s in result["suggestions"])


@pytest.mark.parametrize("bad_prompt", ["", "   ", "\n\t", "hi"])
def test_empty_or_too_short_prompt_raises(bad_prompt):
    with pytest.raises(EmptyPromptError):
        score_prompt(bad_prompt)
