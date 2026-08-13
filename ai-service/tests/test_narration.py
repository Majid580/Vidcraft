import pytest

from narration import agent, tts


# --- Narrator agent -------------------------------------------------------

SHOTS = [
    {"shot_id": 1, "description": "wide of the forge", "camera": "wide, static"},
    {"shot_id": 2, "description": "the blade glows", "camera": "close-up"},
]


def _fake(payload):
    return lambda system, user, temperature=0.3: payload


def test_no_shots_is_a_noop(monkeypatch):
    called = False

    def fake(system, user, temperature=0.3):
        nonlocal called
        called = True
        return {}

    monkeypatch.setattr(agent, "complete_json", fake)
    assert agent.write_narration([]) == []
    assert called is False


def test_beats_are_returned_per_shot(monkeypatch):
    monkeypatch.setattr(agent, "complete_json", _fake({"shots": [
        {"shot_id": 1, "beats": [{"action": "sparks fly", "narration": "It burns again."}]},
        {"shot_id": 2, "beats": [
            {"action": "metal glows", "narration": "The steel takes its colour."},
            {"action": "hammer falls", "narration": ""},
        ]},
    ]}))
    result = agent.write_narration(SHOTS, {"setting": "a forge"})
    assert [s["shot_id"] for s in result] == [1, 2]
    assert len(result[1]["beats"]) == 2
    assert result[0]["beats"][0]["beat_id"] == 1
    assert result[1]["beats"][1]["beat_id"] == 2


def test_a_silent_beat_is_allowed(monkeypatch):
    # Silence is a legitimate authoring choice; it must survive as "".
    monkeypatch.setattr(agent, "complete_json", _fake({"shots": [
        {"shot_id": 1, "beats": [{"action": "sparks fly", "narration": ""}]},
        {"shot_id": 2, "beats": [{"action": "metal glows", "narration": None}]},
    ]}))
    result = agent.write_narration(SHOTS)
    assert result[0]["beats"][0]["narration"] == ""
    assert result[1]["beats"][0]["narration"] == ""


def test_wrong_shot_count_raises(monkeypatch):
    # A narration list that silently skips a shot would leave it mute with
    # no indication why, so misalignment must be loud.
    monkeypatch.setattr(agent, "complete_json", _fake({"shots": [
        {"shot_id": 1, "beats": [{"action": "a", "narration": "b"}]},
    ]}))
    with pytest.raises(agent.NarratorOutputError):
        agent.write_narration(SHOTS)


def test_missing_beats_raises(monkeypatch):
    monkeypatch.setattr(agent, "complete_json", _fake({"shots": [
        {"shot_id": 1, "beats": []},
        {"shot_id": 2, "beats": [{"action": "a", "narration": "b"}]},
    ]}))
    with pytest.raises(agent.NarratorOutputError):
        agent.write_narration(SHOTS)


def test_missing_action_raises(monkeypatch):
    monkeypatch.setattr(agent, "complete_json", _fake({"shots": [
        {"shot_id": 1, "beats": [{"narration": "no action given"}]},
        {"shot_id": 2, "beats": [{"action": "a", "narration": "b"}]},
    ]}))
    with pytest.raises(agent.NarratorOutputError):
        agent.write_narration(SHOTS)


def test_beats_are_capped_per_shot(monkeypatch):
    monkeypatch.setattr(agent, "complete_json", _fake({"shots": [
        {"shot_id": 1, "beats": [{"action": f"a{i}", "narration": "x"} for i in range(9)]},
        {"shot_id": 2, "beats": [{"action": "a", "narration": "b"}]},
    ]}))
    result = agent.write_narration(SHOTS)
    assert len(result[0]["beats"]) == agent.MAX_BEATS_PER_SHOT


def test_narrator_is_never_asked_for_timings():
    # Durations are measured from real speech; a model that volunteers them
    # would reintroduce the drift this whole layer exists to remove.
    assert "Do NOT provide any timings" in agent.NARRATOR_SYSTEM_PROMPT


# --- Timeline -------------------------------------------------------------

def _shot(shot_id, *durations):
    return {
        "shot_id": shot_id,
        "beats": [
            {"beat_id": i, "action": "a", "narration": "n", "duration_s": d}
            for i, d in enumerate(durations, start=1)
        ],
    }


def test_timeline_is_contiguous_and_derived_from_measurements():
    result = tts.beat_timeline([_shot(1, 3.0, 2.0), _shot(2, 1.5)])

    assert result[0]["start_s"] == 0.0
    assert result[0]["duration_s"] == 5.0
    assert result[1]["start_s"] == 5.0
    assert result[1]["duration_s"] == 1.5

    flat = [b for s in result for b in s["beats"]]
    assert [b["start_s"] for b in flat] == [0.0, 3.0, 5.0]
    assert [b["end_s"] for b in flat] == [3.0, 5.0, 6.5]
    # No gaps and no overlaps: each beat starts exactly where the last ended.
    for previous, following in zip(flat, flat[1:]):
        assert previous["end_s"] == following["start_s"]


def test_shot_duration_equals_the_sum_of_its_beats():
    result = tts.beat_timeline([_shot(1, 1.25, 2.5, 0.75)])
    assert result[0]["duration_s"] == 4.5


def test_total_timeline_equals_total_measured_speech():
    shots = [_shot(1, 3.212, 2.487), _shot(2, 2.462)]
    result = tts.beat_timeline(shots)
    measured = sum(b["duration_s"] for s in shots for b in s["beats"])
    assert abs(sum(s["duration_s"] for s in result) - measured) < 0.01


def test_unmeasured_beat_raises():
    # Building a timeline from a guessed duration is the failure mode this
    # module exists to prevent, so it must be impossible rather than lenient.
    with pytest.raises(ValueError):
        tts.beat_timeline([{"shot_id": 1, "beats": [{"beat_id": 1, "action": "a"}]}])


def test_zero_duration_beat_raises():
    with pytest.raises(ValueError):
        tts.beat_timeline([_shot(1, 0)])


def test_empty_timeline_is_empty():
    assert tts.beat_timeline([]) == []


# --- Synthesis guards -----------------------------------------------------

def test_empty_narration_refuses_synthesis():
    with pytest.raises(ValueError):
        tts.synthesize("   ")


def test_silent_beat_still_occupies_time(monkeypatch):
    # A beat with no narration is a pause in the voiceover, not an
    # instruction to drop the picture.
    assert tts.duration_for("") == tts.SILENT_BEAT_SECONDS


def test_spoken_beat_costs_its_measured_length_plus_padding(monkeypatch):
    monkeypatch.setattr(tts, "synthesize", lambda text, **kw: {"duration_s": 2.0})
    assert tts.duration_for("something") == 2.0 + tts.BEAT_PADDING_SECONDS


def test_unusably_short_report_raises_rather_than_guessing(monkeypatch):
    async def fake(text, voice):
        return b"audio-bytes", 0.0

    monkeypatch.setattr(tts, "_synthesize_edge", fake)
    with pytest.raises(tts.SpeechSynthesisError):
        tts.synthesize("a line that produced no timing")
