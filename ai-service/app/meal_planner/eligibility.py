"""
Deterministic Food Eligibility Engine for AyurDiet Phase 5.
Evaluates food items against patient allergies, dietary preferences, clinical conditions,
medications, disliked foods, and Ayurvedic contraindications.
Distinguishes ELIGIBLE, INELIGIBLE, and REQUIRES_REVIEW without guessing.
"""

import re
from typing import Any, Dict, List, Optional
from .models import FoodItem

# Common allergen alias normalization
ALLERGEN_ALIASES: Dict[str, List[str]] = {
    "milk": ["milk", "dairy", "lactose", "casein", "paneer", "curd", "ghee", "yogurt", "butter"],
    "gluten": ["gluten", "wheat", "godhuma", "barley", "yava", "rye"],
    "wheat": ["wheat", "gluten", "godhuma", "atta", "maida"],
    "soy": ["soy", "soya", "soybean", "tofu", "soymilk"],
    "tree_nuts": ["tree_nuts", "tree_nut", "nuts", "almond", "almonds", "walnut", "walnuts", "cashew", "cashews", "pistachio"],
    "peanut": ["peanut", "peanuts", "groundnut"],
    "sesame": ["sesame", "til", "tila"],
    "egg": ["egg", "eggs", "albumin"],
}


class EligibilityResult:
    """Evaluation outcome for a food item against a patient profile."""

    def __init__(self, food_id: str, food_name: str):
        self.food_id = food_id
        self.food_name = food_name
        self.status: str = "eligible"  # 'eligible', 'ineligible', 'requires_review'
        self.reasons: List[Dict[str, str]] = []
        self.requires_dietitian_review: bool = False

    def add_ineligible(self, reason_type: str, message: str):
        self.status = "ineligible"
        self.reasons.append({"type": reason_type, "message": message})

    def add_review_flag(self, reason_type: str, message: str):
        if self.status != "ineligible":
            self.status = "requires_review"
        self.requires_dietitian_review = True
        self.reasons.append({"type": reason_type, "message": message})

    def to_dict(self) -> Dict[str, Any]:
        return {
            "food_id": self.food_id,
            "food_name": self.food_name,
            "status": self.status,
            "is_eligible": self.status == "eligible",
            "requires_dietitian_review": self.requires_dietitian_review,
            "reasons": self.reasons,
        }


class FoodEligibilityEngine:
    """
    Deterministic rule engine verifying patient-specific food safety and suitability.
    """

    def evaluate_food(self, food: FoodItem, assessment: Dict[str, Any]) -> EligibilityResult:
        result = EligibilityResult(food.food_id, food.food_name)

        # 1. Allergies & Intolerances Filtering
        self._check_allergies_and_intolerances(food, assessment, result)
        if result.status == "ineligible":
            return result

        # 2. Dietary Category Filtering (Vegetarian / Vegan / Eggetarian)
        self._check_dietary_category(food, assessment, result)
        if result.status == "ineligible":
            return result

        # 3. Disliked & Avoided Foods
        self._check_disliked_foods(food, assessment, result)
        if result.status == "ineligible":
            return result

        # 4. Clinical Condition Restrictions
        self._check_clinical_conditions(food, assessment, result)
        if result.status == "ineligible":
            return result

        # 5. Food-Drug Interactions
        self._check_drug_interactions(food, assessment, result)

        # 6. Ayurvedic Dosha & Apathya Contraindications
        self._check_ayurvedic_compatibility(food, assessment, result)

        return result

    def _check_allergies_and_intolerances(self, food: FoodItem, assessment: Dict[str, Any], res: EligibilityResult):
        patient_allergies = [a.lower().strip() for a in assessment.get("food_allergies", []) if a]
        patient_intolerances = [i.lower().strip() for i in assessment.get("food_intolerances", []) if i]
        all_hazards = patient_allergies + patient_intolerances

        if not all_hazards:
            return

        # Check against food allergens list
        for food_allergen in food.allergens:
            allergen_key = food_allergen.lower()
            aliases = ALLERGEN_ALIASES.get(allergen_key, [allergen_key])

            for hazard in all_hazards:
                for alias in aliases:
                    if alias in hazard or hazard in alias:
                        res.add_ineligible(
                            "allergy",
                            f"Contains recorded patient allergy/intolerance: '{hazard}' matches '{food_allergen}'"
                        )
                        return

        # Specific dairy flag
        if food.dietary.dairy:
            for hazard in all_hazards:
                if any(k in hazard for k in ["milk", "dairy", "lactose"]):
                    res.add_ineligible("allergy", f"Contains dairy, excluded due to: '{hazard}'")
                    return

        # Specific gluten flag
        if food.dietary.gluten:
            for hazard in all_hazards:
                if any(k in hazard for k in ["gluten", "wheat", "celiac"]):
                    res.add_ineligible("allergy", f"Contains gluten, excluded due to: '{hazard}'")
                    return

    def _check_dietary_category(self, food: FoodItem, assessment: Dict[str, Any], res: EligibilityResult):
        diet_cat = (assessment.get("diet_category") or "vegetarian").lower().strip()

        if diet_cat == "vegan":
            if not food.dietary.vegan:
                res.add_ineligible("dietary_category", "Food is not vegan (contains animal/dairy derivatives)")
        elif diet_cat == "vegetarian":
            if not food.dietary.vegetarian:
                res.add_ineligible("dietary_category", "Food is not vegetarian")
        elif diet_cat == "eggetarian":
            if not (food.dietary.vegetarian or food.dietary.eggetarian):
                res.add_ineligible("dietary_category", "Food is not compliant with eggetarian diet")

    def _check_disliked_foods(self, food: FoodItem, assessment: Dict[str, Any], res: EligibilityResult):
        disliked_raw = assessment.get("foods_disliked")
        if not disliked_raw:
            return

        disliked_items = [d.lower().strip() for d in re.split(r"[,;\n]+", str(disliked_raw)) if d.strip()]
        food_name_lower = food.food_name.lower()
        local_name_lower = (food.local_name or "").lower()

        for item in disliked_items:
            if item in food_name_lower or (local_name_lower and item in local_name_lower):
                res.add_ineligible("disliked_food", f"Excluded as patient explicitly marked '{item}' as disliked")
                return

    def _check_clinical_conditions(self, food: FoodItem, assessment: Dict[str, Any], res: EligibilityResult):
        conditions = [str(c).lower().strip() for c in assessment.get("existing_conditions", []) if c]
        if not conditions:
            return

        has_diabetes = any("diabet" in c or "madhumeha" in c or "sugar" in c for c in conditions)
        has_cardiac = any("heart" in c or "cardiac" in c or "hypertension" in c or "blood pressure" in c for c in conditions)
        has_skin = any("skin" in c or "kushta" in c or "psoriasis" in c or "eczema" in c for c in conditions)
        has_kidney = any("kidney" in c or "renal" in c or "stone" in c or "calculi" in c for c in conditions)

        # Diabetes checks
        if has_diabetes:
            if "high_gi" in food.clinical_restrictions or "diabetes" in [a.lower() for a in food.ayurvedic.apathya_for]:
                res.add_ineligible("clinical_condition", "High glycemic response or classical Apathya in diabetes mellitus")
                return

        # Kidney Stone / Renal checks
        if has_kidney:
            if "kidney_oxalate_calculi" in food.clinical_restrictions:
                res.add_ineligible("clinical_condition", "High oxalate content contraindicated in renal calculi")
                return

        # Skin disease checks
        if has_skin:
            if "active_skin_disease_kushta" in [a.lower() for a in food.ayurvedic.apathya_for]:
                res.add_ineligible("clinical_condition", "Classical Apathya (contraindicated) in active inflammatory skin diseases")
                return

    def _check_drug_interactions(self, food: FoodItem, assessment: Dict[str, Any], res: EligibilityResult):
        meds = assessment.get("medications", [])
        if not meds:
            return

        med_names = []
        for m in meds:
            if isinstance(m, dict):
                name = m.get("medication_name") or m.get("name") or ""
                med_names.append(str(name).lower())
            elif isinstance(m, str):
                med_names.append(m.lower())

        # Check Levothyroxine + Soy interaction
        if any("thyroid" in m or "levothyroxine" in m or "eltroxin" in m or "thyronorm" in m for m in med_names):
            if "thyroid_medication_timing" in food.clinical_restrictions:
                res.add_review_flag(
                    "food_drug_interaction",
                    "Soy products interfere with levothyroxine absorption. Requires dietitian review / 4-hour separation."
                )

    def _check_ayurvedic_compatibility(self, food: FoodItem, assessment: Dict[str, Any], res: EligibilityResult):
        prakriti = str(assessment.get("prakriti", "")).lower()

        # Check explicit Apathya
        for apathya in food.ayurvedic.apathya_for:
            ap_lower = apathya.lower()
            if "vata" in prakriti and "high_vata" in ap_lower:
                res.add_review_flag(
                    "ayurvedic_contraindication",
                    f"Food is noted as aggravating/Apathya for high Vata constitution ({food.food_name})"
                )
            elif "kapha" in prakriti and "obesity" in ap_lower:
                res.add_review_flag(
                    "ayurvedic_contraindication",
                    f"Food is heavy/Guru and noted as Apathya for sluggish Kapha/medoroga"
                )

        if food.ayurvedic.evidence_status == "requires_review":
            res.add_review_flag("evidence_review", "Ayurvedic properties require dietitian clinical verification")
