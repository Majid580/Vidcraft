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

# --- Storyboard intent-similarity retry loop (AI-008, FR-3, per ADR-018) ---
# Cosine similarity (all-MiniLM-L6-v2, same encoder as RAG-001/FR-4) between
# the clarified prompt and the generated shots' descriptions. Below this
# threshold the storyboard is sent back to the Screenwriter for revision, up
# to MAX_STORYBOARD_RETRIES times (ADR-005's bounded-retry default of 2),
# after which the last attempt is finalized rather than failing the request
# (mirrors FR-8's critic-loop behavior on retry exhaustion).
STORYBOARD_SIMILARITY_THRESHOLD = float(os.getenv("STORYBOARD_SIMILARITY_THRESHOLD", "0.35"))
MAX_STORYBOARD_RETRIES = int(os.getenv("MAX_STORYBOARD_RETRIES", "2"))

# --- Critic / quality-feedback loop (CRITIC-001, FR-8, per ADR-026) ---
# The proposal left the vision-capable provider TBD ("likely the fallback
# LLM if it offers multimodal capability") — Groq's live model catalog was
# checked and has zero vision-capable models today, so that assumption
# doesn't hold (same kind of research-vs-reality gap PROVIDER-001 hit for
# Cloudflare's video catalog, ADR-019). Cloudflare Workers AI already has
# live-validated credentials (PROVIDER-001) and its llama-4-scout model
# accepts an OpenAI-style image_url content part and returns clean,
# correctly-grounded structured verdicts — live-verified against both a
# genuinely matching and a genuinely mismatching image before this was
# written. ai-service holds its own copy of the Cloudflare credentials
# (same real values as backend/.env) since it's a separate process, mirroring
# GROQ_API_KEY.
CLOUDFLARE_ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID", "")
CLOUDFLARE_API_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN", "")
CRITIC_VISION_MODEL = os.getenv("CRITIC_VISION_MODEL", "@cf/meta/llama-4-scout-17b-16e-instruct")
