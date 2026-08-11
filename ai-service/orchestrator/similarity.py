"""Storyboard intent-similarity check (AI-008, FR-3).

Per proposal Section 6.3 / the AI-pipeline diagram (PROJECT_ARCHITECTURE.md
Section 4.4), a generated storyboard's shot descriptions are checked against
the clarified prompt's intent via sentence-transformer embeddings before the
storyboard is handed to the Producer/Router. This reuses the same
all-MiniLM-L6-v2 encoder as the RAG module (RAG-001/FR-4) rather than adding
a second embedding pathway.

Not a RAG retrieval concern (no corpus, no index) -- lives at the
orchestrator level, consumed only by the retry-routing edge in graph.py.
"""

from rag.embedder import embed as default_embed


def compute_similarity(clarified_prompt: str, shots: list[dict], embed_fn=default_embed) -> float:
    """Cosine similarity between the clarified prompt and the shots' descriptions.

    ``embed_fn`` is injectable (mirrors the ``embed_fn``/``index`` injection
    pattern used throughout ``rag/`` and the Cinematographer) so tests can
    run offline with a deterministic embedder. Shot descriptions are joined
    into one storyboard-level string and compared against the prompt as a
    single pair -- there is no per-shot corpus to search against, just two
    pieces of free text. An empty shot list can't happen on a well-formed
    Screenwriter output (MIN_SHOTS=3), but returns 0.0 defensively rather
    than dividing by nothing.
    """
    descriptions = [shot["description"] for shot in shots if shot.get("description")]
    if not descriptions:
        return 0.0

    storyboard_text = ". ".join(descriptions)
    prompt_vector, storyboard_vector = embed_fn([clarified_prompt, storyboard_text])
    return float(prompt_vector @ storyboard_vector)
