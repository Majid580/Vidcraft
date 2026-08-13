"""Speech synthesis + measured timing for the narration track (NARR-001, FR-10).

This module exists to answer one question honestly: **how long is this line
actually spoken for?** Everything about keeping picture and voice together
follows from measuring that rather than assuming it.

**Why the video is fitted to the audio, and not the reverse.** The tempting
approach is to constrain narration to a shot's authored ``duration_s`` — say
2.5 words per second — and trust it to fit. It does not: speaking rate varies
with the voice, the punctuation, and the words themselves, so the error
accumulates shot after shot until the voice is describing the wrong picture.
That is the same class of failure ADR-028 refused for subtitles, and the fix
is the same shape. Here it is easier than it looks, because Remotion composes
an AUTHORED timeline: ``framesFor(shot) = round(duration_s * FPS)`` takes
duration as an INPUT. So a shot can simply be made exactly as long as the
speech it carries, and the drift is not reduced — it is structurally absent.

**Where the duration comes from.** The provider reports it. Edge TTS streams
``SentenceBoundary`` metadata alongside the audio, carrying an offset and a
duration in 100-nanosecond ticks, so the spoken length is known exactly
without decoding the MP3 or shelling out to ffprobe. Where a provider does
not report timing, ``measure_with_ffprobe`` is the fallback — but a reported
duration is always preferred, because it describes the speech rather than the
container.

**Provider choice (ADR-032).** Edge TTS is the Tier 1 default: hosted (so it
respects ADR-015's no-local-inference rule — the synthesis runs on Microsoft's
servers, nothing is loaded onto the dev machine), free, and needing no API key
or signup, which matters because the alternatives all failed a live check on
2026-08-13. Cloudflare Workers AI has TTS (`@cf/myshell-ai/melotts`,
`@cf/deepgram/aura-1` — both confirmed to exist by their schema validation)
but shares one 10,000 neuron/day free allocation with image generation, and it
was already exhausted. Groq has no TTS at all any more: `playai-tts` returns
"has been decommissioned", and its live model list now contains only
Whisper, which is speech-to-TEXT. Cloudflare remains the natural Tier 2.
"""

import asyncio
import shutil
import subprocess

DEFAULT_VOICE = "en-US-GuyNeural"

# Edge TTS reports offsets and durations in 100-nanosecond ticks.
TICKS_PER_SECOND = 10_000_000

# A synthesised line shorter than this is almost certainly a failure that
# still returned bytes; a beat cannot meaningfully occupy less time.
MIN_SPOKEN_SECONDS = 0.15

# Breathing room appended to each spoken beat so consecutive lines do not
# butt directly against one another. Small, and applied to the TIMELINE
# rather than the audio, so it never desynchronises anything.
BEAT_PADDING_SECONDS = 0.35

# What a silent beat is worth on the timeline. A beat with no narration still
# needs to occupy time or it would vanish from the video entirely.
SILENT_BEAT_SECONDS = 1.5


class SpeechSynthesisError(RuntimeError):
    """Raised when a narration line could not be synthesised."""


async def _synthesize_edge(text: str, voice: str) -> tuple[bytes, float]:
    """Synthesise one line with Edge TTS, returning (mp3 bytes, spoken seconds)."""
    import edge_tts

    communicate = edge_tts.Communicate(text, voice)
    audio = bytearray()
    end_ticks = 0

    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] in ("SentenceBoundary", "WordBoundary"):
            # The last boundary's end is the end of speech. Both event types
            # carry offset+duration, and a voice may emit either.
            end_ticks = max(end_ticks, chunk.get("offset", 0) + chunk.get("duration", 0))

    if not audio:
        raise SpeechSynthesisError(f"provider returned no audio for {text!r}")

    return bytes(audio), end_ticks / TICKS_PER_SECOND


def synthesize(text: str, *, voice: str = DEFAULT_VOICE) -> dict:
    """Synthesise one narration line.

    Returns ``{"audio": bytes, "duration_s": float, "voice": str}`` where
    ``duration_s`` is the REPORTED spoken length, not an estimate.

    Raises :class:`SpeechSynthesisError` when nothing usable came back, so a
    caller records a failed beat rather than silently timing the video
    against speech that does not exist.
    """
    if not isinstance(text, str) or not text.strip():
        raise ValueError("cannot synthesise empty narration")

    audio, duration_s = asyncio.run(_synthesize_edge(text.strip(), voice))

    if duration_s < MIN_SPOKEN_SECONDS:
        # The provider streamed audio but reported no usable timing. Falling
        # back to a guess here would reintroduce exactly the drift this
        # module exists to prevent, so it is surfaced instead.
        raise SpeechSynthesisError(
            f"synthesised {len(audio)} bytes for {text!r} but reported only "
            f"{duration_s:.3f}s of speech — refusing to time the video against it"
        )

    return {"audio": audio, "duration_s": duration_s, "voice": voice}


def measure_with_ffprobe(path: str) -> float:
    """Fallback duration measurement for a provider that reports no timing."""
    if not shutil.which("ffprobe"):
        raise SpeechSynthesisError("ffprobe is not available to measure narration audio")
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True, check=False,
    )
    try:
        return float(result.stdout.strip())
    except ValueError as exc:
        raise SpeechSynthesisError(f"ffprobe returned no duration for {path}") from exc


def beat_timeline(narrated_shots: list[dict]) -> list[dict]:
    """Lay measured beats onto one absolute timeline.

    Every beat must already carry a ``duration_s``. Returns the same shots
    with each beat given absolute ``start_s``/``end_s``, and each shot given
    the ``duration_s`` it must be held for — the sum of its own beats.

    This is the single place the video's timing is decided. Both the Remotion
    composition and the subtitle track read it, for the same reason ADR-028
    exported ``assembledShots()``: two independent copies of a timeline
    disagree eventually, and captions that drift look correct until someone
    watches to the end.
    """
    timeline = []
    cursor = 0.0

    for shot in narrated_shots:
        beats = []
        shot_start = cursor

        for beat in shot.get("beats", []):
            duration = beat.get("duration_s")
            if not isinstance(duration, (int, float)) or duration <= 0:
                raise ValueError(
                    f"shot {shot.get('shot_id')} beat {beat.get('beat_id')} "
                    "has no measured duration — synthesise before building a timeline"
                )
            beats.append({**beat, "start_s": round(cursor, 3), "end_s": round(cursor + duration, 3)})
            cursor += duration

        timeline.append(
            {
                **shot,
                "beats": beats,
                "start_s": round(shot_start, 3),
                "duration_s": round(cursor - shot_start, 3),
            }
        )

    return timeline


def duration_for(narration: str) -> float:
    """Timeline cost of a beat, synthesising it when there is anything to say.

    A silent beat still occupies ``SILENT_BEAT_SECONDS`` — it is a deliberate
    pause in the voiceover, not an instruction to skip the picture.
    """
    if not narration.strip():
        return SILENT_BEAT_SECONDS
    return synthesize(narration)["duration_s"] + BEAT_PADDING_SECONDS
