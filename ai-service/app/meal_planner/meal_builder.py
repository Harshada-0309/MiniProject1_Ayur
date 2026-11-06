"""
Deterministic Meal Builder & Assembly Engine for AyurDiet Phase 5.
Combines patient assessment metrics, Phase 3 nutrition targets, and Phase 4
grounded knowledge to deterministically construct daily meal plans.
No LLM/Gemini is used for meal construction, scoring, or portions.
"""

from typing import Any, Dict, List, Optional
from ..nutrition import calculate_nutrition_targets
from .eligibility import FoodEligibilityEngine
from .food_db import get_food_db
from .models import (
    DailyTotals,
    FoodItem,
    FoodSelectionResult,
    MealPlanMeal,
    NutritionTargetComparison,
    PlanValidationResult,
    StructuredMealPlan,
)
from .portion_engine import PortionEngine
from .scoring import FoodScorer
from .validator import PlanValidator


DEFAULT_MEAL_DISTRIBUTION = {
    "breakfast": 0.25,
    "lunch": 0.35,
    "evening_snack": 0.10,
    "dinner": 0.30,
}

REPETITION_PENALTY = 25.0  # Exceeds clinical Pathya bonus (+15.0) to prevent repetitive mono-diet selection



class MealBuilder:
    """
    Constructs deterministic, balanced, Ayurvedic-aligned daily meal plans.
    """

    def __init__(self):
        self.food_db = get_food_db()
        self.eligibility_engine = FoodEligibilityEngine()
        self.scorer = FoodScorer()
        self.portion_engine = PortionEngine()
        self.validator = PlanValidator()

    def generate_plan(
        self,
        assessment: Dict[str, Any],
        nutrition_targets: Optional[Dict[str, Any]] = None,
        meal_structure: Optional[List[str]] = None,
        custom_meal_distribution: Optional[Dict[str, float]] = None,
        day_offset: int = 0,
    ) -> StructuredMealPlan:
        """
        Orchestrates full deterministic meal plan generation for a single day.
        """
        # 1. Resolve Phase 3 Nutrition Targets
        if not nutrition_targets:
            target_res = calculate_nutrition_targets(assessment)
            nutrition_targets = target_res.model_dump()

        target_cals = float(
            nutrition_targets.get("energy", {}).get("target_energy_kcal_day")
            or nutrition_targets.get("target_energy_kcal_day")
            or 2000.0
        )

        # 2. Determine Meal Slots & Calorie Distribution
        meal_slots = meal_structure or ["breakfast", "lunch", "evening_snack", "dinner"]
        distribution = custom_meal_distribution or {}
        active_dist: Dict[str, float] = {}

        # Normalize distribution for active meal slots
        raw_dist = {slot: distribution.get(slot, DEFAULT_MEAL_DISTRIBUTION.get(slot, 1.0 / len(meal_slots))) for slot in meal_slots}
        dist_sum = sum(raw_dist.values()) or 1.0
        for slot in meal_slots:
            active_dist[slot] = raw_dist[slot] / dist_sum

        # 3. Filter Eligible Foods
        all_foods = self.food_db.get_all_foods()
        eligible_foods: List[FoodItem] = []
        review_flags_by_food: Dict[str, Dict[str, Any]] = {}

        for food in all_foods:
            el_res = self.eligibility_engine.evaluate_food(food, assessment)
            if el_res.status != "ineligible":
                eligible_foods.append(food)
                if el_res.requires_dietitian_review:
                    review_flags_by_food[food.food_id] = {
                        "requires_review": True,
                        "notes": "; ".join(r["message"] for r in el_res.reasons),
                    }

        # 4. Build Each Meal
        constructed_meals: List[MealPlanMeal] = []
        used_food_ids: List[str] = []

        for slot in meal_slots:
            slot_target_cal = target_cals * active_dist[slot]
            meal = self._build_single_meal(
                slot=slot,
                target_calories=slot_target_cal,
                eligible_foods=eligible_foods,
                assessment=assessment,
                targets=nutrition_targets,
                review_flags=review_flags_by_food,
                used_foods=used_food_ids,
                day_offset=day_offset,
            )
            constructed_meals.append(meal)

            # Record used foods to encourage daily dietary variety
            for f in meal.foods:
                if f.food_id not in used_food_ids:
                    used_food_ids.append(f.food_id)

        # 4b. Multi-Macro Discrete Optimization across Daily Meals
        constructed_meals = self.portion_engine.optimize_daily_macro_portions(
            meals=constructed_meals,
            nutrition_targets=nutrition_targets,
            food_db=self.food_db,
        )

        # 5. Compute Daily Totals
        daily_totals = DailyTotals(
            calories=round(sum(m.totals.get("calories", 0.0) for m in constructed_meals), 1),
            protein_g=round(sum(m.totals.get("protein_g", 0.0) for m in constructed_meals), 1),
            carbohydrate_g=round(sum(m.totals.get("carbohydrate_g", 0.0) for m in constructed_meals), 1),
            fat_g=round(sum(m.totals.get("fat_g", 0.0) for m in constructed_meals), 1),
            fiber_g=round(sum(m.totals.get("fiber_g", 0.0) for m in constructed_meals), 1),
        )

        # 6. Validate Plan
        val_result, target_comp = self.validator.validate_plan(
            meals=constructed_meals,
            daily_totals=daily_totals,
            nutrition_targets=nutrition_targets,
            assessment=assessment,
        )

        # 7. Collect Evidence Provenance
        evidence_list: List[Dict[str, Any]] = []
        seen_evidence = set()
        for m in constructed_meals:
            for food_sel in m.foods:
                for src in food_sel.sources:
                    key = (src.document, src.page)
                    if key not in seen_evidence:
                        seen_evidence.add(key)
                        evidence_list.append(src.model_dump())

        # Determine overall plan status
        status = "validated" if (val_result.valid and not val_result.requires_dietitian_review) else "needs_review"

        return StructuredMealPlan(
            patient_id=assessment.get("patient_id"),
            assessment_id=assessment.get("assessment_id"),
            plan_status=status,
            nutrition_targets=nutrition_targets,
            meals=constructed_meals,
            daily_totals=daily_totals,
            target_comparison=target_comp,
            validation=val_result,
            evidence=evidence_list,
            requires_dietitian_review=val_result.requires_dietitian_review,
            review_reasons=val_result.review_reasons,
        )

    def _build_single_meal(
        self,
        slot: str,
        target_calories: float,
        eligible_foods: List[FoodItem],
        assessment: Dict[str, Any],
        targets: Dict[str, Any],
        review_flags: Dict[str, Dict[str, Any]],
        used_foods: Optional[List[str]] = None,
        used_grains: Optional[List[str]] = None,
        used_pulses: Optional[List[str]] = None,
        day_offset: int = 0,
    ) -> MealPlanMeal:
        """
        Selects balanced complementary items for a meal and solves portion sizing.
        """
        # Determine required category composition per meal slot
        slot_categories = self._get_slot_categories(slot)

        candidate_items: List[Dict[str, Any]] = []
        previously_used = set(used_foods or []) | set(used_grains or []) | set(used_pulses or [])

        for cat in slot_categories:
            meal_food_ids = {c["food"].food_id for c in candidate_items}
            pool = [f for f in eligible_foods if f.category == cat and f.food_id not in meal_food_ids]
            if not pool:
                # If specific category empty (e.g. no dairy), prioritize protein-rich alternatives
                if cat == "dairy":
                    for fallback_cat in ["pulse_legume", "nut_seed"]:
                        fallback_pool = [
                            f for f in eligible_foods
                            if f.category == fallback_cat and f.food_id not in meal_food_ids
                        ]
                        if fallback_pool:
                            pool = fallback_pool
                            break
                    if not pool:
                        pool = [
                            f for f in eligible_foods
                            if f.category in ["nut_seed", "vegetable", "fruit"]
                            and f.food_id not in meal_food_ids
                        ]
                elif cat == "pulse_legume":
                    for fallback_cat in ["dairy", "nut_seed", "vegetable"]:
                        fallback_pool = [
                            f for f in eligible_foods
                            if f.category == fallback_cat and f.food_id not in meal_food_ids
                        ]
                        if fallback_pool:
                            pool = fallback_pool
                            break

            if not pool:
                continue

            # Score each candidate in the category
            scored_pool = []
            for food in pool:
                score, reason, ayur_note = self.scorer.score_food(food, assessment, targets, slot)
                # Penalize already used foods within the day to promote variety and avoid mono-diet macro lock
                if food.food_id in previously_used:
                    score -= REPETITION_PENALTY
                scored_pool.append((score, food, reason, ayur_note))

            # Pick highest scoring item (or rotate across close contenders for multi-day variety)
            scored_pool.sort(key=lambda x: x[0], reverse=True)
            if day_offset > 0 and len(scored_pool) > 1:
                # Consider candidates within 12 points of the top score for balanced daily rotation
                top_cutoff = scored_pool[0][0] - 12.0
                contenders = [item for item in scored_pool if item[0] >= top_cutoff]
                pick_idx = day_offset % len(contenders)
                best_score, best_food, best_reason, best_ayur = contenders[pick_idx]
            else:
                best_score, best_food, best_reason, best_ayur = scored_pool[0]

            rev_info = review_flags.get(best_food.food_id, {})
            candidate_items.append({
                "food": best_food,
                "score": best_score,
                "selection_reason": best_reason,
                "ayurvedic_alignment": best_ayur,
                "requires_review": rev_info.get("requires_review", False),
                "review_notes": rev_info.get("notes"),
            })

        # Calculate exact portions
        selected_foods = self.portion_engine.calculate_meal_portions(
            candidate_items=candidate_items,
            target_calories=target_calories,
            meal_type=slot,
        )

        # Calculate meal totals
        meal_cals = round(sum(f.nutrition.calories for f in selected_foods), 1)
        meal_prot = round(sum(f.nutrition.protein_g for f in selected_foods), 1)
        meal_carb = round(sum(f.nutrition.carbohydrate_g for f in selected_foods), 1)
        meal_fat = round(sum(f.nutrition.fat_g for f in selected_foods), 1)
        meal_fiber = round(sum(f.nutrition.fiber_g for f in selected_foods), 1)

        totals = {
            "calories": meal_cals,
            "protein_g": meal_prot,
            "carbohydrate_g": meal_carb,
            "fat_g": meal_fat,
            "fiber_g": meal_fiber,
        }

        return MealPlanMeal(
            meal_id=f"meal_{slot}",
            meal_type=slot,
            target_calories=round(target_calories, 1),
            foods=selected_foods,
            totals=totals,
        )

    def _get_slot_categories(self, slot: str) -> List[str]:
        """
        Defines classic balanced Indian meal composition patterns.
        """
        if slot == "breakfast":
            return ["cereal_grain", "fruit", "nut_seed"]
        elif slot in ["lunch", "dinner"]:
            return ["cereal_grain", "pulse_legume", "vegetable", "dairy", "spice_herb"]
        elif slot in ["evening_snack", "mid_morning"]:
            return ["fruit", "nut_seed", "spice_herb"]
        else:
            return ["cereal_grain", "vegetable"]

    def generate_7day_plan(
        self,
        assessment: Dict[str, Any],
        nutrition_targets: Optional[Dict[str, Any]] = None,
        meal_structure: Optional[List[str]] = None,
        custom_meal_distribution: Optional[Dict[str, float]] = None,
    ) -> List[StructuredMealPlan]:
        """
        Generates 7 distinct, deterministically rotated daily meal plans.
        Each day respects dosha, allergen, and macro limits while introducing
        nutritional variety across grains, pulses, and vegetables.
        """
        days: List[StructuredMealPlan] = []
        for day_idx in range(7):
            day_plan = self.generate_plan(
                assessment=assessment,
                nutrition_targets=nutrition_targets,
                meal_structure=meal_structure,
                custom_meal_distribution=custom_meal_distribution,
                day_offset=day_idx,
            )
            days.append(day_plan)
        return days
