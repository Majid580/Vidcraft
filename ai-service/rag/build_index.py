"""Build + persist the production RAG vector index (RAG-003, FR-4).

This is the offline *corpus ingestion* step. It loads the curated
cinematography corpus (RAG-002), embeds every passage with the real
``all-MiniLM-L6-v2`` encoder (RAG-001), and writes the populated FAISS index
plus its JSON metadata sidecar to ``VECTOR_INDEX_PATH``. The Cinematographer
agent (AI-007) then queries that persisted index via ``VectorIndex.load()``.

Idempotent by design: a run rebuilds the whole index from the corpus, so the
committed corpus (RAG-002) is the single source of truth and the generated
index (gitignored ``rag/data/``) is a derived, disposable artifact. Re-run it
whenever the corpus changes:

    python -m rag.build_index          # (from ai-service/, inside .venv-wsl)

MongoDB ``embeddings`` collection (Section 10.1) note — per ADR-004 the JSON
sidecar written beside the index is the canonical metadata store, and the
Mongo sync stays DEFERRED (see ADR-017): the sole consumer (AI-007) reads the
FAISS index directly, and the Python ai-service has no Mongo client. The
sidecar already holds the Mongo-ready ``{text, metadata}`` rows, so adopting
the collection later is a straightforward load, not a re-embed.
"""

import argparse
from collections import Counter

from config import EMBEDDING_DIM, VECTOR_INDEX_PATH
from .corpus import load_corpus
from .index import VectorIndex


def build_index(
    path: str = VECTOR_INDEX_PATH,
    *,
    embed_fn=None,
    files=None,
    dim: int = EMBEDDING_DIM,
) -> tuple[VectorIndex, int]:
    """Load the corpus, embed it, and persist a populated ``VectorIndex``.

    ``embed_fn`` is injectable so tests can build a real persisted index with
    deterministic vectors instead of loading the ~90 MB model; production
    callers omit it to use the real ``all-MiniLM-L6-v2`` encoder. ``files``
    overrides which corpus files are ingested (defaults to the full curated
    set). Returns ``(index, count_added)``.

    Raises :class:`rag.corpus.CorpusError` if the corpus is missing, malformed,
    or empty — the index is only written after a successful, non-empty load.
    """
    kwargs = {} if embed_fn is None else {"embed_fn": embed_fn}
    index = VectorIndex(dim=dim, **kwargs)

    items = load_corpus() if files is None else load_corpus(files)
    added = index.add(items)  # load_corpus already guarantees a non-empty list
    index.save(path)
    return index, added


def _category_counts(index: VectorIndex) -> Counter:
    return Counter(m["metadata"].get("category", "?") for m in index.metadata)


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(
        description="Build + persist the RAG production vector index (RAG-003)."
    )
    parser.add_argument(
        "--path",
        default=VECTOR_INDEX_PATH,
        help=f"base output path (writes {{path}}.faiss + {{path}}.meta.json; default: {VECTOR_INDEX_PATH})",
    )
    args = parser.parse_args(argv)

    index, added = build_index(args.path)
    print(f"Built RAG index: {added} passages -> {len(index)} vectors ({index.dim}-dim)")
    print(f"Persisted to {args.path}.faiss + {args.path}.meta.json")
    for category, count in sorted(_category_counts(index).items()):
        print(f"  {category:<12} {count}")


if __name__ == "__main__":  # pragma: no cover
    main()
