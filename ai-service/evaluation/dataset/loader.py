"""Fixed evaluation prompt-set loader + validator (EVAL-001).

Reads the curated JSON prompt set used by FR-12's comparative evaluation
study (EVAL-002/003/004): the same fixed prompts are run under both the
single-shot baseline and the full multi-agent pipeline, so the set must stay
stable and validated rather than edited ad hoc.
"""

import json
import os

# Dataset files that make up the fixed evaluation set. Kept as a tuple (not a
# single hardcoded filename) for the same reason as rag/corpus/loader.py --
# a themed follow-up file could be added later without changing callers.
DATASET_FILES = ("prompts.json",)

_DATASET_DIR = os.path.dirname(__file__)

VALID_COMPLEXITIES = {"single-beat", "multi-beat"}


class EvaluationDatasetError(ValueError):
    """Raised when the evaluation dataset is missing, malformed, or fails validation."""


def _validate_item(item, *, file: str, index: int, seen_ids: set, seen_prompts: set) -> dict:
    where = f"{file}[{index}]"
    if not isinstance(item, dict):
        raise EvaluationDatasetError(f"{where}: each entry must be an object")

    item_id = item.get("id")
    if not isinstance(item_id, str) or not item_id.strip():
        raise EvaluationDatasetError(f"{where}: 'id' must be a non-empty string")
    if item_id in seen_ids:
        raise EvaluationDatasetError(f"{where}: duplicate id {item_id!r}")
    seen_ids.add(item_id)

    prompt = item.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise EvaluationDatasetError(f"{where}: 'prompt' must be a non-empty string")
    prompt = prompt.strip()
    if len(prompt) < 40:
        raise EvaluationDatasetError(
            f"{where}: 'prompt' is too short to be a real scene description ({len(prompt)} chars)"
        )
    normalized = prompt.lower()
    if normalized in seen_prompts:
        raise EvaluationDatasetError(f"{where}: duplicate prompt text (id {item_id!r})")
    seen_prompts.add(normalized)

    complexity = item.get("complexity")
    if complexity not in VALID_COMPLEXITIES:
        raise EvaluationDatasetError(
            f"{where}: 'complexity' must be one of {sorted(VALID_COMPLEXITIES)}, got {complexity!r}"
        )

    genre = item.get("genre")
    if not isinstance(genre, str) or not genre.strip():
        raise EvaluationDatasetError(f"{where}: 'genre' must be a non-empty string")

    tags = item.get("tags")
    if not isinstance(tags, list) or len(tags) < 2 or not all(isinstance(t, str) and t.strip() for t in tags):
        raise EvaluationDatasetError(f"{where}: 'tags' must be a list of at least 2 non-empty strings")

    return {
        "id": item_id,
        "prompt": prompt,
        "complexity": complexity,
        "genre": genre.strip(),
        "tags": tags,
    }


def load_prompts(files=DATASET_FILES) -> list[dict]:
    """Load, validate, and return the fixed evaluation prompt set.

    Each returned item is ``{"id", "prompt", "complexity", "genre", "tags"}``.
    Raises :class:`EvaluationDatasetError` on any missing file, malformed
    entry, duplicate id, or duplicate prompt text across the whole set.
    """
    items: list[dict] = []
    seen_ids: set = set()
    seen_prompts: set = set()

    for file in files:
        path = os.path.join(_DATASET_DIR, file)
        if not os.path.exists(path):
            raise EvaluationDatasetError(f"dataset file not found: {path}")
        with open(path, "r", encoding="utf-8") as fh:
            try:
                raw = json.load(fh)
            except json.JSONDecodeError as exc:
                raise EvaluationDatasetError(f"{file}: invalid JSON — {exc}") from exc
        if not isinstance(raw, list) or not raw:
            raise EvaluationDatasetError(f"{file}: must be a non-empty JSON array")
        for i, entry in enumerate(raw):
            items.append(
                _validate_item(entry, file=file, index=i, seen_ids=seen_ids, seen_prompts=seen_prompts)
            )

    return items
