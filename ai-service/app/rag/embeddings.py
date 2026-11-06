"""
Dense Embedding Service for AyurDiet Phase 4.
Generates 384-dimensional dense vectors using Sentence Transformers all-MiniLM-L6-v2.
"""

import logging
from typing import List, Optional
import numpy as np
from sentence_transformers import SentenceTransformer

from ..config import settings

logger = logging.getLogger("ayurdiet.rag.embeddings")

_EMBEDDING_MODEL_INSTANCE: Optional[SentenceTransformer] = None


def get_embedding_model() -> SentenceTransformer:
    """
    Lazy-loads and returns the singleton SentenceTransformer instance.
    """
    global _EMBEDDING_MODEL_INSTANCE
    if _EMBEDDING_MODEL_INSTANCE is None:
        logger.info(f"Loading dense embedding model: {settings.embedding_model}")
        _EMBEDDING_MODEL_INSTANCE = SentenceTransformer(settings.embedding_model)
    return _EMBEDDING_MODEL_INSTANCE


class EmbeddingService:
    """
    Handles dense vector generation for knowledge chunks and dietitian retrieval queries.
    """

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or settings.embedding_model
        self.dimension = settings.embedding_dimension

    def embed_texts(self, texts: List[str], batch_size: int = 64, show_progress: bool = False) -> np.ndarray:
        """
        Embeds a batch of passage texts into normalized dense vectors.
        """
        if not texts:
            return np.empty((0, self.dimension), dtype=np.float32)

        model = get_embedding_model()
        embeddings = model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=show_progress,
            normalize_embeddings=True,
            convert_to_numpy=True,
        )

        if embeddings.shape[1] != self.dimension:
            raise ValueError(
                f"Embedding dimension mismatch: expected {self.dimension}, got {embeddings.shape[1]}"
            )

        return embeddings.astype(np.float32)

    def embed_query(self, query: str) -> List[float]:
        """
        Embeds a single search query into a 384-dimensional normalized vector.
        """
        if not query or not query.strip():
            raise ValueError("Query string cannot be empty")

        model = get_embedding_model()
        vec = model.encode(
            [query.strip()],
            show_progress_bar=False,
            normalize_embeddings=True,
            convert_to_numpy=True,
        )[0]
        return vec.tolist()
