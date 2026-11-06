"""
Integration Tests for FastAPI Nutrition API Endpoint.
"""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "ayurdiet-ai-service"


def test_calculate_nutrition_valid_request():
    payload = {
        "patient_id": "PAT-2026-0002",
        "assessment_id": 2,
        "age": 46,
        "sex": "male",
        "height": 178.0,
        "weight": 64.0,
        "diet_goal": "weight_gain",
        "activity_level": "moderately_active",
        "prakriti": "Vata",
        "appetite": "Vishamagni (Irregular)",
        "existing_conditions": ["IBS-C"],
    }
    response = client.post("/api/nutrition/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()

    # BMR: 10*64 + 6.25*178 - 5*46 + 5 = 640 + 1112.5 - 230 + 5 = 1527.5
    assert data["anthropometrics"]["bmi"] == 20.2
    assert data["energy"]["bmr_kcal_day"] == 1527.5
    # TDEE: 1527.5 * 1.55 = 2367.6
    assert data["energy"]["tdee_kcal_day"] == 2367.6
    # Target Energy: 2367.6 + 400 = 2767.6
    assert data["energy"]["target_energy_kcal_day"] == 2767.6
    # Protein: 64 * 1.3 = 83.2 g
    assert data["macros"]["protein_g_day"] == 83.2
    assert data["condition_specific"] is True
    assert data["requires_knowledge_grounded_guidance"] is True


def test_calculate_nutrition_validation_failure():
    # Missing required age, sex, height, weight
    payload = {
        "diet_goal": "weight_loss",
    }
    response = client.post("/api/nutrition/calculate", json=payload)
    # FastAPI pydantic validation returns 422
    assert response.status_code == 422
