"""
Pydantic Schemas for AyurDiet Hybrid RAG Knowledge Retrieval.
Defines strict contracts for chunks, metadata, search queries, and responses.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SourceReference(BaseModel):
    """
    Source traceability pointer.
    Every retrieved chunk must be traceable back to its originating document and page.
    """
    document: str = Field(..., description="Document filename or canonical title")
    page: int = Field(..., description="1-indexed PDF page number")
    section: Optional[str] = Field(default=None, description="Section heading or topic name")


class KnowledgeChunk(BaseModel):
    """
    Internal and persistent representation of a chunked knowledge fragment.
    """
    chunk_id: str = Field(..., description="Unique chunk identifier")
    document_id: str = Field(..., description="Unique document identifier")
    text: str = Field(..., description="Cleaned passage text content")
    page_number: int = Field(..., description="Originating page number")
    section: Optional[str] = Field(default=None, description="Identified section heading")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata tags")
    source_reference: SourceReference = Field(..., description="Source provenance reference")


class RetrievalFilter(BaseModel):
    """
    Optional metadata filter constraints for retrieval.
    """
    prakriti: Optional[str] = Field(default=None, description="e.g. vata, pitta, kapha")
    dosha: Optional[str] = Field(default=None, description="e.g. vata, pitta, kapha")
    season: Optional[str] = Field(default=None, description="e.g. winter, summer, monsoon, hemanta, shishira")
    condition: Optional[str] = Field(default=None, description="Clinical condition e.g. diabetes, cardiac, skin")
    food_category: Optional[str] = Field(default=None, description="e.g. cereal, pulse, fruit, spice, dairy")
    pathya_status: Optional[str] = Field(default=None, description="pathya or apathya")
    source_type: Optional[str] = Field(default=None, description="e.g. classical_ayurvedic, clinical_guideline")


class RetrieveRequest(BaseModel):
    """
    Request payload for POST /api/rag/retrieve.
    """
    query: str = Field(..., min_length=2, description="Dietitian search or clinical dietary query")
    top_k: Optional[int] = Field(default=5, ge=1, le=50, description="Number of results to return")
    filters: Optional[Dict[str, Any]] = Field(default=None, description="Optional metadata filter key-values")
    dense_weight: Optional[float] = Field(default=None, ge=0.0, le=5.0, description="RRF dense search weight")
    bm25_weight: Optional[float] = Field(default=None, ge=0.0, le=5.0, description="RRF BM25 search weight")
    rrf_k: Optional[int] = Field(default=None, ge=1, le=200, description="RRF smoothing parameter k")


class RetrievalResult(BaseModel):
    """
    Structured retrieval result adhering to Section 12 contract.
    """
    chunk_id: str
    document_id: str
    text: str
    score: float
    retrieval_method: str = "hybrid"
    dense_rank: Optional[int] = None
    bm25_rank: Optional[int] = None
    rrf_score: float
    metadata: Dict[str, Any] = Field(default_factory=dict)
    source: SourceReference


class RetrievalMetadata(BaseModel):
    """
    Metadata diagnostics for retrieval execution.
    """
    dense_results: int
    bm25_results: int
    final_results: int
    retrieval_method: str = "hybrid_rrf"
    query_expanded: Optional[str] = None
    insufficient_evidence: bool = False
    dense_weight: float = 0.5
    bm25_weight: float = 0.5
    rrf_k: int = 60


class RetrieveResponse(BaseModel):
    """
    Response schema for POST /api/rag/retrieve.
    """
    query: str
    results: List[RetrievalResult] = Field(default_factory=list)
    insufficient_evidence: bool = False
    retrieval_metadata: RetrievalMetadata
