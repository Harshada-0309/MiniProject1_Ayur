"""
Comprehensive Unit and Integration Tests for AyurDiet Phase 4 Hybrid RAG Retrieval Layer.
Validates PDF extraction, semantic chunking, dense embeddings, Qdrant vector store,
BM25 lexical index, hybrid RRF rank fusion, metadata filtering, traceability, and grounding safety.
"""

import os
from pathlib import Path
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.rag.bm25_index import BM25Index, tokenize_text
from app.rag.chunker import SemanticChunker
from app.rag.document_loader import (
    DOCUMENT_CATALOG,
    DocumentLoader,
    ExtractedPage,
    derive_contextual_metadata,
    normalize_extracted_text,
)
from app.rag.embeddings import EmbeddingService
from app.rag.hybrid_retriever import HybridRetriever
from app.rag.query_expansion import DeterministicQueryExpander
from app.rag.schemas import KnowledgeChunk, RetrieveRequest, SourceReference
from app.rag.vector_store import QdrantVectorStore

client = TestClient(app)


# ==============================================================================
# 1. Document Loading, Normalization & Metadata Tests
# ==============================================================================

def test_document_catalog_completeness():
    """Verify all 24 documents are cataloged with source type, title, and topic."""
    assert len(DOCUMENT_CATALOG) == 24
    for doc_name, meta in DOCUMENT_CATALOG.items():
        assert "document_id" in meta
        assert "source_title" in meta
        assert "source_type" in meta
        assert "topic" in meta
        assert doc_name.endswith(".pdf")


def test_normalize_extracted_text():
    """Verify hyphenation removal across line breaks and whitespace normalization."""
    raw = "This is an Ayur- \n vedic dietary recom- \n mendation. \x00 Extra   spaces\n\n\n\nNew paragraph."
    cleaned = normalize_extracted_text(raw)
    assert "Ayurvedic" in cleaned
    assert "recommendation" in cleaned
    assert "\x00" not in cleaned
    assert "Extra spaces" in cleaned
    assert "\n\nNew paragraph." in cleaned


def test_derive_contextual_metadata():
    """Verify factual extraction of dosha, prakriti, season, pathya without fabrication."""
    doc_base = {"condition": "diabetes", "topic": "diabetes_management"}
    text = "For Kapha prakriti persons during winter hemanta season, bitter and pungent foods are wholesome Pathya."
    meta = derive_contextual_metadata(text, doc_base)

    assert meta["prakriti"] == "kapha"
    assert meta["dosha"] == "kapha"
    assert meta["season"] == "winter"
    assert meta["pathya_status"] == "pathya"
    assert meta["clinical_condition"] == "diabetes"

    # Test query without dosha or season
    neutral_text = "General guidance regarding meal timing and clean drinking water."
    neutral_meta = derive_contextual_metadata(neutral_text, {})
    assert neutral_meta["dosha"] is None
    assert neutral_meta["season"] is None


# ==============================================================================
# 2. Semantic Chunking Tests
# ==============================================================================

def test_semantic_chunker_structure_and_traceability():
    """Verify semantic chunker splits by sentence/paragraph, preserves overlap, IDs, and source provenance."""
    page = ExtractedPage(
        document_id="doc_test_ayurveda",
        document_name="Test_Document.pdf",
        source_title="Test Ayurvedic Guidelines",
        source_type="classical_ayurvedic",
        page_number=14,
        section="Chapter 2: Ahara Vidhi",
        text=(
            "Paragraph one describes rules for healthy eating and honoring Agni. "
            "One should eat warm, freshly prepared food in proper quantity.\n\n"
            "Paragraph two discusses Vata pacifying diets. Warm unctuous soups and sesame oil "
            "counteract the cold dry qualities of Vata dosha."
        ),
    )

    chunker = SemanticChunker(chunk_size=150, chunk_overlap=30)
    chunks = chunker.chunk_page(page)

    assert len(chunks) >= 1
    for idx, chunk in enumerate(chunks, start=1):
        assert chunk.document_id == "doc_test_ayurveda"
        assert chunk.page_number == 14
        assert chunk.section == "Chapter 2: Ahara Vidhi"
        assert chunk.chunk_id == f"doc_test_ayurveda_p0014_c{idx:02d}"
        assert chunk.source_reference.document == "Test_Document.pdf"
        assert chunk.source_reference.page == 14
        assert len(chunk.text) > 20


# ==============================================================================
# 3. Dense Embeddings Tests
# ==============================================================================

def test_dense_embeddings_generation_and_dimensions():
    """Verify Sentence Transformers all-MiniLM-L6-v2 outputs 384-dimensional embeddings."""
    embedder = EmbeddingService()
    assert embedder.dimension == 384

    texts = [
        "Kapha pacifying foods for winter season.",
        "Diabetes mellitus glycemic management and blood sugar control.",
    ]
    embs = embedder.embed_texts(texts, batch_size=2)
    assert embs.shape == (2, 384)
    assert isinstance(embs, np.ndarray)

    query_emb = embedder.embed_query("Ayurvedic food properties")
    assert len(query_emb) == 384


# ==============================================================================
# 4. BM25 Lexical Index Tests
# ==============================================================================

def test_bm25_ayurvedic_tokenization_and_search(tmp_path):
    """Verify BM25 tokenization preserves Sanskrit terms, hyphens, and exact lexical search."""
    tokens = tokenize_text("Kapha-Pitta dosha, Pathya, Apathya, Agni, HbA1c, and food-drug interaction")
    assert "kapha-pitta" in tokens or "kapha" in tokens
    assert "pathya" in tokens
    assert "apathya" in tokens
    assert "agni" in tokens
    assert "hba1c" in tokens
    assert "food-drug" in tokens

    # Build small temporary index
    chunk1 = KnowledgeChunk(
        chunk_id="c1",
        document_id="doc1",
        text="Pathya foods for diabetes include barley (yava), bitter gourd, and amla.",
        page_number=5,
        source_reference=SourceReference(document="doc1.pdf", page=5),
        metadata={"prakriti": "kapha", "condition": "diabetes"},
    )
    chunk2 = KnowledgeChunk(
        chunk_id="c2",
        document_id="doc2",
        text="Apathya for cardiac disorders include excessive salt, deep fried items, and heavy meals.",
        page_number=8,
        source_reference=SourceReference(document="doc2.pdf", page=8),
        metadata={"condition": "cardiac_disorders"},
    )

    bm25 = BM25Index(index_dir=tmp_path)
    bm25.build([chunk1, chunk2])

    # Search for exact term
    results = bm25.search("barley yava for diabetes", top_k=2)
    assert len(results) > 0
    assert results[0]["chunk_id"] == "c1"

    # Search with filter
    cardiac_results = bm25.search("cardiac disorders", top_k=2, filters={"condition": "cardiac_disorders"})
    assert len(cardiac_results) > 0
    assert cardiac_results[0]["chunk_id"] == "c2"



# ==============================================================================
# 5. Deterministic Query Expansion Tests
# ==============================================================================

def test_deterministic_query_expansion():
    """Verify clinical and Sanskrit expansion mappings."""
    expander = DeterministicQueryExpander()

    res_kapha = expander.expand_query("Kapha foods in winter")
    assert "shleshma" in res_kapha
    assert "hemanta" in res_kapha

    res_diabetes = expander.expand_query("diabetic diet plan")
    assert "madhumeha" in res_diabetes
    assert "prameha" in res_diabetes

    res_cardiac = expander.expand_query("cardiac diet guidelines")
    assert "hridya" in res_cardiac
    assert "hridroga" in res_cardiac


# ==============================================================================
# 6. Hybrid RAG Retrieval & Domain Verification Tests
# ==============================================================================

from app.main import get_retriever


@pytest.fixture(scope="module")
def retriever_instance():
    """Provides initialized retriever singleton with existing knowledge base, seeding test fixtures if empty."""
    retriever = get_retriever()
    status = retriever.vector_store.get_connection_status()
    bm25_loaded = retriever.bm25_index.load()
    if not status.get("exists") or status.get("vector_count", 0) == 0 or not bm25_loaded or len(retriever.bm25_index.chunk_store) == 0:
        sample_chunks = [
            KnowledgeChunk(
                chunk_id="test_c1",
                document_id="ayur_doc_kapha",
                text="In winter (hemanta and shishira), Kapha dosha tends to accumulate. Recommended foods suitable for Kapha in winter include pungent, bitter, and astringent tastes, warm and dry foods, honey, and barley.",
                page_number=1,
                source_reference=SourceReference(document="kapha_winter_guidelines.pdf", page=1),
                metadata={"prakriti": "kapha", "season": "winter"},
            ),
            KnowledgeChunk(
                chunk_id="test_c2",
                document_id="ayur_doc_vata",
                text="Vata dosha digestion and Agni require warm, unctuous (snigdha), sweet, sour, and salty foods. Cooked grains with ghee strengthen mandagni and vishamagni in Vata individuals.",
                page_number=2,
                source_reference=SourceReference(document="vata_digestion.pdf", page=2),
                metadata={"prakriti": "vata", "topic": "digestion"},
            ),
            KnowledgeChunk(
                chunk_id="test_c3",
                document_id="ayur_doc_pathya",
                text="Pathya and Apathya dietary rules define wholesome and unwholesome foods. Pathya promotes bodily equilibrium and longevity while Apathya aggravates doshas and blocks srotas.",
                page_number=3,
                source_reference=SourceReference(document="pathya_apathya.pdf", page=3),
                metadata={"topic": "pathya_apathya"},
            ),
            KnowledgeChunk(
                chunk_id="test_c4",
                document_id="ayur_doc_diabetes",
                text="Dietary guidelines for diabetes mellitus (Madhumeha, Prameha) emphasize whole grains such as barley (yava), bitter melon (karela), fenugreek, and low glycemic index foods to regulate blood glucose.",
                page_number=4,
                source_reference=SourceReference(document="diabetes_guidelines.pdf", page=4),
                metadata={"condition": "diabetes"},
            ),
            KnowledgeChunk(
                chunk_id="test_c5",
                document_id="ayur_doc_cardiac",
                text="Cardiac disorders and heart disease (Hridroga) require heart-healthy (hridya) dietary guidelines: low sodium, avoidance of saturated fats and heavy deep fried items, and incorporation of garlic, arjuna, and fiber.",
                page_number=5,
                source_reference=SourceReference(document="cardiac_guidelines.pdf", page=5),
                metadata={"condition": "cardiac_disorders"},
            ),
            KnowledgeChunk(
                chunk_id="test_c6",
                document_id="ayur_doc_allergy",
                text="Food allergy reference doses and hypersensitivity guidance indicate eliminating trigger allergens such as nuts, shellfish, or dairy to prevent acute anaphylaxis or adverse reactions.",
                page_number=6,
                source_reference=SourceReference(document="food_allergy.pdf", page=6),
                metadata={"topic": "food_allergies"},
            ),
            KnowledgeChunk(
                chunk_id="test_c7",
                document_id="ayur_doc_drug_interaction",
                text="Food drug interactions and impact on medications must be monitored when herbs and nutrients alter drug bioavailability, CYP450 metabolism, or clearance.",
                page_number=7,
                source_reference=SourceReference(document="food_drug_interactions.pdf", page=7),
                metadata={"topic": "food_drug_interactions"},
            ),
        ]
        retriever.bm25_index.build(sample_chunks)
        retriever.vector_store.ensure_collection(recreate=True)
        embeddings = retriever.embedding_service.embed_texts([c.text for c in sample_chunks])
        retriever.vector_store.upsert_chunks(sample_chunks, embeddings)

    return retriever



def test_hybrid_retrieval_kapha_winter(retriever_instance):
    """1. Test Kapha + winter query retrieves relevant evidence with provenance."""
    req = RetrieveRequest(query="foods suitable for Kapha in winter", top_k=5)
    resp = retriever_instance.retrieve(req)

    assert not resp.insufficient_evidence
    assert len(resp.results) > 0
    top = resp.results[0]
    assert top.source.document != ""
    assert top.source.page >= 1
    assert top.rrf_score > 0.0


def test_hybrid_retrieval_vata_digestion(retriever_instance):
    """2. Test Vata + digestive guidance query."""
    req = RetrieveRequest(query="Vata dosha digestion Agni recommendations", top_k=5)
    resp = retriever_instance.retrieve(req)

    assert not resp.insufficient_evidence
    assert len(resp.results) > 0


def test_hybrid_retrieval_pathya_apathya(retriever_instance):
    """3. Test Pathya / Apathya query."""
    req = RetrieveRequest(query="Pathya and Apathya wholesome unwholesome dietary rules", top_k=5)
    resp = retriever_instance.retrieve(req)

    assert not resp.insufficient_evidence
    assert len(resp.results) > 0


def test_hybrid_retrieval_diabetes(retriever_instance):
    """4. Test diabetes-related dietary query."""
    req = RetrieveRequest(query="dietary guidelines for diabetes mellitus and blood glucose", top_k=5)
    resp = retriever_instance.retrieve(req)

    assert not resp.insufficient_evidence
    assert len(resp.results) > 0


def test_hybrid_retrieval_cardiac(retriever_instance):
    """5. Test cardiac dietary query."""
    req = RetrieveRequest(query="cardiac disorders heart disease dietary guidelines", top_k=5)
    resp = retriever_instance.retrieve(req)

    assert not resp.insufficient_evidence
    assert len(resp.results) > 0


def test_hybrid_retrieval_food_allergies(retriever_instance):
    """6. Test food allergy query."""
    req = RetrieveRequest(query="food allergy reference doses and hypersensitivity", top_k=5)
    resp = retriever_instance.retrieve(req)

    assert not resp.insufficient_evidence
    assert len(resp.results) > 0


def test_hybrid_retrieval_food_drug_interaction(retriever_instance):
    """7. Test food-drug interaction query."""
    req = RetrieveRequest(query="food drug interactions and impact on medications", top_k=5)
    resp = retriever_instance.retrieve(req)

    assert not resp.insufficient_evidence
    assert len(resp.results) > 0


def test_unsupported_query_insufficient_evidence(retriever_instance):
    """Verify completely out-of-domain query returns insufficient_evidence = True."""
    req = RetrieveRequest(query="quantum cryptography blockchain consensus protocols", top_k=5)
    resp = retriever_instance.retrieve(req)

    assert resp.insufficient_evidence is True
    assert len(resp.results) == 0


# ==============================================================================
# 7. FastAPI Endpoint Integration Tests
# ==============================================================================

def test_api_rag_status_endpoint():
    """Verify GET /api/rag/status returns operational statistics."""
    resp = client.get("/api/rag/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "qdrant" in data
    assert "bm25" in data


def test_api_rag_retrieve_endpoint():
    """Verify POST /api/rag/retrieve returns structured response adhering to schema."""
    payload = {
        "query": "wholesome foods for diabetes",
        "top_k": 3,
        "filters": {"condition": "diabetes"},
    }
    resp = client.post("/api/rag/retrieve", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "query" in data
    assert "results" in data
    assert "retrieval_metadata" in data
    assert data["retrieval_metadata"]["retrieval_method"] == "hybrid_rrf"
    if data["results"]:
        first = data["results"][0]
        assert "chunk_id" in first
        assert "document_id" in first
        assert "text" in first
        assert "score" in first
        assert "source" in first
        assert "page" in first["source"]
