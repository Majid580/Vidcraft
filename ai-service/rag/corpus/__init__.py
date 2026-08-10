"""Curated RAG corpus (RAG-002).

Exposes :func:`load_corpus`, which reads the curated cinematography reference
corpus and returns it in the exact ``{"text", "metadata"}`` item shape that
``rag.index.VectorIndex.add`` consumes. This is corpus *preparation* only —
embedding + populating a persisted production index is RAG-003.
"""

from .loader import CORPUS_FILES, CorpusError, load_corpus

__all__ = ["load_corpus", "CORPUS_FILES", "CorpusError"]
