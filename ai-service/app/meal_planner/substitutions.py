"""
Deterministic Food Substitution Engine for AyurDiet Phase 5.
Finds clinically appropriate, allergen-safe, and nutritionally equivalent
substitute foods when a dietitian or patient requests an alternative.
"""

from typing import Any, Dict, List, Optional
from .eligibility import FoodEligibilityEngine
from .food_db import get_food_db
from .models import (
    FoodItem,
    FoodSubstitutionOption,
    NutritionProfile,
    SourceProvenance,
)
from .portion_engine import PortionEngine, scale_nutrition


class SubstitutionEngine:
    """
    Finds and ranks safe, grounded food alternatives.
    """

    def __init__(self):
        self.food_db = get_food_db()
        self.eligibility_engine = FoodEligibilityEngine()
        self.portion_engine = PortionEngine()

    def get_substitutions(
        self,
        food_id: str,
        current_quantity: float,
        patient_assessment: Dict[str, Any],
        meal_type: Optional[str] = None,
    ) -> List[FoodSubstitutionOption]:
        """
        Finds eligible substitutes for food_id at current_quantity.
        """
        current_food = self.food_db.get_food(food_id)
        if not current_food:
            return []

        current_nutri = scale_nutrition(current_food, current_quantity)
        target_calories = current_nutri.calories

        # Determine compatible categories
        categories = [current_food.category]
        if current_food.category == "pulse_legume":
            categories.append("dairy")  # Paneer/tofu can substitute pulses
        elif current_food.category == "dairy":
            categories.append("pulse_legume")

        candidate_foods: List[FoodItem] = []
        for cat in categories:
            candidate_foods.extend(self.food_db.get_by_category(cat))

        options: List[FoodSubstitutionOption] = []

        for candidate in candidate_foods:
            # Exclude current food
            if candidate.food_id == current_food.food_id:
                continue

            # Check eligibility against patient safety profile
            el_res = self.eligibility_engine.evaluate_food(candidate, patient_assessment)
            if el_res.status == "ineligible":
                continue

            # Compute portion to match current calories
            portion_qty = self.portion_engine.calculate_single_food_portion_for_target(
                candidate, target_calories
            )
            cand_nutri = scale_nutrition(candidate, portion_qty)

            # Compute delta
            delta = {
                "calories": round(cand_nutri.calories - current_nutri.calories, 1),
                "protein_g": round(cand_nutri.protein_g - current_nutri.protein_g, 1),
                "carbohydrate_g": round(cand_nutri.carbohydrate_g - current_nutri.carbohydrate_g, 1),
                "fat_g": round(cand_nutri.fat_g - current_nutri.fat_g, 1),
                "fiber_g": round(cand_nutri.fiber_g - current_nutri.fiber_g, 1),
            }

            # Explanatory rationale
            virya_desc = f"{candidate.ayurvedic.virya} virya ({'cooling' if candidate.ayurvedic.virya == 'sheeta' else 'warming'})"
            dosha_desc = ", ".join(f"{k} {v}" for k, v in candidate.ayurvedic.dosha_effect.items())
            reason = (
                f"Nutritionally equivalent {candidate.category.replace('_', ' ')} alternative ({portion_qty:.0f}{candidate.serving.unit} "
                f"providing {cand_nutri.calories:.0f} kcal, {cand_nutri.protein_g:.1f}g protein). "
                f"Possesses {virya_desc} with dosha effects: {dosha_desc}."
            )

            requires_review = (
                el_res.requires_dietitian_review
                or candidate.ayurvedic.evidence_status != "grounded"
            )

            options.append(
                FoodSubstitutionOption(
                    replacement_food=candidate,
                    quantity=portion_qty,
                    unit=candidate.serving.unit,
                    nutritional_delta=delta,
                    reason=reason,
                    evidence_sources=candidate.sources,
                    requires_dietitian_review=requires_review,
                )
            )

        # Sort by smallest absolute calorie difference
        options.sort(key=lambda opt: abs(opt.nutritional_delta["calories"]))
        return options
