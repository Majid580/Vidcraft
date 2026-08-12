"""EVAL-003 runner (run_multiagent.run()) unit tests.

Offline: generate_multiagent and score_prompt are monkeypatched, and
pace_seconds=0 removes the real inter-prompt sleep, so this exercises the
per-prompt result shape / error-isolation logic without any network call,
spaCy model load, or LangGraph invocation.
"""

from evaluation import run_multiagent

_ITEM = {
    "id": "sci-fi-1",
    "prompt": "A drone hovers over a canyon.",
    "complexity": "single-beat",
    "genre": "sci-fi",
    "tags": ["space"],
}

_STORYBOARD = {
    "storyboard_id": "sb_test",
    "world_state": {"setting": "a canyon", "style_tokens": []},
    "shots": [
        {"shot_id": 1, "description": "A drone hovers.", "camera": "wide, static", "duration_s": 4},
        {"shot_id": 2, "description": "It scans the ground.", "camera": "close-up, static", "duration_s": 3},
    ],
    "attempt_count": 1,
    "similarity_score": 0.71,
}


def _fake_score(overall):
    return {"overall_score": overall, "dimensions": {"subject_clarity": overall}}


def test_run_records_ok_result(monkeypatch):
    monkeypatch.setattr(run_multiagent, "generate_multiagent", lambda prompt: _STORYBOARD)
    scores = iter([_fake_score(40), _fake_score(85)])
    monkeypatch.setattr(run_multiagent, "score_prompt", lambda text: next(scores))

    [record] = run_multiagent.run([_ITEM], pace_seconds=0)

    assert record["id"] == "sci-fi-1"
    assert record["condition"] == "multiagent"
    assert record["status"] == "ok"
    assert record["shots"] == _STORYBOARD["shots"]
    assert record["attempt_count"] == 1
    assert record["similarity_score"] == 0.71
    assert record["enhanced_description"] == "A drone hovers.. It scans the ground."
    assert record["original_score"] == 40
    assert record["enhanced_score"] == 85


def test_run_isolates_a_failure_to_one_prompt(monkeypatch):
    def fake_generate(prompt):
        if prompt == "boom":
            raise RuntimeError("graph exploded")
        return _STORYBOARD

    monkeypatch.setattr(run_multiagent, "generate_multiagent", fake_generate)
    monkeypatch.setattr(run_multiagent, "score_prompt", lambda text: _fake_score(50))

    items = [
        {**_ITEM, "id": "a", "prompt": "boom"},
        {**_ITEM, "id": "b", "prompt": "a fine prompt"},
    ]
    results = run_multiagent.run(items, pace_seconds=0)

    assert results[0]["status"] == "error"
    assert "graph exploded" in results[0]["error"]
    assert results[1]["status"] == "ok"


def test_run_handles_an_empty_shot_list_without_a_second_score_call(monkeypatch):
    empty_storyboard = {**_STORYBOARD, "shots": []}
    monkeypatch.setattr(run_multiagent, "generate_multiagent", lambda prompt: empty_storyboard)
    monkeypatch.setattr(run_multiagent, "score_prompt", lambda text: _fake_score(50))

    [record] = run_multiagent.run([_ITEM], pace_seconds=0)

    assert record["status"] == "ok"
    assert record["enhanced_description"] == ""
    assert record["enhanced_score"] is None
    assert record["enhanced_dimensions"] is None


def test_run_returns_one_record_per_prompt(monkeypatch):
    monkeypatch.setattr(run_multiagent, "generate_multiagent", lambda prompt: _STORYBOARD)
    monkeypatch.setattr(run_multiagent, "score_prompt", lambda text: _fake_score(60))

    items = [{**_ITEM, "id": f"p{i}", "prompt": f"prompt {i} is here"} for i in range(5)]
    results = run_multiagent.run(items, pace_seconds=0)

    assert [r["id"] for r in results] == [f"p{i}" for i in range(5)]


def test_run_reuses_previous_ok_records_without_calling_generate(monkeypatch):
    calls = []
    monkeypatch.setattr(
        run_multiagent, "generate_multiagent",
        lambda prompt: calls.append(prompt) or _STORYBOARD,
    )
    monkeypatch.setattr(run_multiagent, "score_prompt", lambda text: _fake_score(60))

    already_done = {"a": {"id": "a", "status": "ok", "enhanced_description": "cached result"}}
    items = [{**_ITEM, "id": "a", "prompt": "boom if called"}, {**_ITEM, "id": "b", "prompt": "run me"}]
    results = run_multiagent.run(items, pace_seconds=0, previous_ok=already_done)

    assert results[0] == already_done["a"]
    assert results[1]["id"] == "b"
    assert results[1]["status"] == "ok"
    assert calls == ["run me"]
