import pytest
from app.clinical_labs import (
    interpret_patient_labs,
    LabStatus,
    LabCategory,
)

def test_empty_labs():
    summary = interpret_patient_labs([], {"sex": "female", "age": 30})
    assert summary.total_tests_analyzed == 0
    assert summary.normal_count == 0
    assert not summary.requires_dietitian_review

def test_hba1c_and_glucose():
    raw = [
        {"test_name": "HbA1c", "value": "8.4", "unit": "%", "reference_range": "< 5.7"},
        {"test_name": "Fasting Blood Sugar", "value": "165", "unit": "mg/dL", "reference_range": "70 - 99"}
    ]
    summary = interpret_patient_labs(raw, {"sex": "male", "age": 45})
    assert summary.total_tests_analyzed == 2
    assert summary.has_glycemic_derangement is True
    assert summary.requires_dietitian_review is True
    assert "Barley / Yava" in summary.emphasized_foods
    assert "Refined Sugar" in summary.contraindicated_foods

def test_low_calcium():
    raw = [
        {"test_name": "Serum Calcium", "value": "7.8", "unit": "mg/dL", "reference_range": "8.5 - 10.5"}
    ]
    summary = interpret_patient_labs(raw, {"sex": "female", "age": 38})
    assert summary.has_calcium_derangement is True
    assert "Finger Millet / Ragi" in summary.emphasized_foods
    assert "Sesame Seeds / Til" in summary.emphasized_foods

def test_low_potassium():
    raw = [
        {"test_name": "Serum Potassium", "value": "3.2", "unit": "mEq/L", "reference_range": "3.5 - 5.0"}
    ]
    summary = interpret_patient_labs(raw, {"sex": "male", "age": 50})
    assert summary.has_hypokalemia is True
    assert "Tender Coconut Water" in summary.emphasized_foods

def test_renal_impairment_blocks_potassium_loading():
    raw = [
        {"test_name": "Serum Creatinine", "value": "2.2", "unit": "mg/dL", "reference_range": "0.7 - 1.3"},
        {"test_name": "eGFR", "value": "32", "unit": "mL/min/1.73m2", "reference_range": "> 60"},
        {"test_name": "Potassium", "value": "3.3", "unit": "mEq/L", "reference_range": "3.5 - 5.0"}
    ]
    summary = interpret_patient_labs(raw, {"sex": "male", "age": 62})
    assert summary.has_renal_impairment is True
    assert summary.has_hypokalemia is True
    # In renal impairment, coconut water must NOT be freely loaded
    assert "Tender Coconut Water" not in summary.emphasized_foods

def test_critical_hyperkalemia():
    raw = [
        {"test_name": "Serum Potassium", "value": "6.3", "unit": "mEq/L", "reference_range": "3.5 - 5.0"}
    ]
    summary = interpret_patient_labs(raw, {"sex": "female", "age": 55})
    assert len(summary.critical_alerts) > 0
    assert summary.critical_alerts[0].severity == "critical"
    assert "Tender Coconut Water" in summary.contraindicated_foods

def test_all_normal():
    raw = [
        {"test_name": "Fasting Blood Sugar", "value": "85", "unit": "mg/dL", "reference_range": "70 - 99"},
        {"test_name": "Serum Calcium", "value": "9.5", "unit": "mg/dL", "reference_range": "8.5 - 10.5"},
        {"test_name": "Potassium", "value": "4.2", "unit": "mEq/L", "reference_range": "3.5 - 5.0"}
    ]
    summary = interpret_patient_labs(raw, {"sex": "female", "age": 28})
    assert summary.all_normal is True
    assert summary.normal_count == 3
    assert len(summary.contraindicated_foods) == 0

def test_incompatible_units_and_unknown_tests():
    raw = [
        {"test_name": "Fasting Blood Sugar", "value": "95", "unit": "seconds", "reference_range": "70 - 99"},
        {"test_name": "Some Obscure Research Biomarker XYZ", "value": "42.0", "unit": "units/L"}
    ]
    summary = interpret_patient_labs(raw, {"sex": "male", "age": 40})
    assert summary.indeterminate_count == 2
    # Incompatible unit should not trigger fake high/low
    assert summary.has_glycemic_derangement is False

