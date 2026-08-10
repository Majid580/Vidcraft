"""Environment configuration for the ai-service (loaded once at import time)."""

import os

from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
ANALYSIS_SCORE_THRESHOLD = int(os.getenv("ANALYSIS_SCORE_THRESHOLD", "60"))

# --- RAG / vector index (RAG-001, per ADR-004 and FR-4) ---
# all-MiniLM-L6-v2 is the corpus + query embedding model (FR-4); it emits
# 384-dim vectors. EMBEDDING_DIM lets an empty index be sized without
# loading the model. VECTOR_INDEX_PATH is a base path — the store writes
# `{path}.faiss` + `{path}.meta.json` beside it.
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "384"))
VECTOR_INDEX_PATH = os.getenv("VECTOR_INDEX_PATH", "rag/data/style_index")
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "3"))
