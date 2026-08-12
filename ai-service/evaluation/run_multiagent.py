"""Evaluation runner for Condition B: full multi-agent pipeline (EVAL-003, FR-12).

Runs every prompt in the fixed 50-prompt set (EVAL-001) through the full
multi-agent pipeline (``multiagent.generate_multiagent``, Condition B in
PROJECT_ARCHITECTURE.md Section 4.7) and writes one result record per
prompt to ``evaluation/results/multiagent_results.json``.

Per-prompt records carry FR-1 spaCy scores for the original prompt and for
the resulting storyboard's joined shot descriptions -- the same comparison
shape as EVAL-002's ``baseline_results.json`` -- plus ``attempt_count``/
``similarity_score`` retry diagnostics. Real media generation and the
CLIPScore-style alignment metric are deliberately NOT run here -- see
ADR-024/ADR-025 in PROJECT_STATE.yaml.

Each prompt triggers several sequential Groq calls (1 Screenwriter + 1
Cinematographer call per shot, times up to 1+MAX_STORYBOARD_RETRIES
attempts on drift) -- substantially more than EVAL-002's one call/prompt --
so this paces PER PROMPT rather than per LLM call; the graph's own calls
already run sequentially (not concurrently) within one storyboard, which by
itself keeps a single prompt's traffic well under the Groq free-tier 30
req/min cap. It does NOT, however, keep a full 50-prompt run under Groq's
real per-model DAILY token budget (~100k tokens/day for
llama-3.3-70b-versatile in practice, well below the nominal 1M -- see the
2026-08-12 live run note in PROJECT_STATE.yaml/memory), which a multi-call
condition like this one can exhaust partway through. --resume makes a
quota-interrupted run continuable on a later day without re-spending
tokens on prompts that already succeeded.

Usage: python -m evaluation.run_multiagent [--limit N] [--pace SECONDS] [--resume]
"""

import argparse
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path

from analyzer import score_prompt
from evaluation.dataset import load_prompts
from evaluation.multiagent import generate_multiagent

logger = logging.getLogger(__name__)

RESULTS_DIR = Path(__file__).parent / "results"
RESULTS_PATH = RESULTS_DIR / "multiagent_results.json"

DEFAULT_PACE_SECONDS = 2.0


def run(
    prompts: list[dict],
    *,
    pace_seconds: float = DEFAULT_PACE_SECONDS,
    previous_ok: dict[str, dict] | None = None,
) -> list[dict]:
    """Run Condition B over ``prompts``, returning one result record each.

    ``previous_ok`` (id -> already-``"ok"`` record from an earlier,
    quota-interrupted run) lets a prompt be reused verbatim instead of
    re-spending Groq tokens on a prompt that already succeeded.
    """
    previous_ok = previous_ok or {}
    results: list[dict] = []
    made_a_call = False

    for item in prompts:
        if item["id"] in previous_ok:
            results.append(previous_ok[item["id"]])
            logger.info("[%d/%d] %s -> ok (resumed, skipped)", len(results), len(prompts), item["id"])
            continue

        if made_a_call:
            time.sleep(pace_seconds)
        made_a_call = True

        record = {
            "id": item["id"],
            "genre": item["genre"],
            "complexity": item["complexity"],
            "condition": "multiagent",
            "original_prompt": item["prompt"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        try:
            original_scores = score_prompt(item["prompt"])
            storyboard = generate_multiagent(item["prompt"])
            joined_description = ". ".join(
                shot["description"] for shot in storyboard["shots"] if shot.get("description")
            )
            enhanced_scores = score_prompt(joined_description) if joined_description else None
            record.update(
                {
                    "status": "ok",
                    "shots": storyboard["shots"],
                    "world_state": storyboard["world_state"],
                    "attempt_count": storyboard["attempt_count"],
                    "similarity_score": storyboard["similarity_score"],
                    "enhanced_description": joined_description,
                    "original_score": original_scores["overall_score"],
                    "enhanced_score": enhanced_scores["overall_score"] if enhanced_scores else None,
                    "original_dimensions": original_scores["dimensions"],
                    "enhanced_dimensions": enhanced_scores["dimensions"] if enhanced_scores else None,
                }
            )
        except Exception as exc:  # keep the run alive; one bad prompt shouldn't lose the other 49
            logger.warning("[%s] multiagent generation failed: %s", item["id"], exc)
            record.update({"status": "error", "error": str(exc)})

        results.append(record)
        logger.info("[%d/%d] %s -> %s", len(results), len(prompts), item["id"], record["status"])

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--limit", type=int, default=None, help="run only the first N prompts (smoke testing)"
    )
    parser.add_argument(
        "--pace", type=float, default=DEFAULT_PACE_SECONDS, help="seconds to sleep between prompts"
    )
    parser.add_argument(
        "--resume", action="store_true",
        help="reuse already-'ok' records from an existing results file instead of re-running them",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    prompts = load_prompts()
    if args.limit:
        prompts = prompts[: args.limit]

    previous_ok = {}
    if args.resume and RESULTS_PATH.exists():
        existing = json.loads(RESULTS_PATH.read_text(encoding="utf-8"))
        previous_ok = {r["id"]: r for r in existing if r.get("status") == "ok"}
        logger.info("Resuming: reusing %d already-'ok' record(s) from %s", len(previous_ok), RESULTS_PATH)

    results = run(prompts, pace_seconds=args.pace, previous_ok=previous_ok)

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_PATH.write_text(json.dumps(results, indent=2), encoding="utf-8")

    ok = sum(1 for r in results if r["status"] == "ok")
    logger.info("Done: %d/%d succeeded. Results written to %s", ok, len(results), RESULTS_PATH)


if __name__ == "__main__":
    main()
