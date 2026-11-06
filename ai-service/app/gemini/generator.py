"""
Phase 6 7-Day Diet Plan Orchestrator.
Combines Phase 5 deterministic meal construction, Gemini LLM presentation layer,
and deterministic post-generation guardrails to deliver a verified diet plan for dietitians.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from ..meal_planner.meal_builder import MealBuilder
from ..nutrition import calculate_nutrition_targets
from .client import GeminiClient
from .models import Gemini7DayDietPlan
from .validator import DietPlanValidator
from ..clinical_labs import interpret_patient_labs


class DietPlanGenerator:
    """
    Main orchestrator for generating and validating complete 7-day Ayurvedic diet plans.
    """

    def __init__(self):
        self.meal_builder = MealBuilder()
        self.gemini_client = GeminiClient()
        self.validator = DietPlanValidator()

    def generate_plan(
        self,
        patient_assessment: Dict[str, Any],
        nutrition_targets: Optional[Dict[str, Any]] = None,
        meal_structure: Optional[List[str]] = None,
        custom_meal_distribution: Optional[Dict[str, float]] = None,
        dietitian_notes: Optional[str] = None,
        clinical_lab_data: Optional[List[Dict[str, Any]]] = None,
        force_mock: bool = False,
    ) -> Dict[str, Any]:
        """
        Full 7-day diet plan workflow:
        1. Resolve Phase 3 Nutrition Targets
        2. Deterministically assemble 7 daily meal plans (Phase 5 engine)
        3. Format into a professional clinical document using Gemini (Phase 6 layer)
        4. Enforce deterministic guardrails on output
        5. Return verified diet plan ready for dietitian review
        """
        # Normalize assessment keys if caller used alternate conventions
        norm_assessment = dict(patient_assessment)
        if "sex" not in norm_assessment and "gender" in norm_assessment:
            norm_assessment["sex"] = norm_assessment["gender"]
        if "height" not in norm_assessment and "height_cm" in norm_assessment:
            norm_assessment["height"] = norm_assessment["height_cm"]
        if "weight" not in norm_assessment and "weight_kg" in norm_assessment:
            norm_assessment["weight"] = norm_assessment["weight_kg"]
        if "diet_goal" not in norm_assessment and "health_goal" in norm_assessment:
            norm_assessment["diet_goal"] = norm_assessment["health_goal"]
        if "diet_category" not in norm_assessment and "dietary_preference" in norm_assessment:
            norm_assessment["diet_category"] = norm_assessment["dietary_preference"]
        if norm_assessment.get("activity_level") == "moderate":
            norm_assessment["activity_level"] = "moderately_active"
        if isinstance(norm_assessment.get("prakriti"), dict):
            # Extract dominant dosha string
            p_dict = norm_assessment["prakriti"]
            def _get_dosha_score(k: str) -> float:
                val = p_dict.get(k)
                if isinstance(val, (int, float)):
                    return float(val)
                try:
                    return float(val) if val is not None else 0.0
                except (ValueError, TypeError):
                    return 0.0

            norm_assessment["prakriti"] = (
                max(p_dict.keys(), key=_get_dosha_score).capitalize()
                if p_dict
                else "Vata-Pitta"
            )

        patient_assessment = norm_assessment

        # 0. Section 9 Clinical & Laboratory Interpretation Pipeline
        lab_summary_model = interpret_patient_labs(clinical_lab_data or [], patient_assessment)
        lab_summary = lab_summary_model.model_dump()

        # 1. Resolve Phase 3 Nutrition Targets
        if not nutrition_targets:
            target_res = calculate_nutrition_targets(patient_assessment)
            nutrition_targets = target_res.model_dump()

        # 2. Build 7-Day Deterministic Meal Plan
        det_day_models = self.meal_builder.generate_7day_plan(
            assessment=patient_assessment,
            nutrition_targets=nutrition_targets,
            meal_structure=meal_structure,
            custom_meal_distribution=custom_meal_distribution,
        )

        # Convert to serializable dicts
        deterministic_days = [day.model_dump() for day in det_day_models]

        # Collect unique evidence provenance across all 7 days
        grounded_evidence: List[Dict[str, Any]] = []
        seen_evidence = set()
        for day in deterministic_days:
            for ev in day.get("evidence", []):
                key = (ev.get("document"), ev.get("page"))
                if key not in seen_evidence:
                    seen_evidence.add(key)
                    grounded_evidence.append(ev)

        # 3. Format using Gemini (or fallback mock)
        formatted_plan_raw = self.gemini_client.generate_formatted_diet_plan(
            patient_assessment=patient_assessment,
            nutrition_targets=nutrition_targets,
            deterministic_7day_data=deterministic_days,
            grounded_evidence=grounded_evidence,
            dietitian_notes=dietitian_notes or "",
            lab_summary=lab_summary,
            force_mock=force_mock,
        )

        # 4. Post-Generation Deterministic Guardrail Validation
        val_result = self.validator.validate_plan(
            formatted_plan=formatted_plan_raw,
            deterministic_days=deterministic_days,
            patient_assessment=patient_assessment,
            nutrition_targets=nutrition_targets,
            lab_summary=lab_summary,
        )

        # 5. Determine Overall Status
        status = "validated" if val_result.passed and not val_result.requires_dietitian_review else "needs_review"

        plan_id = f"dp_{uuid.uuid4().hex[:12]}"
        now_iso = datetime.now(timezone.utc).isoformat()

        val_dump = val_result.model_dump()
        if nutrition_targets:
            val_dump["nutrition_targets"] = nutrition_targets
        val_dump["clinical_lab_summary"] = lab_summary

        final_plan = {
            "clinical_lab_summary": lab_summary,
            "plan_id": plan_id,
            "patient_id": patient_assessment.get("patient_id"),
            "assessment_id": patient_assessment.get("assessment_id"),
            "title": "7-Day Personalized Ayurvedic Diet Plan",
            "status": status,
            "patient_summary": formatted_plan_raw.get("patient_summary", ""),
            "clinical_rationale": formatted_plan_raw.get("clinical_rationale", ""),
            "ayurvedic_dietary_principles": formatted_plan_raw.get("ayurvedic_dietary_principles", []),
            "dosha_guidelines": formatted_plan_raw.get("dosha_guidelines", {}),
            "days": formatted_plan_raw.get("days", []),
            "weekly_overview": formatted_plan_raw.get("weekly_overview", ""),
            "general_instructions": formatted_plan_raw.get("general_instructions", []),
            "evidence_citations": grounded_evidence,
            "validation_results": val_dump,
            "nutrition_targets": nutrition_targets,
            "dietitian_notes": dietitian_notes or "",
            "is_approved": False,
            "approved_by": None,
            "approved_at": None,
            "created_at": now_iso,
            "updated_at": now_iso,
        }

        return final_plan

    def revalidate_plan(
        self,
        diet_plan: Dict[str, Any],
        patient_assessment: Dict[str, Any],
        nutrition_targets: Optional[Dict[str, Any]] = None,
        clinical_lab_data: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Revalidates a dietitian-edited diet plan deterministically.
        Recalculates totals and checks allergen safety, macro boundaries, and claims.
        """
        days = diet_plan.get("days", [])
        allergies = [str(a).lower().strip() for a in patient_assessment.get("allergies", [])]
        errors: List[str] = []
        warnings: List[str] = []
        review_reasons: List[str] = []

        total_plan_cals = 0.0

        for day_idx, day in enumerate(days):
            day_cals = 0.0
            day_prot = 0.0
            day_carb = 0.0
            day_fat = 0.0
            day_fiber = 0.0

            for meal in day.get("meals", []):
                meal_cals = 0.0
                meal_prot = 0.0
                meal_carb = 0.0
                meal_fat = 0.0
                meal_fiber = 0.0

                for food in meal.get("foods", []):
                    # Check allergens
                    f_name = food.get("food_name", "").lower()
                    for allergy in allergies:
                        if allergy in f_name:
                            errors.append(
                                f"Day {day_idx + 1}, {meal.get('meal_type')}: Allergen '{allergy}' present in '{food.get('food_name')}'"
                            )

                    # Quantities sanity
                    qty = float(food.get("quantity", 0))
                    if qty <= 0:
                        errors.append(f"Day {day_idx + 1}: Invalid non-positive quantity for '{food.get('food_name')}'")

                    meal_cals += float(food.get("calories", 0))
                    meal_prot += float(food.get("protein_g", 0))
                    meal_carb += float(food.get("carbohydrate_g", 0))
                    meal_fat += float(food.get("fat_g", 0))
                    meal_fiber += float(food.get("fiber_g", 0))

                meal["totals"] = {
                    "calories": round(meal_cals, 1),
                    "protein_g": round(meal_prot, 1),
                    "carbohydrate_g": round(meal_carb, 1),
                    "fat_g": round(meal_fat, 1),
                    "fiber_g": round(meal_fiber, 1),
                }

                day_cals += meal_cals
                day_prot += meal_prot
                day_carb += meal_carb
                day_fat += meal_fat
                day_fiber += meal_fiber

            day["daily_totals"] = {
                "calories": round(day_cals, 1),
                "protein_g": round(day_prot, 1),
                "carbohydrate_g": round(day_carb, 1),
                "fat_g": round(day_fat, 1),
                "fiber_g": round(day_fiber, 1),
            }
            total_plan_cals += day_cals

        # Claims check
        claim_errors = []
        text_corpus = self.validator._extract_text_for_claims_scan(diet_plan)
        from .validator import FORBIDDEN_CLAIM_PATTERNS
        import re
        for pat in FORBIDDEN_CLAIM_PATTERNS:
            matches = re.findall(pat, text_corpus, re.IGNORECASE)
            if matches:
                for m in set(matches):
                    errors.append(f"Forbidden curative/absolute claim detected: '{m}'")
                    claim_errors.append(m)

        # Macro comparison against target
        if nutrition_targets:
            target_cals = float(
                nutrition_targets.get("energy", {}).get("target_energy_kcal_day")
                or nutrition_targets.get("target_energy_kcal_day")
                or 2000.0
            )
            avg_daily_cals = total_plan_cals / max(len(days), 1)
            diff_pct = abs(avg_daily_cals - target_cals) / target_cals * 100.0
            if diff_pct > 10.0:
                warnings.append(
                    f"Average daily energy ({avg_daily_cals:.0f} kcal) deviates by {diff_pct:.1f}% from target ({target_cals:.0f} kcal)"
                )
                review_reasons.append("Caloric deviation exceeds standard 10% tolerance")

        passed = len(errors) == 0
        requires_review = len(warnings) > 0 or not passed

        return {
            "passed": passed,
            "errors": errors,
            "warnings": warnings,
            "requires_dietitian_review": requires_review,
            "review_reasons": review_reasons,
            "macro_tolerance_passed": len(warnings) == 0,
            "allergen_safety_passed": len([e for e in errors if "Allergen" in e]) == 0,
            "forbidden_claims_found": claim_errors,
            "nutrition_targets": nutrition_targets,
        }
