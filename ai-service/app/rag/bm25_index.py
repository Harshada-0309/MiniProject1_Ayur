"""
Lexical BM25 Search Engine for AyurDiet Phase 4.
Preserves and indexes exact Ayurvedic (Prakriti, Vata, Pitta, Kapha, Pathya, Apathya, Agni, Rasa, Virya, Vipaka)
and clinical terminology (diabetes, HbA1c, cardiac, allergy, food-drug interaction).
Persists index and metadata under data/processed/bm25_index/.
"""

import json
import logging
import pickle
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from rank_bm25 import BM25Plus

from .schemas import KnowledgeChunk
from ..config import settings

logger = logging.getLogger("ayurdiet.rag.bm25")

# Token pattern that preserves clinical abbreviations and hyphenated compounds
TOKEN_PATTERN = re.compile(r"[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*")


def tokenize_text(text: str) -> List[str]:
    """
    Tokenizes text for BM25 while preserving Sanskrit/Ayurvedic terms and clinical tokens.
    """
    if not text:
        return []
    # Lowercase and extract alphanumeric tokens including hyphens
    tokens = TOKEN_PATTERN.findall(text.lower())
    return [t for t in tokens if len(t) > 1]


class BM25Index:
    """
    Lexical BM25 index with persistence and metadata-aware filtering.
    Uses BM25Plus to avoid negative IDF weights and ensure consistent ranking.
    """

    def __init__(self, index_dir: Optional[Path] = None):
        self.index_dir = index_dir or settings.bm25_index_dir
        self.index_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = self.index_dir / "bm25_model.pkl"
        self.manifest_file = self.index_dir / "bm25_manifest.json"

        self.bm25: Optional[BM25Plus] = None
        self.chunk_store: List[Dict[str, Any]] = []
        self.chunk_id_to_idx: Dict[str, int] = {}

    def build(self, chunks: List[KnowledgeChunk]) -> None:
        """
        Builds BM25 index over the provided KnowledgeChunk corpus and persists to disk.
        """
        if not chunks:
            raise ValueError("Cannot build BM25 index on empty chunk list")

        logger.info(f"[BM25] Tokenizing {len(chunks)} chunks for lexical indexing...")
        tokenized_corpus: List[List[str]] = []
        self.chunk_store = []
        self.chunk_id_to_idx = {}

        for idx, chunk in enumerate(chunks):
            tokens = tokenize_text(chunk.text)
            tokenized_corpus.append(tokens)
            self.chunk_store.append({
                "chunk_id": chunk.chunk_id,
                "document_id": chunk.document_id,
                "text": chunk.text,
                "page_number": chunk.page_number,
                "section": chunk.section,
                "metadata": chunk.metadata,
                "source_reference": chunk.source_reference.model_dump(),
            })
            self.chunk_id_to_idx[chunk.chunk_id] = idx

        self.bm25 = BM25Plus(tokenized_corpus)
        logger.info(f"[BM25] Index constructed over {len(tokenized_corpus)} documents.")
        self.save()


    def save(self) -> None:
        """
        Persists BM25 model and payload store to disk.
        """
        if not self.bm25 or not self.chunk_store:
            return

        with open(self.index_file, "wb") as f:
            pickle.dump({
                "bm25": self.bm25,
                "chunk_store": self.chunk_store,
                "chunk_id_to_idx": self.chunk_id_to_idx,
            }, f)

        manifest = {
            "total_chunks": len(self.chunk_store),
            "index_path": str(self.index_file),
            "version": settings.version,
        }
        with open(self.manifest_file, "w", encoding="utf-8") as f_m:
            json.dump(manifest, f_m, indent=2)

        logger.info(f"[BM25] Successfully saved index to {self.index_file}")

    def load(self) -> bool:
        """
        Loads persisted BM25 index from disk if present.
        """
        if not self.index_file.exists():
            return False

        try:
            with open(self.index_file, "rb") as f:
                data = pickle.load(f)
                self.bm25 = data["bm25"]
                self.chunk_store = data["chunk_store"]
                self.chunk_id_to_idx = data["chunk_id_to_idx"]
            logger.info(f"[BM25] Loaded index with {len(self.chunk_store)} entries from {self.index_file}")
            return True
        except Exception as e:
            logger.error(f"[BM25] Failed to load index from {self.index_file}: {e}")
            return False

    def search(
        self,
        query: str,
        top_k: int = 20,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Executes lexical BM25 search returning scored and ranked results.
        """
        if self.bm25 is None:
            if not self.load():
                logger.warning("[BM25] No index available for search")
                return []

        tokens = tokenize_text(query)
        if not tokens:
            return []

        scores = self.bm25.get_scores(tokens)

        # Pair scores with chunk metadata
        scored_results = []
        for idx, score in enumerate(scores):
            if score <= 0.0:
                continue

            chunk_info = self.chunk_store[idx]

            # Metadata filter check
            if filters:
                meta = chunk_info.get("metadata", {})
                match = True
                for f_key, f_val in filters.items():
                    if f_val:
                        target = str(f_val).lower()
                        meta_val = str(meta.get(f_key, "")).lower()
                        # If the metadata exists on the chunk and doesn't match, filter it out
                        if meta_val and target not in meta_val and meta_val not in target:
                            match = False
                            break
                if not match:
                    continue

            scored_results.append({
                "chunk_id": chunk_info["chunk_id"],
                "document_id": chunk_info["document_id"],
                "text": chunk_info["text"],
                "score": float(score),
                "metadata": chunk_info["metadata"],
                "source_reference": chunk_info["source_reference"],
            })

        # Sort descending by BM25 score
        scored_results.sort(key=lambda x: x["score"], reverse=True)
        top_results = scored_results[:top_k]

        # Assign bm25_rank
        for rank, res in enumerate(top_results, start=1):
            res["bm25_rank"] = rank

        return top_results
