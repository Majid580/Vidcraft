"""spaCy pipeline loading for the FR-1 prompt analyzer (AI-002)."""

import functools

import spacy
from spacy.language import Language

MODEL_NAME = "en_core_web_sm"


@functools.lru_cache(maxsize=1)
def get_nlp() -> Language:
    """Load the spaCy model once per process and cache it."""
    return spacy.load(MODEL_NAME)


def parse(text: str):
    """Run the cached spaCy pipeline over `text` and return the Doc."""
    return get_nlp()(text)
