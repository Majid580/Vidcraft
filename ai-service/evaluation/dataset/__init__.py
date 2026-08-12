"""Fixed 50-prompt evaluation set (EVAL-001, FR-12).

Exposes :func:`load_prompts`, which reads the curated prompt set used by the
comparative evaluation study (EVAL-002/003/004): the same fixed prompts run
under both the single-shot baseline and the full multi-agent pipeline.
"""

from .loader import DATASET_FILES, EvaluationDatasetError, VALID_COMPLEXITIES, load_prompts

__all__ = ["load_prompts", "DATASET_FILES", "EvaluationDatasetError", "VALID_COMPLEXITIES"]
