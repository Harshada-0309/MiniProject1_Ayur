"""
Comprehensive Automated Unit and Integration Tests for Phase 5 Food & Meal Planning Engine.
Tests food database provenance, eligibility filtering, scoring, portion calculations,
meal plan generation, substitutions, validation, and FastAPI endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.meal_planner import (
    FoodEligibilityEngine,
    FoodScorer,
    MealBuilder,
    PortionEngine,
    SubstitutionEngine,
    get_food_db,
    scale_nutrition,
)
from app.meal_planner.models import FoodItem, MealPlanMeal, DailyTotals
from app.meal_planner.validator import PlanValidator

client = TestClient(app)


# -----------------------------------------------------------------------------
# Fixtures
# -----------------------------------------------------------------------------
@pytest.fixture
def food_db():
    return get_food_db()


@pytest.fixture
def sample_assessment():
    return {
        "patient_id": "P-101",
        "assessment_id": "A-202",
        "age": 42,
        "sex": "male",
        "height": 172.0,
        "weight": 78.0,
        "diet_goal": "weight_loss",
        "activity_level": "sedentary",
        "prakriti": "Pitta-Kapha",
        "existing_conditions": ["diabetes"],
        "food_allergies": ["peanut"],
        "food_intolerances": [],
        "diet_category": "vegetarian",
        "food_preferences": "moong dal, roti",
        "foods_disliked": "bitter gourd",
    }


# -----------------------------------------------------------------------------
# 1. Food Database Catalog Tests
# -----------------------------------------------------------------------------
def test_food_database_provenance_and_counts(food_db):
    foods = food_db.get_all_foods()
    assert len(foods) >= 25, f"Expected >= 25 foods, got {len(foods)}"

    categories = set(f.category for f in foods)
    expected_categories = {"cereal_grain", "pulse_legume", "vegetable", "fruit", "dairy", "nut_seed", "spice_herb"}
    assert expected_categories.issubset(categories), f"Missing categories: {expected_categories - categories}"

    # Verify each food has grounded provenance and positive nutrition
    for f in foods:
        assert f.food_id
        assert f.food_name
        assert f.nutrition.calories >= 0
        assert f.nutrition.protein_g >= 0
        assert f.serving.min_quantity > 0
        assert f.serving.max_quantity >= f.serving.min_quantity
        assert len(f.sources) > 0, f"Food {f.food_id} lacks source provenance"
        assert f.sources[0].document


def test_food_search_and_category_lookup(food_db):
    grains = food_db.get_by_category("cereal_grain")
    assert len(grains) >= 4
    assert any("rice" in g.food_id for g in grains)

    search_res = food_db.search_foods("moong")
    assert len(search_res) >= 2
    assert all("moong" in f.food_name.lower() or "moong" in f.food_id for f in search_res)


# -----------------------------------------------------------------------------
# 2. Eligibility Engine Tests
# -----------------------------------------------------------------------------
def test_eligibility_allergy_exclusion(food_db, sample_assessment):
    engine = FoodEligibilityEngine()

    # Patient is allergic to peanut and dislikes bitter gourd
    karela = food_db.get_food("veg_bitter_gourd")
    res_karela = engine.evaluate_food(karela, sample_assessment)
    assert res_karela.status == "ineligible"
    assert any("dislike" in r["type"] for r in res_karela.reasons)

    # Patient with milk allergy
    milk_allergic_assessment = dict(sample_assessment, food_allergies=["milk"])
    cow_milk = food_db.get_food("dairy_cow_milk")
    res_milk = engine.evaluate_food(cow_milk, milk_allergic_assessment)
    assert res_milk.status == "ineligible"
    assert any("allergy" in r["type"] for r in res_milk.reasons)


def test_eligibility_vegan_filtering(food_db, sample_assessment):
    engine = FoodEligibilityEngine()
    vegan_assessment = dict(sample_assessment, diet_category="vegan")

    ghee = food_db.get_food("dairy_cow_ghee")
    res_ghee = engine.evaluate_food(ghee, vegan_assessment)
    assert res_ghee.status == "ineligible"
    assert any("dietary_category" in r["type"] for r in res_ghee.reasons)

    almond_milk = food_db.get_food("dairy_almond_milk")
    res_almond = engine.evaluate_food(almond_milk, vegan_assessment)
    assert res_almond.status == "eligible"


def test_eligibility_drug_interaction_flag(food_db, sample_assessment):
    engine = FoodEligibilityEngine()
    thyroid_assessment = dict(sample_assessment, medications=[{"name": "Levothyroxine", "dosage": "50mcg"}])

    tofu = food_db.get_food("pulse_tofu")
    res_tofu = engine.evaluate_food(tofu, thyroid_assessment)
    assert res_tofu.requires_dietitian_review is True
    assert any("drug_interaction" in r["type"] for r in res_tofu.reasons)


# -----------------------------------------------------------------------------
# 3. Portion Engine Tests
# -----------------------------------------------------------------------------
def test_portion_engine_bounds_and_snapping(food_db):
    engine = PortionEngine()
    red_rice = food_db.get_food("cereal_red_rice")

    # Portion for 300 kcal: 300 / 111 * 100 = 270.2g, snapped to step 25 within [50, 250] -> 250.0g
    portion = engine.calculate_single_food_portion_for_target(red_rice, 300.0)
    assert portion <= red_rice.serving.max_quantity
    assert portion >= red_rice.serving.min_quantity
    assert portion % red_rice.serving.step_size == 0


def test_scale_nutrition(food_db):
    moong = food_db.get_food("pulse_green_moong_dal")
    nutri_100 = moong.nutrition
    nutri_200 = scale_nutrition(moong, 200.0)

    assert round(nutri_200.calories, 1) == round(nutri_100.calories * 2.0, 1)
    assert round(nutri_200.protein_g, 1) == round(nutri_100.protein_g * 2.0, 1)


# -----------------------------------------------------------------------------
# 4. Meal Plan Builder & Assembly Tests
# -----------------------------------------------------------------------------
def test_meal_plan_builder_full_generation(sample_assessment):
    builder = MealBuilder()
    plan = builder.generate_plan(sample_assessment)

    assert plan.plan_status in ["validated", "needs_review"]
    assert len(plan.meals) == 4
    meal_types = [m.meal_type for m in plan.meals]
    assert meal_types == ["breakfast", "lunch", "evening_snack", "dinner"]

    # Check totals
    assert plan.daily_totals.calories > 1000
    assert plan.daily_totals.protein_g > 30

    # Ensure disliked bitter gourd was NOT selected in any meal
    for meal in plan.meals:
        for f in meal.foods:
            assert f.food_id != "veg_bitter_gourd"

    # Evidence sources should be populated
    assert len(plan.evidence) > 5


def test_custom_meal_structure_and_distribution(sample_assessment):
    builder = MealBuilder()
    custom_slots = ["breakfast", "lunch", "dinner"]
    custom_dist = {"breakfast": 0.30, "lunch": 0.40, "dinner": 0.30}

    plan = builder.generate_plan(
        assessment=sample_assessment,
        meal_structure=custom_slots,
        custom_meal_distribution=custom_dist,
    )

    assert len(plan.meals) == 3
    assert [m.meal_type for m in plan.meals] == ["breakfast", "lunch", "dinner"]


def test_diabetes_meal_plan_variety_and_validation():
    assessment = {
        "patient_id": "P-TEST-4",
        "assessment_id": "A-TEST-4",
        "age": 45,
        "sex": "female",
        "height": 160.0,
        "weight": 70.0,
        "activity_level": "moderately_active",
        "diet_category": "vegetarian",
        "diet_goal": "weight_maintenance",
        "existing_conditions": ["diabetes"],
        "food_allergies": [],
        "food_intolerances": [],
        "prakriti": "Kapha",
    }
    builder = MealBuilder()
    plan = builder.generate_plan(assessment=assessment)

    # Check that repetition penalty prevented excessive repeats
    all_food_ids = [f.food_id for meal in plan.meals for f in meal.foods]
    assert len(all_food_ids) == len(set(all_food_ids)), f"Duplicate foods found: {all_food_ids}"
    assert plan.validation.valid is True
    assert plan.target_comparison.within_target is True
    assert plan.plan_status == "validated"


# -----------------------------------------------------------------------------
# 5. Substitution Engine Tests
# -----------------------------------------------------------------------------
def test_substitution_engine(sample_assessment):
    sub_engine = SubstitutionEngine()
    subs = sub_engine.get_substitutions("cereal_whole_wheat_roti", 80.0, sample_assessment)

    assert len(subs) > 0
    # Replacement items should be other grains
    for opt in subs:
        assert opt.replacement_food.food_id != "cereal_whole_wheat_roti"
        assert opt.replacement_food.category in ["cereal_grain"]
        assert "calories" in opt.nutritional_delta
        assert opt.quantity >= opt.replacement_food.serving.min_quantity
        assert opt.quantity <= opt.replacement_food.serving.max_quantity


# -----------------------------------------------------------------------------
# 6. Plan Validator Tests
# -----------------------------------------------------------------------------
def test_plan_validator_detects_violations(food_db, sample_assessment):
    validator = PlanValidator()

    # Create dummy meal with allergen peanut
    dummy_food = food_db.get_food("cereal_red_rice")
    f_sel = scale_nutrition(dummy_food, 100.0)
    food_sel_res = {
        "food_id": "cereal_red_rice",
        "food_name": "Red Rice (Cooked)",
        "category": "cereal_grain",
        "quantity": 100.0,
        "unit": "g",
        "nutrition": f_sel,
        "selection_reason": "Test",
        "ayurvedic_alignment": "Test",
        "sources": [],
        "requires_dietitian_review": False,
        "review_notes": None,
    }

    from app.meal_planner.models import FoodSelectionResult
    meals = [
        MealPlanMeal(
            meal_id="meal_lunch",
            meal_type="lunch",
            target_calories=500.0,
            foods=[FoodSelectionResult(**food_sel_res)],
            totals={"calories": 111.0, "protein_g": 2.6, "carbohydrate_g": 23.5, "fat_g": 0.9, "fiber_g": 1.8},
        )
    ]
    daily_totals = DailyTotals(calories=111.0, protein_g=2.6, carbohydrate_g=23.5, fat_g=0.9, fiber_g=1.8)
    nutrition_targets = {"energy": {"target_energy_kcal_day": 1500.0}, "macros": {"protein_g_day": 50.0, "carbohydrate_g_day": 200.0, "fat_g_day": 40.0}}

    val_res, target_comp = validator.validate_plan(meals, daily_totals, nutrition_targets, sample_assessment)
    # Calorie variance (111 vs 1500) will trigger variance warning
    assert target_comp.within_target is False
    assert len(val_res.warnings) > 0


def test_validator_macro_invalid_plan_requires_dietitian_review(food_db, sample_assessment):
    """
    Regression Test: A deliberately macro-invalid plan must:
    - set valid == False
    - set within_target == False
    - set requires_dietitian_review == True
    - have non-empty review_reasons containing the nutritional variance warning
    """
    validator = PlanValidator()
    dummy_food = food_db.get_food("cereal_red_rice")
    f_sel = scale_nutrition(dummy_food, 100.0)
    food_sel_res = {
        "food_id": "cereal_red_rice",
        "food_name": "Red Rice (Cooked)",
        "category": "cereal_grain",
        "quantity": 100.0,
        "unit": "g",
        "nutrition": f_sel,
        "selection_reason": "Test",
        "ayurvedic_alignment": "Test",
        "sources": [],
        "requires_dietitian_review": False,
        "review_notes": None,
    }

    from app.meal_planner.models import FoodSelectionResult
    meals = [
        MealPlanMeal(
            meal_id="meal_lunch",
            meal_type="lunch",
            target_calories=500.0,
            foods=[FoodSelectionResult(**food_sel_res)],
            totals={"calories": 111.0, "protein_g": 2.6, "carbohydrate_g": 23.5, "fat_g": 0.9, "fiber_g": 1.8},
        )
    ]
    daily_totals = DailyTotals(calories=111.0, protein_g=2.6, carbohydrate_g=23.5, fat_g=0.9, fiber_g=1.8)
    nutrition_targets = {
        "energy": {"target_energy_kcal_day": 1500.0},
        "macros": {"protein_g_day": 50.0, "carbohydrate_g_day": 200.0, "fat_g_day": 40.0},
    }

    val_res, target_comp = validator.validate_plan(meals, daily_totals, nutrition_targets, sample_assessment)
    assert val_res.valid is False
    assert target_comp.within_target is False
    assert val_res.requires_dietitian_review is True
    assert len(val_res.review_reasons) > 0
    assert any("Nutritional variance" in r for r in val_res.review_reasons)



# -----------------------------------------------------------------------------
# 7. FastAPI Endpoint Integration Tests
# -----------------------------------------------------------------------------
def test_endpoint_get_foods():
    response = client.get("/api/meal-plan/foods")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 25


def test_endpoint_get_food_detail():
    response = client.get("/api/meal-plan/foods/cereal_red_rice")
    assert response.status_code == 200
    data = response.json()
    assert data["food_id"] == "cereal_red_rice"
    assert data["nutrition"]["calories"] == 111.0
    assert len(data["sources"]) > 0

    response_404 = client.get("/api/meal-plan/foods/nonexistent_food_xyz")
    assert response_404.status_code == 404


def test_endpoint_generate_meal_plan(sample_assessment):
    payload = {
        "patient_assessment": sample_assessment,
        "meal_structure": ["breakfast", "lunch", "dinner"],
    }
    response = client.post("/api/meal-plan/generate", json=payload)
    assert response.status_code == 200
    plan = response.json()
    assert "meals" in plan
    assert len(plan["meals"]) == 3
    assert plan["daily_totals"]["calories"] > 0
    assert "target_comparison" in plan
    assert "validation" in plan


def test_endpoint_substitutions(sample_assessment):
    payload = {
        "food_id": "pulse_green_moong_dal",
        "current_quantity": 150.0,
        "patient_assessment": sample_assessment,
    }
    response = client.post("/api/meal-plan/substitutions", json=payload)
    assert response.status_code == 200
    subs = response.json()
    assert isinstance(subs, list)
    assert len(subs) > 0
    assert subs[0]["replacement_food"]["category"] in ["pulse_legume", "dairy"]


# -----------------------------------------------------------------------------
# 8. Dairy-Intolerant Category Fallback Regression Test
# -----------------------------------------------------------------------------
def test_dairy_intolerant_vegetarian_fallback_selects_protein():
    """
    Regression Test: Vegetarian + Dairy-Intolerant patient.
    1. Dairy foods are completely ineligible/unavailable.
    2. Dairy slots in lunch/dinner fall back to protein-rich categories (pulse_legume / nut_seed).
    3. No duplicate foods in any meal or across candidate selection.
    4. Generated plan remains valid according to existing safety, macro, and portion rules.
    """
    assessment = {
        "patient_id": "P-TEST-INTOLERANT",
        "assessment_id": "A-TEST-INTOLERANT",
        "age": 30,
        "sex": "male",
        "height": 175.0,
        "weight": 70.0,
        "activity_level": "sedentary",
        "diet_category": "vegetarian",
        "diet_goal": "weight_maintenance",
        "existing_conditions": [],
        "food_allergies": ["tree_nuts"],
        "food_intolerances": ["dairy"],
        "prakriti": "Pitta-Kapha",
    }
    targets = {
        "energy": {"target_energy_kcal_day": 1550.0},
        "macros": {"protein_g_day": 65.0, "carbohydrate_g_day": 230.0, "fat_g_day": 40.0},
    }

    builder = MealBuilder()
    plan = builder.generate_plan(assessment=assessment, nutrition_targets=targets)

    # 1. Verify zero dairy foods in entire plan
    all_foods = [f for meal in plan.meals for f in meal.foods]
    assert all(f.category != "dairy" for f in all_foods), "Dairy foods found in lactose-intolerant plan"

    # 2. Verify each meal has no duplicate food IDs
    for meal in plan.meals:
        meal_food_ids = [f.food_id for f in meal.foods]
        assert len(meal_food_ids) == len(set(meal_food_ids)), f"Duplicate food found in {meal.meal_type}: {meal_food_ids}"

    # 3. Verify protein-rich fallback was selected in lunch & dinner (which include dairy slot)
    lunch = next(m for m in plan.meals if m.meal_type == "lunch")
    dinner = next(m for m in plan.meals if m.meal_type == "dinner")

    lunch_protein_items = [f for f in lunch.foods if f.category in ["pulse_legume", "nut_seed"]]
    dinner_protein_items = [f for f in dinner.foods if f.category in ["pulse_legume", "nut_seed"]]
    assert len(lunch_protein_items) >= 2, f"Expected >= 2 protein items in lunch (pulse + dairy fallback), got {len(lunch_protein_items)}"
    assert len(dinner_protein_items) >= 2, f"Expected >= 2 protein items in dinner (pulse + dairy fallback), got {len(dinner_protein_items)}"

    # 4. Plan safety and clinical validation rules
    assert plan.validation.valid is True
    assert len(plan.validation.errors) == 0
    assert plan.target_comparison.within_target is True
    assert plan.plan_status == "validated"
