"""Unit tests for the RAG-003 production-index builder.

The real all-MiniLM-L6-v2 model is never loaded: a deterministic hash-based
``fake_embed`` is injected so the build runs fast, offline, and without the
~90 MB download. These tests exercise the ingest -> embed -> persist ->
reload contract against the ACTUAL curated corpus (RAG-002), so a corpus that
regresses in size, shape, or category coverage fails here.
"""

import numpy as np
import pytest

from rag.build_index import build_index
from rag.corpus import CorpusError, load_corpus
from rag.index import VectorIndex

DIM = 8


def fake_embed(texts) -> np.ndarray:
    """Deterministic, offline stand-in for the real encoder.

    Buckets each text into a DIM-dimensional vector by hashing its tokens, so
    identical text always embeds identically (persistence round-trips exactly)
    while different passages generally differ.
    """
    rows = []
    for text in texts:
        vec = np.zeros(DIM, dtype="float32")
        for token in text.lower().split():
            vec[hash(token) % DIM] += 1.0
        rows.append(vec)
    matrix = np.asarray(rows, dtype="float32") + 0.01  # avoid zero vectors
    return matrix / np.linalg.norm(matrix, axis=1, keepdims=True)


def _build(tmp_path):
    path = str(tmp_path / "style_index")
    index, added = build_index(path, embed_fn=fake_embed, dim=DIM)
    return path, index, added


def test_build_ingests_entire_corpus(tmp_path):
    corpus = load_corpus()
    _, index, added = _build(tmp_path)

    assert added == len(corpus)
    assert len(index) == len(corpus)
    assert added >= 75  # RAG-002 curated at least 75 passages


def test_build_persists_reloadable_index(tmp_path):
    path, built, _ = _build(tmp_path)

    reloaded = VectorIndex.load(path, dim=DIM, embed_fn=fake_embed)
    assert len(reloaded) == len(built)
    # metadata sidecar survives the round-trip intact
    assert reloaded.metadata[0]["metadata"]["id"] == built.metadata[0]["metadata"]["id"]


def test_persisted_index_is_queryable(tmp_path):
    path, _, _ = _build(tmp_path)

    reloaded = VectorIndex.load(path, dim=DIM, embed_fn=fake_embed)
    results = reloaded.search("wide establishing landscape shot", k=3)

    assert len(results) == 3
    assert all("id" in r["metadata"] for r in results)
    assert results[0]["score"] >= results[-1]["score"]  # descending cosine scores


def test_every_vector_carries_id_and_category(tmp_path):
    _, index, _ = _build(tmp_path)

    for item in index.metadata:
        assert item["metadata"]["id"]
        assert item["metadata"]["category"]


def test_all_ids_unique_in_built_index(tmp_path):
    _, index, _ = _build(tmp_path)

    ids = [item["metadata"]["id"] for item in index.metadata]
    assert len(ids) == len(set(ids))


def test_build_propagates_corpus_error(tmp_path):
    path = str(tmp_path / "style_index")
    with pytest.raises(CorpusError):
        build_index(path, embed_fn=fake_embed, dim=DIM, files=("does_not_exist.json",))
