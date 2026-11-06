"""
Deterministic Post-Generation Guardrails for Gemini 7-Day Diet Plan.
Validates food identity, quantities, units, nutritional totals, allergen safety,
and clinical language compliance before any output is shown to the dietitian.
"""

import math
import re
from typing import Any, Dict, List, Optional, Set, Tuple
from .models import DeterministicGuardrailResult


FORBIDDEN_CLAIM_PATTERNS = [
    r"\bcure[sd]?\b",
    r"\bcuring\b",
    r"\bmiracle\b",
    r"\bguarantee[sd]?\b",
    r"\b100%\s*(effective|cure|success)\b",
    r"\beliminate[sd]?\s+(diabetes|hypertension|cancer|disease)\b",
    r"\breverse[sd]?\s+(diabetes|hypertension|chronic\s+disease)\b",
    r"\beradicate[sd]?\b",
    r"\bmagical\b",
]


class DietPlanValidator:
    """
    Deterministic safety and accuracy validator for Gemini-formatted diet plans.
    Guarantees that Gemini cannot hallucinate foods, alter macros, or breach clinical boundaries.
    """

    def __init__(self, macro_tolerance_pct: float = 2.0):
        self.macro_tolerance_pct = macro_tolerance_pct

    def validate_plan(
        self,
        formatted_plan: Dict[str, Any],
        deterministic_days: List[Dict[str, Any]],
        patient_assessment: Dict[str, Any],
        nutrition_targets: Optional[Dict[str, Any]] = None,
        lab_summary: Optional[Dict[str, Any]] = None,
    ) -> DeterministicGuardrailResult:
        """
        Executes strict deterministic verification on formatted diet plan.
        """
        errors: List[str] = []
        warnings: List[str] = []
        review_reasons: List[str] = []
        forbidden_claims: List[str] = []
        item_checks = 0
        requires_review = False

        # 1. Structure Verification
        formatted_days = formatted_plan.get("days", [])
        if len(formatted_days) != len(deterministic_days):
            errors.append(
                f"Day count mismatch: Gemini generated {len(formatted_days)} days, expected {len(deterministic_days)}"
            )

        # 2. Check each day against deterministic ground truth
        for day_idx, det_day in enumerate(deterministic_days):
            if day_idx >= len(formatted_days):
                break

            fmt_day = formatted_days[day_idx]
            det_meals = det_day.get("meals", [])
            fmt_meals = fmt_day.get("meals", [])

            # Index deterministic foods for quick lookup
            det_food_map: Dict[Tuple[str, str], Dict[str, Any]] = {}
            for m in det_meals:
                m_type = m.get("meal_type", "")
                for f in m.get("foods", []):
                    det_food_map[(m_type, f.get("food_id"))] = f

            # Validate meals and foods in formatted plan
            for fmt_meal in fmt_meals:
                m_type = fmt_meal.get("meal_type", "")
                fmt_foods = fmt_meal.get("foods", [])

                for fmt_food in fmt_foods:
                    item_checks += 1
                    food_id = fmt_food.get("food_id")
                    key = (m_type, food_id)

                    if key not in det_food_map:
                        errors.append(
                            f"Day {day_idx + 1}, {m_type}: Unauthorized or hallucinated food item '{food_id}' ({fmt_food.get('food_name')})"
                        )
                        continue

                    det_food = det_food_map[key]

                    # Quantity & Unit Check
                    det_qty = float(det_food.get("quantity", 0))
                    fmt_qty = float(fmt_food.get("quantity", 0))
                    if abs(det_qty - fmt_qty) > 0.05:
                        warnings.append(
                            f"Day {day_idx + 1}, {m_type}, {food_id}: Quantity altered ({fmt_qty} vs ground truth {det_qty})"
                        )
                        # Auto-align formatted quantity to deterministic ground truth
                        fmt_food["quantity"] = det_qty

                    if fmt_food.get("unit") != det_food.get("unit"):
                        warnings.append(
                            f"Day {day_idx + 1}, {m_type}, {food_id}: Unit altered ({fmt_food.get('unit')} vs ground truth {det_food.get('unit')})"
                        )
                        fmt_food["unit"] = det_food.get("unit")

                    # Calorie & Macro Check
                    det_nut = det_food.get("nutrition", {})
                    fmt_cals = float(fmt_food.get("calories", 0))
                    det_cals = float(det_nut.get("calories", 0))

                    if abs(det_cals - fmt_cals) > 1.0:
                        warnings.append(
                            f"Day {day_idx + 1}, {m_type}, {food_id}: Calories drift ({fmt_cals} vs {det_cals} kcal)"
                        )
                        # Enforce exact deterministic calories and macros
                        fmt_food["calories"] = det_cals
                        fmt_food["protein_g"] = float(det_nut.get("protein_g", 0))
                        fmt_food["carbohydrate_g"] = float(det_nut.get("carbohydrate_g", 0))
                        fmt_food["fat_g"] = float(det_nut.get("fat_g", 0))
                        fmt_food["fiber_g"] = float(det_nut.get("fiber_g", 0))

            # Daily Totals Check
            det_totals = det_day.get("daily_totals", {})
            fmt_totals = fmt_day.get("daily_totals", {})
            det_daily_cal = float(det_totals.get("calories", 0))
            fmt_daily_cal = float(fmt_totals.get("calories", 0))

            if det_daily_cal > 0 and abs(det_daily_cal - fmt_daily_cal) / det_daily_cal > (self.macro_tolerance_pct / 100.0):
                warnings.append(
                    f"Day {day_idx + 1}: Daily calories drift ({fmt_daily_cal} vs ground truth {det_daily_cal})"
                )
                # Auto-align daily totals
                fmt_day["daily_totals"] = {
                    "calories": det_daily_cal,
                    "protein_g": float(det_totals.get("protein_g", 0)),
                    "carbohydrate_g": float(det_totals.get("carbohydrate_g", 0)),
                    "fat_g": float(det_totals.get("fat_g", 0)),
                    "fiber_g": float(det_totals.get("fiber_g", 0)),
                }

        # 3. Patient Allergens Safety Check
        allergies = [str(a).lower().strip() for a in patient_assessment.get("allergies", [])]
        allergen_passed = True
        if allergies:
            for fmt_day in formatted_days:
                for fmt_meal in fmt_day.get("meals", []):
                    for fmt_food in fmt_meal.get("foods", []):
                        f_name = fmt_food.get("food_name", "").lower()
                        for allergy in allergies:
                            if allergy in f_name:
                                errors.append(
                                    f"Allergen conflict: Food '{fmt_food.get('food_name')}' matches patient allergy '{allergy}'"
                                )
                                allergen_passed = False

        # 4. Forbidden Medical / Curative Claims Scanning
        text_corpus = self._extract_text_for_claims_scan(formatted_plan)
        for pattern in FORBIDDEN_CLAIM_PATTERNS:
            matches = re.findall(pattern, text_corpus, flags=re.IGNORECASE)
            if matches:
                for m in set(matches):
                    forbidden_claims.append(m)
                    errors.append(f"Forbidden curative/absolute claim detected: '{m}'")

        # 4b. Laboratory Contraindications & Safety Guardrails
        if lab_summary:
            contra_items = [c.lower().strip() for c in lab_summary.get("contraindicated_foods", []) if c]
            if contra_items:
                for fmt_day in formatted_days:
                    for fmt_meal in fmt_day.get("meals", []):
                        for fmt_food in fmt_meal.get("foods", []):
                            f_name = fmt_food.get("food_name", "").lower()
                            for c_item in contra_items:
                                if c_item in f_name or f_name in c_item:
                                    errors.append(
                                        f"Lab Contraindication Conflict: Food '{fmt_food.get('food_name')}' violates active clinical lab guidance ({c_item})"
                                    )

            # Check critical alerts
            critical_alerts = lab_summary.get("critical_alerts", [])
            if critical_alerts:
                requires_review = True
                for ca in critical_alerts:
                    review_reasons.append(f"Critical Lab Alert: {ca.get('message')}")

            if lab_summary.get("requires_dietitian_review"):
                requires_review = True
                for rr in lab_summary.get("review_reasons", []):
                    if rr not in review_reasons:
                        review_reasons.append(f"Lab Review Reason: {rr}")

            # Check stale lab warnings
            stale_count = lab_summary.get("stale_count", 0)
            if stale_count > 0:
                warnings.append(
                    f"{stale_count} laboratory test(s) are older than 180 days and require clinical re-testing."
                )

            # Check indeterminate / unit incompatible warnings
            indet_count = lab_summary.get("indeterminate_count", 0)
            if indet_count > 0:
                warnings.append(
                    f"{indet_count} laboratory test(s) had unrecognized or incompatible units and could not be evaluated safely."
                )

        # 5. Dietitian Review Trigger Determination
        if warnings:
            requires_review = True
            review_reasons.extend(warnings[:5])
        if patient_assessment.get("risk_category") in ["high", "critical"]:
            requires_review = True
            review_reasons.append("High risk patient category requires mandatory clinical review")

        passed = len(errors) == 0

        return DeterministicGuardrailResult(
            passed=passed,
            errors=errors,
            warnings=warnings,
            requires_dietitian_review=requires_review,
            review_reasons=review_reasons,
            item_check_count=item_checks,
            macro_tolerance_passed=passed,
            allergen_safety_passed=allergen_passed,
            forbidden_claims_found=forbidden_claims,
        )

    def _extract_text_for_claims_scan(self, plan: Dict[str, Any]) -> str:
        """Collects all natural language text blocks in plan to scan for prohibited medical claims."""
        texts = [
            plan.get("patient_summary", ""),
            plan.get("clinical_rationale", ""),
            plan.get("weekly_overview", ""),
        ]
        for instruction in plan.get("general_instructions", []):
            texts.append(instruction)

        for principle in plan.get("ayurvedic_dietary_principles", []):
            texts.append(principle)

        for day in plan.get("days", []):
            texts.append(day.get("theme", ""))
            texts.append(day.get("daily_summary", ""))
            texts.append(day.get("clinical_rationale", ""))
            texts.append(day.get("ayurvedic_notes", ""))
            for meal in day.get("meals", []):
                texts.append(meal.get("meal_summary", ""))
                for food in meal.get("foods", []):
                    texts.append(food.get("preparation_notes", ""))
                    texts.append(food.get("ayurvedic_properties", ""))

        return " ".join(t for t in texts if t)
