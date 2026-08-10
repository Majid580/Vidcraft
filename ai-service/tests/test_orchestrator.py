import pytest

from orchestrator import generate_storyboard
from orchestrator.agents import screenwriter
from orchestrator.agents.screenwriter import ScreenwriterOutputError, run_screenwriter

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
    assert result["shots"][0]["pathway"] == "remotion"
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


def test_generate_storyboard_runs_the_graph_end_to_end(monkeypatch):
    monkeypatch.setattr(
        screenwriter, "complete_json",
        lambda system, user, temperature=0.3: VALID_LLM_RESPONSE,
    )
    result = generate_storyboard("An astronaut repairs a broken antenna on Mars before nightfall.")

    assert result["storyboard_id"].startswith("sb_")
    assert len(result["shots"]) == 3
    assert result["world_state"]["characters"] == ["astronaut in a worn white EVA suit"]
