"""Corpus loader + validator (RAG-002).

Reads the curated JSON corpus files and returns validated items ready for
``rag.index.VectorIndex.add``. Validation is deliberately strict so a
malformed or duplicated corpus fails loudly here (at ingestion time, RAG-003)
rather than silently poisoning the vector index.
"""

import json
import os

# Corpus files that make up the curated knowledge base. Add future themed
# files (e.g. genre look-books) here and they are picked up automatically.
CORPUS_FILES = ("cinematography.json",)

_CORPUS_DIR = os.path.dirname(__file__)


class CorpusError(ValueError):
    """Raised when a corpus file is missing, malformed, or fails validation."""


def _validate_item(item, *, file: str, index: int, seen_ids: set) -> dict:
    where = f"{file}[{index}]"
    if not isinstance(item, dict):
        raise CorpusError(f"{where}: each entry must be an object")

    text = item.get("text")
    if not isinstance(text, str) or not text.strip():
        raise CorpusError(f"{where}: 'text' must be a non-empty string")

    metadata = item.get("metadata", {})
    if not isinstance(metadata, dict):
        raise CorpusError(f"{where}: 'metadata' must be an object")

    item_id = metadata.get("id")
    if not isinstance(item_id, str) or not item_id.strip():
        raise CorpusError(f"{where}: metadata.id must be a non-empty string")
    if item_id in seen_ids:
        raise CorpusError(f"{where}: duplicate metadata.id {item_id!r}")
    seen_ids.add(item_id)

    # Return a clean, normalized copy in the VectorIndex.add() item shape.
    return {"text": text.strip(), "metadata": metadata}


def load_corpus(files=CORPUS_FILES) -> list[dict]:
    """Load, validate, and return all curated corpus items.

    Each returned item is ``{"text": str, "metadata": dict}``. Raises
    :class:`CorpusError` on any missing file, malformed entry, or duplicate
    ``metadata.id`` across the whole corpus.
    """
    items: list[dict] = []
    seen_ids: set = set()

    for file in files:
        path = os.path.join(_CORPUS_DIR, file)
        if not os.path.exists(path):
            raise CorpusError(f"corpus file not found: {path}")
        with open(path, "r", encoding="utf-8") as fh:
            try:
                raw = json.load(fh)
            except json.JSONDecodeError as exc:
                raise CorpusError(f"{file}: invalid JSON — {exc}") from exc
        if not isinstance(raw, list) or not raw:
            raise CorpusError(f"{file}: must be a non-empty JSON array")
        for i, entry in enumerate(raw):
            items.append(_validate_item(entry, file=file, index=i, seen_ids=seen_ids))

    return items
