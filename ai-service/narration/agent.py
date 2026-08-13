"""Narrator agent (NARR-001, FR-10): timed beats + voiceover script per shot.

Turns a finished storyboard into the *script* layer the storyboard alone
cannot express. Each shot is subdivided into 1-3 BEATS, and each beat
carries the narration line spoken over it.

**Why a beat and not a fixed second.** The obvious reading of "a full script
from 0-1s, 1-2s, ..." is a fixed one-second grid, and that is the wrong unit
for two independent reasons. Nothing downstream can consume it — the
Remotion pathway holds ONE still per shot under a Ken-Burns move, the image
providers return one still per shot, and text-to-video models take one
prompt per clip rather than instructions addressed to t=3s. And a 4-second
shot contains about two narrative beats, not four; slicing it into four
equal boxes invents three boundaries that do not exist and forces the model
to pad. A beat is the smallest unit that is real: one continuous thing
happening, with one line of narration over it. A per-second table is a
*view* that can be rendered from beats whenever a report wants one, and that
direction (beats -> seconds) is sound, where seconds -> beats is not.

**Beats subdivide time and narration, not picture.** On today's pathways a
shot is a single still, so beat 2 of a shot looks identical to beat 1. What
beats buy is real anyway: narration timing, finer subtitle cues, and a
script artifact. The ``action`` field is deliberately kept per-beat even
though nothing renders it yet, because it is exactly what a keyframe-capable
video model would consume — the one place where per-beat picture control
becomes possible without redesigning this layer.

**Durations are outputs, not inputs.** This agent proposes no timings at
all. A beat's duration is whatever its narration actually takes to speak,
measured after synthesis (see ``narration/tts.py`` and ADR-032). Authoring a
duration here and hoping the voice fits it is precisely the drift ADR-028
refused for subtitles.
"""

from llm import complete_json

MIN_BEATS_PER_SHOT = 1
MAX_BEATS_PER_SHOT = 3

NARRATOR_SYSTEM_PROMPT = f"""You are the Narrator agent in a video-generation pipeline.
You are given a finished storyboard: a world_state and an ordered list of
shots, each with a description and a camera framing.

For EVERY shot, write {MIN_BEATS_PER_SHOT} to {MAX_BEATS_PER_SHOT} beats. A beat is one
continuous thing happening on screen — not a fixed slice of time. Give a shot
more beats only when it genuinely contains more than one movement or change;
a simple establishing shot is one beat.

Each beat has:
- "action": what is happening on screen during this beat, in one short
  clause. Present tense. Describe only what is visible.
- "narration": the voiceover line spoken over this beat. Write it to be
  HEARD, not read: plain spoken English, one sentence, no stage directions,
  no shot numbers, no "we see" or "the camera shows". Do not describe the
  camera work — the viewer is watching it.

Rules that matter:
- The narration must carry the story ACROSS the whole storyboard. Read as a
  sequence, the narration lines should form one continuous voiceover, not a
  set of independent captions that each restate the picture.
- Do not narrate what is already obvious on screen. Voiceover that says what
  the viewer can plainly see is the most common failure of a bad narration
  track — add context, cause, or consequence instead.
- Never invent characters, places, or plot that the storyboard does not
  contain. You are scripting what is there.
- A beat may have an EMPTY narration string if the moment is better silent.
  Silence is a legitimate choice; padding is not.
- Keep narration lines short. One sentence, roughly 8-20 words.

Do NOT provide any timings or durations. They are measured from the
synthesised speech, never guessed.

Respond ONLY with JSON of the exact shape:
{{"shots": [{{"shot_id": number, "beats": [{{"action": string, "narration": string}}, ...]}}, ...]}}
with one entry per input shot, in the same order."""


class NarratorOutputError(ValueError):
    """Raised when the LLM's narration output doesn't match the expected shape."""


def _shot_summary(shots: list[dict]) -> str:
    lines = []
    for shot in shots:
        lines.append(
            f"Shot {shot.get('shot_id')}: {shot.get('description', '')}"
            f" [camera: {shot.get('camera', 'unspecified')}]"
        )
    return "\n".join(lines)


def write_narration(shots: list[dict], world_state: dict | None = None) -> list[dict]:
    """Write timed-beat narration for a storyboard's shots.

    Returns one ``{"shot_id", "beats": [{"action", "narration"}]}`` per input
    shot, in input order. Beats carry no durations — those are measured from
    synthesised audio downstream.

    Raises :class:`NarratorOutputError` if the model returns a shape that
    cannot be aligned to the input shots, because a narration list that
    silently skips a shot would leave that shot mute with no indication why.
    """
    if not shots:
        return []

    world_state = world_state or {}
    user_content = (
        f"Setting: {world_state.get('setting', 'unspecified')}\n"
        f"Characters: {', '.join(world_state.get('characters', [])) or 'none specified'}\n\n"
        f"{_shot_summary(shots)}"
    )

    result = complete_json(NARRATOR_SYSTEM_PROMPT, user_content)

    raw = result.get("shots")
    if not isinstance(raw, list) or len(raw) != len(shots):
        raise NarratorOutputError(
            f"narrator returned {len(raw) if isinstance(raw, list) else 'no'} shot entries "
            f"for {len(shots)} shots"
        )

    narrated = []
    for shot, entry in zip(shots, raw):
        if not isinstance(entry, dict):
            raise NarratorOutputError("each narration entry must be an object")

        beats = entry.get("beats")
        if not isinstance(beats, list) or not beats:
            raise NarratorOutputError(f"shot {shot.get('shot_id')} has no beats")

        cleaned = []
        for index, beat in enumerate(beats[:MAX_BEATS_PER_SHOT], start=1):
            if not isinstance(beat, dict):
                raise NarratorOutputError("each beat must be an object")
            action = beat.get("action")
            narration = beat.get("narration", "")
            if not isinstance(action, str) or not action.strip():
                raise NarratorOutputError(
                    f"shot {shot.get('shot_id')} beat {index} is missing an action"
                )
            # An empty narration is legitimate — a beat may be deliberately
            # silent — but it must be a string so downstream never sees None.
            if not isinstance(narration, str):
                narration = ""
            cleaned.append(
                {
                    "beat_id": index,
                    "action": action.strip(),
                    "narration": narration.strip(),
                }
            )

        narrated.append({"shot_id": shot.get("shot_id"), "beats": cleaned})

    return narrated
