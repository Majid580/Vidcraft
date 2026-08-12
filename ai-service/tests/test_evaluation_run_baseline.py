"""EVAL-002 runner (run_baseline.run()) unit tests.

Offline: both the baseline generator and the spaCy scorer are
monkeypatched, and pace_seconds=0 removes the real rate-limit sleep, so
this exercises the per-prompt result shape / error-isolation logic without
any network call or spaCy model load.
"""

from evaluation import run_baseline

_ITEM = {
    "id": "sci-fi-1",
    "prompt": "A drone hovers over a canyon.",
    "complexity": "single-beat",
    "genre": "sci-fi",
    "tags": ["space"],
}


def _fake_score(overall):
    return {"overall_score": overall, "dimensions": {"subject_clarity": overall}}


def test_run_records_ok_result(monkeypatch):
    monkeypatch.setattr(
        run_baseline, "generate_baseline",
        lambda prompt: {"enhanced_description": "an enhanced scene", "camera": "wide, static"},
    )
    scores = iter([_fake_score(40), _fake_score(80)])
    monkeypatch.setattr(run_baseline, "score_prompt", lambda text: next(scores))

    [record] = run_baseline.run([_ITEM], pace_seconds=0)

    assert record["id"] == "sci-fi-1"
    assert record["condition"] == "baseline"
    assert record["status"] == "ok"
    assert record["enhanced_description"] == "an enhanced scene"
    assert record["original_score"] == 40
    assert record["enhanced_score"] == 80


def test_run_isolates_a_failure_to_one_prompt(monkeypatch):
    def fake_generate(prompt):
        if prompt == "boom":
            raise RuntimeError("LLM exploded")
        return {"enhanced_description": "fine", "camera": "medium, static"}

    monkeypatch.setattr(run_baseline, "generate_baseline", fake_generate)
    monkeypatch.setattr(run_baseline, "score_prompt", lambda text: _fake_score(50))

    items = [
        {**_ITEM, "id": "a", "prompt": "boom"},
        {**_ITEM, "id": "b", "prompt": "a fine prompt"},
    ]
    results = run_baseline.run(items, pace_seconds=0)

    assert results[0]["status"] == "error"
    assert "LLM exploded" in results[0]["error"]
    assert results[1]["status"] == "ok"


def test_run_returns_one_record_per_prompt(monkeypatch):
    monkeypatch.setattr(
        run_baseline, "generate_baseline",
        lambda prompt: {"enhanced_description": "x", "camera": "wide, static"},
    )
    monkeypatch.setattr(run_baseline, "score_prompt", lambda text: _fake_score(60))

    items = [{**_ITEM, "id": f"p{i}", "prompt": f"prompt {i} is here"} for i in range(5)]
    results = run_baseline.run(items, pace_seconds=0)

    assert [r["id"] for r in results] == [f"p{i}" for i in range(5)]
