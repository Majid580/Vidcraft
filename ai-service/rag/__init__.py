"""RAG style-grounding vector index (RAG-001, FR-4).

Public surface: `VectorIndex` (the FAISS + metadata store) and `embed`
(the all-MiniLM-L6-v2 encoder). The Cinematographer agent (AI-007) will
query a populated index; corpus curation/ingestion is RAG-002/RAG-003.
"""

from .embedder import embed, get_model
from .index import VectorIndex

__all__ = ["VectorIndex", "embed", "get_model"]
