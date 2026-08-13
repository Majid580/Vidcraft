"""Evaluation study package (FR-12, Phase 9).

`dataset/` holds the fixed 50-prompt test set (EVAL-001). `baseline.py` +
`run_baseline.py` are EVAL-002's Condition A (single-shot baseline)
enhancer + runner. `multiagent.py` + `run_multiagent.py` are EVAL-003's
Condition B (full multi-agent pipeline) wrapper + runner.

EVAL-004 is the scoring arm and lands in three siblings (ADR-030):
`media.py` generates one still per frame from a condition's own text,
`alignment.py` scores a frame against the ORIGINAL prompt with a
CLIPScore-style metric, and `run_scoring.py` pairs the conditions and emits
`results/eval004_comparison.md` — the comparison table Section 4.7 asks for.

Read `results/eval004_comparison.md` before quoting any number from it: the
multi-agent condition is reported under two aggregations (mean-of-shots and
best-shot) precisely because a single figure would misrepresent what shot
decomposition does to a whole-prompt frame metric.
"""
