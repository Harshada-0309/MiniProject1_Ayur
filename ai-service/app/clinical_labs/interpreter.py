"""
Clinical Laboratory Test Interpreter.
Evaluates observed values against lab-specific and age/sex-adjusted clinical standard intervals,
detects stale results, resolves duplicates and conflicts, and prevents fabricated claims.
"""

from datetime import datetime, date
from typing import Dict, Any, List, Optional, Tuple
from .models import LabStatus, LabCategory, NormalizedLabItem
from .normalizer import (
    canonicalize_test_name,
    normalize_unit_and_value,
    parse_reference_range,
)


# Standard Clinical Reference Intervals: (min_val, max_val, unit)
# If sex-specific: tuple is (male_min, male_max, female_min, female_max, unit)
STANDARD_INTERVALS: Dict[str, Tuple[float, float, str]] = {
    "glucose_fasting": (70.0, 99.0, "mg/dL"),
    "glucose_pp": (70.0, 140.0, "mg/dL"),
    "glucose_random": (70.0, 140.0, "mg/dL"),
    "hba1c": (4.0, 5.6, "%"),
    "potassium": (3.5, 5.0, "mEq/L"),
    "sodium": (135.0, 145.0, "mEq/L"),
    "calcium": (8.5, 10.5, "mg/dL"),
    "magnesium": (1.7, 2.2, "mg/dL"),
    "phosphorus": (2.5, 4.5, "mg/dL"),
    "chloride": (96.0, 106.0, "mEq/L"),
    "egfr": (90.0, 150.0, "mL/min/1.73m2"),
    "urea_bun": (7.0, 20.0, "mg/dL"),
    "total_bilirubin": (0.2, 1.2, "mg/dL"),
    "direct_bilirubin": (0.0, 0.3, "mg/dL"),
    "serum_albumin": (3.5, 5.0, "g/dL"),
    "total_protein": (6.0, 8.3, "g/dL"),
    "total_cholesterol": (125.0, 200.0, "mg/dL"),
    "ldl_cholesterol": (0.0, 100.0, "mg/dL"),
    "triglycerides": (0.0, 150.0, "mg/dL"),
    "tsh": (0.4, 4.0, "uIU/mL"),
    "free_t3": (2.0, 4.4, "pg/mL"),
    "free_t4": (0.8, 1.8, "ng/dL"),
    "vitamin_b12": (200.0, 900.0, "pg/mL"),
    "vitamin_d": (30.0, 100.0, "ng/mL"),
    "platelet_count": (150000.0, 450000.0, "/uL"),
    "crp": (0.0, 5.0, "mg/L"),
}

# Sex-adjusted reference intervals: (male_min, male_max, female_min, female_max, unit)
SEX_ADJUSTED_INTERVALS: Dict[str, Tuple[float, float, float, float, str]] = {
    "creatinine": (0.7, 1.3, 0.6, 1.1, "mg/dL"),
    "hemoglobin": (13.5, 17.5, 12.0, 15.5, "g/dL"),
    "ferritin": (24.0, 336.0, 11.0, 307.0, "ng/mL"),
    "serum_iron": (65.0, 175.0, 50.0, 170.0, "ug/dL"),
    "hdl_cholesterol": (40.0, 90.0, 50.0, 90.0, "mg/dL"),
    "alt_sgpt": (10.0, 40.0, 7.0, 35.0, "U/L"),
    "ast_sgot": (10.0, 40.0, 9.0, 32.0, "U/L"),
    "uric_acid": (3.4, 7.0, 2.4, 6.0, "mg/dL"),
}


def interpret_single_lab(
    raw_record: Dict[str, Any],
    patient_sex: str = "male",
    patient_age: Optional[int] = None,
    reference_date: Optional[date] = None,
) -> NormalizedLabItem:
    """
    Standardizes, validates, and clinically interprets a single raw lab record.
    """
    test_name_raw = str(raw_record.get("test_name", "")).strip()
    val_raw = str(raw_record.get("value", "")).strip()
    unit_raw = raw_record.get("unit")
    range_raw = raw_record.get("reference_range")
    test_date_raw = raw_record.get("test_date")
    source_lab = raw_record.get("source_laboratory")

    # 1. Canonicalization
    canon_key, category, std_unit = canonicalize_test_name(test_name_raw)

    # 2. Value parsing & unit normalization
    num_val, qual_val, norm_unit, unit_incompat = normalize_unit_and_value(canon_key, val_raw, unit_raw)

    # 3. Reference range parsing
    r_min, r_max, r_qual, range_valid = parse_reference_range(range_raw)
    range_source = "lab_specified" if (r_min is not None or r_max is not None or r_qual is not None) else "none"

    if not range_valid:
        range_source = "invalid_reversed"
        r_min, r_max = None, None

    # Fallback to clinical standard if lab range omitted
    if range_source == "none" and canon_key != "custom":
        sex_lower = str(patient_sex or "male").strip().lower()
        if canon_key in SEX_ADJUSTED_INTERVALS:
            m_min, m_max, f_min, f_max, s_unit = SEX_ADJUSTED_INTERVALS[canon_key]
            if sex_lower in ["female", "f"]:
                r_min, r_max = f_min, f_max
            else:
                r_min, r_max = m_min, m_max
            range_source = "clinical_standard"
        elif canon_key in STANDARD_INTERVALS:
            r_min, r_max, s_unit = STANDARD_INTERVALS[canon_key]
            range_source = "clinical_standard"

    # 4. Freshness / Stale calculation
    ref_d = reference_date or date.today()
    days_old = None
    is_stale = False
    if test_date_raw:
        try:
            d_str = str(test_date_raw).split("T")[0]
            parsed_d = datetime.strptime(d_str, "%Y-%m-%d").date()
            days_old = (ref_d - parsed_d).days
            if days_old > 180:
                is_stale = True
        except Exception:
            pass

    # 5. Status determination
    status = LabStatus.INDETERMINATE
    comment = ""

    if unit_incompat:
        status = LabStatus.INDETERMINATE
        comment = f"Observed unit '{unit_raw}' is incompatible or unverified for test '{test_name_raw}'. Clinical comparison withheld."
    elif qual_val is not None:
        if qual_val in ["negative", "normal"]:
            status = LabStatus.NORMAL
            comment = f"Qualitative result '{qual_val}' is normal."
        elif qual_val in ["positive", "reactive", "abnormal"]:
            status = LabStatus.HIGH
            comment = f"Qualitative result '{qual_val}' is clinically significant/abnormal."
        else:
            status = LabStatus.INDETERMINATE
            comment = f"Qualitative result '{qual_val}' requires clinician interpretation."
    elif num_val is not None:
        if r_min is None and r_max is None:
            status = LabStatus.INDETERMINATE
            comment = "No validated reference range provided or established for this test. Interpretation withheld."
        else:
            # Check bounds
            if r_min is not None and num_val < r_min:
                status = LabStatus.LOW
                comment = f"Observed value {num_val} {norm_unit or ''} is below normal range ({r_min} - {r_max or 'inf'})."
            elif r_max is not None and num_val > r_max:
                status = LabStatus.HIGH
                comment = f"Observed value {num_val} {norm_unit or ''} is above normal range ({r_min or 0} - {r_max})."
            else:
                status = LabStatus.NORMAL
                comment = f"Observed value {num_val} {norm_unit or ''} is within normal reference interval."

    if is_stale:
        comment += f" [STALE: Result is {days_old} days old; clinical confirmation recommended before acute intervention]"

    return NormalizedLabItem(
        original_test_name=test_name_raw,
        canonical_key=canon_key,
        category=category,
        original_value=val_raw,
        numeric_value=num_val,
        qualitative_value=qual_val,
        original_unit=unit_raw,
        normalized_unit=norm_unit,
        reference_range_raw=range_raw,
        reference_range_min=r_min,
        reference_range_max=r_max,
        range_source=range_source,
        test_date=str(test_date_raw).split("T")[0] if test_date_raw else None,
        days_old=days_old,
        source_laboratory=source_lab,
        status=status,
        is_critical=False,  # Evaluated by safety module
        is_stale=is_stale,
        is_conflict=False,
        clinical_comment=comment.strip(),
    )


def process_lab_records(
    raw_records: List[Dict[str, Any]],
    patient_sex: str = "male",
    patient_age: Optional[int] = None,
    reference_date: Optional[date] = None,
) -> List[NormalizedLabItem]:
    """
    Processes a list of raw lab records, resolving duplicates and conflicts.
    - If multiple records for same canonical test:
      Sort by test_date descending (newest first).
      If same date has multiple differing values: marks is_conflict = True.
    """
    if not raw_records:
        return []

    interpreted_items = [
        interpret_single_lab(r, patient_sex, patient_age, reference_date)
        for r in raw_records
    ]

    # Group by canonical key (or original test name if custom)
    grouped: Dict[str, List[NormalizedLabItem]] = {}
    for item in interpreted_items:
        key = item.canonical_key if item.canonical_key != "custom" else item.original_test_name.lower().strip()
        grouped.setdefault(key, []).append(item)

    final_items: List[NormalizedLabItem] = []

    for key, items in grouped.items():
        if len(items) == 1:
            final_items.append(items[0])
            continue

        # Sort by date descending (None dates treated as oldest)
        items.sort(key=lambda x: x.test_date or "1900-01-01", reverse=True)

        latest = items[0]
        # Check for same-date conflict
        same_date_items = [it for it in items if it.test_date == latest.test_date]
        if len(same_date_items) > 1:
            vals = {it.numeric_value for it in same_date_items if it.numeric_value is not None}
            if len(vals) > 1:
                latest.is_conflict = True
                latest.status = LabStatus.INDETERMINATE
                latest.clinical_comment = (
                    f"Conflicting lab values detected on {latest.test_date} for '{latest.original_test_name}'. "
                    f"Clinician confirmation required."
                )

        final_items.append(latest)

    return final_items

