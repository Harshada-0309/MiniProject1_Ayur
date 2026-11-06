"""
Tests for PyMuPDF-based Clinical Diet Prescription PDF Generator.
"""

import pytest
import pymupdf
from app.pdf_generator import build_prescription_pdf


@pytest.fixture
def sample_prescription_data():
    patient = {
        "id": 101,
        "name": "Dr. Rajesh K. Varma",
        "patient_code": "PAT-2026-0042",
        "age": 48,
        "sex": "male",
        "diet_goal": "weight_loss",
    }
    assessment = {
        "height": 174,
        "weight": 82,
        "bmi": 27.1,
        "prakriti": "Pitta-Kapha",
        "vikriti": "Pitta-Vata imbalance",
        "appetite": "Tikshnagni (Sharp/High)",
        "food_allergies": ["Peanuts"],
        "existing_conditions": ["Dyslipidemia", "Mild Hypertension"],
    }
    diet_plan = {
        "id": 55,
        "plan_id": "DP-2026-0042-V1",
        "title": "7-Day Personalized Ayurvedic Diet Plan",
        "is_approved": True,
        "status": "approved",
        "approved_by": "Dr. A. Sen, Senior Ayurvedic Dietitian",
        "approved_at": "2026-11-05T09:30:00Z",
        "patient_summary": "48-year-old male with Pitta-Kapha prakriti and elevated postprandial glucose.",
        "clinical_rationale": "Caloric moderation with low-glycemic ancient grains (yava, ragi) and cooling herbs to pacify pitta.",
        "nutrition_targets": {
            "energy": {"target_energy_kcal_day": 1850},
            "macronutrients": {
                "protein": {"target_g": 70},
                "carbohydrate": {"target_g": 230},
                "fat": {"target_g": 45},
            },
        },
        "clinical_lab_summary": {
            "total_tests_analyzed": 4,
            "abnormal_count": 2,
            "items": [
                {"test_name": "Fasting Blood Sugar", "observed_value": "135", "unit": "mg/dL", "reference_range": "70 - 99", "status": "high"},
                {"test_name": "HbA1c", "observed_value": "7.2", "unit": "%", "reference_range": "< 5.7", "status": "high"},
                {"test_name": "Serum Creatinine", "observed_value": "1.0", "unit": "mg/dL", "reference_range": "0.7 - 1.3", "status": "normal"},
                {"test_name": "Serum Potassium", "observed_value": "4.4", "unit": "mmol/L", "reference_range": "3.5 - 5.1", "status": "normal"},
            ],
            "critical_alerts": [
                {"message": "Postprandial glycemic derangement observed (HbA1c 7.2%). Monitor glycemic curve closely."}
            ],
        },
        "days": [
            {
                "day_number": i,
                "day_name": f"Day {i}",
                "theme": f"Clinical Rotation Theme {i}",
                "daily_totals": {"calories": 1845, "protein_g": 69.5, "carbohydrate_g": 228, "fat_g": 44},
                "meals": [
                    {
                        "meal_type": "breakfast",
                        "timing": "08:00 AM",
                        "totals": {"calories": 420, "protein_g": 16},
                        "foods": [
                            {"food_name": "Barley Upma with Seasonal Greens", "quantity": 150, "unit": "g", "calories": 420, "preparation_notes": "Sauté with cumin and curry leaves"}
                        ],
                    },
                    {
                        "meal_type": "lunch",
                        "timing": "01:00 PM",
                        "totals": {"calories": 650, "protein_g": 25},
                        "foods": [
                            {"food_name": "Moong Dal Khichdi with Ghee", "quantity": 200, "unit": "g", "calories": 650, "preparation_notes": "Cooked soft with pinch of hing"}
                        ],
                    },
                    {
                        "meal_type": "evening_snack",
                        "timing": "05:00 PM",
                        "totals": {"calories": 250, "protein_g": 8},
                        "foods": [
                            {"food_name": "Roasted Makhana with Rock Salt", "quantity": 50, "unit": "g", "calories": 250, "preparation_notes": "Dry roasted lightly"}
                        ],
                    },
                    {
                        "meal_type": "dinner",
                        "timing": "07:30 PM",
                        "totals": {"calories": 525, "protein_g": 20.5},
                        "foods": [
                            {"food_name": "Ash Gourd Soup with Jowar Roti", "quantity": 180, "unit": "g", "calories": 525, "preparation_notes": "Light, warm, freshly cooked"}
                        ],
                    },
                ],
            }
            for i in range(1, 8)
        ],
        "ayurvedic_dietary_principles": [
            "Ahara Vidhi: Consume warm, unctuous meals in a calm environment.",
            "Shad Rasa Satmya: Maintain representation of all six tastes.",
        ],
        "general_instructions": [
            "Drink warm water throughout the day.",
            "Avoid iced beverages during or immediately after meals.",
        ],
    }
    return patient, assessment, diet_plan


def test_generate_pdf_valid(sample_prescription_data):
    """Verifies that the PDF generator outputs a valid PDF starting with %PDF."""
    patient, assessment, diet_plan = sample_prescription_data
    pdf_bytes = build_prescription_pdf(patient, assessment, diet_plan)

    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b"%PDF-")
    assert len(pdf_bytes) > 5000  # Multi-page complete report


def test_generate_pdf_pages_and_content(sample_prescription_data):
    """Verifies page count, text content, patient code, and all 7 days."""
    patient, assessment, diet_plan = sample_prescription_data
    pdf_bytes = build_prescription_pdf(patient, assessment, diet_plan)

    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    assert len(doc) >= 2  # Complete 7-day schedule requires multiple A4 pages

    full_text = " ".join(page.get_text() for page in doc)

    # Header & Clinic
    assert "AYURDIET CLINICAL NUTRITION CENTER" in full_text
    assert "PAT-2026-0042" in full_text
    assert "Dr. Rajesh K. Varma" in full_text

    # Section 9 Labs
    assert "Fasting Blood Sugar" in full_text
    assert "HbA1c" in full_text
    assert "HIGH" in full_text
    assert "CLINICAL ALERT" in full_text

    # All 7 days
    for day_num in range(1, 8):
        assert f"DAY {day_num}:" in full_text

    # Sign-off
    assert "Dr. A. Sen, Senior Ayurvedic Dietitian" in full_text
    assert "VERIFIED & OFFICIALLY LOCKED" in full_text

    doc.close()

