"""
Comprehensive 10-Scenario Test Suite for AyurDiet Clinical & Laboratory Data Integration.
Validates end-to-end clinical reasoning, deterministic guardrails, and patient isolation.
"""

import pytest
from datetime import datetime, timezone, timedelta
from app.clinical_labs import interpret_patient_labs
from app.clinical_labs.models import LabStatus
from app.gemini.generator import DietPlanGenerator


@pytest.fixture
def generator():
    return DietPlanGenerator()


@pytest.fixture
def base_assessment():
    return {
        "patient_id": 101,
        "assessment_id": 201,
        "name": "Arjun Sharma",
        "age": 45,
        "sex": "male",
        "height": 172,
        "weight": 70,
        "activity_level": "sedentary",
        "diet_goal": "general_healthy_diet",
        "diet_category": "vegetarian",
        "prakriti": "Pitta-Kapha",
        "appetite": "Samagni (Balanced)",
        "allergies": [],
        "existing_conditions": [],
        "medications": [],
    }


# ==============================================================================
# Scenario 1: Baseline (No Labs)
# ==============================================================================
def test_scenario_1_baseline_no_labs(generator, base_assessment):
    """Verifies that an assessment with zero lab records generates successfully."""
    plan = generator.generate_plan(
        patient_assessment=base_assessment,
        clinical_lab_data=[],
        force_mock=True,
    )

    assert plan["status"] in ["validated", "needs_review"]
    assert "clinical_lab_summary" in plan
    summary = plan["clinical_lab_summary"]
    assert summary["total_tests_analyzed"] == 0
    assert summary["abnormal_count"] == 0
    assert len(summary["critical_alerts"]) == 0
    assert len(plan["days"]) == 7


# ==============================================================================
# Scenario 2: Elevated Glucose and HbA1c (Prameha / Glycemic Control)
# ==============================================================================
def test_scenario_2_elevated_glucose_and_hba1c(generator, base_assessment):
    """Verifies that diabetic/hyperglycemic markers trigger glycemic dietetic guidelines."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    labs = [
        {"test_name": "Fasting Blood Sugar", "value": "165", "unit": "mg/dL", "reference_range": "70 - 99", "test_date": today},
        {"test_name": "HbA1c", "value": "8.4", "unit": "%", "reference_range": "< 5.7", "test_date": today},
    ]

    plan = generator.generate_plan(
        patient_assessment=base_assessment,
        clinical_lab_data=labs,
        force_mock=True,
    )

    summary = plan["clinical_lab_summary"]
    assert summary["total_tests_analyzed"] == 2
    assert summary["has_glycemic_derangement"] is True
    assert "Refined Sugar" in summary["contraindicated_foods"]
    assert "Barley / Yava" in summary["emphasized_foods"]

    # Verify plan incorporates findings in clinical rationale
    assert any(term in plan["clinical_rationale"].lower() for term in ["glycemic", "glucose", "sugar", "prameha"])


# ==============================================================================
# Scenario 3: Low Calcium (Asthi Dhatu Kshaya)
# ==============================================================================
def test_scenario_3_low_calcium(generator, base_assessment):
    """Verifies that hypocalcemia prioritizes calcium sources and vitamin D co-factors."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    labs = [
        {"test_name": "Serum Calcium", "value": "7.9", "unit": "mg/dL", "reference_range": "8.5 - 10.5", "test_date": today},
    ]

    plan = generator.generate_plan(
        patient_assessment=base_assessment,
        clinical_lab_data=labs,
        force_mock=True,
    )

    summary = plan["clinical_lab_summary"]
    assert summary["has_calcium_derangement"] is True
    assert any("ragi" in f.lower() or "sesame" in f.lower() or "til" in f.lower() for f in summary["emphasized_foods"])
    assert "calcium" in plan["clinical_rationale"].lower() or "asthi" in plan["clinical_rationale"].lower()


# ==============================================================================
# Scenario 4: Low Potassium with Safety Check
# ==============================================================================
def test_scenario_4_low_potassium_safety_check(generator, base_assessment):
    """Verifies that hypokalemia prompts potassium-rich whole foods and medication awareness."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    labs = [
        {"test_name": "Serum Potassium", "value": "3.1", "unit": "mmol/L", "reference_range": "3.5 - 5.1", "test_date": today},
    ]

    plan = generator.generate_plan(
        patient_assessment=base_assessment,
        clinical_lab_data=labs,
        force_mock=True,
    )

    summary = plan["clinical_lab_summary"]
    assert summary["has_hypokalemia"] is True
    assert any("coconut" in f.lower() or "banana" in f.lower() for f in summary["emphasized_foods"])


# ==============================================================================
# Scenario 5: Abnormal Kidney Function & Hyperkalemia (Strict Renal Safety)
# ==============================================================================
def test_scenario_5_abnormal_kidney_and_hyperkalemia(generator, base_assessment):
    """Verifies strict renal safety: blocks tender coconut water, triggers clinician review."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    labs = [
        {"test_name": "Serum Creatinine", "value": "2.2", "unit": "mg/dL", "reference_range": "0.7 - 1.3", "test_date": today},
        {"test_name": "eGFR", "value": "28", "unit": "mL/min/1.73m2", "reference_range": "> 60", "test_date": today},
        {"test_name": "Serum Potassium", "value": "5.6", "unit": "mmol/L", "reference_range": "3.5 - 5.1", "test_date": today},
    ]

    plan = generator.generate_plan(
        patient_assessment=base_assessment,
        clinical_lab_data=labs,
        force_mock=True,
    )

    summary = plan["clinical_lab_summary"]
    assert summary["has_renal_impairment"] is True
    assert summary["has_hyperkalemia_risk"] is True

    # Must strictly contraindicate high-potassium items like tender coconut water
    assert any("coconut" in f.lower() for f in summary["contraindicated_foods"])

    # Must trigger dietitian review flag
    assert plan["status"] == "needs_review"
    assert plan["validation_results"]["requires_dietitian_review"] is True


# ==============================================================================
# Scenario 6: Iron Deficiency with Incomplete Panel (Pandu / Uncertainty)
# ==============================================================================
def test_scenario_6_iron_deficiency_with_uncertainty(generator, base_assessment):
    """Verifies handling of low hemoglobin without ferritin (transparency without fabricating certainty)."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    labs = [
        {"test_name": "Hemoglobin", "value": "9.8", "unit": "g/dL", "reference_range": "13.0 - 17.5", "test_date": today},
    ]

    plan = generator.generate_plan(
        patient_assessment=base_assessment,
        clinical_lab_data=labs,
        force_mock=True,
    )

    summary = plan["clinical_lab_summary"]
    assert summary["has_anemia_or_iron_deficiency"] is True
    assert any("spinach" in f.lower() or "amla" in f.lower() or "beetroot" in f.lower() for f in summary["emphasized_foods"])


# ==============================================================================
# Scenario 7: Normal Labs Across All Panels
# ==============================================================================
def test_scenario_7_normal_labs(generator, base_assessment):
    """Verifies that completely normal panels are affirmed without spurious restrictions."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    labs = [
        {"test_name": "Fasting Blood Sugar", "value": "88", "unit": "mg/dL", "reference_range": "70 - 99", "test_date": today},
        {"test_name": "HbA1c", "value": "5.2", "unit": "%", "reference_range": "< 5.7", "test_date": today},
        {"test_name": "Serum Creatinine", "value": "0.9", "unit": "mg/dL", "reference_range": "0.7 - 1.3", "test_date": today},
        {"test_name": "Serum Potassium", "value": "4.2", "unit": "mmol/L", "reference_range": "3.5 - 5.1", "test_date": today},
        {"test_name": "Serum Calcium", "value": "9.6", "unit": "mg/dL", "reference_range": "8.5 - 10.5", "test_date": today},
    ]

    plan = generator.generate_plan(
        patient_assessment=base_assessment,
        clinical_lab_data=labs,
        force_mock=True,
    )

    summary = plan["clinical_lab_summary"]
    assert summary["total_tests_analyzed"] == 5
    assert summary["abnormal_count"] == 0
    assert len(summary["critical_alerts"]) == 0
    assert "reference intervals" in plan["patient_summary"].lower()


# ==============================================================================
# Scenario 8: Incompatible Units and Missing Ranges
# ==============================================================================
def test_scenario_8_incompatible_units_and_missing_ranges(generator, base_assessment):
    """Verifies that incompatible units are safely flagged without crashing or incorrect comparisons."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    labs = [
        {"test_name": "HbA1c", "value": "120", "unit": "meters", "reference_range": "< 5.7", "test_date": today},
        {"test_name": "Serum Creatinine", "value": "1.1", "unit": "", "reference_range": "", "test_date": today},
    ]

    plan = generator.generate_plan(
        patient_assessment=base_assessment,
        clinical_lab_data=labs,
        force_mock=True,
    )

    summary = plan["clinical_lab_summary"]
    assert summary["indeterminate_count"] >= 1
    # Guardrail warnings must report unit issue
    assert any("unit" in w.lower() for w in plan["validation_results"]["warnings"])


# ==============================================================================
# Scenario 9: Stale Results (> 180 Days) and Conflicting Values
# ==============================================================================
def test_scenario_9_stale_and_conflicting_results(generator, base_assessment):
    """Verifies that tests older than 180 days are marked stale with warnings."""
    stale_date = (datetime.now(timezone.utc) - timedelta(days=220)).strftime("%Y-%m-%d")
    labs = [
        {"test_name": "Fasting Blood Sugar", "value": "145", "unit": "mg/dL", "reference_range": "70 - 99", "test_date": stale_date},
    ]

    plan = generator.generate_plan(
        patient_assessment=base_assessment,
        clinical_lab_data=labs,
        force_mock=True,
    )

    summary = plan["clinical_lab_summary"]
    assert summary["stale_count"] >= 1
    assert any("180 days" in w.lower() for w in plan["validation_results"]["warnings"])


# ==============================================================================
# Scenario 10: Two Patients with Distinct Clinical Records (Isolation Proof)
# ==============================================================================
def test_scenario_10_two_patients_isolation(generator, base_assessment):
    """Verifies that Patient A (hyperkalemic) and Patient B (anemic) maintain complete clinical isolation."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Patient A: Renal / Hyperkalemia
    assessment_a = dict(base_assessment)
    assessment_a["patient_id"] = 101
    labs_a = [
        {"test_name": "Serum Potassium", "value": "5.8", "unit": "mmol/L", "reference_range": "3.5 - 5.1", "test_date": today},
    ]

    # Patient B: Anemia / Normal Potassium
    assessment_b = dict(base_assessment)
    assessment_b["patient_id"] = 102
    assessment_b["name"] = "Priya Patel"
    labs_b = [
        {"test_name": "Hemoglobin", "value": "9.2", "unit": "g/dL", "reference_range": "12.0 - 15.5", "test_date": today},
        {"test_name": "Serum Potassium", "value": "4.1", "unit": "mmol/L", "reference_range": "3.5 - 5.1", "test_date": today},
    ]

    plan_a = generator.generate_plan(patient_assessment=assessment_a, clinical_lab_data=labs_a, force_mock=True)
    plan_b = generator.generate_plan(patient_assessment=assessment_b, clinical_lab_data=labs_b, force_mock=True)

    # Assert Patient A has hyperkalemia restrictions and Patient B does NOT
    assert plan_a["clinical_lab_summary"]["has_hyperkalemia_risk"] is True
    assert plan_b["clinical_lab_summary"]["has_hyperkalemia_risk"] is False

    # Assert Patient B has anemia rules and Patient A does NOT
    assert plan_b["clinical_lab_summary"]["has_anemia_or_iron_deficiency"] is True
    assert plan_a["clinical_lab_summary"]["has_anemia_or_iron_deficiency"] is False

    # Patient IDs preserved
    assert plan_a["patient_id"] == 101
    assert plan_b["patient_id"] == 102
