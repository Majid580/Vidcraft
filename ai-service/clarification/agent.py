"""FR-2 conversational clarification agent (AI-003).

Single-round design: generate_questions() asks at most MAX_QUESTIONS
targeted follow-ups from the FR-1 analysis, and build_brief() merges the
user's answers into a clarified prompt. There is no iteration loop, which
is what guarantees the pipeline always terminates (proposal Section 6.2).
"""

from llm import complete_json

MAX_QUESTIONS = 2

QUESTIONS_SYSTEM_PROMPT = f"""You are the clarification step of a video-generation pipeline.
You will be given a user's raw video-prompt text and a structured quality
analysis (flags and suggestions) naming what is missing or ambiguous about it.

Ask at most {MAX_QUESTIONS} short, specific follow-up questions that would
resolve the most important ambiguities named by the flags. Do not ask about
anything not implied by the flags/suggestions. If the flags don't warrant
any question, return an empty list.

Respond ONLY with JSON of the exact shape: {{"questions": string[]}}
with between 0 and {MAX_QUESTIONS} items."""

BRIEF_SYSTEM_PROMPT = """You merge a user's clarification answers into their original
video-generation prompt.

Given the original prompt, the follow-up questions that were asked, and the
user's answers, produce:
- "brief": a JSON object of short key/value facts extracted from the answers
  (e.g. {"setting": "outdoors, city street", "style": "realistic"}) — use
  whatever keys fit the answers, omit anything not addressed.
- "clarified_prompt": the original prompt rewritten as a single natural
  paragraph that incorporates the answers, ready to pass on to storyboard
  generation.

Respond ONLY with JSON of the exact shape:
{"brief": {...}, "clarified_prompt": string}"""


def generate_questions(prompt: str, flags: list[str], suggestions: list[str]) -> list[str]:
    """Ask at most MAX_QUESTIONS clarifying questions, or none if nothing is flagged."""
    if not flags:
        return []

    user_content = (
        f"Prompt: {prompt}\n"
        f"Flags: {', '.join(flags)}\n"
        f"Suggestions: {', '.join(suggestions)}"
    )
    result = complete_json(QUESTIONS_SYSTEM_PROMPT, user_content)

    questions = result.get("questions", [])
    if not isinstance(questions, list):
        return []
    questions = [q for q in questions if isinstance(q, str) and q.strip()]
    return questions[:MAX_QUESTIONS]


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
