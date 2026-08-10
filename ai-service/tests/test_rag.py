"""Unit tests for the RAG-001 FAISS vector-index scaffold.

The real all-MiniLM-L6-v2 embedder is never loaded here: a deterministic
3-dimensional `fake_embed` is injected so the tests stay fast, offline, and
free of the ~90 MB model download. The empty-index path needs no embedder
at all (it short-circuits), which is the scaffold's core acceptance test.
"""

import numpy as np

from rag import VectorIndex

CORPUS = [
    {"text": "wide establishing landscape shot", "metadata": {"id": "wide"}},
    {"text": "extreme close-up on a face", "metadata": {"id": "close"}},
    {"text": "dark night scene lighting", "metadata": {"id": "night"}},
]


def fake_embed(texts):
    """Map text to a normalized 3-axis vector by keyword presence."""
    rows = []
    for t in texts:
        low = t.lower()
        rows.append(
            [
                float("wide" in low or "landscape" in low),
                float("close" in low or "face" in low),
                float("night" in low or "dark" in low),
            ]
        )
    matrix = np.asarray(rows, dtype="float32") + 0.01  # avoid zero vectors
    return matrix / np.linalg.norm(matrix, axis=1, keepdims=True)


def make_index() -> VectorIndex:
    return VectorIndex(dim=3, embed_fn=fake_embed)


def test_empty_index_creates_and_searches_gracefully():
    index = make_index()
    assert len(index) == 0
    assert index.search("anything at all") == []  # no embedder call, no error


def test_add_returns_count_and_empty_add_is_noop():
    index = make_index()
    assert index.add(CORPUS) == 3
    assert len(index) == 3
    assert index.add([]) == 0
    assert len(index) == 3


def test_search_ranks_by_cosine_similarity():
    index = make_index()
    index.add(CORPUS)
    results = index.search("a sweeping wide landscape vista", k=2)

    assert len(results) == 2
    assert results[0]["metadata"]["id"] == "wide"
    # scores are cosine similarities, descending
    assert results[0]["score"] >= results[1]["score"]


def test_search_k_larger_than_corpus_is_clamped():
    index = make_index()
    index.add(CORPUS)
    results = index.search("close-up of a face", k=10)

    assert len(results) == 3  # clamped to corpus size, no -1 padding leaks through
    assert results[0]["metadata"]["id"] == "close"


def test_search_carries_metadata_and_text():
    index = make_index()
    index.add(CORPUS)
    top = index.search("night time darkness", k=1)[0]

    assert top["text"] == "dark night scene lighting"
    assert top["metadata"] == {"id": "night"}


def test_zero_k_returns_empty():
    index = make_index()
    index.add(CORPUS)
    assert index.search("wide landscape", k=0) == []


def test_persistence_round_trip(tmp_path):
    path = str(tmp_path / "style_index")
    index = make_index()
    index.add(CORPUS)
    index.save(path)

    loaded = VectorIndex.load(path, dim=3, embed_fn=fake_embed)
    assert len(loaded) == 3
    assert loaded.search("wide landscape", k=1)[0]["metadata"]["id"] == "wide"


def test_load_missing_path_returns_empty_index(tmp_path):
    loaded = VectorIndex.load(str(tmp_path / "does_not_exist"), dim=3, embed_fn=fake_embed)
    assert len(loaded) == 0
    assert loaded.search("anything") == []


def test_dim_mismatch_raises():
    index = VectorIndex(dim=5, embed_fn=fake_embed)  # fake_embed emits dim 3
    try:
        index.add(CORPUS)
        assert False, "expected ValueError on dim mismatch"
    except ValueError as exc:
        assert "dim" in str(exc)
