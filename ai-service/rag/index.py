"""Local FAISS vector index with a JSON metadata sidecar (RAG-001, FR-4).

Design (ADR-004 — FAISS + local metadata, no managed vector DB):
  * Vectors live in a FAISS ``IndexFlatIP``. Because the embedder returns
    L2-normalized vectors, inner-product search is exactly cosine
    similarity (FR-4, "top-k retrieval via cosine similarity").
  * Each vector's metadata (the source ``text`` plus an arbitrary dict) is
    kept in a parallel Python list; FAISS row ``i`` corresponds to
    ``self.metadata[i]``. The list is persisted as a JSON sidecar next to
    the index file.
  * Persistence writes two files from one base path: ``{path}.faiss`` and
    ``{path}.meta.json``.

MongoDB sync note: Section 10.1 defines an ``embeddings`` collection as the
eventual canonical metadata store, synced with this FAISS index. That sync
is deferred to RAG-003, when the real curated corpus (RAG-002) is ingested.
For this scaffold the JSON sidecar IS the metadata store, which keeps the
index self-contained and unit-testable without a live MongoDB. See the
metadata-sync note in PROJECT_ARCHITECTURE.md Section 10.
"""

import json
import os

import faiss
import numpy as np

from config import EMBEDDING_DIM, RAG_TOP_K, VECTOR_INDEX_PATH
from .embedder import embed as default_embed


class VectorIndex:
    """A cosine-similarity vector store over a curated text corpus.

    ``embed_fn`` is injectable so tests can supply deterministic vectors
    without loading the real sentence-transformer model.
    """

    def __init__(self, dim: int = EMBEDDING_DIM, embed_fn=default_embed):
        self.dim = dim
        self._embed = embed_fn
        self.index = faiss.IndexFlatIP(dim)
        self.metadata: list[dict] = []

    def __len__(self) -> int:
        return self.index.ntotal

    def add(self, items) -> int:
        """Embed and add corpus items.

        ``items`` is an iterable of either plain strings or dicts shaped
        ``{"text": str, "metadata": dict}``. Returns the number added. An
        empty iterable is a no-op (no embedding call).
        """
        normalized = [
            {"text": it, "metadata": {}}
            if isinstance(it, str)
            else {"text": it["text"], "metadata": it.get("metadata", {})}
            for it in items
        ]
        if not normalized:
            return 0

        vectors = self._as_faiss_matrix(self._embed([n["text"] for n in normalized]))
        if vectors.shape[1] != self.dim:
            raise ValueError(
                f"embedding dim {vectors.shape[1]} != index dim {self.dim}"
            )
        self.index.add(vectors)
        self.metadata.extend(normalized)
        return len(normalized)

    def search(self, query: str, k: int = RAG_TOP_K) -> list[dict]:
        """Return up to ``k`` nearest corpus items to ``query``.

        Gracefully returns ``[]`` for an empty index (the scaffold's core
        acceptance criterion) — short-circuited before any embedding call.
        Each result is ``{"text", "metadata", "score"}`` (score = cosine
        similarity), ordered most-similar first.
        """
        if len(self) == 0 or k <= 0:
            return []

        query_vec = self._as_faiss_matrix(self._embed([query]))
        scores, ids = self.index.search(query_vec, min(k, len(self)))
        results = []
        for score, idx in zip(scores[0], ids[0]):
            if idx < 0:  # FAISS pads with -1 when fewer than k neighbours exist
                continue
            item = self.metadata[idx]
            results.append(
                {"text": item["text"], "metadata": item["metadata"], "score": float(score)}
            )
        return results

    def save(self, path: str = VECTOR_INDEX_PATH) -> None:
        """Persist the FAISS index + metadata sidecar to ``{path}.faiss`` / ``{path}.meta.json``."""
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        faiss.write_index(self.index, f"{path}.faiss")
        with open(f"{path}.meta.json", "w", encoding="utf-8") as fh:
            json.dump(self.metadata, fh, ensure_ascii=False, indent=2)

    @classmethod
    def load(
        cls, path: str = VECTOR_INDEX_PATH, dim: int = EMBEDDING_DIM, embed_fn=default_embed
    ) -> "VectorIndex":
        """Load a persisted index, or return a fresh empty one if none exists.

        A missing index on disk is treated as "empty corpus", not an error —
        callers (the Cinematographer, AI-007) can query it and get ``[]``.
        """
        store = cls(dim=dim, embed_fn=embed_fn)
        index_file = f"{path}.faiss"
        meta_file = f"{path}.meta.json"
        if not (os.path.exists(index_file) and os.path.exists(meta_file)):
            return store
        store.index = faiss.read_index(index_file)
        with open(meta_file, "r", encoding="utf-8") as fh:
            store.metadata = json.load(fh)
        store.dim = store.index.d
        return store

    @staticmethod
    def _as_faiss_matrix(vectors) -> np.ndarray:
        """Coerce embeddings to the contiguous 2-D float32 array FAISS requires."""
        matrix = np.ascontiguousarray(np.asarray(vectors, dtype="float32"))
        if matrix.ndim == 1:
            matrix = matrix.reshape(1, -1)
        return matrix
