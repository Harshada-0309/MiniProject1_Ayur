"""
Main Pipeline for Clinical Laboratory Data Interpretation.
Orchestrates normalization, interpretation, safety evaluation, and dietary synthesis.
"""

from datetime import date
from typing import List, Dict, Any, Optional
from .models import (
    LabInterpretationSummary,
    LabStatus,
)
from .interpreter import process_lab_records
from .safety import evaluate_safety_alerts
from .dietary_rules import generate_lab_dietary_guidelines


def interpret_patient_labs(
    raw_records: Optional[List[Dict[str, Any]]],
    patient_assessment: Dict[str, Any],
    reference_date: Optional[date] = None,
) -> LabInterpretationSummary:
    """
    Consumes raw laboratory records for a patient assessment and returns
    a comprehensive, clinically verified interpretation summary.
    """
    if not raw_records:
        return LabInterpretationSummary(
            total_tests_analyzed=0,
            clinical_rationale_snippet="No clinical laboratory findings were recorded for this assessment. Diet plan generated based on standard clinical and Prakriti anthropometrics."
        )

    patient_sex = patient_assessment.get("sex") or patient_assessment.get("gender") or "male"
    patient_age = patient_assessment.get("age")
    try:
        if patient_age is not None:
            patient_age = int(patient_age)
    except Exception:
        patient_age = None

    # 1. Normalization & Interpretation (with duplicate/conflict resolution)
    normalized_items = process_lab_records(
        raw_records=raw_records,
        patient_sex=str(patient_sex),
        patient_age=patient_age,
        reference_date=reference_date,
    )

    # 2. Safety & Urgent Alerts
    critical_alerts, safety_reasons = evaluate_safety_alerts(normalized_items, patient_assessment)

    # 3. Dietary Guidelines & Ayurvedic Synthesis
    guidelines, emphasized_foods, contraindicated_foods, flags = generate_lab_dietary_guidelines(
        normalized_items,
        patient_assessment
    )

    # 4. Counts
    total = len(normalized_items)
    normal_cnt = sum(1 for it in normalized_items if it.status == LabStatus.NORMAL)
    abnormal_cnt = sum(1 for it in normalized_items if it.status in [LabStatus.LOW, LabStatus.HIGH, LabStatus.CRITICAL_LOW, LabStatus.CRITICAL_HIGH])
    critical_cnt = sum(1 for it in normalized_items if it.is_critical)
    stale_cnt = sum(1 for it in normalized_items if it.is_stale)
    indet_cnt = sum(1 for it in normalized_items if it.status == LabStatus.INDETERMINATE)

    # 5. Build Clinical Rationale Snippet
    rationale_lines: List[str] = []
    if critical_alerts:
        for alert in critical_alerts:
            rationale_lines.append(f"URGENT ALERT: {alert.message} ({alert.medical_action_required})")

    if flags.get("all_normal"):
        rationale_lines.append(
            f"Laboratory Profile: All {total} analyzed tests are within normal reference intervals. "
            "Reinforces baseline doshic equilibrium; no therapeutic mineral or macro restrictions warranted."
        )
    else:
        abnormal_summaries = [
            f"{it.original_test_name}: {it.original_value} {it.normalized_unit or ''} ({it.status.value.upper()})"
            for it in normalized_items
            if it.status in [LabStatus.LOW, LabStatus.HIGH, LabStatus.CRITICAL_LOW, LabStatus.CRITICAL_HIGH]
        ]
        if abnormal_summaries:
            rationale_lines.append(f"Identified Laboratory Findings: {'; '.join(abnormal_summaries)}.")

        for g in guidelines:
            if g.rationale:
                rationale_lines.append(f"{g.finding} -> {g.rationale}")

        if stale_cnt > 0:
            stale_names = [it.original_test_name for it in normalized_items if it.is_stale]
            rationale_lines.append(f"Note: Stale laboratory findings detected ({', '.join(stale_names)}). Repeat testing advised before aggressive chronic restrictions.")

        if indet_cnt > 0:
            indet_names = [it.original_test_name for it in normalized_items if it.status == LabStatus.INDETERMINATE and not it.is_conflict]
            if indet_names:
                rationale_lines.append(f"Indeterminate / unreferenced tests: {', '.join(indet_names)}. No unverified dietary restrictions fabricated.")

    # Clinical safety disclaimer
    rationale_lines.append(
        "Clinical Disclaimer: Laboratory findings inform nutritional support and whole-food choices; "
        "they do not establish a standalone medical diagnosis nor alter prescribed pharmaceutical regimens."
    )

    combined_rationale = "\n\n".join(rationale_lines)

    all_review_reasons = list(dict.fromkeys(
        safety_reasons + [g.finding for g in guidelines if g.requires_dietitian_review]
    ))
    requires_review = len(critical_alerts) > 0 or len(all_review_reasons) > 0

    return LabInterpretationSummary(
        total_tests_analyzed=total,
        normal_count=normal_cnt,
        abnormal_count=abnormal_cnt,
        critical_count=critical_cnt,
        stale_count=stale_cnt,
        indeterminate_count=indet_cnt,
        items=normalized_items,
        critical_alerts=critical_alerts,
        dietary_guidelines=guidelines,
        clinical_rationale_snippet=combined_rationale,
        contraindicated_foods=contraindicated_foods,
        emphasized_foods=emphasized_foods,
        requires_dietitian_review=requires_review,
        review_reasons=all_review_reasons,
        has_renal_impairment=flags.get("has_renal_impairment", False),
        has_hyperkalemia_risk=flags.get("has_hyperkalemia_risk", False),
        has_hypokalemia=flags.get("has_hypokalemia", False),
        has_glycemic_derangement=flags.get("has_glycemic_derangement", False),
        has_calcium_derangement=flags.get("has_calcium_derangement", False),
        has_anemia_or_iron_deficiency=flags.get("has_anemia_or_iron_deficiency", False),
        has_dyslipidemia=flags.get("has_dyslipidemia", False),
        has_thyroid_derangement=flags.get("has_thyroid_derangement", False),
        all_normal=flags.get("all_normal", False),
    )

