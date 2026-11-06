"""
Comprehensive Deterministic Unit Tests for AyurDiet Nutrition Engine.
Asserts exact mathematical values, boundary conditions, and validation rules.
"""

import pytest
from app.nutrition.calculator import (
    calculate_bmi,
    calculate_bmr,
    calculate_nutrition_targets,
)
from app.nutrition.validators import NutritionValidationError
from app.nutrition.constants import (
    ACTIVITY_MULTIPLIERS,
    PROTEIN_FACTORS_BY_GOAL,
    DEFAULT_FAT_ENERGY_PERCENTAGE,
    KCAL_PER_G_PROTEIN,
    KCAL_PER_G_FAT,
    KCAL_PER_G_CARB,
)


class TestBMICalculation:
    def test_normal_bmi(self):
        # 80 kg, 180 cm -> 80 / (1.8^2) = 24.69
        bmi, status = calculate_bmi(80.0, 180.0)
        assert bmi == 24.69
        assert status == "Normal weight"

    def test_underweight_bmi(self):
        # 45 kg, 170 cm -> 45 / (1.7^2) = 15.57
        bmi, status = calculate_bmi(45.0, 170.0)
        assert bmi == 15.57
        assert status == "Severe Underweight"

    def test_overweight_bmi(self):
        # 85 kg, 175 cm -> 85 / (1.75^2) = 27.76
        bmi, status = calculate_bmi(85.0, 175.0)
        assert bmi == 27.76
        assert status == "Overweight"

    def test_obesity_bmi(self):
        # 105 kg, 170 cm -> 105 / (1.7^2) = 36.33
        bmi, status = calculate_bmi(105.0, 170.0)
        assert bmi == 36.33
        assert status == "Obesity Class II"


class TestBMRMifflinStJeor:
    def test_male_bmr(self):
        # Male, age 30, height 180 cm, weight 80 kg
        # 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780.0
        bmr = calculate_bmr(weight_kg=80.0, height_cm=180.0, age_years=30, sex="male")
        assert bmr == 1780.0

    def test_female_bmr(self):
        # Female, age 25, height 160 cm, weight 55 kg
        # 10*55 + 6.25*160 - 5*25 - 161 = 550 + 1000 - 125 - 161 = 1264.0
        bmr = calculate_bmr(weight_kg=55.0, height_cm=160.0, age_years=25, sex="female")
        assert bmr == 1264.0

    def test_missing_required_fields_raises_validation_error(self):
        with pytest.raises(NutritionValidationError) as exc_info:
            calculate_nutrition_targets({
                "weight": 70.0,
                # Missing age, sex, height, diet_goal
            })
        err_msg = str(exc_info.value)
        assert "Age is required" in err_msg
        assert "Sex is required" in err_msg
        assert "Height in cm is required" in err_msg


class TestTDEEAndActivityMultipliers:
    @pytest.mark.parametrize("activity,expected_mult", [
        ("sedentary", 1.2),
        ("lightly_active", 1.375),
        ("moderately_active", 1.55),
        ("very_active", 1.725),
        ("extremely_active", 1.9),
    ])
    def test_all_activity_multipliers(self, activity, expected_mult):
        data = {
            "age": 30,
            "sex": "male",
            "height": 180.0,
            "weight": 80.0,
            "activity_level": activity,
            "diet_goal": "weight_maintenance",
        }
        res = calculate_nutrition_targets(data)
        expected_bmr = 1780.0
        expected_tdee = round(expected_bmr * expected_mult, 1)
        assert res.energy.activity_multiplier == expected_mult
        assert res.energy.tdee_kcal_day == expected_tdee

    def test_invalid_activity_category_raises(self):
        with pytest.raises(NutritionValidationError) as exc_info:
            calculate_nutrition_targets({
                "age": 30,
                "sex": "male",
                "height": 180.0,
                "weight": 80.0,
                "activity_level": "super_crazy_active",
                "diet_goal": "weight_maintenance",
            })
        assert "Invalid activity level" in str(exc_info.value)


class TestGoalAdjustment:
    def test_weight_loss_goal(self):
        data = {
            "age": 30,
            "sex": "male",
            "height": 180.0,
            "weight": 80.0,
            "activity_level": "sedentary",
            "diet_goal": "weight_loss",
        }
        res = calculate_nutrition_targets(data)
        # BMR 1780 * 1.2 = 2136.0 TDEE; deficit -500 -> 1636.0 kcal
        assert res.energy.tdee_kcal_day == 2136.0
        assert res.energy.adjustment_kcal_day == -500.0
        assert res.energy.target_energy_kcal_day == 1636.0

    def test_weight_maintenance_goal(self):
        data = {
            "age": 30,
            "sex": "male",
            "height": 180.0,
            "weight": 80.0,
            "activity_level": "sedentary",
            "diet_goal": "weight_maintenance",
        }
        res = calculate_nutrition_targets(data)
        assert res.energy.adjustment_kcal_day == 0.0
        assert res.energy.target_energy_kcal_day == 2136.0

    def test_weight_gain_goal(self):
        data = {
            "age": 30,
            "sex": "male",
            "height": 180.0,
            "weight": 80.0,
            "activity_level": "sedentary",
            "diet_goal": "weight_gain",
        }
        res = calculate_nutrition_targets(data)
        # Surplus +400 -> 2136.0 + 400 = 2536.0 kcal
        assert res.energy.adjustment_kcal_day == 400.0
        assert res.energy.target_energy_kcal_day == 2536.0


class TestProteinAndMacronutrients:
    def test_protein_calculation(self):
        # 80 kg, weight_loss -> 1.2 g/kg -> 96.0 g
        data = {
            "age": 30,
            "sex": "male",
            "height": 180.0,
            "weight": 80.0,
            "activity_level": "sedentary",
            "diet_goal": "weight_loss",
        }
        res = calculate_nutrition_targets(data)
        assert res.macros.protein_factor_g_kg == 1.2
        assert res.macros.protein_g_day == 96.0
        assert res.macros.protein_kcal_day == 96.0 * 4.0

    def test_macronutrient_calorie_consistency(self):
        """Assert sum of macro calories exactly equals target energy without rounding drifts."""
        data = {
            "age": 42,
            "sex": "female",
            "height": 165.0,
            "weight": 68.0,
            "activity_level": "moderately_active",
            "diet_goal": "weight_loss",
        }
        res = calculate_nutrition_targets(data)
        sum_macro_kcal = (
            res.macros.protein_kcal_day
            + res.macros.fat_kcal_day
            + res.macros.carbohydrate_kcal_day
        )
        # Exactly equal to target energy
        assert abs(sum_macro_kcal - res.energy.target_energy_kcal_day) < 0.2
        assert res.macros.total_macro_kcal == res.energy.target_energy_kcal_day


class TestHydrationAndFiber:
    def test_hydration_calculation(self):
        # 80 kg * 35 ml/kg = 2800 ml
        data = {
            "age": 30,
            "sex": "male",
            "height": 180.0,
            "weight": 80.0,
            "activity_level": "sedentary",
            "diet_goal": "weight_maintenance",
        }
        res = calculate_nutrition_targets(data)
        assert res.other_targets.water_ml_day == 2800.0

    def test_hydration_floor_applied_for_low_weight(self):
        # 45 kg * 35 ml/kg = 1575 ml -> clamped to floor 2000 ml
        data = {
            "age": 20,
            "sex": "female",
            "height": 150.0,
            "weight": 45.0,
            "activity_level": "sedentary",
            "diet_goal": "weight_maintenance",
        }
        res = calculate_nutrition_targets(data)
        assert res.other_targets.water_ml_day == 2000.0

    def test_fiber_calculation(self):
        # Target energy 2136 kcal -> (2136/1000)*14 = 29.9 g
        data = {
            "age": 30,
            "sex": "male",
            "height": 180.0,
            "weight": 80.0,
            "activity_level": "sedentary",
            "diet_goal": "weight_maintenance",
        }
        res = calculate_nutrition_targets(data)
        assert res.other_targets.fiber_g_day == 29.9


class TestCompletePatientAssessmentFlow:
    def test_complete_assessment_with_ayurvedic_and_clinical_context(self):
        payload = {
            "patient_id": "PAT-2026-0001",
            "assessment_id": 1,
            "age": 38,
            "sex": "female",
            "height": 162.0,
            "weight": 68.5,
            "waist_circumference": 84.0,
            "weight_trend": "gaining",
            "diet_goal": "weight_loss",
            "target_weight": 58.0,
            "activity_level": "sedentary",
            "diet_category": "vegetarian",
            "prakriti": "Pitta-Kapha",
            "vikriti": "Aggravated Pitta with Ama signs",
            "appetite": "Tikshnagni (Sharp/High)",
            "digestion": "Acidity",
            "bowel_habits": "Regular",
            "season_ritu": "Sharad (Autumn)",
            "existing_conditions": ["GERD", "Mild Dyslipidemia"],
            "medications": [{"medication_name": "Pantoprazole", "dosage": "40mg"}],
        }

        res = calculate_nutrition_targets(payload)

        # 1. Anthropometrics
        # 68.5 / (1.62^2) = 26.1
        assert res.anthropometrics.bmi == 26.1
        assert res.anthropometrics.bmi_status == "Overweight"

        # 2. BMR
        # 10*68.5 + 6.25*162 - 5*38 - 161 = 685 + 1012.5 - 190 - 161 = 1346.5
        assert res.energy.bmr_kcal_day == 1346.5
        assert res.energy.formula == "Mifflin-St Jeor"

        # 3. TDEE & Goal Target
        # 1346.5 * 1.2 = 1615.8 TDEE; -500 deficit = 1115.8; clamped to female floor (1200.0)
        assert res.energy.tdee_kcal_day == 1615.8
        assert res.energy.target_energy_kcal_day == 1200.0

        # 4. Macros
        # Protein: 68.5 * 1.2 = 82.2 g -> 328.8 kcal
        assert res.macros.protein_g_day == 82.2
        assert res.macros.protein_kcal_day == 328.8
        # Fat: 25% of 1200 = 300 kcal -> 33.3 g
        assert res.macros.fat_kcal_day == 300.0
        assert res.macros.fat_g_day == 33.3
        # Carbs: 1200 - 328.8 - 300 = 571.2 kcal -> 142.8 g
        assert res.macros.carbohydrate_kcal_day == 571.2
        assert res.macros.carbohydrate_g_day == 142.8

        # 5. Ayurvedic profile
        assert res.ayurvedic_profile.prakriti == "Pitta-Kapha"
        assert res.ayurvedic_profile.agni == "Tikshnagni (Sharp/High)"
        assert len(res.ayurvedic_profile.doshic_dietary_qualities) > 0

        # 6. Condition specific flag
        assert res.condition_specific is True
        assert res.requires_knowledge_grounded_guidance is True

        # 7. Metadata
        assert len(res.calculation_metadata.formulas_used) > 0
        assert len(res.calculation_metadata.warnings) > 0  # Energy floor warning
