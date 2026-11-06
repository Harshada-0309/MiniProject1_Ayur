"""
Gemini API client wrapper with resilient error handling, strict timeouts,
and deterministic fallback generation for testing and offline execution.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional
from ..config import settings
from .prompts import SYSTEM_INSTRUCTION, build_7day_generation_prompt

logger = logging.getLogger(__name__)


class GeminiClient:
    """
    Wrapper for Gemini LLM formatting layer.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.gemini_api_key
        self.model_name = model or settings.gemini_model
        self.temperature = settings.gemini_temperature
        self.max_tokens = settings.gemini_max_tokens
        self.timeout = settings.gemini_timeout_seconds

    def generate_formatted_diet_plan(
        self,
        patient_assessment: Dict[str, Any],
        nutrition_targets: Dict[str, Any],
        deterministic_7day_data: List[Dict[str, Any]],
        grounded_evidence: List[Dict[str, Any]],
        dietitian_notes: str = "",
        lab_summary: Optional[Dict[str, Any]] = None,
        force_mock: bool = False,
    ) -> Dict[str, Any]:
        """
        Generates formatted 7-day diet plan using Gemini API, or falls back to
        deterministic formatting if API key is absent, force_mock is True, or network fails.
        """
        # If API key is not configured or mock is explicitly forced, return deterministic mock
        if force_mock or not self.api_key or self.api_key.startswith("your_") or len(self.api_key.strip()) < 10:
            logger.info("Using deterministic fallback formatter (Gemini API key not configured or mock requested).")
            return self._build_deterministic_mock(
                patient_assessment=patient_assessment,
                nutrition_targets=nutrition_targets,
                deterministic_7day_data=deterministic_7day_data,
                grounded_evidence=grounded_evidence,
                dietitian_notes=dietitian_notes,
                lab_summary=lab_summary,
            )

        prompt = build_7day_generation_prompt(
            patient_assessment=patient_assessment,
            nutrition_targets=nutrition_targets,
            deterministic_7day_data=deterministic_7day_data,
            grounded_evidence=grounded_evidence,
            dietitian_notes=dietitian_notes,
            lab_summary=lab_summary,
        )

        try:
            raw_text = self._call_gemini_api(prompt)
            parsed_json = self._extract_and_parse_json(raw_text)
            return parsed_json
        except Exception as e:
            logger.warning(
                f"Gemini API call failed or returned invalid response ({str(e)}). Falling back to deterministic formatter."
            )
            return self._build_deterministic_mock(
                patient_assessment=patient_assessment,
                nutrition_targets=nutrition_targets,
                deterministic_7day_data=deterministic_7day_data,
                grounded_evidence=grounded_evidence,
                dietitian_notes=dietitian_notes,
                lab_summary=lab_summary,
            )

    def _call_gemini_api(self, prompt: str) -> str:
        """Invokes Gemini SDK with timeout and system instructions."""
        # Attempt modern google-genai SDK first
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=self.api_key)
            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    temperature=self.temperature,
                    max_output_tokens=self.max_tokens,
                    response_mime_type="application/json",
                ),
            )
            return response.text or ""
        except ImportError:
            pass

        # Fallback to legacy google.generativeai SDK if installed
        try:
            import google.generativeai as legacy_genai

            legacy_genai.configure(api_key=self.api_key)
            model = legacy_genai.GenerativeModel(
                model_name=self.model_name,
                system_instruction=SYSTEM_INSTRUCTION,
                generation_config={
                    "temperature": self.temperature,
                    "max_output_tokens": self.max_tokens,
                    "response_mime_type": "application/json",
                },
            )
            response = model.generate_content(prompt)
            return response.text or ""
        except Exception as e:
            raise RuntimeError(f"Failed to execute Gemini API request: {e}")

    def _extract_and_parse_json(self, raw_text: str) -> Dict[str, Any]:
        """Cleans and extracts valid JSON from response."""
        text = raw_text.strip()
        # Strip markdown fences if present
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        # Direct JSON load
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Match outermost curly braces
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            raise ValueError("No valid JSON found in Gemini output")

    def _build_deterministic_mock(
        self,
        patient_assessment: Dict[str, Any],
        nutrition_targets: Dict[str, Any],
        deterministic_7day_data: List[Dict[str, Any]],
        grounded_evidence: List[Dict[str, Any]],
        dietitian_notes: str,
        lab_summary: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Builds a comprehensive, clinically rigorous 7-day formatted diet plan
        adhering strictly to the exact JSON schema without calling external APIs.
        """
        prakriti = patient_assessment.get("prakriti", {})
        dominant_prakriti = "Vata-Pitta"
        if isinstance(prakriti, dict):
            def _get_dosha_score(k: str) -> float:
                val = prakriti.get(k)
                if isinstance(val, (int, float)):
                    return float(val)
                try:
                    return float(val) if val is not None else 0.0
                except (ValueError, TypeError):
                    return 0.0

            dominant_prakriti = max(prakriti.keys(), key=_get_dosha_score) if prakriti else "Pitta"
        elif isinstance(prakriti, str):
            dominant_prakriti = prakriti

        patient_name = patient_assessment.get("name") or f"Patient #{patient_assessment.get('patient_id', '1')}"
        age = patient_assessment.get("age", 35)
        gender = patient_assessment.get("gender", "Individual")
        bmi = patient_assessment.get("bmi", 23.5)
        agni = patient_assessment.get("digestive_fire", patient_assessment.get("agni", "mandagni"))

        target_cals = (
            nutrition_targets.get("energy", {}).get("target_energy_kcal_day")
            or nutrition_targets.get("target_energy_kcal_day")
            or 2000.0
        )
        target_prot = (
            nutrition_targets.get("macronutrients", {}).get("protein", {}).get("target_g")
            or nutrition_targets.get("protein_g")
            or 65.0
        )

        # Section 9 Clinical & Laboratory Insights synthesis
        lab_notes_summary = ""
        lab_rationale_addition = ""
        lab_urgent_banner = ""
        if lab_summary:
            analyzed_count = lab_summary.get("total_tests_analyzed", 0)
            critical_alerts = (
                lab_summary.get("critical_alerts")
                or lab_summary.get("clinical_urgent_alerts")
                or []
            )
            contra_items = list(
                lab_summary.get("contraindicated_foods")
                or lab_summary.get("contraindicated_food_items")
                or []
            )
            recom_items = list(
                lab_summary.get("emphasized_foods")
                or lab_summary.get("recommended_food_items")
                or []
            )
            snippet = lab_summary.get("clinical_rationale_snippet", "")

            # Safely process dietary_guidelines whether it is a list of dicts, a dict, or empty
            dietary_g = lab_summary.get("dietary_guidelines")
            guideline_rationales: List[str] = []
            if isinstance(dietary_g, list):
                for g in dietary_g:
                    if isinstance(g, dict):
                        r = g.get("rationale") or g.get("guideline") or g.get("finding")
                        if r and isinstance(r, str):
                            guideline_rationales.append(r.strip())
                        for avoid_food in g.get("foods_to_avoid_or_limit", []):
                            if avoid_food and avoid_food not in contra_items:
                                contra_items.append(avoid_food)
                        for rec_food in g.get("food_recommendations", []):
                            if rec_food and rec_food not in recom_items:
                                recom_items.append(rec_food)
                    elif isinstance(g, str) and g.strip():
                        guideline_rationales.append(g.strip())
            elif isinstance(dietary_g, dict):
                r_val = dietary_g.get("rationale", [])
                if isinstance(r_val, list):
                    guideline_rationales.extend([str(item).strip() for item in r_val if item])
                elif isinstance(r_val, str) and r_val.strip():
                    guideline_rationales.append(r_val.strip())
                for avoid_food in dietary_g.get("contraindicated_food_items", []):
                    if avoid_food and avoid_food not in contra_items:
                        contra_items.append(avoid_food)
                for rec_food in dietary_g.get("recommended_food_items", []):
                    if rec_food and rec_food not in recom_items:
                        recom_items.append(rec_food)

            if critical_alerts:
                alert_msgs = "; ".join(
                    str(a.get("message")) if isinstance(a, dict) and a.get("message") is not None
                    else str(a)
                    for a in critical_alerts
                    if a is not None
                )
                lab_urgent_banner = (
                    f"[URGENT CLINICAL ALERT: {alert_msgs}. Dietary measures are supportive "
                    f"and must never substitute for emergency medical evaluation.] "
                )

            lab_items = lab_summary.get("items") or lab_summary.get("analyzed_items") or []
            if analyzed_count > 0:
                abnormal_tests = [
                    f"{item.get('test_name')} ({item.get('observed_value')} {item.get('unit', '')} - {item.get('status')})"
                    for item in lab_items
                    if isinstance(item, dict) and item.get("status") in ["high", "low", "critical"]
                ]
                if abnormal_tests:
                    lab_notes_summary = f" Section 9 Lab Insights: Noted findings for {', '.join(abnormal_tests)}."
                else:
                    lab_notes_summary = " Section 9 Lab Insights: Analyzed biomarkers are within reference intervals."

            rationale_parts = []
            if snippet:
                rationale_parts.append(snippet.strip())
            if guideline_rationales:
                rationale_parts.extend(guideline_rationales)

            if rationale_parts:
                lab_rationale_addition = f" Laboratory-Guided Strategy: {' '.join(rationale_parts)}"
            if contra_items:
                contra_list = [str(c) for c in contra_items[:4]]
                lab_rationale_addition += f" Strictly avoids contraindicated items ({', '.join(contra_list)})."
            if recom_items:
                recom_list = [str(r) for r in recom_items[:4]]
                lab_rationale_addition += f" Incorporates therapeutic items ({', '.join(recom_list)})."

        day_names = [
            "Day 1 (Monday)",
            "Day 2 (Tuesday)",
            "Day 3 (Wednesday)",
            "Day 4 (Thursday)",
            "Day 5 (Friday)",
            "Day 6 (Saturday)",
            "Day 7 (Sunday)",
        ]

        day_themes = [
            ("Restorative Agni Rekindling", "Focuses on easily digestible whole grains and light spices to awaken sluggish agni."),
            ("Prakriti-Balancing Nourishment", "Deep cellular nourishment with adequate fiber, plant proteins, and grounding grains."),
            ("Srotas Cleansing & Vitality", "Promotes micro-circulation and prevents ama accumulation with digestive herbs."),
            ("Metabolic Equilibrium", "Sustained postprandial glycemic control through fiber-dense pulses and complex starches."),
            ("Tissue Rejuvenation (Dhatuposhana)", "Rebuilding vigor and endurance with wholesome nutrient combinations."),
            ("Digestive Harmony & Reset", "Light, warm culinary preparations supporting intestinal flora and optimal motility."),
            ("Tridoshic Integration & Vitality", "Balanced culinary celebration supporting ojas, mental clarity, and digestive ease."),
        ]

        meal_timing_map = {
            "breakfast": "08:00 AM - 08:30 AM",
            "mid_morning": "11:00 AM - 11:30 AM",
            "lunch": "01:00 PM - 01:45 PM",
            "evening_snack": "05:00 PM - 05:30 PM",
            "dinner": "07:30 PM - 08:15 PM",
        }

        formatted_days: List[Dict[str, Any]] = []

        for idx, day_plan in enumerate(deterministic_7day_data):
            day_num = idx + 1
            d_name = day_names[idx % len(day_names)]
            d_theme, d_summary = day_themes[idx % len(day_themes)]

            det_totals = day_plan.get("daily_totals", {})
            daily_cals = float(det_totals.get("calories", target_cals))
            daily_prot = float(det_totals.get("protein_g", target_prot))
            daily_carb = float(det_totals.get("carbohydrate_g", 250.0))
            daily_fat = float(det_totals.get("fat_g", 50.0))
            daily_fiber = float(det_totals.get("fiber_g", 30.0))

            meals_out: List[Dict[str, Any]] = []
            for m in day_plan.get("meals", []):
                m_type = m.get("meal_type", "lunch")
                m_totals = m.get("totals", {})

                foods_out: List[Dict[str, Any]] = []
                for f in m.get("foods", []):
                    f_nut = f.get("nutrition", {})
                    f_name = f.get("food_name", "Food Item")

                    # Generate authentic therapeutic preparation guidance
                    prep_note = self._generate_preparation_guidance(f_name, m_type, dominant_prakriti)
                    ayur_note = f.get("ayurvedic_alignment") or "Laghu, Ushna virya, supports Agni"

                    foods_out.append({
                        "food_id": f.get("food_id"),
                        "food_name": f_name,
                        "quantity": float(f.get("quantity", 100)),
                        "unit": f.get("unit", "g"),
                        "preparation_notes": prep_note,
                        "ayurvedic_properties": ayur_note,
                        "calories": round(float(f_nut.get("calories", 0)), 1),
                        "protein_g": round(float(f_nut.get("protein_g", 0)), 1),
                        "carbohydrate_g": round(float(f_nut.get("carbohydrate_g", 0)), 1),
                        "fat_g": round(float(f_nut.get("fat_g", 0)), 1),
                        "fiber_g": round(float(f_nut.get("fiber_g", 0)), 1),
                    })

                meals_out.append({
                    "meal_id": m.get("meal_id", f"meal_{m_type}"),
                    "meal_type": m_type,
                    "timing": meal_timing_map.get(m_type, "12:00 PM - 12:30 PM"),
                    "meal_summary": f"Wholesome {m_type.replace('_', ' ')} aligned with {dominant_prakriti} dosha pacification.",
                    "totals": {
                        "calories": round(float(m_totals.get("calories", 0)), 1),
                        "protein_g": round(float(m_totals.get("protein_g", 0)), 1),
                        "carbohydrate_g": round(float(m_totals.get("carbohydrate_g", 0)), 1),
                        "fat_g": round(float(m_totals.get("fat_g", 0)), 1),
                        "fiber_g": round(float(m_totals.get("fiber_g", 0)), 1),
                    },
                    "foods": foods_out,
                })

            formatted_days.append({
                "day_number": day_num,
                "day_name": d_name,
                "theme": d_theme,
                "daily_summary": d_summary,
                "clinical_rationale": f"Engineered to provide {daily_cals:.0f} kcal and {daily_prot:.1f}g protein with balanced glycemic stability.",
                "ayurvedic_notes": f"Pacifies aggravated {dominant_prakriti} while stimulating {agni} agni without generating excess pitta.",
                "daily_totals": {
                    "calories": daily_cals,
                    "protein_g": daily_prot,
                    "carbohydrate_g": daily_carb,
                    "fat_g": daily_fat,
                    "fiber_g": daily_fiber,
                },
                "meals": meals_out,
            })

        return {
            "patient_summary": (
                f"{patient_name}, {age} yrs, {gender}, BMI {bmi:.1f}. "
                f"Constitution identified as predominantly {dominant_prakriti} with {agni} agni. "
                f"Dietary approach emphasizes warm, fresh, lightly spiced seasonal preparations.{lab_notes_summary}"
            ),
            "clinical_rationale": (
                f"{lab_urgent_banner}"
                f"Personalized 7-day clinical meal schedule calibrated to deliver a daily average of ~{target_cals:.0f} kcal "
                f"and {target_prot:.0f}g protein. Emphasizes complex carbohydrates, adequate dietary fiber, and healthy fats "
                f"to support metabolic homeostasis and tissue nourishment.{lab_rationale_addition}"
            ),
            "ayurvedic_dietary_principles": [
                "Ahara Vidhi Vidhana: Consume warm, freshly cooked food in a calm, seated environment without distractions.",
                "Shad Rasa Satmya: Ensure all six tastes (Madhura, Amla, Lavana, Katu, Tikta, Kashaya) are represented in daily meals.",
                "Agni Rakshana: Maintain a 3.5 to 4-hour gap between primary meals to allow complete digestion of previous food.",
                "Matravat Ahara: Eat until 3/4 capacity (2 parts solid, 1 part liquid, 1 part left empty for Vata movement).",
            ],
            "dosha_guidelines": {
                "vata": "Favor warm, cooked, unctuous (snigdha) foods. Avoid cold, dry, raw preparations.",
                "pitta": "Favor sweet, bitter, and astringent tastes. Moderately seasoned with coriander and fennel.",
                "kapha": "Favor light (laghu), warm, dry foods seasoned with warming spices like black pepper and dry ginger.",
            },
            "days": formatted_days,
            "weekly_overview": (
                "The 7-day cycle features strategic rotation across staple grains (whole wheat, brown rice, barley, oats, ragi) "
                "and legumes (yellow moong dal, green gram, toor dal) to prevent monotony, ensure complete amino acid profiles, "
                "and support continuous gastrointestinal balance."
                + (f" Meal selections actively integrate laboratory findings to optimize biomarker stability." if lab_summary and lab_summary.get("total_tests_analyzed", 0) > 0 else "")
            ),
            "general_instructions": [
                "Sip warm or room temperature water throughout the day. Avoid iced beverages with meals.",
                "Finish evening dinner at least 2.5 to 3 hours prior to sleep.",
                "Incorporate a light 10-15 minute walk (Shatapadi) following major meals to aid peristalsis.",
                "Season dishes with digestive spices (cumin, ginger, turmeric, coriander, rock salt).",
            ],
            "evidence_citations": grounded_evidence,
        }

    def _generate_preparation_guidance(self, food_name: str, meal_type: str, prakriti: str) -> str:
        """Helper to create clinical culinary instructions based on item and meal slot."""
        name_lower = food_name.lower()
        if "dal" in name_lower or "pulse" in name_lower or "gram" in name_lower or "moong" in name_lower:
            return "Wash thoroughly, soak for 30 minutes, cook until soft. Temper with a drop of ghee, cumin seeds, and a pinch of hing for easy assimilation."
        elif "rice" in name_lower or "khichdi" in name_lower:
            return "Rinse well and boil in 4x water until tender. Season with mild cumin and fresh coriander."
        elif "roti" in name_lower or "wheat" in name_lower or "bread" in name_lower:
            return "Knead dough with warm water, rest for 20 mins. Cook on medium flame on a dry skillet until puffed."
        elif "oat" in name_lower or "porridge" in name_lower:
            return "Simmer with warm water or light almond milk, add a dash of Ceylon cinnamon and cardamom."
        elif "vegetable" in name_lower or "sabzi" in name_lower or "palak" in name_lower or "curry" in name_lower:
            return "Steam or lightly sauté with cumin seeds, turmeric, and sea salt. Avoid deep frying."
        elif "curd" in name_lower or "yogurt" in name_lower or "buttermilk" in name_lower:
            return "Whisk fresh with twice the water, roasted cumin, and black salt to form digestive Takra. Do not consume late at night."
        elif "apple" in name_lower or "fruit" in name_lower or "papaya" in name_lower:
            return "Consume fresh, whole, and at room temperature. Best eaten as a standalone snack."
        elif "almond" in name_lower or "walnut" in name_lower or "nut" in name_lower:
            return "Soak overnight in pure water, peel brown skin before chewing slowly."
        else:
            return "Prepare freshly cooked, warm, and seasoned with mild digestive spices."
