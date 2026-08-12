"""EVAL-001 fixed evaluation prompt-set validation tests.

Offline and dependency-light: exercise the loader + curated JSON only (no
model download, no network), so they run anywhere pytest runs.
"""

from collections import Counter

import pytest

from evaluation.dataset import EvaluationDatasetError, VALID_COMPLEXITIES, load_prompts


def test_dataset_loads_exactly_fifty():
    prompts = load_prompts()
    assert len(prompts) == 50, "the evaluation set is a FIXED 50-prompt set (EVAL-001 acceptance criterion)"


def test_every_item_has_the_expected_shape():
    for item in load_prompts():
        assert set(item.keys()) == {"id", "prompt", "complexity", "genre", "tags"}
        assert isinstance(item["id"], str) and item["id"].strip()
        assert isinstance(item["prompt"], str) and item["prompt"].strip()
        assert isinstance(item["genre"], str) and item["genre"].strip()
        assert isinstance(item["tags"], list)


def test_ids_are_unique():
    ids = [it["id"] for it in load_prompts()]
    dupes = [i for i, c in Counter(ids).items() if c > 1]
    assert not dupes, f"duplicate ids: {dupes}"


def test_prompt_texts_are_unique():
    texts = [it["prompt"].lower() for it in load_prompts()]
    dupes = [t for t, c in Counter(texts).items() if c > 1]
    assert not dupes, "duplicate prompt text found — the fixed set should have 50 distinct scenes"


def test_complexity_values_are_valid_and_both_represented():
    complexities = Counter(it["complexity"] for it in load_prompts())
    assert set(complexities.keys()) <= VALID_COMPLEXITIES
    assert complexities["single-beat"] >= 15, "need substantial single-shot-idea coverage"
    assert complexities["multi-beat"] >= 15, "need substantial multi-shot-idea coverage"


def test_genres_are_diverse_and_not_thin():
    genres = Counter(it["genre"] for it in load_prompts())
    assert len(genres) >= 10, "the set should span many genres, not repeat a handful of themes"
    thin = {g: n for g, n in genres.items() if n < 2}
    assert not thin, f"genres with too few entries: {thin}"


def test_prompts_carry_tags():
    for it in load_prompts():
        assert len(it["tags"]) >= 2


def test_prompts_are_substantial_scene_descriptions():
    for it in load_prompts():
        assert len(it["prompt"]) >= 40, f"{it['id']}: prompt too short to be a real scene description"


def test_loader_rejects_a_missing_file():
    with pytest.raises(EvaluationDatasetError):
        load_prompts(files=("does-not-exist.json",))
