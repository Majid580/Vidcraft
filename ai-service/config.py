"""Environment configuration for the ai-service (loaded once at import time)."""

import os

from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
ANALYSIS_SCORE_THRESHOLD = int(os.getenv("ANALYSIS_SCORE_THRESHOLD", "60"))

# --- Fallback LLM (AI-006, per ADR-002 + ADR-015) ---
# Groq is the primary provider; a secondary hosted API is used ONLY when Groq
# is unavailable (rate-limited/429 — see the 30 req/min free-tier cap — a
# connection error, a 5xx, or an unconfigured key). The fallback is any
# OpenAI-compatible chat-completions endpoint, so NOTHING runs locally (per
# ADR-015: no on-device LLM/heavy compute — it degrades UX on the dev
# machine). Defaults point at a SECOND Groq model on the same free key: a
# different per-model rate bucket, zero cost, no extra signup. Override the
# base_url/key/model to use a fully independent provider (OpenRouter,
# Together, Google Gemini's OpenAI-compat endpoint, OpenAI, ...).
# Set LLM_FALLBACK_ENABLED=false to make Groq failures fatal instead.
LLM_FALLBACK_ENABLED = os.getenv("LLM_FALLBACK_ENABLED", "true").strip().lower() in (
    "1",
    "true",
    "yes",
    "on",
)
FALLBACK_LLM_BASE_URL = os.getenv(
    "FALLBACK_LLM_BASE_URL", "https://api.groq.com/openai/v1"
).rstrip("/")
# Falls back to the primary Groq key when a separate fallback key isn't set.
FALLBACK_LLM_API_KEY = os.getenv("FALLBACK_LLM_API_KEY", "") or GROQ_API_KEY
FALLBACK_LLM_MODEL = os.getenv("FALLBACK_LLM_MODEL", "llama-3.1-8b-instant")
LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "60"))

# --- RAG / vector index (RAG-001, per ADR-004 and FR-4) ---
# all-MiniLM-L6-v2 is the corpus + query embedding model (FR-4); it emits
# 384-dim vectors. EMBEDDING_DIM lets an empty index be sized without
# loading the model. VECTOR_INDEX_PATH is a base path — the store writes
# `{path}.faiss` + `{path}.meta.json` beside it.
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "384"))
VECTOR_INDEX_PATH = os.getenv("VECTOR_INDEX_PATH", "rag/data/style_index")
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "3"))
