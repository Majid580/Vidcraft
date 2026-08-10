import pytest

from orchestrator import generate_storyboard
from orchestrator.agents import producer, screenwriter
from orchestrator.agents.producer import ProducerOutputError, assign_pathways
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


SAMPLE_SHOTS = [
    {"shot_id": 1, "description": "a", "camera": "wide, static", "duration_s": 3, "pathway": "remotion"},
    {"shot_id": 2, "description": "b", "camera": "close-up, static", "duration_s": 3, "pathway": "remotion"},
]
SAMPLE_WORLD_STATE = {"characters": ["a chef"], "setting": "a kitchen", "style_tokens": []}


def test_assign_pathways_empty_shots_is_noop(monkeypatch):
    called = False

    def fake_complete_json(system, user, temperature=0.3):
        nonlocal called
        called = True
        return {"pathways": {}}

    monkeypatch.setattr(producer, "complete_json", fake_complete_json)
    assert assign_pathways([], SAMPLE_WORLD_STATE) == []
    assert called is False


def test_assign_pathways_overwrites_pathway(monkeypatch):
    monkeypatch.setattr(
        producer, "complete_json",
        lambda system, user, temperature=0.3: {"pathways": {"1": "external_api", "2": "remotion"}},
    )
    result = assign_pathways(SAMPLE_SHOTS, SAMPLE_WORLD_STATE)
    assert result[0]["pathway"] == "external_api"
    assert result[1]["pathway"] == "remotion"
    assert result[0]["description"] == "a"


def test_assign_pathways_rejects_invalid_pathway(monkeypatch):
    monkeypatch.setattr(
        producer, "complete_json",
        lambda system, user, temperature=0.3: {"pathways": {"1": "nonexistent", "2": "remotion"}},
    )
    with pytest.raises(ProducerOutputError):
        assign_pathways(SAMPLE_SHOTS, SAMPLE_WORLD_STATE)


def test_assign_pathways_rejects_malformed_response(monkeypatch):
    monkeypatch.setattr(
        producer, "complete_json",
        lambda system, user, temperature=0.3: {"pathways": "not a dict"},
    )
    with pytest.raises(ProducerOutputError):
        assign_pathways(SAMPLE_SHOTS, SAMPLE_WORLD_STATE)


def test_generate_storyboard_runs_the_graph_end_to_end(monkeypatch):
    monkeypatch.setattr(
        screenwriter, "complete_json",
        lambda system, user, temperature=0.3: VALID_LLM_RESPONSE,
    )
    monkeypatch.setattr(
        producer, "complete_json",
        lambda system, user, temperature=0.3: {
            "pathways": {"1": "remotion", "2": "external_api", "3": "remotion"}
        },
    )
    result = generate_storyboard("An astronaut repairs a broken antenna on Mars before nightfall.")

    assert result["storyboard_id"].startswith("sb_")
    assert len(result["shots"]) == 3
    assert result["world_state"]["characters"] == ["astronaut in a worn white EVA suit"]
    assert result["shots"][0]["pathway"] == "remotion"
    assert result["shots"][1]["pathway"] == "external_api"
