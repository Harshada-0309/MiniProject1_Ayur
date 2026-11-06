"""
Deterministic Food Scoring & Explanation Engine for AyurDiet Phase 5.
Scores eligible foods using a transparent, multi-factor clinical, Ayurvedic,
nutritional, and preference model.
Provides deterministic justification answering "Why was this food selected?".
"""

from typing import Any, Dict, List, Optional, Tuple
from .models import FoodItem, FoodSelectionResult, SourceProvenance


class FoodScorer:
    """
    Computes transparent, explainable scores for candidate foods based on patient assessment and nutrition targets.
    """

    def score_food(
        self,
        food: FoodItem,
        assessment: Dict[str, Any],
        targets: Dict[str, Any],
        meal_type: str,
    ) -> Tuple[float, str, str]:
        """
        Calculates total score (0-100) and produces detailed explanation strings.
        Returns: (score, selection_reason, ayurvedic_alignment)
        """
        prakriti = str(assessment.get("prakriti", "")).lower()
        diet_goal = str(assessment.get("diet_goal", "")).lower()
        season_raw = str(assessment.get("season_ritu", "")).lower()
        conditions = [str(c).lower().strip() for c in assessment.get("existing_conditions", []) if c]
        preferences = str(assessment.get("food_preferences", "")).lower()
        appetite = str(assessment.get("appetite", "")).lower()

        score = 0.0
        reasons: List[str] = []
        ayur_notes: List[str] = []

        # ---------------------------------------------------------------------
        # 1. Clinical Condition Compatibility (Max 30 pts)
        # ---------------------------------------------------------------------
        clinical_pts = 10.0
        for cond in conditions:
            if "diabet" in cond and "diabetes" in [p.lower() for p in food.ayurvedic.pathya_for]:
                clinical_pts += 15.0
                reasons.append("Indicated Pathya for blood sugar regulation in diabetes mellitus")
            elif "cardiac" in cond and "cardiac_disorders" in [p.lower() for p in food.ayurvedic.pathya_for]:
                clinical_pts += 15.0
                reasons.append("Cardioprotective (Hridya) profile supporting arterial and cardiovascular health")
            elif "skin" in cond and "skin_diseases" in [p.lower() for p in food.ayurvedic.pathya_for]:
                clinical_pts += 15.0
                reasons.append("Blood purifying (Rakta Shodhana) Pathya for skin health")
            elif "digest" in cond and "digestive_weakness" in [p.lower() for p in food.ayurvedic.pathya_for]:
                clinical_pts += 12.0
                reasons.append("Easily assimilable, strengthening digestive capacity")

        clinical_pts = min(clinical_pts, 30.0)
        score += clinical_pts

        # ---------------------------------------------------------------------
        # 2. Ayurvedic Dosha & Agni Compatibility (Max 30 pts)
        # ---------------------------------------------------------------------
        ayur_pts = 0.0
        dosha_effects = food.ayurvedic.dosha_effect

        # Check primary dosha alignment
        is_tridoshic = (
            dosha_effects.get("vata") == "pacifies"
            and dosha_effects.get("pitta") == "pacifies"
            and dosha_effects.get("kapha") == "pacifies"
        )

        if is_tridoshic:
            ayur_pts += 18.0
            ayur_notes.append("Tridosha-hara (balances Vata, Pitta, and Kapha equally)")
        else:
            if "vata" in prakriti:
                if dosha_effects.get("vata") == "pacifies":
                    ayur_pts += 12.0
                    ayur_notes.append("Vata-shamaka (calms and grounds dry/light Vata)")
                elif dosha_effects.get("vata") == "increases":
                    ayur_pts -= 8.0

            if "pitta" in prakriti:
                if dosha_effects.get("pitta") == "pacifies":
                    ayur_pts += 12.0
                    ayur_notes.append("Pitta-shamaka (soothes internal heat and acid)")
                elif dosha_effects.get("pitta") == "increases":
                    ayur_pts -= 8.0

            if "kapha" in prakriti:
                if dosha_effects.get("kapha") == "pacifies":
                    ayur_pts += 12.0
                    ayur_notes.append("Kapha-shamaka (light and counteracts heaviness)")
                elif dosha_effects.get("kapha") == "increases":
                    ayur_pts -= 8.0

        # Seasonal alignment (Ritucharya)
        if any(s in season_raw for s in food.ayurvedic.seasonal_relevance) or "all_seasons" in food.ayurvedic.seasonal_relevance:
            ayur_pts += 6.0
            reasons.append("Aligned with current seasonal Ritucharya")

        # Agni alignment
        if "mandagni" in appetite and "laghu" in food.ayurvedic.guna:
            ayur_pts += 6.0
            reasons.append("Laghu (light) quality ideal for sluggish digestion (Mandagni)")

        ayur_pts = max(0.0, min(ayur_pts, 30.0))
        score += ayur_pts

        # ---------------------------------------------------------------------
        # 3. Nutrition Target Contribution (Max 25 pts)
        # ---------------------------------------------------------------------
        nutri_pts = 0.0
        if diet_goal == "weight_loss":
            # Favor fiber and appropriate nutrient density
            if food.nutrition.fiber_g >= 3.0:
                nutri_pts += 8.0
                reasons.append("High dietary fiber content supporting satiety for weight management")
            if food.nutrition.calories <= 160.0 or food.nutrition.protein_g >= 7.0:
                nutri_pts += 6.0
        elif diet_goal == "weight_gain":
            # Favor nutrient-dense and balya foods
            if food.nutrition.calories >= 180.0 or food.nutrition.protein_g >= 8.0:
                nutri_pts += 15.0
                reasons.append("Calorically and nutritionally dense, supporting healthy tissue build (Brimhana)")
        else:
            # Balanced general nutrition
            nutri_pts += 10.0

        # Protein reward if patient protein target is elevated
        target_protein = targets.get("macros", {}).get("protein_g_day", 50.0) if targets else 50.0
        if target_protein >= 65.0:
            if food.nutrition.protein_g >= 12.0:
                nutri_pts += 8.0
                reasons.append("Rich source of concentrated protein assisting daily protein target")
            elif food.nutrition.protein_g >= 7.0:
                nutri_pts += 4.0
                reasons.append("Quality protein source assisting daily protein target")

        # Healthy fat reward if patient requires essential fatty acid balance
        target_fat = targets.get("macros", {}).get("fat_g_day", 40.0) if targets else 40.0
        if target_fat >= 35.0 and food.nutrition.fat_g >= 8.0:
            nutri_pts += 6.0
            reasons.append("Wholesome unctuous source (Sneha) supporting essential fatty acid balance")

        nutri_pts = min(nutri_pts, 25.0)
        score += nutri_pts

        # ---------------------------------------------------------------------
        # 4. Meal Suitability & Category Fit (Max 10 pts)
        # ---------------------------------------------------------------------
        meal_fit_pts = 0.0
        if meal_type == "breakfast":
            if food.category in ["cereal_grain", "fruit", "dairy", "nut_seed"]:
                meal_fit_pts = 10.0
        elif meal_type in ["lunch", "dinner"]:
            if food.category in ["cereal_grain", "pulse_legume", "vegetable", "spice_herb", "dairy"]:
                meal_fit_pts = 10.0
        elif meal_type in ["evening_snack", "mid_morning"]:
            if food.category in ["fruit", "nut_seed", "dairy", "cereal_grain", "spice_herb"]:
                meal_fit_pts = 10.0

        score += meal_fit_pts

        # ---------------------------------------------------------------------
        # 5. Patient Explicit Preferences (Max 10 pts)
        # ---------------------------------------------------------------------
        if preferences:
            food_name_low = food.food_name.lower()
            local_name_low = (food.local_name or "").lower()
            if any(p.strip() in food_name_low or (local_name_low and p.strip() in local_name_low) for p in preferences.split(",")):
                score += 10.0
                reasons.append("Matches patient's recorded dietary preferences")

        # Compile final narrative strings
        if not reasons:
            reasons.append(f"Wholesome {food.category.replace('_', ' ')} providing balanced daily nutrition")

        selection_reason = "; ".join(reasons)
        ayurvedic_alignment = "; ".join(ayur_notes) if ayur_notes else "General Ayurvedic nutritional compatibility"

        return round(score, 2), selection_reason, ayurvedic_alignment
