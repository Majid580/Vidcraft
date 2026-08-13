"""Narration / voiceover script layer (NARR-001, FR-10, per ADR-032).

`agent.py` is the Narrator: it turns a finished storyboard into timed BEATS
with a voiceover line each. `tts.py` synthesises those lines and — the part
that matters — reports how long each one is ACTUALLY spoken for, then lays
them onto the single timeline that both the video and the subtitles read.

The ordering is the whole design: narration is written first, measured
second, and the video's timing is derived from the measurement. Nothing here
ever guesses how long a line takes to say.
"""

from .agent import MAX_BEATS_PER_SHOT, MIN_BEATS_PER_SHOT, NarratorOutputError, write_narration
from .tts import (
    SpeechSynthesisError,
    beat_timeline,
    duration_for,
    synthesize,
)

__all__ = [
    "write_narration",
    "NarratorOutputError",
    "MIN_BEATS_PER_SHOT",
    "MAX_BEATS_PER_SHOT",
    "synthesize",
    "duration_for",
    "beat_timeline",
    "SpeechSynthesisError",
]
