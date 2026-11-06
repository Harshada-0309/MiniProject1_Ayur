import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    app_name: str = "AyurDiet AI Service"
    version: str = "1.0.0"
    port: int = 8000
    host: str = "0.0.0.0"
    backend_url: str = "http://localhost:5000"

    # RAG & Knowledge Base Configuration
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "ayurdiet_knowledge"
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dimension: int = 384

    # Paths
    repo_root: Path = REPO_ROOT
    data_dir: Path = REPO_ROOT / "data"
    knowledge_base_dir: Path = REPO_ROOT / "data" / "knowledge_base"
    processed_dir: Path = REPO_ROOT / "data" / "processed"
    chunks_dir: Path = REPO_ROOT / "data" / "processed" / "chunks"
    bm25_index_dir: Path = REPO_ROOT / "data" / "processed" / "bm25_index"
    qdrant_storage_dir: Path = REPO_ROOT / "data" / "processed" / "qdrant_storage"
    manifests_dir: Path = REPO_ROOT / "data" / "processed" / "manifests"

    # Default Chunking & Retrieval Parameters
    rag_chunk_size: int = 700
    rag_chunk_overlap: int = 120
    rag_candidate_k: int = 20
    rag_top_k: int = 5
    rag_rrf_k: int = 60
    rag_dense_weight: float = 0.5
    rag_bm25_weight: float = 0.5
    rag_min_evidence_score: float = 0.005

    # Gemini Configuration
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    gemini_temperature: float = 0.2
    gemini_max_tokens: int = 4096
    gemini_timeout_seconds: float = 30.0

    model_config = SettingsConfigDict(
    env_file=REPO_ROOT / ".env",
    extra="ignore"
)


settings = Settings()
