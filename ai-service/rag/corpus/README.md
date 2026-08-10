# Cinematography reference corpus (RAG-002)

The curated knowledge base that grounds the **Cinematographer** agent (AI-007)
via the FAISS vector index (RAG-001). At generation time a shot description is
used as a query; the index returns the top-k (default 3) most relevant passages
below, which are injected into the Cinematographer's prompt so its camera /
lighting / colour / mood decisions are retrieval-grounded rather than guessed
(FR-4).

## What's here

| File | Contents |
|---|---|
| `cinematography.json` | The curated corpus — a JSON array of `{ "text", "metadata" }` items. |
| `loader.py` | `load_corpus()` — reads + validates the JSON into the exact item shape `VectorIndex.add()` consumes. |
| `__init__.py` | Package exports (`load_corpus`, `CORPUS_FILES`, `CorpusError`). |

## Item shape

```json
{
  "text": "A low-angle shot places the camera below the subject, looking up...",
  "metadata": {
    "id": "angle-low",
    "category": "angle",
    "technique": "Low-angle shot",
    "tags": ["power", "dominance", "heroic", "..."]
  }
}
```

- **`text`** — a self-contained 2–4 sentence passage describing one technique,
  written with the vocabulary a shot description is likely to use (mood words
  like *tense*, *romantic*, *epic*) so semantic retrieval matches well.
- **`metadata.id`** — unique, stable, kebab-case; used for dedup and (later)
  the MongoDB `embeddings`-collection sync in RAG-003.
- **`metadata.category`** — one of: `framing`, `angle`, `movement`, `lens`,
  `lighting`, `color`, `composition`, `mood`. Useful for eval labelling
  (precision-at-k, §6.11) and future metadata filtering.
- **`metadata.tags`** — retrieval/eval keywords.

## Coverage

Original technique summaries across the eight categories above (shot sizes,
angles, camera movement, lenses/optics, lighting, colour palettes, composition,
and mood/genre looks). Counts per category are asserted by the unit tests.

## Licensing / sourcing (FR-4 security note)

Every passage is an **original summary of common-knowledge film technique**
written for this project — not copied from any book, article, or site. These are
factual craft concepts (e.g. "a low-angle shot makes a subject look powerful"),
described in our own words, so the corpus is license-clean and safe to embed and
redistribute, consistent with the proposal's "assembled from open film-technique
references" and the FR-4 note to use open references only.

## How this is consumed (later tasks)

- **RAG-003** embeds this corpus with `all-MiniLM-L6-v2` and persists a
  production FAISS index (+ the deferred MongoDB `embeddings` sync). Sketch:

  ```python
  from rag.index import VectorIndex
  from rag.corpus import load_corpus

  index = VectorIndex()
  index.add(load_corpus())      # items are already in the right shape
  index.save()                  # -> {VECTOR_INDEX_PATH}.faiss / .meta.json
  ```

- **AI-007** loads that index and calls `index.search(shot_description)` per
  shot.

RAG-002 is corpus **curation only** — no embedding, no populated index, no
Cinematographer consumer.
