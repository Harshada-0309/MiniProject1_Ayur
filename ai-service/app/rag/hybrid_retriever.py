"""
Hybrid RAG Retrieval Layer for AyurDiet Phase 4.
Implements Reciprocal Rank Fusion (RRF) combining dense semantic search (Sentence Transformers + Qdrant)
and lexical exact search (BM25Okapi), with deterministic query expansion, metadata-aware filtering,
and evidence confidence validation.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

from .bm25_index import BM25Index
from .embeddings import EmbeddingService
from .query_expansion import DeterministicQueryExpander
from .schemas import (
    RetrievalFilter,
    RetrievalMetadata,
    RetrievalResult,
    RetrieveRequest,
    RetrieveResponse,
    SourceReference,
)
from .vector_store import QdrantVectorStore
from ..config import settings

logger = logging.getLogger("ayurdiet.rag.retriever")

# Minimum semantic similarity threshold below which a query is considered unsupported
MIN_DENSE_SIMILARITY_THRESHOLD = 0.28


class HybridRetriever:
    """
    Coordinates dense and BM25 retrievers, Reciprocal Rank Fusion, and evidence grounding.
    """

    def __init__(
        self,
        vector_store: Optional[QdrantVectorStore] = None,
        bm25_index: Optional[BM25Index] = None,
        embedding_service: Optional[EmbeddingService] = None,
        query_expander: Optional[DeterministicQueryExpander] = None,
        default_k: Optional[int] = None,
        default_dense_weight: Optional[float] = None,
        default_bm25_weight: Optional[float] = None,
    ):
        self.vector_store = vector_store or QdrantVectorStore()
        self.bm25_index = bm25_index or BM25Index()
        self.embedding_service = embedding_service or EmbeddingService()
        self.query_expander = query_expander or DeterministicQueryExpander()

        # Configurable RRF parameters
        self.default_k = default_k or settings.rag_rrf_k  # 60
        self.default_dense_weight = default_dense_weight or settings.rag_dense_weight  # 0.5
        self.default_bm25_weight = default_bm25_weight or settings.rag_bm25_weight  # 0.5
        self.candidate_k = settings.rag_candidate_k  # 20

    def retrieve(self, request: RetrieveRequest) -> RetrieveResponse:
        """
        Executes end-to-end hybrid retrieval according to Phase 4 architecture.
        """
        query_text = request.query.strip()
        top_k = request.top_k or settings.rag_top_k
        k = request.rrf_k or self.default_k
        dense_w = request.dense_weight if request.dense_weight is not None else self.default_dense_weight
        bm25_w = request.bm25_weight if request.bm25_weight is not None else self.default_bm25_weight
        filters = request.filters or {}

        # 1. Deterministic Query Expansion
        expanded_query = self.query_expander.expand_query(query_text)

        # 2. Dense Semantic Retrieval
        dense_results: List[Dict[str, Any]] = []
        try:
            query_vector = self.embedding_service.embed_query(expanded_query)
            dense_results = self.vector_store.search(
                query_vector=query_vector,
                top_k=self.candidate_k,
                filters=filters,
            )
        except Exception as e:
            logger.error(f"[Retriever] Dense retrieval error: {e}")

        # 3. BM25 Lexical Retrieval
        bm25_results: List[Dict[str, Any]] = []
        try:
            bm25_results = self.bm25_index.search(
                query=expanded_query,
                top_k=self.candidate_k,
                filters=filters,
            )
        except Exception as e:
            logger.error(f"[Retriever] BM25 retrieval error: {e}")

        # 4. Check for Unsupported / Insufficient Evidence Query
        # If neither dense nor lexical finds evidence, or top dense similarity is exceptionally weak
        insufficient_evidence = False
        top_dense_score = dense_results[0]["score"] if dense_results else 0.0
        top_bm25_score = bm25_results[0]["score"] if bm25_results else 0.0

        if (not dense_results and not bm25_results) or (
            top_dense_score < 0.35 and top_bm25_score < 18.0
        ) or (top_dense_score < 0.28):
            insufficient_evidence = True

            logger.info(
                f"[Retriever] Insufficient evidence detected for query: '{query_text}' "
                f"(top_dense={top_dense_score:.3f}, top_bm25={top_bm25_score:.3f})"
            )
            return RetrieveResponse(
                query=query_text,
                results=[],
                insufficient_evidence=True,
                retrieval_metadata=RetrievalMetadata(
                    dense_results=len(dense_results),
                    bm25_results=len(bm25_results),
                    final_results=0,
                    retrieval_method="hybrid_rrf",
                    query_expanded=expanded_query,
                    insufficient_evidence=True,
                    dense_weight=dense_w,
                    bm25_weight=bm25_w,
                    rrf_k=k,
                ),
            )

        # 5. Reciprocal Rank Fusion (RRF)
        # RRF formula: Score(d) = sum(w / (k + rank))
        fused_items: Dict[str, Dict[str, Any]] = {}

        # Process dense ranks
        for item in dense_results:
            cid = item["chunk_id"]
            dense_rank = item["dense_rank"]
            dense_component = dense_w / (k + dense_rank)

            fused_items[cid] = {
                "chunk_id": cid,
                "document_id": item["document_id"],
                "text": item["text"],
                "metadata": item.get("metadata", {}),
                "source_reference": item.get("source_reference", {}),
                "dense_rank": dense_rank,
                "bm25_rank": None,
                "rrf_score": dense_component,
                "retrieval_method": "dense",
            }

        # Process BM25 ranks
        for item in bm25_results:
            cid = item["chunk_id"]
            bm25_rank = item["bm25_rank"]
            bm25_component = bm25_w / (k + bm25_rank)

            if cid in fused_items:
                fused_items[cid]["bm25_rank"] = bm25_rank
                fused_items[cid]["rrf_score"] += bm25_component
                fused_items[cid]["retrieval_method"] = "hybrid"
            else:
                fused_items[cid] = {
                    "chunk_id": cid,
                    "document_id": item["document_id"],
                    "text": item["text"],
                    "metadata": item.get("metadata", {}),
                    "source_reference": item.get("source_reference", {}),
                    "dense_rank": None,
                    "bm25_rank": bm25_rank,
                    "rrf_score": bm25_component,
                    "retrieval_method": "bm25",
                }

        # 6. Metadata Soft-Filtering (Graceful preservation)
        # "Do not discard potentially relevant evidence merely because a document lacks optional metadata"
        filtered_candidates = list(fused_items.values())
        if filters:
            matched_subset = []
            for cand in filtered_candidates:
                meta = cand.get("metadata", {})
                is_match = True
                for f_key, f_val in filters.items():
                    if f_val and f_key in meta and meta[f_key]:
                        target = str(f_val).lower()
                        meta_val = str(meta[f_key]).lower()
                        if target not in meta_val and meta_val not in target:
                            is_match = False
                            break
                if is_match:
                    matched_subset.append(cand)

            # If filtered subset has results, use it; otherwise retain general candidates gracefully
            if matched_subset:
                filtered_candidates = matched_subset

        # 7. Sort by fused RRF score descending
        filtered_candidates.sort(key=lambda x: x["rrf_score"], reverse=True)
        top_candidates = filtered_candidates[:top_k]

        # 8. Build structured results adhering to contract
        final_results: List[RetrievalResult] = []
        for cand in top_candidates:
            raw_source = cand.get("source_reference", {})
            src_ref = SourceReference(
                document=raw_source.get("document", cand.get("document_id", "Unknown")),
                page=raw_source.get("page", 1),
                section=raw_source.get("section"),
            )
            final_results.append(
                RetrievalResult(
                    chunk_id=cand["chunk_id"],
                    document_id=cand["document_id"],
                    text=cand["text"],
                    score=round(float(cand["rrf_score"]), 6),
                    retrieval_method=cand["retrieval_method"],
                    dense_rank=cand.get("dense_rank"),
                    bm25_rank=cand.get("bm25_rank"),
                    rrf_score=round(float(cand["rrf_score"]), 6),
                    metadata=cand.get("metadata", {}),
                    source=src_ref,
                )
            )

        return RetrieveResponse(
            query=query_text,
            results=final_results,
            insufficient_evidence=False,
            retrieval_metadata=RetrievalMetadata(
                dense_results=len(dense_results),
                bm25_results=len(bm25_results),
                final_results=len(final_results),
                retrieval_method="hybrid_rrf",
                query_expanded=expanded_query,
                insufficient_evidence=False,
                dense_weight=dense_w,
                bm25_weight=bm25_w,
                rrf_k=k,
            ),
        )
