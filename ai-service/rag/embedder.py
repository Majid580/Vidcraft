"""Sentence-embedding model wrapper for RAG (RAG-001, FR-4).

Lazy, cached load of `all-MiniLM-L6-v2` (the corpus + query encoder mandated
by FR-4 / ADR-004). The model is only loaded on the first real `embed()`
call, so an empty index can be created and queried — and the empty-path
tests can run — without downloading or loading the ~90 MB model.
"""

import functools

import numpy as np

from config import EMBEDDING_MODEL


@functools.lru_cache(maxsize=1)
def get_model():
    """Load the sentence-transformer once per process and cache it.

    `sentence_transformers` is imported lazily (inside the function) so that
    importing the `rag` package stays cheap and dependency-light.
    """
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(EMBEDDING_MODEL)


def embed(texts) -> np.ndarray:
    """Encode text(s) into L2-normalized float32 vectors.

    Normalizing means a FAISS inner-product search is exactly cosine
    similarity (FR-4). Accepts a single string or an iterable of strings;
    always returns a 2-D array of shape (n, EMBEDDING_DIM).
    """
    if isinstance(texts, str):
        texts = [texts]
    vectors = get_model().encode(
        list(texts), normalize_embeddings=True, convert_to_numpy=True
    )
    return np.asarray(vectors, dtype="float32")
