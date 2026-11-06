"""
Deterministic Query Expansion Engine for AyurDiet Phase 4.
Expands clinical dietitian and Ayurvedic queries with classical Sanskrit equivalents,
dosha characteristics, and clinical synonyms without calling external LLMs.
"""

import re
from typing import Dict, List, Set

EXPANSION_LEXICON: Dict[str, List[str]] = {
    # Doshas & Prakriti
    "kapha": ["shleshma", "heavy", "cold", "unctuous", "pungent", "bitter", "astringent", "light warm diet"],
    "vata": ["vayu", "dry", "light", "cold", "rough", "sweet", "sour", "salty", "unctuous warm diet", "snigdha"],
    "pitta": ["hot", "sharp", "acidic", "cooling foods", "sheeta", "sweet", "bitter", "astringent", "tikta"],
    # Seasons & Ritucharya
    "winter": ["hemanta", "shishira", "cold season", "warm nourishing food"],
    "summer": ["grishma", "cooling diet", "hydration", "sweet fruits", "sheeta ahara"],
    "monsoon": ["varsha", "rainy season", "mandagni", "digestive fire", "light food"],
    "spring": ["vasanta", "kapha accumulation", "dry pungent bitter"],
    # Clinical Conditions
    "diabetes": ["madhumeha", "prameha", "blood glucose", "glycemic index", "sugar control", "hba1c"],
    "diabetic": ["madhumeha", "prameha", "blood sugar", "glycemic"],
    "cardiac": ["hridya", "hridroga", "cardiovascular", "heart disease", "hypertension", "blood pressure", "cholesterol"],
    "heart": ["hridya", "hridroga", "cardiac", "arterial"],
    "skin": ["kushta", "twak roga", "dermatology", "psoriasis", "eczema", "rakta shodhana", "viruddha ahara"],
    "mental": ["manasa roga", "satvic diet", "medhya rasayana", "anxiety", "depression", "stress", "insomnia", "smriti"],
    "digestive": ["agni", "deepana", "pachana", "mandagni", "digestion", "metabolism", "appetite"],
    "digestion": ["agni", "deepana", "pachana", "gastrointestinal"],
    "allergy": ["viruddha ahara", "allergen", "hypersensitivity", "food allergy", "adverse reaction"],
    "allergies": ["viruddha ahara", "food allergens", "eliciting dose", "anaphylaxis"],
    "food-drug": ["drug interaction", "pharmacokinetics", "bioavailability", "contraindication"],
    "interaction": ["food drug interaction", "adverse combination", "samyoga viruddha"],
    "deficiency": ["nutrient deficiency", "anemia", "iron", "calcium", "micronutrient", "rda"],
    "pathya": ["apathya", "wholesome", "unwholesome", "dietary regimen", "indicated foods", "contraindicated"],
    "apathya": ["pathya", "unwholesome", "contraindicated", "restricted foods", "avoid"],
}


class DeterministicQueryExpander:
    """
    Applies deterministic term matching and synonym expansion to enhance dense and BM25 recall.
    """

    def expand_query(self, query: str) -> str:
        """
        Enriches query string with domain-specific clinical and Ayurvedic terminology.
        """
        if not query or not query.strip():
            return ""

        query_clean = query.strip()
        lower = query_clean.lower()
        added_terms: Set[str] = set()

        for trigger, expansions in EXPANSION_LEXICON.items():
            # Match whole trigger word or trigger within hyphenated term
            pattern = rf"\b{re.escape(trigger)}\b"
            if re.search(pattern, lower):
                for term in expansions:
                    # Only add if not already part of the query
                    if term.lower() not in lower:
                        added_terms.add(term)

        if not added_terms:
            return query_clean

        # Deterministically sort added terms for reproducible embeddings and search queries
        expansion_suffix = " ".join(sorted(list(added_terms)))
        return f"{query_clean} ({expansion_suffix})"
