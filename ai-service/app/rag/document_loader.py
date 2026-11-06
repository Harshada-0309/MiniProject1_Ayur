"""
Document Loader & Knowledge Extraction Pipeline for AyurDiet Phase 4.
Extracts text from 24 canonical Ayurvedic, clinical, and nutritional PDFs,
normalizes formatting, and maps verifiable document-level and page-level metadata.
"""

import io
import logging
import os
import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Tuple

from pypdf import PdfReader
from pypdf.errors import PdfStreamError

from ..config import settings

logger = logging.getLogger("ayurdiet.rag.loader")

# Canonical Document Catalog
# Captures factual provenance, source classification, and domain tags for all 24 source documents.
DOCUMENT_CATALOG: Dict[str, Dict[str, Any]] = {
    "05112021_Nutritional_Advocacy_in_Ayurveda.pdf": {
        "document_id": "doc_nutritional_advocacy_ayurveda",
        "source_title": "Nutritional Advocacy in Ayurveda",
        "source_type": "ayush_guideline",
        "topic": "ayurvedic_nutrition_advocacy",
        "condition": None,
        "ayurvedic_category": "Swasthavritta",
        "language": "en",
    },
    "1.-diabetes-24-04-19.pdf": {
        "document_id": "doc_diabetes_clinical_guidelines",
        "source_title": "Clinical Diet and Management Guidelines for Diabetes Mellitus",
        "source_type": "clinical_guideline",
        "topic": "diabetes_management",
        "condition": "diabetes",
        "ayurvedic_category": "Chikitsa",
        "language": "en",
    },
    "9789240042674-eng.pdf": {
        "document_id": "doc_who_dietary_risk_assessment",
        "source_title": "WHO Guidelines on Dietary Risk Assessment and Healthy Eating",
        "source_type": "who_guideline",
        "topic": "healthy_diet_and_risk_assessment",
        "condition": None,
        "ayurvedic_category": None,
        "language": "en",
    },
    "9789240064935-eng.pdf": {
        "document_id": "doc_who_healthy_diet_compendium",
        "source_title": "WHO Technical Guidance & Compendium on Healthy Diets",
        "source_type": "who_guideline",
        "topic": "population_nutrient_intake",
        "condition": None,
        "ayurvedic_category": None,
        "language": "en",
    },
    "Ayurveda-Based-Diet-Lifestyle-Guidelines-Skin-Diseas.pdf": {
        "document_id": "doc_ayurveda_skin_diseases_guidelines",
        "source_title": "Ayurveda-Based Diet and Lifestyle Guidelines for Prevention and Management of Skin Diseases (Kushta)",
        "source_type": "ayush_ccras_guideline",
        "topic": "skin_diseases",
        "condition": "skin_diseases",
        "ayurvedic_category": "Pathya_Apathya",
        "language": "en",
    },
    "Ayurveda-Based_Dietary_Guidelines_Mental_Disorders.pdf": {
        "document_id": "doc_ayurveda_mental_disorders_guidelines",
        "source_title": "Ayurveda-Based Dietary Guidelines for Mental Health Disorders (Manasa Roga)",
        "source_type": "ayush_ccras_guideline",
        "topic": "mental_health",
        "condition": "mental_health",
        "ayurvedic_category": "Pathya_Apathya",
        "language": "en",
    },
    "Ayurvedic food properties.pdf": {
        "document_id": "doc_ayurvedic_food_properties",
        "source_title": "Ayurvedic Food Properties: Rasa, Guna, Virya, Vipaka, and Prabhava Compendium",
        "source_type": "classical_ayurvedic",
        "topic": "food_properties_and_dravyaguna",
        "condition": None,
        "ayurvedic_category": "Dravyaguna",
        "language": "en",
    },
    "Cardiac disorders.pdf": {
        "document_id": "doc_cardiac_disorders_guidelines",
        "source_title": "Ayurveda-Based Diet and Lifestyle Guidelines for Cardiac Disorders (Hridroga)",
        "source_type": "ayush_ccras_guideline",
        "topic": "cardiac_health",
        "condition": "cardiac_disorders",
        "ayurvedic_category": "Pathya_Apathya",
        "language": "en",
    },
    "Charaka Samhita Vol 2.pdf": {
        "document_id": "doc_charaka_samhita_vol2",
        "source_title": "Charaka Samhita Volume 2 (Chikitsa, Kalpa, Siddhi Sthana)",
        "source_type": "classical_ayurvedic_text",
        "topic": "classical_therapeutics_and_diet",
        "condition": None,
        "ayurvedic_category": "Samhita",
        "language": "en",
    },
    "Charaka-Samhita-Acharya-Charaka.pdf": {
        "document_id": "doc_charaka_samhita_vol1",
        "source_title": "Charaka Samhita (Sutra Sthana, Sharira Sthana - Ahara Vidhi Vidhana)",
        "source_type": "classical_ayurvedic_text",
        "topic": "fundamental_principles_and_dietetics",
        "condition": None,
        "ayurvedic_category": "Samhita",
        "language": "en",
    },
    "Common diseases.pdf": {
        "document_id": "doc_common_diseases_guidelines",
        "source_title": "Dietary Management for Common Diseases",
        "source_type": "clinical_guideline",
        "topic": "common_diseases",
        "condition": "common_diseases",
        "ayurvedic_category": "Pathya_Apathya",
        "language": "en",
    },
    "Food Allergen Reference Doses.pdf": {
        "document_id": "doc_food_allergen_reference_doses",
        "source_title": "Food Allergen Reference Doses and Risk Thresholds",
        "source_type": "allergen_standard",
        "topic": "food_allergies",
        "condition": "food_allergies",
        "ayurvedic_category": None,
        "language": "en",
    },
    "Food composition data.pdf": {
        "document_id": "doc_food_composition_data",
        "source_title": "Indian Food Composition Tables (IFCT / NIN / ICMR)",
        "source_type": "icmr_nin_guideline",
        "topic": "food_composition_and_nutrients",
        "condition": None,
        "ayurvedic_category": None,
        "language": "en",
    },
    "Food-Drug.pdf": {
        "document_id": "doc_food_drug_interactions",
        "source_title": "Food-Drug Interactions in Clinical Practice",
        "source_type": "clinical_pharmacology",
        "topic": "food_drug_interactions",
        "condition": None,
        "ayurvedic_category": None,
        "language": "en",
    },
    "guideline methodolog.pdf": {
        "document_id": "doc_guideline_methodology",
        "source_title": "Dietary Guideline Development Methodology",
        "source_type": "methodology_guideline",
        "topic": "nutrition_methodology",
        "condition": None,
        "ayurvedic_category": None,
        "language": "en",
    },
    "healthy diet guidance.pdf": {
        "document_id": "doc_healthy_diet_guidance",
        "source_title": "Principles of Healthy Eating and Balanced Diet",
        "source_type": "public_health_guideline",
        "topic": "balanced_diet",
        "condition": None,
        "ayurvedic_category": "Swasthavritta",
        "language": "en",
    },
    "Impact of Diet and Exercise on Drug Responses.pdf": {
        "document_id": "doc_diet_exercise_drug_responses",
        "source_title": "Impact of Diet and Exercise on Drug Responses",
        "source_type": "clinical_pharmacology",
        "topic": "food_drug_interactions",
        "condition": None,
        "ayurvedic_category": None,
        "language": "en",
    },
    "Nutrient deficiency.pdf": {
        "document_id": "doc_nutrient_deficiency",
        "source_title": "Nutrient Deficiencies: Clinical Manifestations and Dietary Corrections",
        "source_type": "clinical_nutrition",
        "topic": "nutrient_deficiencies",
        "condition": "nutrient_deficiencies",
        "ayurvedic_category": None,
        "language": "en",
    },
    "Nutrient Requirements for Indians, the Recommended Dietary Allowances.pdf": {
        "document_id": "doc_icmr_nin_rda_indians",
        "source_title": "Nutrient Requirements and Recommended Dietary Allowances for Indians (ICMR-NIN)",
        "source_type": "icmr_nin_guideline",
        "topic": "rda_and_energy_requirements",
        "condition": None,
        "ayurvedic_category": None,
        "language": "en",
    },
    "Nutritional information.pdf": {
        "document_id": "doc_nutritional_information",
        "source_title": "Nutritional Information and Portion Guidelines",
        "source_type": "nutritional_database",
        "topic": "calories_and_portion_sizes",
        "condition": None,
        "ayurvedic_category": None,
        "language": "en",
    },
    "Pathya_Apathya.pdf": {
        "document_id": "doc_pathya_apathya_compendium",
        "source_title": "Ayurvedic Compendium of Pathya and Apathya in Health and Disease",
        "source_type": "classical_ayurvedic",
        "topic": "pathya_apathya_dietary_rules",
        "condition": None,
        "ayurvedic_category": "Pathya_Apathya",
        "language": "en",
    },
    "Priority Food Allergens.pdf": {
        "document_id": "doc_priority_food_allergens",
        "source_title": "Priority Food Allergens Identification and Clinical Guidance",
        "source_type": "allergen_standard",
        "topic": "food_allergies",
        "condition": "food_allergies",
        "ayurvedic_category": None,
        "language": "en",
    },
    "Risk assessment of food allergens.pdf": {
        "document_id": "doc_risk_assessment_food_allergens",
        "source_title": "FAO/WHO Risk Assessment of Food Allergens",
        "source_type": "who_guideline",
        "topic": "food_allergies",
        "condition": "food_allergies",
        "ayurvedic_category": None,
        "language": "en",
    },
    "Skin diseases.pdf": {
        "document_id": "doc_skin_diseases_guidelines",
        "source_title": "Ayurvedic Dietary Guidelines in Skin Diseases (Twak Roga)",
        "source_type": "ayush_ccras_guideline",
        "topic": "skin_diseases",
        "condition": "skin_diseases",
        "ayurvedic_category": "Pathya_Apathya",
        "language": "en",
    },
}


@dataclass
class ExtractedPage:
    document_id: str
    document_name: str
    source_title: str
    source_type: str
    page_number: int
    text: str
    section: Optional[str] = None
    topic: Optional[str] = None
    condition: Optional[str] = None
    ayurvedic_category: Optional[str] = None
    language: str = "en"
    prakriti: Optional[str] = None
    dosha: Optional[str] = None
    season: Optional[str] = None
    meal_type: Optional[str] = None
    food_category: Optional[str] = None
    clinical_condition: Optional[str] = None
    pathya_status: Optional[str] = None


def normalize_extracted_text(text: str) -> str:
    """
    Cleans raw PDF text while preserving grammatical structure and word boundaries.
    """
    if not text:
        return ""

    # Replace null and non-printable control characters
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", " ", text)
    # Fix hyphenated words broken across line wraps (e.g., "recom- \n mendation" -> "recommendation")
    text = re.sub(r"(\w+)-\s*\n\s*(\w+)", r"\1\2", text)
    # Normalize multiple newlines into paragraph breaks
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    # Collapse irregular horizontal whitespace
    text = re.sub(r"[ \t]+", " ", text)
    # Trim leading/trailing whitespace
    return text.strip()


def derive_contextual_metadata(text: str, doc_meta: Dict[str, Any]) -> Dict[str, Optional[str]]:
    """
    Derives verifiable dosha, prakriti, season, pathya status, and condition metadata
    directly supported by textual occurrences in the chunk. Does NOT fabricate tags.
    """
    lower = text.lower()
    meta: Dict[str, Optional[str]] = {
        "prakriti": None,
        "dosha": None,
        "season": None,
        "meal_type": None,
        "food_category": None,
        "clinical_condition": doc_meta.get("condition"),
        "pathya_status": None,
    }

    # Dosha / Prakriti derivation
    vata = bool(re.search(r"\bvata\b|\bvāt[aā]\b|\bvata-dosha\b", lower))
    pitta = bool(re.search(r"\bpitta\b|\bpitt[aā]\b|\bpitta-dosha\b", lower))
    kapha = bool(re.search(r"\bkapha\b|\bkaph[aā]\b|\bsleshma\b|\bkapha-dosha\b", lower))

    doshas_found = []
    if vata:
        doshas_found.append("vata")
    if pitta:
        doshas_found.append("pitta")
    if kapha:
        doshas_found.append("kapha")

    if len(doshas_found) == 1:
        meta["dosha"] = doshas_found[0]
        if "prakriti" in lower or "constitution" in lower or "personality" in lower:
            meta["prakriti"] = doshas_found[0]
    elif len(doshas_found) > 1:
        meta["dosha"] = "-".join(doshas_found)

    # Season derivation (Ayurvedic Ritucharya & Modern Seasons)
    if re.search(r"\bwinter\b|\bshishira\b|\bhemanta\b|\bcold weather\b", lower):
        meta["season"] = "winter"
    elif re.search(r"\bsummer\b|\bgrishma\b|\bhot season\b", lower):
        meta["season"] = "summer"
    elif re.search(r"\bmonsoon\b|\bvarsha\b|\brainy season\b", lower):
        meta["season"] = "monsoon"
    elif re.search(r"\bautumn\b|\bsharad\b", lower):
        meta["season"] = "autumn"
    elif re.search(r"\bspring\b|\bvasanta\b", lower):
        meta["season"] = "spring"

    # Pathya / Apathya status
    has_pathya = bool(re.search(r"\bpathya\b|\bwholesome\b|\brecommended foods\b|\bto be consumed\b", lower))
    has_apathya = bool(re.search(r"\bapathya\b|\bunwholesome\b|\bcontraindicated\b|\bto be avoided\b|\brestricted foods\b", lower))
    if has_pathya and not has_apathya:
        meta["pathya_status"] = "pathya"
    elif has_apathya and not has_pathya:
        meta["pathya_status"] = "apathya"
    elif has_pathya and has_apathya:
        meta["pathya_status"] = "pathya_apathya_guidance"

    # Food Category derivation
    if re.search(r"\bcereals?\b|\bgrains?\b|\brice\b|\bwheat\b|\bbarley\b|\bmillets?\b|\byava\b|\bgodhuma\b|\bshali\b", lower):
        meta["food_category"] = "cereal_grain"
    elif re.search(r"\bpulses?\b|\blegumes?\b|\bdal\b|\bmung\b|\bmudga\b|\blentils?\b|\bchana\b", lower):
        meta["food_category"] = "pulse_legume"
    elif re.search(r"\bfruits?\b|\bphala\b|\bamla\b|\bdraksha\b|\bpomegranate\b|\bdadima\b", lower):
        meta["food_category"] = "fruit"
    elif re.search(r"\bvegetables?\b|\bshaka\b|\bleafy vegetables?\b", lower):
        meta["food_category"] = "vegetable"
    elif re.search(r"\bspices?\b|\bginger\b|\bshunthi\b|\bblack pepper\b|\bmaricha\b|\bpippali\b|\btrikatu\b|\bturmeric\b|\bharidra\b|\bcumin\b|\bjeeraka\b", lower):
        meta["food_category"] = "spice_herb"
    elif re.search(r"\bdairy\b|\bmilk\b|\bkshira\b|\bghee\b|\bghrita\b|\byogurt\b|\bcurd\b|\bdadhi\b|\bbuttermilk\b|\btakra\b", lower):
        meta["food_category"] = "dairy"
    elif re.search(r"\boils?\b|\btila\b|\bsesame oil\b|\bmustard oil\b|\bfats?\b|\bsneha\b", lower):
        meta["food_category"] = "oil_fat"

    # Meal Type
    if re.search(r"\bbreakfast\b|\bpratarasha\b", lower):
        meta["meal_type"] = "breakfast"
    elif re.search(r"\blunch\b|\bmadhyahnika\b|\bnoon meal\b", lower):
        meta["meal_type"] = "lunch"
    elif re.search(r"\bdinner\b|\bratribhojana\b|\bevening meal\b|\bsupper\b", lower):
        meta["meal_type"] = "dinner"

    # Clinical condition (if not already set at document level)
    if not meta["clinical_condition"]:
        if re.search(r"\bdiabetes\b|\bdiabetic\b|\bmadhumeha\b|\bprameha\b|\bblood sugar\b|\bhba1c\b", lower):
            meta["clinical_condition"] = "diabetes"
        elif re.search(r"\bcardiac\b|\bheart\b|\bhridroga\b|\bhypertension\b|\bblood pressure\b|\bcardiovascular\b", lower):
            meta["clinical_condition"] = "cardiac_disorders"
        elif re.search(r"\bskin\b|\bkushta\b|\bpsoriasis\b|\beczema\b|\bdermat\b|\btwak\b", lower):
            meta["clinical_condition"] = "skin_diseases"
        elif re.search(r"\bmental\b|\bmanas\b|\banxiety\b|\bdepression\b|\binsomnia\b|\bnidra\b", lower):
            meta["clinical_condition"] = "mental_health"
        elif re.search(r"\ballerg\b|\bhypersensitiv\b|\banaphylax\b|\beliciting dose\b", lower):
            meta["clinical_condition"] = "food_allergies"
        elif re.search(r"\bdrug interaction\b|\bfood-drug\b|\bcytochrome\b|\bpharmacokinetic\b", lower):
            meta["clinical_condition"] = "food_drug_interactions"
        elif re.search(r"\bdeficiency\b|\banemia\b|\biron deficiency\b|\bvitamin d deficiency\b", lower):
            meta["clinical_condition"] = "nutrient_deficiencies"

    return meta


class DocumentLoader:
    """
    Loads, extracts, and normalizes documents from the ZIP knowledge base into memory and data/knowledge_base.
    """

    def __init__(self, zip_path: str = r"E:\final Ayur K.zip", output_dir: Optional[Path] = None):
        self.zip_path = zip_path
        self.output_dir = output_dir or settings.knowledge_base_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def extract_zip_to_storage(self) -> List[Path]:
        """
        Extracts all PDFs from the source ZIP archive into data/knowledge_base/
        with sanitized cross-platform filenames. Does NOT alter the original ZIP.
        """
        if not os.path.exists(self.zip_path):
            raise FileNotFoundError(f"Knowledge-base ZIP not found at: {self.zip_path}")

        extracted_files: List[Path] = []
        with zipfile.ZipFile(self.zip_path, "r") as z:
            for entry in z.namelist():
                if not entry.lower().endswith(".pdf"):
                    continue

                # Sanitize filename for Windows & cross-platform consistency
                filename = os.path.basename(entry)
                sanitized_name = "".join(
                    c if (c.isascii() and c.isprintable()) else "-"
                    for c in filename.replace("\ufffd", "-")
                )
                target_path = self.output_dir / sanitized_name


                if not target_path.exists() or target_path.stat().st_size == 0:
                    with open(target_path, "wb") as f_out:
                        f_out.write(z.read(entry))
                    logger.info(f"Extracted: {sanitized_name}")
                extracted_files.append(target_path)

        logger.info(f"Knowledge base storage populated with {len(extracted_files)} PDFs in {self.output_dir}")
        return extracted_files

    def load_all_pages(self) -> Generator[ExtractedPage, None, None]:
        """
        Extracts all pages from the 24 PDFs, applying fault-tolerant per-page extraction,
        cleaning, and metadata enrichment.
        """
        pdf_files = self.extract_zip_to_storage()

        for pdf_path in sorted(pdf_files):
            file_key = pdf_path.name
            # Lookup in catalog, falling back to clean sanitized key if needed
            doc_meta = DOCUMENT_CATALOG.get(file_key)
            if not doc_meta:
                # Try replacing - with  or matching by prefix
                for cat_key, cat_val in DOCUMENT_CATALOG.items():
                    if cat_key.replace("", "-") == file_key:
                        doc_meta = cat_val
                        break
            if not doc_meta:
                doc_meta = {
                    "document_id": f"doc_{re.sub(r'[^a-zA-Z0-9_]', '_', pdf_path.stem).lower()}",
                    "source_title": pdf_path.stem,
                    "source_type": "clinical_guideline",
                    "topic": "general_nutrition",
                    "condition": None,
                    "ayurvedic_category": None,
                    "language": "en",
                }

            try:
                reader = PdfReader(str(pdf_path))
                num_pages = len(reader.pages)
            except Exception as e:
                logger.error(f"Failed to initialize PdfReader for {pdf_path}: {e}")
                continue

            current_section: Optional[str] = None

            for page_idx, page in enumerate(reader.pages, start=1):
                raw_text = ""
                try:
                    raw_text = page.extract_text() or ""
                except (PdfStreamError, Exception) as p_err:
                    logger.warning(f"Error reading page {page_idx} of {file_key}: {p_err}. Skipping corrupted stream.")
                    continue

                cleaned_text = normalize_extracted_text(raw_text)
                if len(cleaned_text) < 30:
                    # Skip empty pages, blank title sheets, or pages with only page numbers
                    continue

                # Heuristic for section title detection on the first few lines of page
                first_lines = cleaned_text.split("\n", 2)
                if first_lines and len(first_lines[0].strip()) < 80 and not first_lines[0].strip().isdigit():
                    candidate_heading = first_lines[0].strip()
                    if re.match(r"^(chapter|section|part|table|\d+\.|\bpathya\b|\bguideline\b|\btable\b)", candidate_heading, re.IGNORECASE):
                        current_section = candidate_heading

                context_meta = derive_contextual_metadata(cleaned_text, doc_meta)

                doc_id = doc_meta.get("document_id")
                document_id: str = (
                    doc_id.strip()
                    if isinstance(doc_id, str) and doc_id.strip()
                    else f"doc_{re.sub(r'[^a-zA-Z0-9_]', '_', pdf_path.stem).lower()}"
                )

                src_title = doc_meta.get("source_title")
                source_title: str = (
                    src_title.strip()
                    if isinstance(src_title, str) and src_title.strip()
                    else pdf_path.stem
                )

                src_type = doc_meta.get("source_type")
                source_type: str = (
                    src_type.strip()
                    if isinstance(src_type, str) and src_type.strip()
                    else "clinical_guideline"
                )

                raw_lang = doc_meta.get("language")
                language: str = (
                    raw_lang.strip()
                    if isinstance(raw_lang, str) and raw_lang.strip()
                    else "en"
                )

                raw_topic = doc_meta.get("topic")
                topic: Optional[str] = raw_topic.strip() if isinstance(raw_topic, str) and raw_topic.strip() else None

                raw_cond = doc_meta.get("condition")
                condition: Optional[str] = raw_cond.strip() if isinstance(raw_cond, str) and raw_cond.strip() else None

                raw_cat = doc_meta.get("ayurvedic_category")
                ayurvedic_category: Optional[str] = raw_cat.strip() if isinstance(raw_cat, str) and raw_cat.strip() else None

                yield ExtractedPage(
                    document_id=document_id,
                    document_name=pdf_path.name,
                    source_title=source_title,
                    source_type=source_type,
                    page_number=page_idx,
                    text=cleaned_text,
                    section=current_section,
                    topic=topic,
                    condition=condition,
                    ayurvedic_category=ayurvedic_category,
                    language=language,
                    prakriti=context_meta.get("prakriti"),
                    dosha=context_meta.get("dosha"),
                    season=context_meta.get("season"),
                    meal_type=context_meta.get("meal_type"),
                    food_category=context_meta.get("food_category"),
                    clinical_condition=context_meta.get("clinical_condition"),
                    pathya_status=context_meta.get("pathya_status"),
                )
