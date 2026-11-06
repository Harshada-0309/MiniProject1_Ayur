"""
Clinical Safety and Urgent Derangement Detection.
Identifies acute, life-threatening laboratory derangements, flags findings requiring
mandatory clinician review, and cross-checks medication and renal safety interactions.
"""

from typing import List, Dict, Any, Tuple, Optional
from .models import NormalizedLabItem, ClinicalUrgentAlert, LabStatus


# Critical / Urgent Cutoff Thresholds: (critical_low, critical_high, unit, alert_message)
CRITICAL_THRESHOLDS: Dict[str, Tuple[Optional[float], Optional[float], str, str]] = {
    "potassium": (
        3.0,
        6.0,
        "mEq/L",
        "Severe potassium derangement. High risk of cardiac dysrhythmias or arrest. Immediate medical care required; food plan cannot substitute for acute medical therapy."
    ),
    "sodium": (
        125.0,
        155.0,
        "mEq/L",
        "Severe sodium derangement. High risk of seizures, brain edema, or severe dehydration. Urgent inpatient clinical care indicated."
    ),
    "calcium": (
        7.0,
        13.0,
        "mg/dL",
        "Severe calcium derangement. High risk of tetany, laryngospasm, or hypercalcemic crisis. Urgent medical treatment indicated."
    ),
    "glucose_fasting": (
        54.0,
        400.0,
        "mg/dL",
        "Extreme glycemic derangement. Risk of severe hypoglycemia or DKA/HHS crisis. Immediate medical evaluation required."
    ),
    "glucose_random": (
        54.0,
        400.0,
        "mg/dL",
        "Extreme glycemic derangement. Risk of severe hypoglycemia or DKA/HHS crisis. Immediate medical evaluation required."
    ),
    "hemoglobin": (
        7.0,
        None,
        "g/dL",
        "Severe anemia (< 7.0 g/dL). High risk of tissue hypoxia and decompensated heart failure. Immediate hematology/transfusion evaluation required."
    ),
    "egfr": (
        15.0,
        None,
        "mL/min/1.73m2",
        "Kidney failure / Stage 5 CKD (eGFR < 15). Immediate nephrology consult required for renal replacement therapy. Standard dietary interventions require direct nephrology supervision."
    ),
    "platelet_count": (
        20000.0,
        None,
        "/uL",
        "Severe thrombocytopenia (< 20,000 /uL). Critical risk of spontaneous hemorrhage. Urgent hematology evaluation required."
    ),
}


def evaluate_safety_alerts(
    items: List[NormalizedLabItem],
    patient_assessment: Dict[str, Any]
) -> Tuple[List[ClinicalUrgentAlert], List[str]]:
    """
    Evaluates normalized lab findings for acute life-safety alerts and
    medication/condition contraindication flags.
    Returns (critical_alerts, safety_review_reasons).
    """
    alerts: List[ClinicalUrgentAlert] = []
    review_reasons: List[str] = []

    medications_list = [
        str(m.get("medication_name", "")).lower()
        if isinstance(m, dict) else str(m).lower()
        for m in patient_assessment.get("medications", [])
    ]
    meds_text = " ".join(medications_list)

    conditions_list = [
        str(c).lower() for c in patient_assessment.get("medical_conditions", [])
        or patient_assessment.get("existing_conditions", [])
    ]
    conds_text = " ".join(conditions_list)

    for item in items:
        ckey = item.canonical_key
        val = item.numeric_value

        if ckey in CRITICAL_THRESHOLDS and val is not None:
            c_low, c_high, unit, msg = CRITICAL_THRESHOLDS[ckey]

            if c_low is not None and val < c_low:
                item.status = LabStatus.CRITICAL_LOW
                item.is_critical = True
                alerts.append(ClinicalUrgentAlert(
                    test_name=item.original_test_name,
                    value=f"{val} {item.normalized_unit or unit}",
                    severity="critical",
                    message=f"CRITICAL LOW: {msg}",
                    medical_action_required="Emergency/urgent physician consultation mandatory. Do not initiate dietary plan without acute stabilization."
                ))
                review_reasons.append(f"Critical low {item.original_test_name} ({val} {item.normalized_unit or unit})")

            elif c_high is not None and val > c_high:
                item.status = LabStatus.CRITICAL_HIGH
                item.is_critical = True
                alerts.append(ClinicalUrgentAlert(
                    test_name=item.original_test_name,
                    value=f"{val} {item.normalized_unit or unit}",
                    severity="critical",
                    message=f"CRITICAL HIGH: {msg}",
                    medical_action_required="Emergency/urgent physician consultation mandatory. Do not initiate dietary plan without acute stabilization."
                ))
                review_reasons.append(f"Critical high {item.original_test_name} ({val} {item.normalized_unit or unit})")

        # Non-critical abnormal items that warrant dietitian review
        if item.status in [LabStatus.LOW, LabStatus.HIGH] and not item.is_critical:
            if ckey in ["potassium", "creatinine", "egfr", "hba1c", "calcium"]:
                review_reasons.append(f"Abnormal {item.original_test_name}: {val} {item.normalized_unit or ''} ({item.status.value})")

    # Cross-check drug-lab interactions
    # 1. Potassium and ACE inhibitors / ARBs / Potassium-sparing diuretics
    has_k_retention_drug = any(d in meds_text for d in [
        "spironolactone", "amiloride", "triamterene", "losartan",
        "telmisartan", "valsartan", "ramipril", "enalapril", "lisinopril"
    ])
    k_item = next((it for it in items if it.canonical_key == "potassium"), None)
    if has_k_retention_drug and k_item and k_item.numeric_value is not None:
        if k_item.numeric_value >= 4.8:
            alerts.append(ClinicalUrgentAlert(
                test_name="Potassium & Medication Interaction",
                value=f"{k_item.numeric_value} mEq/L with {meds_text}",
                severity="warning",
                message="Patient is prescribed potassium-retaining medication (ACEi/ARB/diuretic) with high-normal or elevated potassium. High risk of precipitous hyperkalemia.",
                medical_action_required="Strictly limit high-potassium foods (tender coconut water, potassium salts). Monitor electrolytes closely."
            ))
            review_reasons.append("Drug-nutrient interaction: Potassium-retaining medication with elevated/borderline potassium")

    # 2. Renal Impairment & Protein / Potassium Guardrails
    has_renal_item = any(
        (it.canonical_key == "egfr" and it.numeric_value and it.numeric_value < 60) or
        (it.canonical_key == "creatinine" and it.numeric_value and it.numeric_value > 1.4)
        for it in items
    ) or any(k in conds_text for k in ["ckd", "renal", "kidney", "nephropathy"])

    if has_renal_item:
        review_reasons.append("Impaired kidney function requires controlled protein (0.6 - 0.8 g/kg) and monitored electrolyte intake")

    return alerts, review_reasons
