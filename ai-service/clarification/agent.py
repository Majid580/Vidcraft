"""FR-2 conversational clarification agent (AI-003).

Single-round design: generate_questions() asks a number of targeted
follow-ups SCALED TO HOW UNDER-SPECIFIED THE PROMPT IS, and build_brief()
merges the user's answers into a clarified prompt. There is still no
iteration loop, which is what guarantees the pipeline always terminates
(proposal Section 6.2) — a vaguer prompt gets a longer single round, never
a second one.

The question count was a fixed 2 until 2026-08-13 (ADR-031). That meant a
one-word-vague prompt and a nearly-complete one were interrogated
identically, and the 2-question cap silently discarded the analyzer's own
evidence: a prompt failing four FR-1 dimensions produced four flags, and
two of them were thrown away by a slice. The budget now derives from that
evidence — see ``question_budget``.
"""

from config import (
    CLARIFICATION_LOW_SCORE,
    CLARIFICATION_MAX_QUESTIONS,
    CLARIFICATION_SHORT_PROMPT_WORDS,
)
from llm import complete_json

# Kept as a module-level name because the tests and older callers refer to
# it; it is now the CEILING on a computed budget, not the budget itself.
MAX_QUESTIONS = CLARIFICATION_MAX_QUESTIONS

QUESTIONS_SYSTEM_PROMPT = """You are the clarification step of a video-generation pipeline.
You will be given a user's raw video-prompt text and a structured quality
analysis (flags and suggestions) naming what is missing or ambiguous about it.

Ask EXACTLY {budget} follow-up question(s) — no more, no fewer. The number has
already been chosen from how under-specified this particular prompt is, so
use all of it: if you have been asked for five questions, there are five real
gaps to close.

What makes a question worth asking here:
- Each question resolves a DIFFERENT gap. Never ask two questions that a
  single answer would settle.
- Ask about things that visibly change the rendered frame — who or what is on
  screen and what they look like, where it is, the time of day and light, what
  physically happens, the mood or visual style. Do not ask about intent,
  audience, purpose, or anything the camera cannot show.
- NEVER ask a yes/no question. "Is it at night?" gains one bit; "What time of
  day is it, and what is the main light source?" gains a usable answer.
- Offer two or three concrete example directions in parentheses, because a
  user who wrote a vague prompt often does not yet know what the options are.
  Example: "Where does this take place? (e.g. a rain-slick city street at
  night, a sunlit kitchen, a bare studio backdrop)"
- Keep each question to one sentence before the examples.
- Put the highest-impact question first — the one whose absence would most
  change what gets generated.

Respond ONLY with JSON of the exact shape: {{"questions": string[]}}
with exactly {budget} items."""

BRIEF_SYSTEM_PROMPT = """You merge a user's clarification answers into their original
video-generation prompt.

Given the original prompt, the follow-up questions that were asked, and the
user's answers, produce:
- "brief": a JSON object of short key/value facts extracted from the answers
  (e.g. {"setting": "outdoors, city street", "style": "realistic"}) — use
  whatever keys fit the answers, omit anything not addressed.
- "clarified_prompt": the original prompt rewritten as a single natural
  paragraph that incorporates every answer, ready to pass on to storyboard
  generation.

The clarified prompt is what the whole rest of the pipeline sees; the raw
prompt is never read again. So it must carry the answers in full, and it
should read as a specific, concrete scene rather than a summary of a
conversation — write the scene, not "the user wants a scene where...".

You MAY add sensory and visual specificity that follows from what the user
told you: lighting implied by a stated time of day, texture and materials
implied by a stated location, weather implied by a stated mood.

You MUST NOT invent anything the user did not imply — no new characters, no
new plot events, no named places or brands, no dialogue. If an answer was
vague or the user skipped it, leave that aspect open rather than deciding it
for them. Inventing content here is worse than leaving a gap, because
everything downstream will treat it as the user's intent.

Respond ONLY with JSON of the exact shape:
{"brief": {...}, "clarified_prompt": string}"""


def question_budget(
    prompt: str,
    flags: list[str],
    overall_score: int | None = None,
    *,
    cap: int = CLARIFICATION_MAX_QUESTIONS,
) -> int:
    """How many questions this prompt has earned.

    One per DISTINCT flag: each flag is a specific FR-1 dimension the
    analyzer scored below its threshold, i.e. a real unresolved gap, and
    asking beyond the gaps produces padding rather than information.
    ``flags`` is de-duplicated first because ``contradictory_descriptors``
    is appended once per contradicting pair, and three contradictions are
    still one kind of question.

    Two additions on top:

    - **A short prompt earns one more.** The analyzer can only flag what was
      written; it cannot flag detail that was never expressed at all, so a
      very short prompt is under-specified in ways its flag count
      understates.
    - **A globally weak prompt earns one more.** A low overall score means
      weak everywhere rather than weak in one place, which usually needs a
      question the per-dimension flags do not name.

    Returns 0 when nothing was flagged — a prompt good enough to skip
    clarification should skip it, not be interrogated for form's sake.
    """
    if not flags:
        return 0

    budget = len(set(flags))

    if len(prompt.split()) < CLARIFICATION_SHORT_PROMPT_WORDS:
        budget += 1
    if overall_score is not None and overall_score < CLARIFICATION_LOW_SCORE:
        budget += 1

    return max(1, min(budget, cap))


def generate_questions(
    prompt: str,
    flags: list[str],
    suggestions: list[str],
    overall_score: int | None = None,
) -> list[str]:
    """Ask as many clarifying questions as the prompt's weaknesses warrant.

    ``overall_score`` is the FR-1 analysis's overall figure. It is optional
    so that a caller which only has flags still works; passing it makes the
    budget sharper for prompts that are mediocre everywhere rather than
    broken in one dimension.
    """
    budget = question_budget(prompt, flags, overall_score)
    if budget == 0:
        return []

    user_content = (
        f"Prompt: {prompt}\n"
        f"Flags: {', '.join(flags)}\n"
        f"Suggestions: {', '.join(suggestions)}"
    )
    result = complete_json(QUESTIONS_SYSTEM_PROMPT.format(budget=budget), user_content)

    questions = result.get("questions", [])
    if not isinstance(questions, list):
        return []
    questions = [q.strip() for q in questions if isinstance(q, str) and q.strip()]
    return questions[:budget]


def build_brief(prompt: str, questions: list[str], answers: list[str]) -> dict:
    """Merge the user's answers into the original prompt.

    Returns {"brief": dict, "clarified_prompt": str}. If no questions were
    asked, this is a no-op that echoes the original prompt back.
    """
    if len(questions) != len(answers):
        raise ValueError("questions and answers must be the same length")

    if not questions:
        return {"brief": {}, "clarified_prompt": prompt}

    qa_pairs = "\n".join(
        f"Q: {q}\nA: {a}" for q, a in zip(questions, answers)
    )
    user_content = f"Original prompt: {prompt}\n\n{qa_pairs}"
    result = complete_json(BRIEF_SYSTEM_PROMPT, user_content)

    brief = result.get("brief", {})
    clarified_prompt = result.get("clarified_prompt", "").strip()
    if not isinstance(brief, dict) or not clarified_prompt:
        raise ValueError("LLM returned a malformed brief/clarified_prompt")

    return {"brief": brief, "clarified_prompt": clarified_prompt}
