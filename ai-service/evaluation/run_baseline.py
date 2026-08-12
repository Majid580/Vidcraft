"""Evaluation runner for Condition A: single-shot baseline (EVAL-002, FR-12).

Runs every prompt in the fixed 50-prompt set (EVAL-001) through the baseline
single-shot enhancer (``baseline.generate_baseline``, Condition A in
PROJECT_ARCHITECTURE.md Section 4.7) and writes one result record per prompt
to ``evaluation/results/baseline_results.json``.

Per-prompt records also carry FR-1 spaCy scores for the original and
enhanced text (Section 4.7: "spaCy dimension scores - reported, not ground
truth"). Real media generation and the CLIPScore-style alignment metric are
deliberately NOT run here -- see ADR-024 in PROJECT_STATE.yaml.

Paced to stay under the Groq free-tier 30 req/min cap (one LLM call per
prompt); a run failure on one prompt is recorded and does not abort the rest.

Usage: python -m evaluation.run_baseline [--limit N] [--pace SECONDS]
"""

import argparse
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path

from analyzer import score_prompt
from evaluation.baseline import generate_baseline
from evaluation.dataset import load_prompts

logger = logging.getLogger(__name__)

RESULTS_DIR = Path(__file__).parent / "results"
RESULTS_PATH = RESULTS_DIR / "baseline_results.json"

# Groq free tier is 30 req/min (see memory/ADR-006's llm rate-limit note);
# one call/prompt at this pace stays comfortably under it (~24/min).
DEFAULT_PACE_SECONDS = 2.5


def run(prompts: list[dict], *, pace_seconds: float = DEFAULT_PACE_SECONDS) -> list[dict]:
    """Run Condition A over ``prompts``, returning one result record each."""
    results = []
    for i, item in enumerate(prompts):
        if i > 0:
            time.sleep(pace_seconds)

        record = {
            "id": item["id"],
            "genre": item["genre"],
            "complexity": item["complexity"],
            "condition": "baseline",
            "original_prompt": item["prompt"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        try:
            original_scores = score_prompt(item["prompt"])
            baseline = generate_baseline(item["prompt"])
            enhanced_scores = score_prompt(baseline["enhanced_description"])
            record.update(
                {
                    "status": "ok",
                    "enhanced_description": baseline["enhanced_description"],
                    "camera": baseline["camera"],
                    "original_score": original_scores["overall_score"],
                    "enhanced_score": enhanced_scores["overall_score"],
                    "original_dimensions": original_scores["dimensions"],
                    "enhanced_dimensions": enhanced_scores["dimensions"],
                }
            )
        except Exception as exc:  # keep the run alive; one bad prompt shouldn't lose the other 49
            logger.warning("[%s] baseline generation failed: %s", item["id"], exc)
            record.update({"status": "error", "error": str(exc)})

        results.append(record)
        logger.info("[%d/%d] %s -> %s", i + 1, len(prompts), item["id"], record["status"])

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--limit", type=int, default=None, help="run only the first N prompts (smoke testing)"
    )
    parser.add_argument(
        "--pace", type=float, default=DEFAULT_PACE_SECONDS, help="seconds to sleep between LLM calls"
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    prompts = load_prompts()
    if args.limit:
        prompts = prompts[: args.limit]

    results = run(prompts, pace_seconds=args.pace)

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_PATH.write_text(json.dumps(results, indent=2), encoding="utf-8")

    ok = sum(1 for r in results if r["status"] == "ok")
    logger.info("Done: %d/%d succeeded. Results written to %s", ok, len(results), RESULTS_PATH)


if __name__ == "__main__":
    main()
