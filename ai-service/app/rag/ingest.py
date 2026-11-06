"""
Reproducible Knowledge Base Ingestion Pipeline for AyurDiet Phase 4.
Executes end-to-end PDF extraction, normalization, semantic chunking, dense embedding,
Qdrant vector upsert, and BM25 lexical index creation from the canonical knowledge-base ZIP.

Usage:
    python -m app.rag.ingest [--zip-path "E:\\final Ayur K.zip"] [--recreate]
"""

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import numpy as np

from .bm25_index import BM25Index
from .chunker import SemanticChunker
from .document_loader import DocumentLoader
from .embeddings import EmbeddingService
from .schemas import KnowledgeChunk
from .vector_store import QdrantVectorStore
from ..config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("ayurdiet.rag.ingest")


def run_ingestion_pipeline(
    zip_path: str = r"E:\final Ayur K.zip",
    recreate_collections: bool = True,
    chunk_size: int = 700,
    chunk_overlap: int = 120,
) -> Dict[str, Any]:
    """
    Executes the complete, reproducible Phase 4 knowledge base ingestion pipeline.
    """
    start_time = time.time()
    logger.info("=" * 70)
    logger.info("AYURDIET PHASE 4: KNOWLEDGE BASE INGESTION PIPELINE")
    logger.info(f"Source ZIP: {zip_path}")
    logger.info(f"Recreate Collections: {recreate_collections}")
    logger.info(f"Chunk Config: size={chunk_size}, overlap={chunk_overlap}")
    logger.info("=" * 70)

    # 1. Directory Structure Setup
    settings.knowledge_base_dir.mkdir(parents=True, exist_ok=True)
    settings.processed_dir.mkdir(parents=True, exist_ok=True)
    settings.chunks_dir.mkdir(parents=True, exist_ok=True)
    settings.bm25_index_dir.mkdir(parents=True, exist_ok=True)
    settings.qdrant_storage_dir.mkdir(parents=True, exist_ok=True)
    settings.manifests_dir.mkdir(parents=True, exist_ok=True)
    (settings.processed_dir / "embeddings").mkdir(parents=True, exist_ok=True)

    # 2. PDF Discovery & Extraction
    loader = DocumentLoader(zip_path=zip_path, output_dir=settings.knowledge_base_dir)
    pdf_files = loader.extract_zip_to_storage()
    logger.info(f"Step 1: Discovered and stored {len(pdf_files)} PDF source documents.")

    # 3. Document Extraction & Semantic Chunking
    chunker = SemanticChunker(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    all_chunks: List[KnowledgeChunk] = []
    total_pages_read = 0
    pdf_page_counts: Dict[str, int] = {}

    logger.info("Step 2: Extracting pages and applying semantic chunking...")
    for page in loader.load_all_pages():
        total_pages_read += 1
        pdf_page_counts[page.document_name] = pdf_page_counts.get(page.document_name, 0) + 1
        page_chunks = chunker.chunk_page(page)
        all_chunks.extend(page_chunks)

    logger.info(
        f"Step 2 Complete: Processed {total_pages_read} pages across {len(pdf_page_counts)} documents. "
        f"Generated {len(all_chunks)} semantic chunks."
    )

    if not all_chunks:
        raise RuntimeError("No chunks were generated! Verify PDF extraction inputs.")

    # 4. Save Chunks Manifest
    chunks_file = settings.chunks_dir / "knowledge_chunks.json"
    logger.info(f"Saving chunk payload to {chunks_file}...")
    chunk_dicts = [c.model_dump() for c in all_chunks]
    with open(chunks_file, "w", encoding="utf-8") as f:
        json.dump(chunk_dicts, f, indent=2, ensure_ascii=False)

    # 5. Dense Embeddings Generation
    logger.info(f"Step 3: Generating dense embeddings via {settings.embedding_model} (dim={settings.embedding_dimension})...")
    embedder = EmbeddingService()
    chunk_texts = [c.text for c in all_chunks]
    embeddings = embedder.embed_texts(chunk_texts, batch_size=64, show_progress=True)

    embeddings_file = settings.processed_dir / "embeddings" / "chunk_embeddings.npy"
    np.save(str(embeddings_file), embeddings)
    logger.info(f"Saved {len(embeddings)} dense embeddings to {embeddings_file}")

    # 6. Qdrant Vector Store Upsert
    logger.info(f"Step 4: Initializing Qdrant collection '{settings.qdrant_collection}'...")
    vector_store = QdrantVectorStore()
    if recreate_collections:
        vector_store.ensure_collection(recreate=True)

    points_upserted = vector_store.upsert_chunks(all_chunks, embeddings, batch_size=100)
    qdrant_status = vector_store.get_connection_status()
    logger.info(
        f"Step 4 Complete: Upserted {points_upserted} vectors into Qdrant "
        f"(mode={qdrant_status['mode']}, location={qdrant_status['location']})"
    )

    # 7. BM25 Lexical Index Construction
    logger.info("Step 5: Constructing lexical BM25 index for exact Ayurvedic and clinical terminology...")
    bm25 = BM25Index()
    bm25.build(all_chunks)
    logger.info(f"Step 5 Complete: BM25 index persisted at {settings.bm25_index_dir}")

    # 8. Write Ingestion Manifest
    elapsed_time = round(time.time() - start_time, 2)
    manifest = {
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "elapsed_seconds": elapsed_time,
        "source_zip": zip_path,
        "total_pdfs": len(pdf_files),
        "total_pages_extracted": total_pages_read,
        "total_chunks": len(all_chunks),
        "chunking": {
            "chunk_size": chunk_size,
            "chunk_overlap": chunk_overlap,
        },
        "embeddings": {
            "model": settings.embedding_model,
            "dimension": settings.embedding_dimension,
            "count": len(embeddings),
            "storage_file": str(embeddings_file),
        },
        "qdrant": {
            "collection": settings.qdrant_collection,
            "vector_count": points_upserted,
            "mode": qdrant_status["mode"],
            "location": qdrant_status["location"],
        },
        "bm25": {
            "index_dir": str(settings.bm25_index_dir),
            "entries_indexed": len(all_chunks),
        },
    }

    manifest_file = settings.manifests_dir / "ingestion_manifest.json"
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    logger.info("=" * 70)
    logger.info("INGESTION PIPELINE COMPLETED SUCCESSFULLY")
    logger.info(f"Processed: {manifest['total_pdfs']} PDFs | {manifest['total_pages_extracted']} Pages | {manifest['total_chunks']} Chunks")
    logger.info(f"Dense Vectors: {manifest['embeddings']['count']} | Qdrant Mode: {manifest['qdrant']['mode']}")
    logger.info(f"Elapsed Time: {elapsed_time}s | Manifest: {manifest_file}")
    logger.info("=" * 70)

    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AyurDiet Phase 4 Knowledge Ingestion Pipeline")
    parser.add_argument("--zip-path", type=str, default=r"E:\final Ayur K.zip", help="Path to knowledge-base ZIP")
    parser.add_argument("--recreate", action="store_true", default=True, help="Recreate Qdrant collections")
    parser.add_argument("--chunk-size", type=int, default=700, help="Chunk character size")
    parser.add_argument("--chunk-overlap", type=int, default=120, help="Chunk overlap in characters")

    args = parser.parse_args()
    run_ingestion_pipeline(
        zip_path=args.zip_path,
        recreate_collections=args.recreate,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
    )
