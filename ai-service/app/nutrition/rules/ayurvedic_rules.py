"""
Ayurvedic Personalization and Condition-Checking Rule Layer.
Produces deterministic Ayurvedic personalization attributes for future RAG retrieval.
Does NOT prescribe medical treatments, alter caloric totals by Prakriti, or generate food lists.
"""

from typing import Dict, Any, List, Tuple
from ..constants import FLAGGED_CONDITIONS


# Classical Ayurvedic dietary quality principles (Gunas & attributes for RAG alignment)
DOSHIC_QUALITIES: Dict[str, List[str]] = {
    "Vata": [
        "Snigdha (unctuous / nourishing)",
        "Ushna (warm cooked preparations)",
        "Guru (grounding & stabilizing)",
        "Madhura, Amla, Lavana (Sweet, Sour, Salty pacifying tastes)",
    ],
    "Pitta": [
        "Shita (cooling temperature)",
        "Manda (mild, non-irritating spices)",
        "Ruksha (moderate non-greasy)",
        "Madhura, Tikta, Kashaya (Sweet, Bitter, Astringent pacifying tastes)",
    ],
    "Kapha": [
        "Laghu (light & easily digestible)",
        "Ruksha (dry, low oil)",
        "Ushna (warm & stimulating)",
        "Katu, Tikta, Kashaya (Pungent, Bitter, Astringent pacifying tastes)",
    ],
    "Vata-Pitta": [
        "Warm, hydrating, moderately unctuous",
        "Cooling spices (coriander, fennel, cardamom)",
        "Sweet, mildly sour, mildly bitter pacifying tastes",
    ],
    "Pitta-Kapha": [
        "Moderately cool to warm temperature",
        "Light, non-oily, cleansing preparations",
        "Bitter, Astringent, and mild sweet tastes",
    ],
    "Vata-Kapha": [
        "Ushna (consistently warm & cooked)",
        "Light but unctuous (moderate ghee, avoid cold/dry)",
        "Pungent and digestive-stimulating spices (ginger, cumin, black pepper)",
    ],
    "Tridosha": [
        "Samadosha balancing (neutral, seasonal, fresh, whole foods)",
        "Shad Rasa (all six tastes in balanced moderation)",
    ],
    "Unknown / Not assessed": [
        "Standard wholesome Ayurvedic dietary principles (Hita Ahara)",
    ],
}


def extract_ayurvedic_profile(data: dict) -> Dict[str, Any]:
    """
    Extracts structured, explainable Ayurvedic parameters from the assessment data.
    Provides personalization attributes for subsequent Hybrid RAG food retrieval.
    """
    prakriti = data.get("prakriti") or "Unknown / Not assessed"
    vikriti = data.get("vikriti") or None
    agni = data.get("appetite") or "Samagni (Balanced)"
    digestion = data.get("digestion") or "Normal"
    bowel_habits = data.get("bowel_habits") or "Regular"
    meal_regularity = data.get("meal_regularity") or "regular"
    season = data.get("season_ritu") or None

    doshic_qualities = DOSHIC_QUALITIES.get(prakriti, DOSHIC_QUALITIES["Unknown / Not assessed"])

    return {
        "prakriti": prakriti,
        "vikriti": vikriti,
        "agni": agni,
        "digestion": digestion,
        "bowel_habits": bowel_habits,
        "meal_regularity": meal_regularity,
        "season": season,
        "doshic_dietary_qualities": doshic_qualities,
    }


def check_condition_specific(data: dict) -> Tuple[bool, bool, List[str]]:
    """
    Scans existing clinical conditions, medical history, and symptoms for
    medical pathologies requiring specialized knowledge-grounded clinical guidance.

    Returns:
        (is_condition_specific, requires_knowledge_grounded_guidance, identified_conditions)
    """
    existing_conditions = data.get("existing_conditions") or []
    medical_history = data.get("medical_history") or ""
    symptoms = data.get("symptoms") or []

    text_corpus = " ".join([
        str(c) for c in existing_conditions
    ] + [medical_history] + [
        s if isinstance(s, str) else s.get("symptom", "") for s in symptoms if isinstance(s, (str, dict))
    ]).lower()

    identified: List[str] = []
    for cond in FLAGGED_CONDITIONS:
        if cond in text_corpus:
            identified.append(cond)

    has_conditions = len(identified) > 0 or len(existing_conditions) > 0

    return has_conditions, has_conditions, identified
