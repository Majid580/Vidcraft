"""FR-1 five-dimension prompt quality scoring (AI-002).

Scoring is a hand-tuned rule-based heuristic over spaCy's dependency parse,
POS tags and NER output, per PROJECT_ARCHITECTURE.md Section 11.1 ("not a
trained classifier"). Thresholds and weights below are the default values
adopted to resolve open question R-12 — see ADR-010 in PROJECT_STATE.yaml.
"""

import json
from pathlib import Path

from .pipeline import parse

_ANTONYMS_PATH = Path(__file__).parent / "antonyms.json"
_ANTONYM_PAIRS = [
    tuple(pair) for pair in json.loads(_ANTONYMS_PATH.read_text())["pairs"]
]

VAGUE_VERBS = {
    "be", "go", "do", "make", "get", "put", "have", "come",
    "walk", "look", "seem", "move", "happen",
}

VAGUE_SUBJECT_LEMMAS = {
    "it", "this", "that", "something", "someone", "they", "thing",
}

LOCATION_ENT_LABELS = {"GPE", "LOC", "FAC"}
LOCATION_PREPOSITIONS = {
    "in", "at", "on", "near", "inside", "outside", "beneath", "above",
    "under", "beside", "across", "through", "along",
}
TIME_OF_DAY_WORDS = {
    "morning", "noon", "afternoon", "evening", "night", "dusk", "dawn",
    "midnight", "sunset", "sunrise", "daytime", "nightfall",
}
TEMPORAL_MARKERS = {
    "before", "after", "then", "while", "during", "until", "when",
    "meanwhile", "later", "next", "finally", "first", "suddenly",
}
FINITE_PAST_TAGS = {"VBD", "VBN"}
FINITE_PRESENT_TAGS = {"VBP", "VBZ"}

MIN_PROMPT_LENGTH = 3


class EmptyPromptError(ValueError):
    """Raised when the prompt is empty or whitespace-only."""


def _score_subject_clarity(doc) -> int:
    sents = list(doc.sents) or [doc]
    with_subject = 0
    vague_penalty = 0
    for sent in sents:
        subjects = [t for t in sent if t.dep_ in ("nsubj", "nsubjpass")]
        if subjects:
            with_subject += 1
            if all(s.lemma_.lower() in VAGUE_SUBJECT_LEMMAS for s in subjects):
                vague_penalty += 1
    fraction = with_subject / len(sents)
    score = fraction * 100
    if with_subject:
        score -= (vague_penalty / with_subject) * 40
    return round(max(0, min(100, score)))


def _score_action_specificity(doc) -> int:
    verbs = [t for t in doc if t.pos_ == "VERB"]
    if not verbs:
        return 0
    specific = [v for v in verbs if v.lemma_.lower() not in VAGUE_VERBS]
    modified = [v for v in specific if any(c.dep_ == "advmod" for c in v.children)]
    base = len(specific) / len(verbs) * 80
    bonus = (len(modified) / len(verbs)) * 20
    return round(max(0, min(100, base + bonus)))


def _score_environment_detail(doc) -> int:
    score = 0
    if any(ent.label_ in LOCATION_ENT_LABELS for ent in doc.ents):
        score += 50
    if any(
        t.dep_ == "prep" and t.lemma_.lower() in LOCATION_PREPOSITIONS
        and any(c.dep_ == "pobj" for c in t.children)
        for t in doc
    ):
        score += 30
    if any(t.lemma_.lower() in TIME_OF_DAY_WORDS for t in doc):
        score += 20
    return min(100, score)


def _score_visual_richness(doc) -> int:
    content_tokens = [t for t in doc if not t.is_stop and not t.is_punct]
    if not content_tokens:
        return 0
    adjectives = [t for t in doc if t.pos_ == "ADJ"]
    density = len(adjectives) / len(content_tokens)
    return round(max(0, min(100, density * 400)))


def _score_temporal_coherence(doc) -> int:
    sents = list(doc.sents) or [doc]
    score = 50
    if any(t.lemma_.lower() in TEMPORAL_MARKERS for t in doc):
        score += 25
    finite_tags = {t.tag_ for t in doc if t.tag_ in FINITE_PAST_TAGS | FINITE_PRESENT_TAGS}
    mixes_tense = bool(finite_tags & FINITE_PAST_TAGS) and bool(finite_tags & FINITE_PRESENT_TAGS)
    if len(sents) > 1 and mixes_tense:
        score -= 25
    else:
        score += 25
    return round(max(0, min(100, score)))


def _find_contradictions(doc) -> list[tuple[str, str]]:
    lemmas = {t.lemma_.lower() for t in doc} | {t.lower_ for t in doc}
    found = []
    for word_a, word_b in _ANTONYM_PAIRS:
        if word_a in lemmas and word_b in lemmas:
            found.append((word_a, word_b))
    return found


def score_prompt(text: str) -> dict:
    """Score a raw prompt across the five FR-1 dimensions.

    Returns a dict matching the schema in VidCraft_Proposal.tex Section 6.1:
    overall_score, dimensions, flags, suggestions.
    """
    if not text or not text.strip() or len(text.strip()) < MIN_PROMPT_LENGTH:
        raise EmptyPromptError("Prompt must be a non-empty string of at least 3 characters.")

    doc = parse(text)

    dimensions = {
        "subject_clarity": _score_subject_clarity(doc),
        "action_specificity": _score_action_specificity(doc),
        "environment_detail": _score_environment_detail(doc),
        "visual_richness": _score_visual_richness(doc),
        "temporal_coherence": _score_temporal_coherence(doc),
    }
    overall_score = round(sum(dimensions.values()) / len(dimensions))

    flags: list[str] = []
    suggestions: list[str] = []

    if dimensions["subject_clarity"] < 40:
        flags.append("no_subject")
        suggestions.append("Add a clear subject (who or what the scene is about).")
    if dimensions["action_specificity"] < 40:
        flags.append("vague_action")
        suggestions.append("Replace generic verbs (e.g. 'moves', 'goes') with a more specific action.")
    if dimensions["environment_detail"] < 40:
        flags.append("missing_setting")
        suggestions.append("Specify where the scene takes place (indoor/outdoor, time of day).")
    if dimensions["visual_richness"] < 40:
        flags.append("low_visual_detail")
        suggestions.append("Add more descriptive adjectives to convey the visual style.")
    if dimensions["temporal_coherence"] < 40:
        flags.append("temporal_ambiguity")
        suggestions.append("Clarify the order or timing of events (e.g. using 'before', 'after', 'then').")

    for word_a, word_b in _find_contradictions(doc):
        flags.append("contradictory_descriptors")
        suggestions.append(f"Prompt contains contradictory descriptors: '{word_a}' and '{word_b}'.")

    return {
        "overall_score": overall_score,
        "dimensions": dimensions,
        "flags": flags,
        "suggestions": suggestions,
    }
