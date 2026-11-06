"""
Qdrant Vector Store Management for AyurDiet Phase 4.
Provides collection lifecycle, reproducible batch upsert, semantic similarity search,
and metadata filtering with transparent remote-server / local-embedded fallback handling.
"""

import logging
import uuid
from typing import Any, Dict, List, Optional
import numpy as np
import qdrant_client
from qdrant_client.http import models as rest_models
from qdrant_client.models import Distance, FieldCondition, Filter, MatchValue, PointStruct, VectorParams

from .schemas import KnowledgeChunk
from ..config import settings

logger = logging.getLogger("ayurdiet.rag.vector_store")


_SHARED_LOCAL_CLIENT = None


class QdrantVectorStore:
    """
    Manages knowledge retrieval vectors inside Qdrant.
    Supports both local embedded persistent storage and remote containerized Qdrant instance.
    """

    def __init__(
        self,
        url: Optional[str] = None,
        collection_name: Optional[str] = None,
        force_local: bool = False,
    ):
        self.url = url or settings.qdrant_url
        self.collection_name = collection_name or settings.qdrant_collection
        self.dimension = settings.embedding_dimension
        self.client: qdrant_client.QdrantClient
        self.mode: str
        self.location: str

        if force_local:
            self._init_local_client()
        else:
            try:
                # Attempt connecting to external Qdrant server
                candidate_client = qdrant_client.QdrantClient(url=self.url, timeout=2)
                # Test connectivity
                candidate_client.get_collections()
                self.client = candidate_client
                self.mode = "remote_server"
                self.location = self.url
                logger.info(f"[Qdrant] Connected to remote server at {self.url}")
            except Exception as conn_err:
                logger.warning(
                    f"[Qdrant] Remote server at {self.url} unavailable ({conn_err}). "
                    f"Falling back to local embedded persistent storage."
                )
                self._init_local_client()

    def _init_local_client(self):
        global _SHARED_LOCAL_CLIENT
        storage_path = str(settings.qdrant_storage_dir)
        settings.qdrant_storage_dir.mkdir(parents=True, exist_ok=True)
        if _SHARED_LOCAL_CLIENT is None:
            _SHARED_LOCAL_CLIENT = qdrant_client.QdrantClient(path=storage_path)
            logger.info(f"[Qdrant] Initialized local embedded storage at {storage_path}")
        self.client = _SHARED_LOCAL_CLIENT
        self.mode = "local_embedded"
        self.location = storage_path


    def get_connection_status(self) -> Dict[str, Any]:
        """
        Returns connection mode, location, collection existence, and vector counts.
        """
        exists = False
        vector_count = 0
        try:
            exists = self.client.collection_exists(self.collection_name)
            if exists:
                info = self.client.get_collection(self.collection_name)
                vector_count = info.points_count or 0
        except Exception as e:
            logger.error(f"[Qdrant] Error checking collection info: {e}")

        return {
            "mode": self.mode,
            "location": self.location,
            "collection_name": self.collection_name,
            "exists": exists,
            "vector_count": vector_count,
        }

    def ensure_collection(self, recreate: bool = False) -> None:
        """
        Creates or resets the Qdrant collection with explicit reproducible configuration.
        """
        exists = self.client.collection_exists(self.collection_name)
        if recreate and exists:
            logger.info(f"[Qdrant] Recreating collection '{self.collection_name}'")
            self.client.delete_collection(self.collection_name)
            exists = False

        if not exists:
            logger.info(
                f"[Qdrant] Creating collection '{self.collection_name}' (dim={self.dimension}, dist=Cosine)"
            )
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(
                    size=self.dimension,
                    distance=Distance.COSINE,
                ),
            )

    def upsert_chunks(
        self,
        chunks: List[KnowledgeChunk],
        embeddings: np.ndarray,
        batch_size: int = 100,
    ) -> int:
        """
        Inserts knowledge chunks and their dense embeddings in batches.
        """
        if len(chunks) != len(embeddings):
            raise ValueError(f"Chunks ({len(chunks)}) and embeddings ({len(embeddings)}) count mismatch")

        self.ensure_collection(recreate=False)
        total = len(chunks)
        points_inserted = 0

        for i in range(0, total, batch_size):
            batch_chunks = chunks[i : i + batch_size]
            batch_embs = embeddings[i : i + batch_size]

            points: List[PointStruct] = []
            for chunk, emb in zip(batch_chunks, batch_embs):
                # Deterministic UUID from chunk_id
                point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, chunk.chunk_id))
                payload = {
                    "chunk_id": chunk.chunk_id,
                    "document_id": chunk.document_id,
                    "text": chunk.text,
                    "page_number": chunk.page_number,
                    "section": chunk.section,
                    "metadata": chunk.metadata,
                    "source_reference": chunk.source_reference.model_dump(),
                    # Direct top-level filterable keys
                    "prakriti": chunk.metadata.get("prakriti"),
                    "dosha": chunk.metadata.get("dosha"),
                    "season": chunk.metadata.get("season"),
                    "condition": chunk.metadata.get("condition"),
                    "clinical_condition": chunk.metadata.get("clinical_condition"),
                    "food_category": chunk.metadata.get("food_category"),
                    "pathya_status": chunk.metadata.get("pathya_status"),
                    "source_type": chunk.metadata.get("source_type"),
                }
                points.append(
                    PointStruct(
                        id=point_id,
                        vector=emb.tolist(),
                        payload=payload,
                    )
                )

            self.client.upsert(collection_name=self.collection_name, points=points)
            points_inserted += len(points)
            logger.info(f"[Qdrant] Upserted batch {points_inserted}/{total} points")

        return points_inserted

    def search(
        self,
        query_vector: List[float],
        top_k: int = 20,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Semantic vector similarity search with optional metadata filtering.
        """
        if not self.client.collection_exists(self.collection_name):
            return []

        qdrant_filter: Optional[Filter] = None
        if filters:
            conditions = []
            for key, val in filters.items():
                if val:
                    val_str = str(val).lower()
                    # Check both top-level and inside metadata
                    conditions.append(
                        FieldCondition(
                            key=key,
                            match=MatchValue(value=val_str),
                        )
                    )
            if conditions:
                qdrant_filter = Filter(should=conditions)

        query_response = self.client.query_points(
            collection_name=self.collection_name,
            query=query_vector,
            limit=top_k,
            query_filter=qdrant_filter,
            with_payload=True,
        )
        search_results = query_response.points

        results: List[Dict[str, Any]] = []
        for rank, hit in enumerate(search_results, start=1):
            payload = hit.payload or {}
            results.append({
                "chunk_id": payload.get("chunk_id", ""),
                "document_id": payload.get("document_id", ""),
                "text": payload.get("text", ""),
                "score": float(hit.score),
                "dense_rank": rank,
                "metadata": payload.get("metadata", {}),
                "source_reference": payload.get("source_reference", {}),
            })

        return results
