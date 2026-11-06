"""
Deterministic Meal Plan Validator for AyurDiet Phase 5.
Validates safety (allergens, clinical contraindications, drug interactions),
portion bounds, macronutrient tolerances, and evidence completeness.
"""

from typing import Any, Dict, List, Tuple
from .eligibility import FoodEligibilityEngine
from .food_db import get_food_db
from .models import (
    DailyTotals,
    FoodSelectionResult,
    MealPlanMeal,
    NutritionTargetComparison,
    PlanValidationResult,
)


class PlanValidator:
    """
    Evaluates complete meal plans against safety constraints, nutritional targets, and clinical rules.
    """

    DEFAULT_TOLERANCES = {
        "calories": 7.5,
        "protein": 10.0,
        "carbohydrate": 10.0,
        "fat": 10.0,
    }

    def __init__(self):
        self.food_db = get_food_db()
        self.eligibility_engine = FoodEligibilityEngine()

    def validate_plan(
        self,
        meals: List[MealPlanMeal],
        daily_totals: DailyTotals,
        nutrition_targets: Dict[str, Any],
        assessment: Dict[str, Any],
    ) -> Tuple[PlanValidationResult, NutritionTargetComparison]:
        """
        Executes comprehensive validation and returns diagnostic results and target comparisons.
        """
        errors: List[str] = []
        warnings: List[str] = []
        review_reasons: List[str] = []
        requires_review = False

        # 1. Safety Checks (Allergens, Contraindications, Drug interactions)
        for meal in meals:
            for food_sel in meal.foods:
                food_item = self.food_db.get_food(food_sel.food_id)
                if not food_item:
                    warnings.append(f"Food item {food_sel.food_id} not found in database catalog")
                    continue

                # Run eligibility engine check
                el_res = self.eligibility_engine.evaluate_food(food_item, assessment)
                if el_res.status == "ineligible":
                    reasons_str = "; ".join(r["message"] for r in el_res.reasons)
                    errors.append(
                        f"Safety violation in {meal.meal_type}: Food '{food_item.food_name}' is ineligible ({reasons_str})"
                    )

                if el_res.requires_dietitian_review:
                    requires_review = True
                    for r in el_res.reasons:
                        if r not in review_reasons:
                            review_reasons.append(f"{food_item.food_name}: {r['message']}")

                # Portion bounds check
                if food_sel.quantity < food_item.serving.min_quantity:
                    warnings.append(
                        f"Portion warning: '{food_item.food_name}' in {meal.meal_type} ({food_sel.quantity}{food_sel.unit}) "
                        f"is below minimum recommended serving ({food_item.serving.min_quantity}{food_item.serving.unit})"
                    )
                elif food_sel.quantity > food_item.serving.max_quantity:
                    warnings.append(
                        f"Portion warning: '{food_item.food_name}' in {meal.meal_type} ({food_sel.quantity}{food_sel.unit}) "
                        f"exceeds maximum recommended serving ({food_item.serving.max_quantity}{food_item.serving.unit})"
                    )

                # Flag review if food selection itself requested review
                if food_sel.requires_dietitian_review:
                    requires_review = True
                    if food_sel.review_notes and food_sel.review_notes not in review_reasons:
                        review_reasons.append(f"{food_sel.food_name}: {food_sel.review_notes}")

        # 2. Extract Phase 3 Targets
        target_calories = (
            nutrition_targets.get("energy", {}).get("target_energy_kcal_day")
            or nutrition_targets.get("target_energy_kcal_day")
            or 2000.0
        )
        target_protein = (
            nutrition_targets.get("macros", {}).get("protein_g_day")
            or nutrition_targets.get("protein_g_day")
            or 60.0
        )
        target_carbs = (
            nutrition_targets.get("macros", {}).get("carbohydrate_g_day")
            or nutrition_targets.get("carbohydrate_g_day")
            or 250.0
        )
        target_fat = (
            nutrition_targets.get("macros", {}).get("fat_g_day")
            or nutrition_targets.get("fat_g_day")
            or 50.0
        )

        targets_dict = {
            "calories": round(float(target_calories), 1),
            "protein": round(float(target_protein), 1),
            "carbohydrate": round(float(target_carbs), 1),
            "fat": round(float(target_fat), 1),
        }
        actual_dict = {
            "calories": round(daily_totals.calories, 1),
            "protein": round(daily_totals.protein_g, 1),
            "carbohydrate": round(daily_totals.carbohydrate_g, 1),
            "fat": round(daily_totals.fat_g, 1),
        }
        diff_dict = {
            k: round(actual_dict[k] - targets_dict[k], 1) for k in targets_dict
        }

        # 3. Verify Nutritional Tolerances
        within_tolerance = True
        for metric, tol_pct in self.DEFAULT_TOLERANCES.items():
            tgt = targets_dict[metric]
            act = actual_dict[metric]
            if tgt > 0:
                pct_err = abs(act - tgt) / tgt * 100.0
                if pct_err > tol_pct:
                    within_tolerance = False
                    warnings.append(
                        f"Nutritional variance: Actual {metric} ({act}) deviates by {pct_err:.1f}% from target ({tgt}), "
                        f"exceeding standard tolerance limit of ±{tol_pct}%"
                    )

        # 4. Construct Target Comparison
        target_comparison = NutritionTargetComparison(
            targets=targets_dict,
            actual=actual_dict,
            difference=diff_dict,
            within_target=within_tolerance,
            tolerances_pct=self.DEFAULT_TOLERANCES,
        )

        is_valid = len(errors) == 0 and within_tolerance

        # If nutritional validation fails or errors exist, mandate dietitian review
        if not within_tolerance:
            requires_review = True
            for w in warnings:
                if "Nutritional variance" in w and w not in review_reasons:
                    review_reasons.append(w)

        if errors:
            requires_review = True
            for err in errors:
                if err not in review_reasons:
                    review_reasons.append(err)

        validation_result = PlanValidationResult(
            valid=is_valid,
            warnings=warnings,
            errors=errors,
            requires_dietitian_review=requires_review,
            review_reasons=review_reasons,
        )

        return validation_result, target_comparison
