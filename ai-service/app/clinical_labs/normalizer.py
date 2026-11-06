"""
Clinical Laboratory Test Normalizer and Unit Standardization.
Provides deterministic canonicalization, unit conversion, and incompatible unit detection.
"""

import re
from typing import Tuple, Optional, Dict, Any
from .models import LabCategory


# Canonical Test Mapping: Aliases to (canonical_key, LabCategory, standard_unit)
TEST_ALIASES: Dict[str, Tuple[str, LabCategory, str]] = {
    # Glucose & Diabetes
    "fasting blood sugar": ("glucose_fasting", LabCategory.GLUCOSE, "mg/dL"),
    "fbs": ("glucose_fasting", LabCategory.GLUCOSE, "mg/dL"),
    "fasting plasma glucose": ("glucose_fasting", LabCategory.GLUCOSE, "mg/dL"),
    "fpg": ("glucose_fasting", LabCategory.GLUCOSE, "mg/dL"),
    "fasting glucose": ("glucose_fasting", LabCategory.GLUCOSE, "mg/dL"),
    "glucose (fasting)": ("glucose_fasting", LabCategory.GLUCOSE, "mg/dL"),
    "postprandial blood sugar": ("glucose_pp", LabCategory.GLUCOSE, "mg/dL"),
    "ppbs": ("glucose_pp", LabCategory.GLUCOSE, "mg/dL"),
    "post prandial glucose": ("glucose_pp", LabCategory.GLUCOSE, "mg/dL"),
    "random blood sugar": ("glucose_random", LabCategory.GLUCOSE, "mg/dL"),
    "rbs": ("glucose_random", LabCategory.GLUCOSE, "mg/dL"),
    "random glucose": ("glucose_random", LabCategory.GLUCOSE, "mg/dL"),
    "hba1c": ("hba1c", LabCategory.GLUCOSE, "%"),
    "glycated hemoglobin": ("hba1c", LabCategory.GLUCOSE, "%"),
    "a1c": ("hba1c", LabCategory.GLUCOSE, "%"),
    "hgba1c": ("hba1c", LabCategory.GLUCOSE, "%"),
    "hemoglobin a1c": ("hba1c", LabCategory.GLUCOSE, "%"),

    # Electrolytes
    "potassium": ("potassium", LabCategory.ELECTROLYTE, "mEq/L"),
    "serum potassium": ("potassium", LabCategory.ELECTROLYTE, "mEq/L"),
    "potassium (serum)": ("potassium", LabCategory.ELECTROLYTE, "mEq/L"),
    "k+": ("potassium", LabCategory.ELECTROLYTE, "mEq/L"),
    "sodium": ("sodium", LabCategory.ELECTROLYTE, "mEq/L"),
    "serum sodium": ("sodium", LabCategory.ELECTROLYTE, "mEq/L"),
    "sodium (serum)": ("sodium", LabCategory.ELECTROLYTE, "mEq/L"),
    "na+": ("sodium", LabCategory.ELECTROLYTE, "mEq/L"),
    "calcium": ("calcium", LabCategory.ELECTROLYTE, "mg/dL"),
    "serum calcium": ("calcium", LabCategory.ELECTROLYTE, "mg/dL"),
    "calcium (total)": ("calcium", LabCategory.ELECTROLYTE, "mg/dL"),
    "total calcium": ("calcium", LabCategory.ELECTROLYTE, "mg/dL"),
    "ca++": ("calcium", LabCategory.ELECTROLYTE, "mg/dL"),
    "magnesium": ("magnesium", LabCategory.ELECTROLYTE, "mg/dL"),
    "serum magnesium": ("magnesium", LabCategory.ELECTROLYTE, "mg/dL"),
    "phosphorus": ("phosphorus", LabCategory.ELECTROLYTE, "mg/dL"),
    "serum phosphorus": ("phosphorus", LabCategory.ELECTROLYTE, "mg/dL"),
    "phosphate": ("phosphorus", LabCategory.ELECTROLYTE, "mg/dL"),
    "chloride": ("chloride", LabCategory.ELECTROLYTE, "mEq/L"),

    # Kidney / Renal Function
    "creatinine": ("creatinine", LabCategory.RENAL, "mg/dL"),
    "serum creatinine": ("creatinine", LabCategory.RENAL, "mg/dL"),
    "sr. creatinine": ("creatinine", LabCategory.RENAL, "mg/dL"),
    "creatinine (serum)": ("creatinine", LabCategory.RENAL, "mg/dL"),
    "egfr": ("egfr", LabCategory.RENAL, "mL/min/1.73m2"),
    "estimated gfr": ("egfr", LabCategory.RENAL, "mL/min/1.73m2"),
    "gfr": ("egfr", LabCategory.RENAL, "mL/min/1.73m2"),
    "estimated glomerular filtration rate": ("egfr", LabCategory.RENAL, "mL/min/1.73m2"),
    "bun": ("urea_bun", LabCategory.RENAL, "mg/dL"),
    "blood urea nitrogen": ("urea_bun", LabCategory.RENAL, "mg/dL"),
    "urea": ("urea_bun", LabCategory.RENAL, "mg/dL"),
    "serum urea": ("urea_bun", LabCategory.RENAL, "mg/dL"),
    "uric acid": ("uric_acid", LabCategory.RENAL, "mg/dL"),
    "serum uric acid": ("uric_acid", LabCategory.RENAL, "mg/dL"),
    "urine microalbumin": ("urine_microalbumin", LabCategory.RENAL, "mg/L"),
    "microalbumin": ("urine_microalbumin", LabCategory.RENAL, "mg/L"),

    # Liver Function Tests (LFT)
    "alt": ("alt_sgpt", LabCategory.LIVER, "U/L"),
    "sgpt": ("alt_sgpt", LabCategory.LIVER, "U/L"),
    "alanine aminotransferase": ("alt_sgpt", LabCategory.LIVER, "U/L"),
    "alanine transaminase": ("alt_sgpt", LabCategory.LIVER, "U/L"),
    "ast": ("ast_sgot", LabCategory.LIVER, "U/L"),
    "sgot": ("ast_sgot", LabCategory.LIVER, "U/L"),
    "aspartate aminotransferase": ("ast_sgot", LabCategory.LIVER, "U/L"),
    "aspartate transaminase": ("ast_sgot", LabCategory.LIVER, "U/L"),
    "alkaline phosphatase": ("alp", LabCategory.LIVER, "U/L"),
    "alp": ("alp", LabCategory.LIVER, "U/L"),
    "total bilirubin": ("total_bilirubin", LabCategory.LIVER, "mg/dL"),
    "bilirubin total": ("total_bilirubin", LabCategory.LIVER, "mg/dL"),
    "serum bilirubin": ("total_bilirubin", LabCategory.LIVER, "mg/dL"),
    "direct bilirubin": ("direct_bilirubin", LabCategory.LIVER, "mg/dL"),
    "conjugated bilirubin": ("direct_bilirubin", LabCategory.LIVER, "mg/dL"),
    "serum albumin": ("serum_albumin", LabCategory.LIVER, "g/dL"),
    "albumin": ("serum_albumin", LabCategory.LIVER, "g/dL"),
    "total protein": ("total_protein", LabCategory.LIVER, "g/dL"),

    # Hematology & Iron Studies
    "hemoglobin": ("hemoglobin", LabCategory.HEMATOLOGY_IRON, "g/dL"),
    "hb": ("hemoglobin", LabCategory.HEMATOLOGY_IRON, "g/dL"),
    "hgb": ("hemoglobin", LabCategory.HEMATOLOGY_IRON, "g/dL"),
    "ferritin": ("ferritin", LabCategory.HEMATOLOGY_IRON, "ng/mL"),
    "serum ferritin": ("ferritin", LabCategory.HEMATOLOGY_IRON, "ng/mL"),
    "serum iron": ("serum_iron", LabCategory.HEMATOLOGY_IRON, "ug/dL"),
    "iron": ("serum_iron", LabCategory.HEMATOLOGY_IRON, "ug/dL"),
    "total iron binding capacity": ("tibc", LabCategory.HEMATOLOGY_IRON, "ug/dL"),
    "tibc": ("tibc", LabCategory.HEMATOLOGY_IRON, "ug/dL"),
    "hematocrit": ("hematocrit", LabCategory.HEMATOLOGY_IRON, "%"),
    "pcv": ("hematocrit", LabCategory.HEMATOLOGY_IRON, "%"),
    "packed cell volume": ("hematocrit", LabCategory.HEMATOLOGY_IRON, "%"),
    "platelet count": ("platelet_count", LabCategory.HEMATOLOGY_IRON, "/uL"),
    "platelets": ("platelet_count", LabCategory.HEMATOLOGY_IRON, "/uL"),
    "wbc": ("wbc_count", LabCategory.HEMATOLOGY_IRON, "/uL"),
    "total leukocyte count": ("wbc_count", LabCategory.HEMATOLOGY_IRON, "/uL"),
    "tlc": ("wbc_count", LabCategory.HEMATOLOGY_IRON, "/uL"),
    "rbc count": ("rbc_count", LabCategory.HEMATOLOGY_IRON, "million/uL"),

    # Lipid Profile
    "total cholesterol": ("total_cholesterol", LabCategory.LIPID, "mg/dL"),
    "cholesterol": ("total_cholesterol", LabCategory.LIPID, "mg/dL"),
    "serum cholesterol": ("total_cholesterol", LabCategory.LIPID, "mg/dL"),
    "ldl": ("ldl_cholesterol", LabCategory.LIPID, "mg/dL"),
    "ldl cholesterol": ("ldl_cholesterol", LabCategory.LIPID, "mg/dL"),
    "ldl-c": ("ldl_cholesterol", LabCategory.LIPID, "mg/dL"),
    "hdl": ("hdl_cholesterol", LabCategory.LIPID, "mg/dL"),
    "hdl cholesterol": ("hdl_cholesterol", LabCategory.LIPID, "mg/dL"),
    "hdl-c": ("hdl_cholesterol", LabCategory.LIPID, "mg/dL"),
    "triglycerides": ("triglycerides", LabCategory.LIPID, "mg/dL"),
    "serum triglycerides": ("triglycerides", LabCategory.LIPID, "mg/dL"),
    "tg": ("triglycerides", LabCategory.LIPID, "mg/dL"),

    # Thyroid Function
    "tsh": ("tsh", LabCategory.THYROID, "uIU/mL"),
    "thyroid stimulating hormone": ("tsh", LabCategory.THYROID, "uIU/mL"),
    "ultrasensitive tsh": ("tsh", LabCategory.THYROID, "uIU/mL"),
    "free t3": ("free_t3", LabCategory.THYROID, "pg/mL"),
    "ft3": ("free_t3", LabCategory.THYROID, "pg/mL"),
    "free t4": ("free_t4", LabCategory.THYROID, "ng/dL"),
    "ft4": ("free_t4", LabCategory.THYROID, "ng/dL"),
    "total t3": ("total_t3", LabCategory.THYROID, "ng/dL"),
    "t3": ("total_t3", LabCategory.THYROID, "ng/dL"),
    "total t4": ("total_t4", LabCategory.THYROID, "ug/dL"),
    "t4": ("total_t4", LabCategory.THYROID, "ug/dL"),

    # Vitamins
    "vitamin b12": ("vitamin_b12", LabCategory.VITAMINS, "pg/mL"),
    "b12": ("vitamin_b12", LabCategory.VITAMINS, "pg/mL"),
    "cyanocobalamin": ("vitamin_b12", LabCategory.VITAMINS, "pg/mL"),
    "vitamin d": ("vitamin_d", LabCategory.VITAMINS, "ng/mL"),
    "25-hydroxy vitamin d": ("vitamin_d", LabCategory.VITAMINS, "ng/mL"),
    "25-oh vitamin d": ("vitamin_d", LabCategory.VITAMINS, "ng/mL"),
    "vitamin d3": ("vitamin_d", LabCategory.VITAMINS, "ng/mL"),
    "vit d": ("vitamin_d", LabCategory.VITAMINS, "ng/mL"),

    # Inflammatory
    "crp": ("crp", LabCategory.INFLAMMATORY, "mg/L"),
    "c-reactive protein": ("crp", LabCategory.INFLAMMATORY, "mg/L"),
    "hs-crp": ("crp", LabCategory.INFLAMMATORY, "mg/L"),
    "esr": ("esr", LabCategory.INFLAMMATORY, "mm/hr"),
}


def canonicalize_test_name(raw_name: str) -> Tuple[str, LabCategory, str]:
    """
    Standardize a clinical test name to canonical key and category.
    Returns (canonical_key, category, standard_unit).
    If unknown, returns ("custom", LabCategory.OTHER, raw_unit or "").
    """
    if not raw_name or not isinstance(raw_name, str):
        return ("custom", LabCategory.OTHER, "")

    cleaned = raw_name.strip().lower()
    # Remove punctuation for matching
    cleaned_norm = re.sub(r'[\(\)\[\],_/-]', ' ', cleaned)
    cleaned_norm = ' '.join(cleaned_norm.split())

    # Exact alias match
    if cleaned in TEST_ALIASES:
        return TEST_ALIASES[cleaned]
    if cleaned_norm in TEST_ALIASES:
        return TEST_ALIASES[cleaned_norm]

    # Partial substring match
    for alias, (ckey, cat, std_u) in TEST_ALIASES.items():
        if alias == cleaned_norm or alias in cleaned_norm:
            return (ckey, cat, std_u)

    return ("custom", LabCategory.OTHER, "")


def normalize_unit_and_value(
    canonical_key: str,
    raw_val: str,
    raw_unit: Optional[str]
) -> Tuple[Optional[float], Optional[str], Optional[str], bool]:
    """
    Parses observed value and standardizes numeric value with unit conversion.
    Returns (normalized_numeric_val, qualitative_val, normalized_unit, is_incompatible).
    """
    raw_str = str(raw_val).strip()
    u_str = (raw_unit or "").strip().lower()

    # 1. Qualitative value detection
    qual_map = {
        "negative": "negative", "non-reactive": "negative", "nonreactive": "negative",
        "normal": "normal", "absent": "negative", "not detected": "negative",
        "positive": "positive", "reactive": "positive", "present": "positive",
        "detected": "positive", "trace": "trace", "abnormal": "abnormal", "borderline": "borderline"
    }
    if raw_str.lower() in qual_map:
        return (None, qual_map[raw_str.lower()], u_str or None, False)

    # 2. Extract numeric value
    num_match = re.match(r'^[+-]?(\d+(\.\d+)?|\.\d+)$', raw_str)
    if not num_match:
        # Check bounded or inequality string like "< 100", "> 50"
        bound_match = re.match(r'^(<|<=|>|>=)\s*([+-]?\d+(?:\.\d+)?)$', raw_str)
        if bound_match:
            try:
                num = float(bound_match.group(2))
                return (num, raw_str, u_str or None, False)
            except ValueError:
                pass
        return (None, raw_str, u_str or None, True)

    val = float(num_match.group(1))

    # 3. Canonical unit conversions and compatibility checks
    if canonical_key in ["glucose_fasting", "glucose_pp", "glucose_random"]:
        # Standard: mg/dL. Convert mmol/L -> mg/dL (x 18.018)
        if "mmol/l" in u_str:
            return (round(val * 18.018, 1), None, "mg/dL", False)
        elif "mg/dl" in u_str or not u_str:
            return (val, None, "mg/dL", False)
        else:
            return (val, None, u_str, True)  # Incompatible unit

    elif canonical_key == "hba1c":
        # Standard: %. Convert IFCC mmol/mol -> %
        if "mmol/mol" in u_str:
            pct = round((0.09148 * val) + 2.152, 1)
            return (pct, None, "%", False)
        elif "%" in u_str or not u_str:
            return (val, None, "%", False)
        else:
            return (val, None, u_str, True)

    elif canonical_key in ["potassium", "sodium", "chloride"]:
        # Standard: mEq/L (1 mEq/L = 1 mmol/L)
        if "mmol/l" in u_str or "meq/l" in u_str or not u_str:
            return (val, None, "mEq/L", False)
        else:
            return (val, None, u_str, True)

    elif canonical_key == "calcium":
        # Standard: mg/dL. Convert mmol/L -> mg/dL (x 4.008)
        if "mmol/l" in u_str:
            return (round(val * 4.008, 1), None, "mg/dL", False)
        elif "mg/dl" in u_str or not u_str:
            return (val, None, "mg/dL", False)
        else:
            return (val, None, u_str, True)

    elif canonical_key == "creatinine":
        # Standard: mg/dL. Convert umol/L -> mg/dL (/ 88.4)
        if "umol/l" in u_str or "µmol/l" in u_str:
            return (round(val / 88.4, 2), None, "mg/dL", False)
        elif "mg/dl" in u_str or not u_str:
            return (val, None, "mg/dL", False)
        else:
            return (val, None, u_str, True)

    elif canonical_key == "hemoglobin":
        # Standard: g/dL. Convert g/L -> g/dL (/ 10)
        if "g/l" in u_str and "dl" not in u_str:
            return (round(val / 10.0, 1), None, "g/dL", False)
        elif "g/dl" in u_str or not u_str:
            return (val, None, "g/dL", False)
        else:
            return (val, None, u_str, True)

    elif canonical_key in ["total_cholesterol", "ldl_cholesterol", "hdl_cholesterol"]:
        # Standard: mg/dL. Convert mmol/L -> mg/dL (x 38.67)
        if "mmol/l" in u_str:
            return (round(val * 38.67, 1), None, "mg/dL", False)
        elif "mg/dl" in u_str or not u_str:
            return (val, None, "mg/dL", False)
        else:
            return (val, None, u_str, True)

    elif canonical_key == "triglycerides":
        # Standard: mg/dL. Convert mmol/L -> mg/dL (x 88.57)
        if "mmol/l" in u_str:
            return (round(val * 88.57, 1), None, "mg/dL", False)
        elif "mg/dl" in u_str or not u_str:
            return (val, None, "mg/dL", False)
        else:
            return (val, None, u_str, True)

    # Default fallback for other/custom tests
    return (val, None, raw_unit or "", False)


def parse_reference_range(range_str: Optional[str]) -> Tuple[Optional[float], Optional[float], Optional[str], bool]:
    """
    Parses reference range string.
    Returns (min_val, max_val, qualitative_expected, is_valid).
    Rejects reversed ranges like '99 - 70'.
    """
    if not range_str or not str(range_str).strip():
        return (None, None, None, True)

    s = str(range_str).strip()

    # 1. Numeric range: "70 - 99", "70-99", "70 to 99"
    m_range = re.match(r'^([+-]?\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*([+-]?\d+(?:\.\d+)?)$', s, re.IGNORECASE)
    if m_range:
        min_v = float(m_range.group(1))
        max_v = float(m_range.group(2))
        if min_v > max_v:
            return (None, None, None, False)  # Reversed range is invalid
        return (min_v, max_v, None, True)

    # 2. Bound: "< 100", "<= 140", "under 100", "> 60", ">= 50", "over 50"
    m_bound = re.match(r'^(<|<=|less than|under)\s*([+-]?\d+(?:\.\d+)?)$', s, re.IGNORECASE)
    if m_bound:
        return (None, float(m_bound.group(2)), None, True)

    m_bound_lower = re.match(r'^(>|>=|greater than|over)\s*([+-]?\d+(?:\.\d+)?)$', s, re.IGNORECASE)
    if m_bound_lower:
        return (float(m_bound_lower.group(2)), None, None, True)

    # 3. Qualitative: "Negative", "Normal", "Absent"
    qual_set = {"negative", "non-reactive", "normal", "absent", "undetected", "not detected"}
    if s.lower() in qual_set:
        return (None, None, s.lower(), True)

    return (None, None, None, False)

