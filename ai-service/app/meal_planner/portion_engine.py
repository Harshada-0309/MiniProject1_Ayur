"""
Deterministic Portion Calculation Engine for AyurDiet Phase 5.
Calculates clinically reasonable, discrete gram/ml servings matching meal targets
within food-specific minimum and maximum portion boundaries.
"""

from typing import Any, Dict, List, Optional
from .models import (
    FoodItem,
    FoodSelectionResult,
    MealPlanMeal,
    NutritionProfile,
    SourceProvenance,
)


def scale_nutrition(food: FoodItem, quantity: float) -> NutritionProfile:
    """
    Computes scaled nutritional values for a specific portion quantity.
    Grounded strictly in the 100g IFCT reference basis.
    """
    factor = quantity / 100.0
    return NutritionProfile(
        basis=f"{quantity:.0f}{food.serving.unit}",
        calories=round(food.nutrition.calories * factor, 1),
        protein_g=round(food.nutrition.protein_g * factor, 1),
        carbohydrate_g=round(food.nutrition.carbohydrate_g * factor, 1),
        fat_g=round(food.nutrition.fat_g * factor, 1),
        fiber_g=round(food.nutrition.fiber_g * factor, 1),
    )


class PortionEngine:
    """
    Solves discrete, practical food portions for a meal to hit target calories and macros.
    """

    def calculate_meal_portions(
        self,
        candidate_items: List[Dict[str, any]],
        target_calories: float,
        meal_type: str,
    ) -> List[FoodSelectionResult]:
        """
        Determines portion quantities for candidate items in a meal.
        candidate_items is a list of dicts:
          {
            "food": FoodItem,
            "score": float,
            "selection_reason": str,
            "ayurvedic_alignment": str,
            "requires_review": bool,
            "review_notes": Optional[str]
          }
        """
        if not candidate_items:
            return []

        # 1. Initialize each food with its default serving, snapped to step size
        current_quantities: Dict[str, float] = {}
        is_scalable: Dict[str, bool] = {}

        for item in candidate_items:
            f: FoodItem = item["food"]
            # Spices and concentrated fats have fixed small therapeutic portions
            if f.category in ["spice_herb", "oil_fat"] or f.serving.max_quantity <= 15.0:
                qty = f.serving.default_quantity
                is_scalable[f.food_id] = False
            else:
                qty = f.serving.default_quantity
                is_scalable[f.food_id] = True

            qty = self._snap_quantity(qty, f.serving.min_quantity, f.serving.max_quantity, f.serving.step_size)
            current_quantities[f.food_id] = qty

        # 2. Iteratively adjust scalable portions towards target_calories
        if target_calories > 0:
            for _ in range(5):
                total_cals = sum(
                    (current_quantities[item["food"].food_id] / 100.0) * item["food"].nutrition.calories
                    for item in candidate_items
                )
                if abs(total_cals - target_calories) <= 15.0 or total_cals == 0:
                    break

                ratio = target_calories / total_cals
                for item in candidate_items:
                    f = item["food"]
                    if not is_scalable[f.food_id]:
                        continue
                    new_q = current_quantities[f.food_id] * ratio
                    current_quantities[f.food_id] = self._snap_quantity(
                        new_q, f.serving.min_quantity, f.serving.max_quantity, f.serving.step_size
                    )

            # Fine tune with step adjustments on main staples
            current_quantities = self._fine_tune_quantities(
                candidate_items, current_quantities, is_scalable, target_calories
            )

        # 3. Build FoodSelectionResult objects
        results: List[FoodSelectionResult] = []
        for item in candidate_items:
            f = item["food"]
            qty = current_quantities[f.food_id]
            scaled_nutri = scale_nutrition(f, qty)

            results.append(
                FoodSelectionResult(
                    food_id=f.food_id,
                    food_name=f.food_name,
                    category=f.category,
                    quantity=qty,
                    unit=f.serving.unit,
                    nutrition=scaled_nutri,
                    selection_reason=item["selection_reason"],
                    ayurvedic_alignment=item["ayurvedic_alignment"],
                    sources=f.sources,
                    requires_dietitian_review=item.get("requires_review", False),
                    review_notes=item.get("review_notes"),
                )
            )

        return results

    def calculate_single_food_portion_for_target(
        self,
        food: FoodItem,
        target_calories: float,
    ) -> float:
        """
        Calculates the discrete portion of a single food item required to yield target_calories.
        """
        if food.nutrition.calories <= 0:
            return food.serving.default_quantity

        raw_qty = (target_calories / food.nutrition.calories) * 100.0
        return self._snap_quantity(
            raw_qty, food.serving.min_quantity, food.serving.max_quantity, food.serving.step_size
        )

    def _snap_quantity(
        self,
        quantity: float,
        min_q: float,
        max_q: float,
        step: float,
    ) -> float:
        """
        Rounds quantity to nearest step size and clamps within [min_q, max_q].
        """
        if step <= 0:
            step = 10.0
        snapped = round(quantity / step) * step
        if snapped < min_q:
            snapped = min_q
        elif snapped > max_q:
            snapped = max_q
        return round(snapped, 1)

    def _fine_tune_quantities(
        self,
        candidate_items: List[Dict[str, any]],
        quantities: Dict[str, float],
        is_scalable: Dict[str, bool],
        target_calories: float,
    ) -> Dict[str, float]:
        """
        Nudges scalable items by single steps to minimize calorie variance.
        """
        total_cals = sum(
            (quantities[item["food"].food_id] / 100.0) * item["food"].nutrition.calories
            for item in candidate_items
        )
        diff = target_calories - total_cals

        # Pick primary scalable item (e.g. cereal_grain or pulse_legume)
        primary_item = None
        for item in candidate_items:
            f = item["food"]
            if is_scalable.get(f.food_id, False) and f.category in ["cereal_grain", "pulse_legume"]:
                primary_item = f
                break

        if not primary_item:
            # Fallback to any scalable item
            for item in candidate_items:
                f = item["food"]
                if is_scalable.get(f.food_id, False):
                    primary_item = f
                    break

        if primary_item:
            cal_per_step = (primary_item.serving.step_size / 100.0) * primary_item.nutrition.calories
            if cal_per_step > 0:
                steps_needed = round(diff / cal_per_step)
                if steps_needed != 0:
                    cand_q = quantities[primary_item.food_id] + (steps_needed * primary_item.serving.step_size)
                    quantities[primary_item.food_id] = self._snap_quantity(
                        cand_q,
                        primary_item.serving.min_quantity,
                        primary_item.serving.max_quantity,
                        primary_item.serving.step_size,
                    )

        return quantities

    def optimize_daily_macro_portions(
        self,
        meals: List[MealPlanMeal],
        nutrition_targets: Dict[str, Any],
        food_db: Optional[Any] = None,
    ) -> List[MealPlanMeal]:
        """
        Deterministically fine-tunes portion sizes across all meals in the day
        to balance calories, protein, carbohydrates, and fat within tolerances.
        """
        if not meals or not nutrition_targets:
            return meals

        if food_db is None:
            from .food_db import get_food_db
            food_db = get_food_db()

        tgt_cal = float(
            nutrition_targets.get("energy", {}).get("target_energy_kcal_day")
            or nutrition_targets.get("target_energy_kcal_day")
            or 2000.0
        )
        tgt_p = float(
            nutrition_targets.get("macros", {}).get("protein_g_day")
            or nutrition_targets.get("protein_g_day")
            or 60.0
        )
        tgt_c = float(
            nutrition_targets.get("macros", {}).get("carbohydrate_g_day")
            or nutrition_targets.get("carbohydrate_g_day")
            or 250.0
        )
        tgt_f = float(
            nutrition_targets.get("macros", {}).get("fat_g_day")
            or nutrition_targets.get("fat_g_day")
            or 50.0
        )

        # Collect scalable food instances across all meals
        items: List[Dict[str, Any]] = []
        for m in meals:
            for f in m.foods:
                f_obj = food_db.get_food(f.food_id)
                if not f_obj:
                    continue
                is_scalable = (
                    f_obj.category not in ["spice_herb", "oil_fat"]
                    and f_obj.serving.max_quantity > 15.0
                )
                items.append({
                    "meal_id": m.meal_id,
                    "food_id": f.food_id,
                    "f_obj": f_obj,
                    "qty": f.quantity,
                    "min": f_obj.serving.min_quantity,
                    "max": f_obj.serving.max_quantity,
                    "step": f_obj.serving.step_size,
                    "scalable": is_scalable,
                })

        def _calc_loss(items_list: List[Dict[str, Any]]) -> float:
            cals = sum(it["qty"] / 100.0 * it["f_obj"].nutrition.calories for it in items_list)
            p = sum(it["qty"] / 100.0 * it["f_obj"].nutrition.protein_g for it in items_list)
            c = sum(it["qty"] / 100.0 * it["f_obj"].nutrition.carbohydrate_g for it in items_list)
            fat = sum(it["qty"] / 100.0 * it["f_obj"].nutrition.fat_g for it in items_list)

            dev_cal = abs(cals - tgt_cal) / tgt_cal if tgt_cal > 0 else 0.0
            dev_p = abs(p - tgt_p) / tgt_p if tgt_p > 0 else 0.0
            dev_c = abs(c - tgt_c) / tgt_c if tgt_c > 0 else 0.0
            dev_f = abs(fat - tgt_f) / tgt_f if tgt_f > 0 else 0.0

            # Tolerances: cal: 7.5%, p: 10%, c: 10%, f: 10%
            # Penalize metric violations exceeding clinical tolerance limits
            loss = 0.0
            loss += (max(0.0, dev_cal - 0.075) * 100.0) ** 2 + dev_cal ** 2 * 2.0
            loss += (max(0.0, dev_p - 0.10) * 100.0) ** 2 + dev_p ** 2 * 3.0
            loss += (max(0.0, dev_c - 0.10) * 100.0) ** 2 + dev_c ** 2 * 2.0
            loss += (max(0.0, dev_f - 0.10) * 100.0) ** 2 + dev_f ** 2 * 2.0
            return loss

        best_loss = _calc_loss(items)

        # Greedy discrete step optimization
        for _ in range(60):
            improved = False

            # 1. Single-item discrete nudges
            for i in range(len(items)):
                if not items[i]["scalable"]:
                    continue
                step = items[i]["step"]
                # Try +step
                if items[i]["qty"] + step <= items[i]["max"]:
                    items[i]["qty"] += step
                    cur_loss = _calc_loss(items)
                    if cur_loss < best_loss - 1e-5:
                        best_loss = cur_loss
                        improved = True
                        continue
                    items[i]["qty"] -= step

                # Try -step
                if items[i]["qty"] - step >= items[i]["min"]:
                    items[i]["qty"] -= step
                    cur_loss = _calc_loss(items)
                    if cur_loss < best_loss - 1e-5:
                        best_loss = cur_loss
                        improved = True
                        continue
                    items[i]["qty"] += step

            # 2. Within-meal pairwise swaps (e.g. increase protein/fat while reducing excess grain carbs)
            for i in range(len(items)):
                if not items[i]["scalable"]:
                    continue
                for j in range(len(items)):
                    if i == j or not items[j]["scalable"] or items[i]["meal_id"] != items[j]["meal_id"]:
                        continue
                    step_i = items[i]["step"]
                    step_j = items[j]["step"]
                    if items[i]["qty"] + step_i <= items[i]["max"] and items[j]["qty"] - step_j >= items[j]["min"]:
                        items[i]["qty"] += step_i
                        items[j]["qty"] -= step_j
                        cur_loss = _calc_loss(items)
                        if cur_loss < best_loss - 1e-5:
                            best_loss = cur_loss
                            improved = True
                            continue
                        items[i]["qty"] -= step_i
                        items[j]["qty"] += step_j

            if not improved:
                break

        # Reconstruct updated meals with scaled nutrition and meal totals
        qty_map = {(it["meal_id"], it["food_id"]): it["qty"] for it in items}
        updated_meals: List[MealPlanMeal] = []
        for m in meals:
            updated_foods: List[FoodSelectionResult] = []
            for f in m.foods:
                new_qty = qty_map.get((m.meal_id, f.food_id), f.quantity)
                f_obj = food_db.get_food(f.food_id)
                new_nut = scale_nutrition(f_obj, new_qty)
                updated_foods.append(
                    f.model_copy(update={"quantity": new_qty, "nutrition": new_nut})
                )
            new_totals = {
                "calories": round(sum(f.nutrition.calories for f in updated_foods), 1),
                "protein_g": round(sum(f.nutrition.protein_g for f in updated_foods), 1),
                "carbohydrate_g": round(sum(f.nutrition.carbohydrate_g for f in updated_foods), 1),
                "fat_g": round(sum(f.nutrition.fat_g for f in updated_foods), 1),
                "fiber_g": round(sum(f.nutrition.fiber_g for f in updated_foods), 1),
            }
            updated_meals.append(
                m.model_copy(update={"foods": updated_foods, "totals": new_totals})
            )

        return updated_meals
