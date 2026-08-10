"""RAG-002 corpus validation tests.

These are offline and dependency-light: they exercise the loader + curated
JSON only (no model download, no FAISS), so they run anywhere pytest runs.
"""

from collections import Counter

import pytest

from rag.corpus import CorpusError, load_corpus

EXPECTED_CATEGORIES = {
    "framing",
    "angle",
    "movement",
    "lens",
    "lighting",
    "color",
    "composition",
    "mood",
}


def test_corpus_loads_and_is_nonempty():
    items = load_corpus()
    assert len(items) >= 50, "corpus should be a substantial reference set"


def test_every_item_has_the_vectorindex_shape():
    for item in load_corpus():
        assert set(item.keys()) == {"text", "metadata"}
        assert isinstance(item["text"], str) and item["text"].strip()
        assert isinstance(item["metadata"], dict)


def test_ids_are_unique():
    ids = [it["metadata"]["id"] for it in load_corpus()]
    dupes = [i for i, c in Counter(ids).items() if c > 1]
    assert not dupes, f"duplicate ids: {dupes}"


def test_categories_are_all_covered_and_valid():
    cats = {it["metadata"].get("category") for it in load_corpus()}
    assert cats == EXPECTED_CATEGORIES


def test_every_category_has_multiple_entries():
    counts = Counter(it["metadata"]["category"] for it in load_corpus())
    thin = {c: n for c, n in counts.items() if n < 3}
    assert not thin, f"categories with too few entries for useful retrieval: {thin}"


def test_items_carry_tags_for_retrieval_and_eval():
    for it in load_corpus():
        tags = it["metadata"].get("tags")
        assert isinstance(tags, list) and len(tags) >= 3


def test_loader_rejects_a_missing_file():
    with pytest.raises(CorpusError):
        load_corpus(files=("does-not-exist.json",))
