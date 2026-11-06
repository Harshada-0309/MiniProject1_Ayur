"""
Semantic Chunking Engine for AyurDiet Phase 4.
Splits extracted document pages into cohesive, contextual passages with configurable size and overlap,
while strictly preserving document identity, page numbers, sections, and source traceability.
"""

import re
from typing import Any, Dict, List, Optional

from .document_loader import ExtractedPage, derive_contextual_metadata
from .schemas import KnowledgeChunk, SourceReference
from ..config import settings


class SemanticChunker:
    """
    Structure-aware semantic chunker that respects paragraph and sentence boundaries.
    """

    def __init__(self, chunk_size: Optional[int] = None, chunk_overlap: Optional[int] = None):
        self.chunk_size = chunk_size or settings.rag_chunk_size
        self.chunk_overlap = chunk_overlap or settings.rag_chunk_overlap
        if self.chunk_overlap >= self.chunk_size:
            self.chunk_overlap = int(self.chunk_size * 0.2)

    def split_into_semantic_segments(self, text: str) -> List[str]:
        """
        Breaks raw page text into paragraph or sentence-level segments.
        """
        # First split by double newlines (paragraphs)
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        segments: List[str] = []

        for para in paragraphs:
            if len(para) <= self.chunk_size:
                segments.append(para)
            else:
                # Split large paragraphs by sentence boundaries
                sentences = re.split(r"(?<=[.!?;\n])\s+", para)
                curr_sentence = ""
                for s in sentences:
                    s_clean = s.strip()
                    if not s_clean:
                        continue
                    if len(curr_sentence) + len(s_clean) + 1 <= self.chunk_size:
                        curr_sentence = f"{curr_sentence} {s_clean}".strip()
                    else:
                        if curr_sentence:
                            segments.append(curr_sentence)
                        curr_sentence = s_clean
                if curr_sentence:
                    segments.append(curr_sentence)

        return segments

    def chunk_page(self, page: ExtractedPage) -> List[KnowledgeChunk]:
        """
        Chunks an extracted page into structured KnowledgeChunk items.
        """
        segments = self.split_into_semantic_segments(page.text)
        if not segments:
            return []

        chunks: List[KnowledgeChunk] = []
        current_chunk_text = ""
        chunk_idx = 1

        for seg in segments:
            if not current_chunk_text:
                current_chunk_text = seg
            elif len(current_chunk_text) + len(seg) + 2 <= self.chunk_size:
                current_chunk_text = f"{current_chunk_text}\n\n{seg}"
            else:
                # Finalize current chunk
                chunk_obj = self._build_chunk(current_chunk_text, page, chunk_idx)
                if chunk_obj:
                    chunks.append(chunk_obj)
                    chunk_idx += 1

                # Carry over overlap if possible
                overlap_text = ""
                if self.chunk_overlap > 0 and len(current_chunk_text) > self.chunk_overlap:
                    # Take the tail of current_chunk_text up to overlap length
                    tail_chars = current_chunk_text[-self.chunk_overlap:]
                    # Break at space to avoid cutting words
                    space_idx = tail_chars.find(" ")
                    if space_idx != -1:
                        overlap_text = tail_chars[space_idx:].strip()

                if overlap_text:
                    current_chunk_text = f"{overlap_text}\n\n{seg}"
                else:
                    current_chunk_text = seg

        if current_chunk_text:
            chunk_obj = self._build_chunk(current_chunk_text, page, chunk_idx)
            if chunk_obj:
                chunks.append(chunk_obj)

        return chunks

    def _build_chunk(self, text: str, page: ExtractedPage, chunk_idx: int) -> Optional[KnowledgeChunk]:
        text_clean = text.strip()
        if len(text_clean) < 40:
            # Skip trivial fragments
            return None

        chunk_id = f"{page.document_id}_p{page.page_number:04d}_c{chunk_idx:02d}"

        # Re-derive local contextual metadata specific to this chunk's text
        doc_base = {
            "condition": page.condition,
            "topic": page.topic,
        }
        chunk_meta = derive_contextual_metadata(text_clean, doc_base)

        combined_metadata: Dict[str, Any] = {
            "document_id": page.document_id,
            "document_name": page.document_name,
            "source_title": page.source_title,
            "source_type": page.source_type,
            "page_number": page.page_number,
            "section": page.section,
            "topic": page.topic,
            "condition": page.condition or chunk_meta.get("clinical_condition"),
            "ayurvedic_category": page.ayurvedic_category,
            "language": page.language,
            "prakriti": chunk_meta.get("prakriti") or page.prakriti,
            "dosha": chunk_meta.get("dosha") or page.dosha,
            "season": chunk_meta.get("season") or page.season,
            "meal_type": chunk_meta.get("meal_type") or page.meal_type,
            "food_category": chunk_meta.get("food_category") or page.food_category,
            "clinical_condition": chunk_meta.get("clinical_condition") or page.clinical_condition,
            "pathya_status": chunk_meta.get("pathya_status") or page.pathya_status,
        }

        # Remove None values for cleaner payload
        clean_metadata = {k: v for k, v in combined_metadata.items() if v is not None}

        source_ref = SourceReference(
            document=page.document_name,
            page=page.page_number,
            section=page.section or page.source_title,
        )

        return KnowledgeChunk(
            chunk_id=chunk_id,
            document_id=page.document_id,
            text=text_clean,
            page_number=page.page_number,
            section=page.section,
            metadata=clean_metadata,
            source_reference=source_ref,
        )
