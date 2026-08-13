"""EVAL-004 runner: score both conditions and produce the comparison table (FR-12).

Closes PROJECT_ARCHITECTURE.md Section 4.7's diagram. EVAL-002 and EVAL-003
produced the two conditions' *text*; ADR-024/ADR-025 deliberately deferred
the "Generate output - same backend" and metric steps rather than guess at
them. This runner does both, per ADR-030:

    for each prompt present and "ok" in BOTH conditions:
        Condition A -> 1 frame  (its single enhanced_description)
        Condition B -> 1 frame per shot
        every frame scored (CLIPScore) against the ORIGINAL prompt
    -> paired comparison table + the spaCy scores already collected

Three properties make the comparison controlled rather than merely
suggestive. The reference text is identical for both conditions (the
original prompt -- see ``alignment``). The image seed is identical for both
conditions of the same prompt, so seed luck cannot favour one arm. And the
set is PAIRED -- only prompts that succeeded under both conditions are
compared, so neither arm is scored on an easier subset than the other.

**The decomposition confound, stated up front because it governs how the
headline number should be read.** Condition B decomposes a prompt into shots
that each depict a PART of the scene: an establishing wide, then a close-up
of one detail. Condition A produces one frame that tries to summarise the
whole prompt. Scored against the full original prompt, B's individual frames
are therefore expected to score lower *by construction* -- a close-up of a
hand on a collar genuinely does not depict "a rain-soaked neon alley at
night" as completely as a single wide summary frame does. This is a property
of storyboarding, not a defect in the pipeline, and a mean-of-shots number
reported on its own would misrepresent it as one. So both are reported:

    mean-of-shots  -- average frame fidelity to the whole prompt
    best-shot      -- how well the storyboard's strongest frame covers it

Neither is "the" answer. The final report should discuss both, and should
note that CLIPScore cannot see the thing Condition B is actually for --
narrative decomposition and cross-shot continuity -- because it scores one
frame at a time and has no notion of a sequence.

Usage: python -m evaluation.run_scoring [--limit N] [--size PX] [--skip-generation]
"""

import argparse
import json
import logging
import statistics
from pathlib import Path

from evaluation.alignment import get_model, score_frames
from evaluation.media import MediaGenerationError, compose_render_prompt, generate_still

logger = logging.getLogger(__name__)

RESULTS_DIR = Path(__file__).parent / "results"
BASELINE_PATH = RESULTS_DIR / "baseline_results.json"
MULTIAGENT_PATH = RESULTS_DIR / "multiagent_results.json"
SCORES_PATH = RESULTS_DIR / "eval004_scores.json"
TABLE_PATH = RESULTS_DIR / "eval004_comparison.md"
FRAME_CACHE_DIR = RESULTS_DIR / "frames"


def seed_for(prompt_id: str) -> int:
    """Deterministic 31-bit seed from a prompt id.

    FNV-1a, the same construction as ``continuityPrompt.js``'s
    ``seedForStoryboard`` -- stable across processes and runs, because a
    random seed would make this study unreproducible (the exact reason that
    function exists). Clamped below 2^31: several providers reject seeds
    outside signed-32-bit range.
    """
    digest = 2166136261
    for char in str(prompt_id):
        digest ^= ord(char)
        digest = (digest * 16777619) & 0xFFFFFFFF
    return digest % (2**31)


def _load(path: Path) -> dict[str, dict]:
    records = json.loads(path.read_text(encoding="utf-8"))
    return {r["id"]: r for r in records if r.get("status") == "ok"}


def build_frame_plan(baseline: dict, multiagent: dict) -> list[dict]:
    """One entry per prompt in the paired set, listing every frame to render."""
    plan = []
    for prompt_id in sorted(set(baseline) & set(multiagent)):
        a, b = baseline[prompt_id], multiagent[prompt_id]
        seed = seed_for(prompt_id)

        frames_a = [
            {
                "condition": "baseline",
                "shot_id": 1,
                "render_prompt": compose_render_prompt(a["enhanced_description"], a.get("camera")),
                "seed": seed,
            }
        ]
        frames_b = [
            {
                "condition": "multiagent",
                "shot_id": shot.get("shot_id", i + 1),
                "render_prompt": compose_render_prompt(shot["description"], shot.get("camera")),
                "seed": seed,
            }
            for i, shot in enumerate(b.get("shots", []))
            if shot.get("description")
        ]
        if not frames_b:
            logger.warning("[%s] multiagent record has no usable shots; skipping", prompt_id)
            continue

        plan.append(
            {
                "id": prompt_id,
                "genre": a.get("genre"),
                "complexity": a.get("complexity"),
                "original_prompt": a["original_prompt"],
                "frames": frames_a + frames_b,
                "spacy": {
                    "original_score": a.get("original_score"),
                    "baseline_enhanced_score": a.get("enhanced_score"),
                    "multiagent_enhanced_score": b.get("enhanced_score"),
                    "original_dimensions": a.get("original_dimensions"),
                    "baseline_dimensions": a.get("enhanced_dimensions"),
                    "multiagent_dimensions": b.get("enhanced_dimensions"),
                },
                "attempt_count": b.get("attempt_count"),
                "similarity_score": b.get("similarity_score"),
            }
        )
    return plan


def render_and_score(plan: list[dict], *, size: int, skip_generation: bool = False) -> list[dict]:
    """Generate every planned frame (cached) and score it against the original prompt."""
    model = None if skip_generation else get_model()
    scored = []

    for index, entry in enumerate(plan, start=1):
        images, kept = [], []
        for frame in entry["frames"]:
            try:
                images.append(
                    generate_still(
                        frame["render_prompt"],
                        seed=frame["seed"],
                        size=size,
                        cache_dir=FRAME_CACHE_DIR,
                    )
                )
                kept.append(frame)
            except MediaGenerationError as exc:
                logger.warning(
                    "[%s] %s shot %s: frame generation failed permanently: %s",
                    entry["id"], frame["condition"], frame["shot_id"], exc,
                )
                frame["error"] = str(exc)

        results = score_frames(images, entry["original_prompt"], model=model) if images else []
        for frame, result in zip(kept, results):
            frame.update(result)

        scored.append(entry)
        logger.info(
            "[%d/%d] %s -> %d/%d frames scored",
            index, len(plan), entry["id"], len(results), len(entry["frames"]),
        )

    return scored


def _condition_frames(entry: dict, condition: str) -> list[dict]:
    return [f for f in entry["frames"] if f["condition"] == condition and "clipscore" in f]


def aggregate(scored: list[dict]) -> dict:
    """Reduce per-frame scores to the paired comparison the report needs."""
    rows, dropped = [], []

    for entry in scored:
        frames_a = _condition_frames(entry, "baseline")
        frames_b = _condition_frames(entry, "multiagent")
        # A prompt missing either arm cannot contribute to a PAIRED test;
        # keeping it would silently compare different prompt sets.
        if not frames_a or not frames_b:
            dropped.append(entry["id"])
            continue

        shot_scores = [f["clipscore"] for f in frames_b]
        rows.append(
            {
                "id": entry["id"],
                "genre": entry["genre"],
                "complexity": entry["complexity"],
                "baseline": frames_a[0]["clipscore"],
                "multiagent_mean": statistics.fmean(shot_scores),
                "multiagent_best": max(shot_scores),
                "shot_count": len(shot_scores),
                "spacy": entry["spacy"],
            }
        )

    return {"rows": rows, "dropped": dropped}


def paired_stats(rows: list[dict], key: str) -> dict:
    """Paired comparison of Condition B's ``key`` against Condition A."""
    from scipy import stats

    a = [r["baseline"] for r in rows]
    b = [r[key] for r in rows]
    diffs = [x - y for x, y in zip(b, a)]

    result = {
        "n": len(rows),
        "baseline_mean": statistics.fmean(a),
        "multiagent_mean": statistics.fmean(b),
        "mean_difference": statistics.fmean(diffs),
        "wins": sum(1 for d in diffs if d > 0),
        "losses": sum(1 for d in diffs if d < 0),
    }
    if len(rows) > 1:
        result["baseline_sd"] = statistics.stdev(a)
        result["multiagent_sd"] = statistics.stdev(b)
        result["difference_sd"] = statistics.stdev(diffs)
        t_stat, t_p = stats.ttest_rel(b, a)
        result["paired_t"] = float(t_stat)
        result["paired_t_p"] = float(t_p)
        # Wilcoxon makes no normality assumption; with n<=50 and a metric
        # whose distribution nobody has checked, the agreement (or not) of
        # the two tests is itself worth reporting.
        try:
            w_stat, w_p = stats.wilcoxon(b, a)
            result["wilcoxon"] = float(w_stat)
            result["wilcoxon_p"] = float(w_p)
        except ValueError as exc:  # all-zero differences
            result["wilcoxon_error"] = str(exc)
        # Cohen's d_z for paired designs.
        if result["difference_sd"]:
            result["cohens_dz"] = result["mean_difference"] / result["difference_sd"]
    return result


def _mean(values):
    values = [v for v in values if isinstance(v, (int, float))]
    return statistics.fmean(values) if values else None


def spacy_summary(rows: list[dict]) -> dict:
    """The FR-1 dimension scores, reported (per Section 4.7) but never ground truth."""
    dims = ("subject_clarity", "action_specificity", "environment_detail",
            "visual_richness", "temporal_coherence")
    summary = {
        "original_mean": _mean([r["spacy"].get("original_score") for r in rows]),
        "baseline_mean": _mean([r["spacy"].get("baseline_enhanced_score") for r in rows]),
        "multiagent_mean": _mean([r["spacy"].get("multiagent_enhanced_score") for r in rows]),
        "dimensions": {},
    }
    for dim in dims:
        summary["dimensions"][dim] = {
            "original": _mean([(r["spacy"].get("original_dimensions") or {}).get(dim) for r in rows]),
            "baseline": _mean([(r["spacy"].get("baseline_dimensions") or {}).get(dim) for r in rows]),
            "multiagent": _mean([(r["spacy"].get("multiagent_dimensions") or {}).get(dim) for r in rows]),
        }
    return summary


def _fmt(value, places=3):
    return "—" if value is None else f"{value:.{places}f}"


def _p(value):
    if value is None:
        return "—"
    return "&lt;0.001" if value < 0.001 else f"{value:.3f}"


def render_table(agg: dict, stats_mean: dict, stats_best: dict, spacy: dict, meta: dict) -> str:
    """The Section 4.7 'Comparison table + discussion' deliverable, as Markdown."""
    rows = agg["rows"]
    by_genre: dict[str, list[dict]] = {}
    by_complexity: dict[str, list[dict]] = {}
    for row in rows:
        by_genre.setdefault(row["genre"], []).append(row)
        by_complexity.setdefault(row["complexity"], []).append(row)

    lines = [
        "# EVAL-004 — Comparison table (FR-12)",
        "",
        f"> Generated by `python -m evaluation.run_scoring`. Frames: {meta['frame_count']} "
        f"({meta['size']}×{meta['size']}, provider `pollinations`, seed fixed per prompt and "
        f"shared across conditions). Metric: CLIPScore = 2.5·max(cos,0) on `clip-ViT-B-32`, "
        "every frame scored against the **original** prompt.",
        "",
        "## 1. Headline — CLIPScore alignment to the original prompt",
        "",
        "| Comparison | n | Condition A (baseline) | Condition B (multi-agent) | Δ (B−A) | paired t | p | Cohen's d_z | B wins |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for label, st in (("B mean-of-shots vs A", stats_mean), ("B best-shot vs A", stats_best)):
        lines.append(
            f"| {label} | {st['n']} | {_fmt(st['baseline_mean'])} | {_fmt(st['multiagent_mean'])} | "
            f"{st['mean_difference']:+.3f} | {_fmt(st.get('paired_t'), 2)} | {_p(st.get('paired_t_p'))} | "
            f"{_fmt(st.get('cohens_dz'), 2)} | {st['wins']}/{st['n']} |"
        )

    lines += [
        "",
        "**Read both rows together.** Condition B decomposes each prompt into shots that "
        "each depict *part* of the scene, so its individual frames are expected to score "
        "lower against the whole prompt by construction — that is storyboarding working as "
        "intended, not the pipeline underperforming. The mean-of-shots row measures average "
        "frame fidelity; the best-shot row measures whether the storyboard contains a frame "
        "that covers the prompt at least as well as the baseline's single summary frame.",
        "",
        "**What this metric cannot see:** CLIPScore reads one frame at a time and has no "
        "notion of a sequence, so it is structurally blind to what Condition B is *for* — "
        "narrative decomposition, shot variety, and cross-shot continuity (FR-7). A study "
        "that reported only this number would be measuring the baseline's strongest axis "
        "and none of the multi-agent pipeline's.",
        "",
        "## 2. Breakdown by prompt complexity",
        "",
        "| Complexity | n | A | B (mean-of-shots) | B (best-shot) | Δ best−A | mean shots/prompt |",
        "|---|---|---|---|---|---|---|",
    ]
    for label, group in sorted(by_complexity.items()):
        a_m = statistics.fmean([r["baseline"] for r in group])
        b_m = statistics.fmean([r["multiagent_mean"] for r in group])
        b_b = statistics.fmean([r["multiagent_best"] for r in group])
        lines.append(
            f"| {label} | {len(group)} | {_fmt(a_m)} | {_fmt(b_m)} | {_fmt(b_b)} | "
            f"{b_b - a_m:+.3f} | {statistics.fmean([r['shot_count'] for r in group]):.1f} |"
        )

    lines += [
        "",
        "## 3. Breakdown by genre",
        "",
        "| Genre | n | A | B (mean-of-shots) | B (best-shot) | Δ best−A |",
        "|---|---|---|---|---|---|",
    ]
    for label, group in sorted(by_genre.items()):
        a_m = statistics.fmean([r["baseline"] for r in group])
        b_m = statistics.fmean([r["multiagent_mean"] for r in group])
        b_b = statistics.fmean([r["multiagent_best"] for r in group])
        lines.append(
            f"| {label} | {len(group)} | {_fmt(a_m)} | {_fmt(b_m)} | {_fmt(b_b)} | {b_b - a_m:+.3f} |"
        )

    lines += [
        "",
        "## 4. spaCy dimension scores (FR-1) — reported, not ground truth",
        "",
        "Section 4.7 marks these *reported, not ground truth* deliberately: the analyzer "
        "scores prompt-like text, and Condition B's joined shot descriptions are not "
        "prompt-like — they are a shot list. Read them as a description of what each "
        "condition's text looks like, never as a quality verdict.",
        "",
        f"| Score | Original prompt | Condition A | Condition B |",
        "|---|---|---|---|",
        f"| Overall | {_fmt(spacy['original_mean'], 1)} | {_fmt(spacy['baseline_mean'], 1)} | "
        f"{_fmt(spacy['multiagent_mean'], 1)} |",
    ]
    for dim, values in spacy["dimensions"].items():
        lines.append(
            f"| {dim.replace('_', ' ')} | {_fmt(values['original'], 1)} | "
            f"{_fmt(values['baseline'], 1)} | {_fmt(values['multiagent'], 1)} |"
        )

    lines += [
        "",
        "## 5. Coverage and exclusions",
        "",
        f"- Paired prompts scored: **{len(rows)}** of the 50-prompt EVAL-001 set.",
        f"- Excluded — no successful Condition B run (Groq daily token quota, "
        f"not a code defect): **{meta['unpaired']}**.",
        f"- Excluded — a frame failed to generate after every retry: "
        f"**{len(agg['dropped'])}**{(' (' + ', '.join(agg['dropped']) + ')') if agg['dropped'] else ''}.",
        f"- Frames that failed permanently: **{meta['failed_frames']}** of "
        f"{meta['frame_count'] + meta['failed_frames']} attempted.",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=None, help="score only the first N paired prompts")
    parser.add_argument("--size", type=int, default=512, help="frame edge length in px")
    parser.add_argument(
        "--skip-generation", action="store_true",
        help="plan and report without generating or scoring (dry run)",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    baseline, multiagent = _load(BASELINE_PATH), _load(MULTIAGENT_PATH)
    plan = build_frame_plan(baseline, multiagent)
    unpaired = len(set(baseline) | set(multiagent)) - len(plan)
    if args.limit:
        plan = plan[: args.limit]

    frame_total = sum(len(e["frames"]) for e in plan)
    logger.info(
        "Paired prompts: %d (%d unpaired). Frames to render: %d.", len(plan), unpaired, frame_total
    )
    if args.skip_generation:
        logger.info("--skip-generation: stopping before any network or model work.")
        return

    scored = render_and_score(plan, size=args.size)
    agg = aggregate(scored)
    rows = agg["rows"]
    if not rows:
        raise SystemExit("no prompt produced a scorable frame in both conditions")

    stats_mean = paired_stats(rows, "multiagent_mean")
    stats_best = paired_stats(rows, "multiagent_best")
    spacy = spacy_summary(rows)

    scored_frames = sum(1 for e in scored for f in e["frames"] if "clipscore" in f)
    failed_frames = sum(1 for e in scored for f in e["frames"] if "error" in f)
    meta = {
        "size": args.size,
        "frame_count": scored_frames,
        "failed_frames": failed_frames,
        "unpaired": unpaired,
    }

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    SCORES_PATH.write_text(
        json.dumps(
            {
                "meta": meta,
                "per_prompt": rows,
                "paired_mean_of_shots": stats_mean,
                "paired_best_shot": stats_best,
                "spacy": spacy,
                "dropped": agg["dropped"],
                "frames": scored,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    TABLE_PATH.write_text(render_table(agg, stats_mean, stats_best, spacy, meta), encoding="utf-8")

    logger.info(
        "Done: %d paired prompts, %d frames scored (%d failed). Wrote %s and %s",
        len(rows), scored_frames, failed_frames, SCORES_PATH.name, TABLE_PATH.name,
    )


if __name__ == "__main__":
    main()
