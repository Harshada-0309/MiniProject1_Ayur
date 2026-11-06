"""
Deterministic Nutrition Calculation Engine.
Orchestrates validated mathematical formulas for BMI, BMR, TDEE, goal-adjusted calories,
macronutrients, fiber, and hydration with complete explainability.
"""

from typing import Dict, Any, List
from .constants import (
    BMI_CATEGORIES,
    BMR_FORMULA_NAME,
    BMR_WEIGHT_COEFF,
    BMR_HEIGHT_COEFF,
    BMR_AGE_COEFF,
    BMR_MALE_CONSTANT,
    BMR_FEMALE_CONSTANT,
    ACTIVITY_MULTIPLIERS,
    KCAL_PER_G_PROTEIN,
    KCAL_PER_G_CARB,
    KCAL_PER_G_FAT,
    DEFAULT_FAT_ENERGY_PERCENTAGE,
    FIBER_GRAMS_PER_1000_KCAL,
    FIBER_MINIMUM_DAILY_GRAMS,
    WATER_ML_PER_KG,
    WATER_MINIMUM_DAILY_ML,
)
from .validators import validate_assessment_input
from .rules.goal_rules import calculate_goal_adjusted_energy, determine_protein_factor
from .rules.ayurvedic_rules import extract_ayurvedic_profile, check_condition_specific
from .models import (
    NutritionTargetResponse,
    AnthropometricsOutput,
    EnergyOutput,
    MacrosOutput,
    OtherTargetsOutput,
    AyurvedicProfileOutput,
    CalculationMetadata,
)


def calculate_bmi(weight_kg: float, height_cm: float) -> tuple[float, str]:
    """
    Calculate Body Mass Index deterministically:
    BMI = weight (kg) / (height (m))^2
    """
    height_m = height_cm / 100.0
    bmi_raw = weight_kg / (height_m * height_m)
    bmi = round(bmi_raw, 2)

    status = "Normal weight"
    for min_val, max_val, label in BMI_CATEGORIES:
        if min_val <= bmi < max_val:
            status = label
            break

    return bmi, status


def calculate_bmr(weight_kg: float, height_cm: float, age_years: int, sex: str) -> float:
    """
    Calculates Basal Metabolic Rate using the Mifflin-St Jeor equation:
    Men:   (10 × weight_kg) + (6.25 × height_cm) - (5 × age) + 5
    Women: (10 × weight_kg) + (6.25 × height_cm) - (5 × age) - 161
    Other: Average constant (-78)
    """
    s = sex.strip().lower()
    if s == "male":
        sex_const = BMR_MALE_CONSTANT
    elif s == "female":
        sex_const = BMR_FEMALE_CONSTANT
    else:
        # Standard mid-point for unspecified/other sex
        sex_const = (BMR_MALE_CONSTANT + BMR_FEMALE_CONSTANT) / 2.0

    bmr = (
        (BMR_WEIGHT_COEFF * weight_kg)
        + (BMR_HEIGHT_COEFF * height_cm)
        + (BMR_AGE_COEFF * age_years)
        + sex_const
    )
    return round(bmr, 1)


def calculate_nutrition_targets(data: Dict[str, Any]) -> NutritionTargetResponse:
    """
    Main deterministic engine workflow:
    Validates patient assessment data and computes reproducible nutritional targets.
    """
    # 1. Validation
    validate_assessment_input(data)

    age = int(data["age"])
    sex = str(data["sex"]).strip().lower()
    height_cm = float(data["height"])
    weight_kg = float(data["weight"])
    activity_level = str(data.get("activity_level", "sedentary")).strip().lower()
    diet_goal = str(data["diet_goal"]).strip().lower()
    waist_cm = float(data["waist_circumference"]) if data.get("waist_circumference") else None
    weight_trend = str(data.get("weight_trend", "stable"))

    warnings: List[str] = []

    # 2. BMI
    bmi, bmi_status = calculate_bmi(weight_kg, height_cm)

    # 3. BMR (Mifflin-St Jeor)
    bmr_kcal = calculate_bmr(weight_kg, height_cm, age, sex)

    # 4. Activity Multiplier & TDEE
    multiplier = ACTIVITY_MULTIPLIERS.get(activity_level, 1.2)
    tdee_raw = bmr_kcal * multiplier
    tdee_kcal = round(tdee_raw, 1)

    # 5. Goal Adjustment & Target Energy
    target_energy, adj_kcal, adj_method, floor_warning = calculate_goal_adjusted_energy(
        tdee_kcal, diet_goal, sex
    )
    if floor_warning:
        warnings.append(floor_warning)

    # 6. Protein Target
    protein_factor, protein_method = determine_protein_factor(diet_goal, activity_level)
    protein_g = round(weight_kg * protein_factor, 1)
    protein_kcal = round(protein_g * KCAL_PER_G_PROTEIN, 1)
    protein_pct = round((protein_kcal / target_energy) * 100.0, 1)

    # 7. Fat & Carbohydrate Targets (Caloric Consistency)
    # Fat: 25% of target energy
    fat_kcal = round(target_energy * DEFAULT_FAT_ENERGY_PERCENTAGE, 1)
    fat_g = round(fat_kcal / KCAL_PER_G_FAT, 1)
    fat_pct = round((fat_kcal / target_energy) * 100.0, 1)

    # Carbohydrate: exact remainder to ensure zero caloric mismatch
    carb_kcal = round(target_energy - protein_kcal - fat_kcal, 1)
    carb_g = round(carb_kcal / KCAL_PER_G_CARB, 1)
    carb_pct = round((carb_kcal / target_energy) * 100.0, 1)

    total_macro_kcal = round(protein_kcal + fat_kcal + carb_kcal, 1)

    # 8. Fiber Target
    fiber_raw = (target_energy / 1000.0) * FIBER_GRAMS_PER_1000_KCAL
    fiber_g = round(max(FIBER_MINIMUM_DAILY_GRAMS, fiber_raw), 1)
    fiber_method = (
        f"14 g per 1,000 kcal energy target ({round(fiber_raw, 1)} g) with "
        f"{round(FIBER_MINIMUM_DAILY_GRAMS)} g/day clinical minimum floor"
    )

    # 9. Hydration Target
    water_raw = weight_kg * WATER_ML_PER_KG
    water_ml = float(round(max(WATER_MINIMUM_DAILY_ML, water_raw)))
    water_method = (
        f"35 ml/kg physiological baseline ({round(water_raw)} ml) with "
        f"{round(WATER_MINIMUM_DAILY_ML)} ml/day minimum floor"
    )

    # 10. Ayurvedic Rule Layer
    ayurvedic_profile = extract_ayurvedic_profile(data)

    # 11. Condition-Specific Data Check
    has_condition, req_knowledge, identified_conds = check_condition_specific(data)
    if has_condition:
        warnings.append(
            f"Assessment notes clinical conditions ({', '.join(identified_conds) or 'clinical history'}). "
            f"Specialized clinical and contraindication guidance requires knowledge-grounded retrieval."
        )

    # 12. Explainability & Metadata
    formulas_used = [
        "BMI: weight (kg) / (height (m))^2",
        "BMR: Mifflin-St Jeor equation (Am J Clin Nutr 1990; 51:241-247)",
        f"TDEE: BMR ({bmr_kcal} kcal) × PAL multiplier ({multiplier})",
        f"Target Energy: TDEE ({tdee_kcal} kcal) + Goal adjustment ({adj_kcal:+.0f} kcal)",
        f"Protein: Body Weight ({weight_kg} kg) × {protein_factor} g/kg/day = {protein_g} g ({protein_kcal} kcal)",
        f"Fat: {int(DEFAULT_FAT_ENERGY_PERCENTAGE*100)}% of Target Energy = {fat_kcal} kcal ({fat_g} g)",
        f"Carbohydrate: Target Energy - (Protein kcal + Fat kcal) = {carb_kcal} kcal ({carb_g} g)",
        f"Fiber: 14 g / 1,000 kcal Target Energy = {fiber_g} g/day",
        f"Hydration: 35 ml / kg Body Weight = {water_ml} ml/day",
    ]

    assumptions = [
        "Resting metabolic rate estimated via validated Mifflin-St Jeor regression equation.",
        "Total daily energy expenditure depends on age, body size, biological sex, metabolic rate, and physical activity.",
        "Calorie and macronutrient values represent planning estimates for clinician customization, not rigid medical prescriptions.",
        "Ayurvedic constitutional attributes define qualitative diet personalization (Guna, Rasa, digestion), not caloric values.",
    ]

    disclaimer = (
        "AyurDiet Nutrition Engine provides deterministic calculations to support professional dietitians. "
        "It does not diagnose medical conditions, prescribe medication, or replace clinical judgment."
    )

    return NutritionTargetResponse(
        patient_id=data.get("patient_id"),
        assessment_id=data.get("assessment_id"),
        anthropometrics=AnthropometricsOutput(
            height_cm=height_cm,
            weight_kg=weight_kg,
            bmi=bmi,
            bmi_status=bmi_status,
            waist_circumference_cm=waist_cm,
            weight_trend=weight_trend,
        ),
        energy=EnergyOutput(
            bmr_kcal_day=bmr_kcal,
            formula=BMR_FORMULA_NAME,
            activity_level=activity_level,
            activity_multiplier=multiplier,
            tdee_kcal_day=tdee_kcal,
            goal=diet_goal,
            target_energy_kcal_day=target_energy,
            adjustment_kcal_day=adj_kcal,
            adjustment_method=adj_method,
        ),
        macros=MacrosOutput(
            protein_g_day=protein_g,
            protein_kcal_day=protein_kcal,
            protein_pct=protein_pct,
            protein_factor_g_kg=protein_factor,
            protein_method=protein_method,
            carbohydrate_g_day=carb_g,
            carbohydrate_kcal_day=carb_kcal,
            carbohydrate_pct=carb_pct,
            fat_g_day=fat_g,
            fat_kcal_day=fat_kcal,
            fat_pct=fat_pct,
            total_macro_kcal=total_macro_kcal,
        ),
        other_targets=OtherTargetsOutput(
            fiber_g_day=fiber_g,
            fiber_method=fiber_method,
            water_ml_day=water_ml,
            water_method=water_method,
        ),
        ayurvedic_profile=AyurvedicProfileOutput(**ayurvedic_profile),
        calculation_metadata=CalculationMetadata(
            formulas_used=formulas_used,
            assumptions=assumptions,
            warnings=warnings,
            disclaimer=disclaimer,
        ),
        condition_specific=has_condition,
        requires_knowledge_grounded_guidance=req_knowledge,
    )
