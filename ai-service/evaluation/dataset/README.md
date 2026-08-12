# Fixed evaluation prompt set (EVAL-001)

The fixed 50-prompt test set that FR-12's comparative evaluation study
(EVAL-002/003/004) runs under **both** conditions — the single-shot baseline
and the full multi-agent pipeline — on the same backend, so the two
conditions are compared on identical input.

## What's here

| File | Contents |
|---|---|
| `prompts.json` | The fixed set — a JSON array of 50 `{id, prompt, complexity, genre, tags}` items. |
| `loader.py` | `load_prompts()` — reads + strictly validates the JSON. |
| `__init__.py` | Package exports (`load_prompts`, `DATASET_FILES`, `EvaluationDatasetError`, `VALID_COMPLEXITIES`). |

## Item shape

```json
{
  "id": "sci-fi-2",
  "prompt": "A cargo hauler drifts silently through a debris field left by an old space battle, its pilot spots a derelict station ahead, and finally eases the ship into a docking clamp as sparks scatter from a damaged strut.",
  "complexity": "multi-beat",
  "genre": "sci-fi",
  "tags": ["spaceship", "salvage", "tension"]
}
```

- **`id`** — unique, stable, kebab-case (`{genre}-{n}`).
- **`prompt`** — a self-contained, original scene description (never copied
  from any external source), written the way a real user would phrase a
  prompt to this app.
- **`complexity`** — `single-beat` (one static scene/moment — the kind of
  prompt that maps naturally onto the single-image mode from ADR-021) or
  `multi-beat` (a scene with two or more distinct visual beats — the kind of
  prompt that maps naturally onto a multi-shot storyboard). This is what
  satisfies the roadmap's "50 prompts covering single-shot and multi-shot
  ideas" acceptance criterion: 26 single-beat / 24 multi-beat.
- **`genre`** — one of 15 genres (sci-fi, fantasy, horror, noir-crime,
  urban-everyday, action-thriller, historical, sports, food-culinary,
  music-performance, comedy-whimsical, abstract-artistic, nature-wildlife,
  family-slice-of-life, romance), 3–4 prompts each, so the study isn't
  dominated by one theme.
- **`tags`** — free-form descriptive keywords (>=2 per item), for eval
  labelling/filtering, mirroring `rag/corpus`'s `metadata.tags` convention.

## Why these specific prompts

Each prompt is deliberately **moderate** in descriptive detail — enough for
the spaCy analyzer (FR-1) to score reasonably without automatically flagging
every dimension, but not so exhaustively detailed that the multi-agent
pipeline's clarification/RAG-grounding/retry steps have no room to add value
over the baseline. This is a design choice for a *fair* comparison: a set of
either maximally vague or maximally detailed prompts would bias the result
toward one condition before any generation happens.

## Licensing / sourcing (FR-4-style security note)

Every prompt is **original text written for this project** — not copied or
adapted from any book, film synopsis, article, or existing dataset. They
describe generic, common scene ideas (a chase, a kitchen, a forest), so
there's no attribution or licensing concern.

## Fixed-set stability

This set is meant to stay **exactly 50 items** and **unchanged** once
EVAL-002/003 start using it — the whole point of a "fixed" test set is that
both conditions see identical input, and a result computed against one
version of the set isn't comparable to a result computed against an edited
version. If a prompt genuinely needs fixing (e.g. a typo), treat it as a
deliberate, recorded change, not a routine edit — note it in
`PROJECT_PROGRESS.md` the same way any other completed-task deliverable
would be touched after the fact.

## How this is consumed (later tasks)

- **EVAL-002** runs each prompt through the single-shot baseline condition.
- **EVAL-003** runs each prompt through the full multi-agent pipeline.
- **EVAL-004** scores both conditions' outputs (CLIPScore-style alignment
  metric + the existing spaCy dimension scores, reported not as ground
  truth) and produces the comparison table for the final report.

```python
from evaluation.dataset import load_prompts

prompts = load_prompts()   # 50 validated {id, prompt, complexity, genre, tags} dicts
```

EVAL-001 is prompt-set curation only — no generation, no scoring, no
evaluation-runner scripts. Those are EVAL-002/003/004.
