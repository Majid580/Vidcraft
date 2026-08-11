from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from analyzer import EmptyPromptError, score_prompt
from clarification import build_brief, generate_questions
from llm import GroqConfigError
from orchestrator import (
    CinematographerOutputError,
    ProducerOutputError,
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


class ClarifyQuestionsResponse(BaseModel):
    questions: list[str]


@app.post("/clarify/questions", response_model=ClarifyQuestionsResponse)
def clarify_questions(request: ClarifyQuestionsRequest):
    try:
        questions = generate_questions(request.prompt, request.flags, request.suggestions)
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
    except (ScreenwriterOutputError, CinematographerOutputError, ProducerOutputError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
