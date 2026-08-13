from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

import base64

from analyzer import EmptyPromptError, score_prompt
from narration import NarratorOutputError, beat_timeline, synthesize, write_narration
from narration.tts import BEAT_PADDING_SECONDS, DEFAULT_VOICE, SILENT_BEAT_SECONDS, SpeechSynthesisError
from clarification import build_brief, generate_questions
from critic import CriticConfigError, CriticEvaluationError, evaluate_frame
from llm import GroqConfigError
from orchestrator import (
    CinematographerOutputError,
    ScreenwriterOutputError,
    generate_storyboard,
)

app = FastAPI(title="VidCraft AI Microservice")


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-service"}


class AnalyzeRequest(BaseModel):
    prompt: str = Field(..., min_length=1)


class AnalyzeResponse(BaseModel):
    overall_score: int
    dimensions: dict[str, int]
    flags: list[str]
    suggestions: list[str]


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest):
    try:
        return score_prompt(request.prompt)
    except EmptyPromptError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


class ClarifyQuestionsRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    flags: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    # Optional so an older caller that sends only flags keeps working; when
    # present it sharpens the question budget for prompts that are mediocre
    # across every dimension rather than broken in one (ADR-031).
    overall_score: int | None = Field(default=None, ge=0, le=100)


class ClarifyQuestionsResponse(BaseModel):
    questions: list[str]


@app.post("/clarify/questions", response_model=ClarifyQuestionsResponse)
def clarify_questions(request: ClarifyQuestionsRequest):
    try:
        questions = generate_questions(
            request.prompt, request.flags, request.suggestions, request.overall_score
        )
        return {"questions": questions}
    except GroqConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


class ClarifyResolveRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    questions: list[str] = Field(default_factory=list)
    answers: list[str] = Field(default_factory=list)


class ClarifyResolveResponse(BaseModel):
    brief: dict
    clarified_prompt: str


@app.post("/clarify/resolve", response_model=ClarifyResolveResponse)
def clarify_resolve(request: ClarifyResolveRequest):
    try:
        return build_brief(request.prompt, request.questions, request.answers)
    except GroqConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class StoryboardRequest(BaseModel):
    clarified_prompt: str = Field(..., min_length=1)


class StoryboardResponse(BaseModel):
    storyboard_id: str
    world_state: dict
    shots: list[dict]


@app.post("/storyboard/generate", response_model=StoryboardResponse)
def storyboard_generate(request: StoryboardRequest):
    try:
        return generate_storyboard(request.clarified_prompt)
    except GroqConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except (ScreenwriterOutputError, CinematographerOutputError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


class NarrationRequest(BaseModel):
    shots: list[dict] = Field(..., min_length=1)
    world_state: dict = Field(default_factory=dict)
    voice: str | None = None


class NarrationResponse(BaseModel):
    shots: list[dict]
    total_duration_s: float


@app.post("/narration/script", response_model=NarrationResponse)
def narration_script(request: NarrationRequest):
    """FR-10 (ADR-032): write the beat script, speak it, and time the result.

    Returns each shot with its beats — every beat carrying the MEASURED
    duration of its own narration and the audio as base64 — plus the shot
    ``duration_s`` the video must adopt for the voice to stay in sync. The
    caller writes the audio to disk and renders against these durations; it
    must not recompute them, for the same reason ADR-028 exported one shot
    filter instead of letting a second copy drift.

    Synthesis failures are per-beat and non-fatal: that beat falls back to a
    silent slot of the same shape, so one dead line costs its voiceover and
    not the whole video.
    """
    try:
        narrated = write_narration(request.shots, request.world_state)
    except NarratorOutputError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except GroqConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    voice = request.voice or DEFAULT_VOICE
    for shot in narrated:
        for beat in shot["beats"]:
            if not beat["narration"]:
                beat.update({"duration_s": SILENT_BEAT_SECONDS, "audio_base64": None})
                continue
            try:
                spoken = synthesize(beat["narration"], voice=voice)
            except (SpeechSynthesisError, ValueError) as exc:
                beat.update(
                    {
                        "duration_s": SILENT_BEAT_SECONDS,
                        "audio_base64": None,
                        "narration_error": str(exc),
                    }
                )
                continue
            beat.update(
                {
                    "duration_s": spoken["duration_s"] + BEAT_PADDING_SECONDS,
                    "audio_base64": base64.b64encode(spoken["audio"]).decode("ascii"),
                    "voice": spoken["voice"],
                }
            )

    timeline = beat_timeline(narrated)
    return {
        "shots": timeline,
        "total_duration_s": round(sum(s["duration_s"] for s in timeline), 3),
    }


class CriticEvaluateRequest(BaseModel):
    image_base64: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)


class CriticEvaluateResponse(BaseModel):
    passed: bool
    reason: str


@app.post("/critic/evaluate", response_model=CriticEvaluateResponse)
def critic_evaluate(request: CriticEvaluateRequest):
    try:
        return evaluate_frame(request.image_base64, request.description)
    except CriticConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except CriticEvaluationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
