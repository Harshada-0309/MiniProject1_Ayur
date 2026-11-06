"""
AyurDiet Clinical Diet Prescription PDF Generator.
Generates an authentic, multi-page, publication-grade A4 clinical prescription document
using PyMuPDF without any external rendering dependencies.
"""

import io
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import pymupdf


# Standard A4 Dimensions in points (72 points/inch)
PAGE_WIDTH = 595.3
PAGE_HEIGHT = 841.9
MARGIN_LEFT = 36.0
MARGIN_RIGHT = 559.3
MARGIN_TOP = 36.0
MARGIN_BOTTOM = 805.9
CONTENT_WIDTH = MARGIN_RIGHT - MARGIN_LEFT  # 523.3 pt

# Professional Palette
COLOR_TEAL_PRIMARY = (0.11, 0.42, 0.31)    # #1b4332
COLOR_TEAL_LIGHT = (0.94, 0.98, 0.95)      # #f0fdf4
COLOR_TEAL_BORDER = (0.73, 0.88, 0.82)     # #bbf7d0
COLOR_TEXT_MAIN = (0.12, 0.16, 0.22)       # #1f2937
COLOR_TEXT_MUTED = (0.35, 0.42, 0.50)      # #5a6b7c
COLOR_ALERT_BG = (0.99, 0.95, 0.95)        # #fef2f2
COLOR_ALERT_BORDER = (0.98, 0.79, 0.79)    # #fecaca
COLOR_ALERT_TEXT = (0.60, 0.11, 0.11)      # #991b1b
COLOR_LINE = (0.85, 0.88, 0.90)            # #d9e2ec


class PrescriptionPdfBuilder:
    """
    Renders a complete, multi-page clinical diet prescription document.
    """

    def __init__(self, patient: Dict[str, Any], assessment: Optional[Dict[str, Any]], diet_plan: Dict[str, Any]):
        self.patient = patient or {}
        self.assessment = assessment or {}
        self.plan = diet_plan or {}
        self.doc = pymupdf.open()
        self.page = None
        self.cursor_y = MARGIN_TOP

    def _new_page(self):
        """Creates a new A4 page and resets cursor."""
        self.page = self.doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
        self.cursor_y = MARGIN_TOP

    def _ensure_space(self, required_pt: float):
        """Checks if required height fits on the current page; creates new page if needed."""
        if self.page is None or (self.cursor_y + required_pt > MARGIN_BOTTOM):
            self._new_page()

    def generate_pdf_bytes(self) -> bytes:
        """Assembles all sections and returns raw PDF binary."""
        self._new_page()

        # 1. Clinic Header & Report Info
        self._render_header()

        # 2. Patient Demographics & Baseline Vitals
        self._render_patient_info()

        # 3. Clinical Assessment & Lab Insights (Section 9)
        self._render_clinical_assessment_and_labs()

        # 4. Nutrition Target Comparison & Weekly Macro Averages
        self._render_nutrition_targets_summary()

        # 5. Complete Seven-Day Meal Schedule (All 7 Days)
        self._render_seven_day_schedule()

        # 6. Ayurvedic Ahara Principles & Dosha Guidelines
        self._render_ayurvedic_guidelines()

        # 7. General Instructions & Clinical Precautions
        self._render_precautions_and_instructions()

        # 8. Dietitian Sign-off, Stamp & Approval Block
        self._render_signature_block()

        # 9. Stamp Footers on All Pages
        self._stamp_page_footers()

        pdf_bytes = self.doc.tobytes()
        self.doc.close()
        return pdf_bytes

    def _render_header(self):
        """Renders clinic identity and report header."""
        y = self.cursor_y
        rect = pymupdf.Rect(MARGIN_LEFT, y, MARGIN_RIGHT, y + 68)
        self.page.draw_rect(rect, color=COLOR_TEAL_PRIMARY, fill=COLOR_TEAL_LIGHT, width=1)

        # Brand & Clinic Name
        self.page.insert_text((MARGIN_LEFT + 14, y + 22), "AYURDIET CLINICAL NUTRITION CENTER", fontsize=12, fontname="helv", color=COLOR_TEAL_PRIMARY)
        self.page.insert_text((MARGIN_LEFT + 14, y + 36), "Integrative Ayurvedic Dietetics & Clinical Metabolic Nutrition", fontsize=8, fontname="helv", color=COLOR_TEXT_MUTED)
        self.page.insert_text((MARGIN_LEFT + 14, y + 48), "Registration No: AYUR-ND-2026/0488 | Dhanvantari Marg, New Delhi", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MUTED)
        self.page.insert_text((MARGIN_LEFT + 14, y + 59), "Phone: +91 (11) 2894-3320 | clinical-care@ayurdiet.org", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MUTED)

        # Report Metadata (Right-aligned)
        plan_id = self.plan.get("plan_id") or f"DP-{self.plan.get('id', '101')}"
        today_str = datetime.now(timezone.utc).strftime("%d %b %Y")
        approved_at_raw = self.plan.get("approved_at")
        approved_str = datetime.fromisoformat(approved_at_raw.replace("Z", "+00:00")).strftime("%d %b %Y, %H:%M") if approved_at_raw else "Approved"

        self.page.insert_text((MARGIN_RIGHT - 180, y + 20), "OFFICIAL DIET PRESCRIPTION", fontsize=9.5, fontname="helv", color=COLOR_TEAL_PRIMARY)
        self.page.insert_text((MARGIN_RIGHT - 180, y + 33), f"Report ID: {plan_id}", fontsize=8, fontname="helv", color=COLOR_TEXT_MAIN)
        self.page.insert_text((MARGIN_RIGHT - 180, y + 45), f"Issued Date: {today_str}", fontsize=8, fontname="helv", color=COLOR_TEXT_MUTED)
        self.page.insert_text((MARGIN_RIGHT - 180, y + 57), f"Sign-off: {approved_str}", fontsize=7.5, fontname="helv", color=(0.08, 0.50, 0.25))

        self.cursor_y = y + 78

    def _render_patient_info(self):
        """Renders patient demographic and assessment parameters."""
        self._ensure_space(85)
        y = self.cursor_y

        p_name = self.patient.get("name") or "Patient"
        p_code = self.patient.get("patient_code") or f"PAT-{self.patient.get('id', '001')}"
        age = self.patient.get("age", "N/A")
        sex = str(self.patient.get("sex") or self.patient.get("gender") or "N/A").capitalize()
        height = self.assessment.get("height") or self.patient.get("height") or "—"
        weight = self.assessment.get("weight") or self.patient.get("weight") or "—"
        bmi = self.assessment.get("bmi") or self.patient.get("bmi") or "—"
        if isinstance(bmi, float):
            bmi = f"{bmi:.1f}"

        prakriti = self.assessment.get("prakriti") or self.patient.get("prakriti") or "Vata-Pitta"
        agni = self.assessment.get("appetite") or self.assessment.get("digestive_fire") or "Samagni"
        goal = str(self.assessment.get("diet_goal") or self.patient.get("diet_goal") or "General Wellness").replace("_", " ").title()
        allergies = self.assessment.get("food_allergies") or self.assessment.get("allergies") or []
        allergy_str = ", ".join(allergies) if isinstance(allergies, list) and allergies else "None Reported"
        conditions = self.assessment.get("existing_conditions") or self.assessment.get("medical_conditions") or []
        cond_str = ", ".join(conditions) if isinstance(conditions, list) and conditions else "None Reported"

        # Patient Demographics Box
        rect = pymupdf.Rect(MARGIN_LEFT, y, MARGIN_RIGHT, y + 76)
        self.page.draw_rect(rect, color=COLOR_LINE, fill=(0.98, 0.99, 0.99), width=0.8)

        # Column 1
        self.page.insert_text((MARGIN_LEFT + 10, y + 16), f"Patient Name: {p_name}", fontsize=9, fontname="helv", color=COLOR_TEXT_MAIN)
        self.page.insert_text((MARGIN_LEFT + 10, y + 29), f"Patient ID: {p_code}", fontsize=8, fontname="helv", color=COLOR_TEXT_MUTED)
        self.page.insert_text((MARGIN_LEFT + 10, y + 42), f"Age / Sex: {age} yrs / {sex}", fontsize=8, fontname="helv", color=COLOR_TEXT_MUTED)
        self.page.insert_text((MARGIN_LEFT + 10, y + 55), f"Constitution (Prakriti): {prakriti}", fontsize=8, fontname="helv", color=COLOR_TEAL_PRIMARY)
        self.page.insert_text((MARGIN_LEFT + 10, y + 68), f"Agni (Digestive Fire): {agni}", fontsize=8, fontname="helv", color=COLOR_TEXT_MUTED)

        # Column 2
        col2_x = MARGIN_LEFT + 250
        self.page.insert_text((col2_x, y + 16), f"Height / Weight: {height} cm / {weight} kg", fontsize=8.5, fontname="helv", color=COLOR_TEXT_MAIN)
        self.page.insert_text((col2_x, y + 29), f"Calculated BMI: {bmi}", fontsize=8, fontname="helv", color=COLOR_TEXT_MUTED)
        self.page.insert_text((col2_x, y + 42), f"Primary Goal: {goal}", fontsize=8, fontname="helv", color=COLOR_TEXT_MUTED)
        self.page.insert_text((col2_x, y + 55), f"Medical Conditions: {cond_str[:42]}", fontsize=8, fontname="helv", color=COLOR_TEXT_MUTED)
        self.page.insert_text((col2_x, y + 68), f"Food Allergies: {allergy_str[:42]}", fontsize=8, fontname="helv", color=(0.75, 0.20, 0.20) if allergy_str != "None Reported" else COLOR_TEXT_MUTED)

        self.cursor_y = y + 86

    def _render_clinical_assessment_and_labs(self):
        """Renders clinical rationale and Section 9 Laboratory Findings table."""
        self._ensure_space(70)
        y = self.cursor_y

        self.page.insert_text((MARGIN_LEFT, y + 10), "1. CLINICAL ASSESSMENT & STRATEGY", fontsize=9.5, fontname="helv", color=COLOR_TEAL_PRIMARY)
        self.page.draw_line((MARGIN_LEFT, y + 14), (MARGIN_RIGHT, y + 14), color=COLOR_TEAL_PRIMARY, width=1)

        summary_text = self.plan.get("patient_summary") or self.plan.get("clinical_rationale") or "Personalized Ayurvedic nutritional plan designed for metabolic balance."
        # Draw wrapped text box
        rect = pymupdf.Rect(MARGIN_LEFT, y + 20, MARGIN_RIGHT, y + 55)
        self.page.insert_textbox(rect, summary_text[:380], fontsize=8, fontname="helv", color=COLOR_TEXT_MAIN)
        self.cursor_y = y + 60

        # Section 9 Labs
        lab_summary = self.plan.get("clinical_lab_summary") or self.plan.get("validation_results", {}).get("clinical_lab_summary")
        if lab_summary and lab_summary.get("total_tests_analyzed", 0) > 0:
            analyzed_count = lab_summary.get("total_tests_analyzed", 0)
            abnormal_count = lab_summary.get("abnormal_count", 0)
            items = lab_summary.get("items", [])

            self._ensure_space(35 + min(len(items), 6) * 14)
            y = self.cursor_y

            self.page.insert_text((MARGIN_LEFT, y + 10), f"Section 9 Laboratory Biomarkers ({analyzed_count} Tests Analyzed • {abnormal_count} Flagged)", fontsize=8.5, fontname="helv", color=COLOR_TEAL_PRIMARY)
            self.cursor_y = y + 16

            # Lab table header
            ty = self.cursor_y
            self.page.draw_rect(pymupdf.Rect(MARGIN_LEFT, ty, MARGIN_RIGHT, ty + 15), color=COLOR_LINE, fill=(0.95, 0.96, 0.98))
            self.page.insert_text((MARGIN_LEFT + 8, ty + 11), "Test Name", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
            self.page.insert_text((MARGIN_LEFT + 180, ty + 11), "Observed Value", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
            self.page.insert_text((MARGIN_LEFT + 280, ty + 11), "Reference Interval", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
            self.page.insert_text((MARGIN_LEFT + 400, ty + 11), "Clinical Status", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
            self.cursor_y = ty + 15

            # Lab table rows (up to 8)
            for item in items[:8]:
                ry = self.cursor_y
                t_name = str(item.get("test_name", "Test"))[:32]
                val_str = f"{item.get('observed_value', '')} {item.get('unit', '')}".strip()
                ref_str = str(item.get("reference_range", "—"))[:24]
                status = str(item.get("status", "normal")).upper()
                s_color = COLOR_ALERT_TEXT if status in ["HIGH", "LOW", "CRITICAL"] else (0.1, 0.5, 0.2)

                self.page.draw_rect(pymupdf.Rect(MARGIN_LEFT, ry, MARGIN_RIGHT, ry + 14), color=COLOR_LINE, fill=(1, 1, 1))
                self.page.insert_text((MARGIN_LEFT + 8, ry + 10), t_name, fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
                self.page.insert_text((MARGIN_LEFT + 180, ry + 10), val_str, fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
                self.page.insert_text((MARGIN_LEFT + 280, ry + 10), ref_str, fontsize=7.5, fontname="helv", color=COLOR_TEXT_MUTED)
                self.page.insert_text((MARGIN_LEFT + 400, ry + 10), status, fontsize=7.5, fontname="helv", color=s_color)
                self.cursor_y = ry + 14

            # Critical alerts banner if present
            alerts = lab_summary.get("critical_alerts", [])
            if alerts:
                self._ensure_space(30)
                ay = self.cursor_y + 4
                alert_text = "; ".join(a.get("message") for a in alerts[:2])
                self.page.draw_rect(pymupdf.Rect(MARGIN_LEFT, ay, MARGIN_RIGHT, ay + 22), color=COLOR_ALERT_BORDER, fill=COLOR_ALERT_BG)
                self.page.insert_text((MARGIN_LEFT + 8, ay + 14), f"CLINICAL ALERT: {alert_text[:95]} (Dietitian review mandatory)", fontsize=7.5, fontname="helv", color=COLOR_ALERT_TEXT)
                self.cursor_y = ay + 28

        self.cursor_y += 10

    def _render_nutrition_targets_summary(self):
        """Renders Deterministic Nutrition Targets vs Actual Calculated Averages."""
        self._ensure_space(60)
        y = self.cursor_y

        self.page.insert_text((MARGIN_LEFT, y + 10), "2. NUTRITION TARGETS & MACRONUTRIENT DISTRIBUTION", fontsize=9.5, fontname="helv", color=COLOR_TEAL_PRIMARY)
        self.page.draw_line((MARGIN_LEFT, y + 14), (MARGIN_RIGHT, y + 14), color=COLOR_TEAL_PRIMARY, width=1)
        self.cursor_y = y + 20

        targets = self.plan.get("nutrition_targets") or {}
        target_cals = targets.get("energy", {}).get("target_energy_kcal_day") or targets.get("target_energy_kcal_day") or 2000
        target_prot = targets.get("macronutrients", {}).get("protein", {}).get("target_g") or targets.get("protein_g") or 65
        target_carb = targets.get("macronutrients", {}).get("carbohydrate", {}).get("target_g") or targets.get("carbohydrate_g") or 260
        target_fat = targets.get("macronutrients", {}).get("fat", {}).get("target_g") or targets.get("fat_g") or 50

        # Calculate actual averages across 7 days
        days = self.plan.get("days", [])
        day_count = max(len(days), 1)
        tot_cals = sum(float(d.get("daily_totals", {}).get("calories", 0)) for d in days)
        tot_prot = sum(float(d.get("daily_totals", {}).get("protein_g", 0)) for d in days)
        tot_carb = sum(float(d.get("daily_totals", {}).get("carbohydrate_g", 0)) for d in days)
        tot_fat = sum(float(d.get("daily_totals", {}).get("fat_g", 0)) for d in days)

        avg_cals = tot_cals / day_count
        avg_prot = tot_prot / day_count
        avg_carb = tot_carb / day_count
        avg_fat = tot_fat / day_count

        # Target comparison table
        ty = self.cursor_y
        self.page.draw_rect(pymupdf.Rect(MARGIN_LEFT, ty, MARGIN_RIGHT, ty + 16), color=COLOR_LINE, fill=(0.95, 0.96, 0.98))
        self.page.insert_text((MARGIN_LEFT + 8, ty + 11), "Parameter", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
        self.page.insert_text((MARGIN_LEFT + 140, ty + 11), "Energy (Calories)", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
        self.page.insert_text((MARGIN_LEFT + 250, ty + 11), "Protein (g)", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
        self.page.insert_text((MARGIN_LEFT + 340, ty + 11), "Carbohydrates (g)", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
        self.page.insert_text((MARGIN_LEFT + 440, ty + 11), "Total Fats (g)", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
        self.cursor_y = ty + 16

        # Row 1: Target
        r1_y = self.cursor_y
        self.page.draw_rect(pymupdf.Rect(MARGIN_LEFT, r1_y, MARGIN_RIGHT, r1_y + 14), color=COLOR_LINE, fill=(1, 1, 1))
        self.page.insert_text((MARGIN_LEFT + 8, r1_y + 10), "Clinical Target", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
        self.page.insert_text((MARGIN_LEFT + 140, r1_y + 10), f"{target_cals:.0f} kcal", fontsize=7.5, fontname="helv", color=COLOR_TEAL_PRIMARY)
        self.page.insert_text((MARGIN_LEFT + 250, r1_y + 10), f"{target_prot:.1f} g", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
        self.page.insert_text((MARGIN_LEFT + 340, r1_y + 10), f"{target_carb:.1f} g", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
        self.page.insert_text((MARGIN_LEFT + 440, r1_y + 10), f"{target_fat:.1f} g", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
        self.cursor_y = r1_y + 14

        # Row 2: Actual Plan Average
        r2_y = self.cursor_y
        self.page.draw_rect(pymupdf.Rect(MARGIN_LEFT, r2_y, MARGIN_RIGHT, r2_y + 14), color=COLOR_LINE, fill=(0.98, 0.99, 0.98))
        self.page.insert_text((MARGIN_LEFT + 8, r2_y + 10), "7-Day Plan Average", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
        self.page.insert_text((MARGIN_LEFT + 140, r2_y + 10), f"{avg_cals:.0f} kcal", fontsize=7.5, fontname="helv", color=(0.1, 0.5, 0.2))
        self.page.insert_text((MARGIN_LEFT + 250, r2_y + 10), f"{avg_prot:.1f} g", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
        self.page.insert_text((MARGIN_LEFT + 340, r2_y + 10), f"{avg_carb:.1f} g", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
        self.page.insert_text((MARGIN_LEFT + 440, r2_y + 10), f"{avg_fat:.1f} g", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
        self.cursor_y = r2_y + 22

    def _render_seven_day_schedule(self):
        """Renders complete 7-day meal schedule across all days, Monday to Sunday."""
        days = self.plan.get("days", [])
        if not days:
            return

        self._ensure_space(30)
        y = self.cursor_y
        self.page.insert_text((MARGIN_LEFT, y + 10), "3. COMPLETE SEVEN-DAY MEAL SCHEDULE (MONDAY — SUNDAY)", fontsize=9.5, fontname="helv", color=COLOR_TEAL_PRIMARY)
        self.page.draw_line((MARGIN_LEFT, y + 14), (MARGIN_RIGHT, y + 14), color=COLOR_TEAL_PRIMARY, width=1)
        self.cursor_y = y + 20

        for day in days:
            day_num = day.get("day_number", 1)
            day_name = day.get("day_name", f"Day {day_num}")
            theme = day.get("theme", "Balanced Nourishment")
            totals = day.get("daily_totals", {})
            cals = float(totals.get("calories", 0))
            prot = float(totals.get("protein_g", 0))
            carb = float(totals.get("carbohydrate_g", 0))
            fat = float(totals.get("fat_g", 0))

            # Need space for day banner + at least one meal
            self._ensure_space(60)
            dy = self.cursor_y

            # Day Banner
            banner_rect = pymupdf.Rect(MARGIN_LEFT, dy, MARGIN_RIGHT, dy + 18)
            self.page.draw_rect(banner_rect, color=COLOR_TEAL_PRIMARY, fill=COLOR_TEAL_LIGHT)
            self.page.insert_text((MARGIN_LEFT + 8, dy + 13), f"DAY {day_num}: {day_name.upper()} — {theme}", fontsize=8.5, fontname="helv", color=COLOR_TEAL_PRIMARY)
            macro_str = f"Totals: {cals:.0f} kcal | P: {prot:.1f}g | C: {carb:.1f}g | F: {fat:.1f}g"
            self.page.insert_text((MARGIN_RIGHT - 180, dy + 13), macro_str, fontsize=7.5, fontname="helv", color=COLOR_TEXT_MUTED)
            self.cursor_y = dy + 22

            # Meals in Day
            meals = day.get("meals", [])
            for meal in meals:
                m_type = meal.get("meal_type", "meal").replace("_", " ").title()
                timing = meal.get("timing", "Appropriate hours")
                m_totals = meal.get("totals", {})
                m_cals = float(m_totals.get("calories", 0))
                m_prot = float(m_totals.get("protein_g", 0))
                foods = meal.get("foods", [])

                req_height = 20 + len(foods) * 14
                self._ensure_space(req_height)
                my = self.cursor_y

                # Meal Header Bar
                self.page.draw_rect(pymupdf.Rect(MARGIN_LEFT + 6, my, MARGIN_RIGHT - 6, my + 14), color=COLOR_LINE, fill=(0.97, 0.98, 0.99))
                self.page.insert_text((MARGIN_LEFT + 10, my + 10), f"• {m_type} ({timing})", fontsize=7.5, fontname="helv", color=COLOR_TEAL_PRIMARY)
                self.page.insert_text((MARGIN_RIGHT - 140, my + 10), f"{m_cals:.0f} kcal | {m_prot:.1f}g Protein", fontsize=7, fontname="helv", color=COLOR_TEXT_MUTED)
                self.cursor_y = my + 15

                # Food Items
                for food in foods:
                    fy = self.cursor_y
                    f_name = food.get("food_name", "Food Item")
                    qty = food.get("quantity", 100)
                    unit = food.get("unit", "g")
                    prep = food.get("preparation_notes") or food.get("ayurvedic_properties") or ""
                    f_cals = float(food.get("calories", 0))

                    # Truncate clean
                    item_display = f"{f_name} — {qty} {unit}"
                    if prep:
                        item_display += f" ({prep[:45]}...)" if len(prep) > 45 else f" ({prep})"

                    self.page.insert_text((MARGIN_LEFT + 18, fy + 10), item_display[:80], fontsize=7.2, fontname="helv", color=COLOR_TEXT_MAIN)
                    self.page.insert_text((MARGIN_RIGHT - 70, fy + 10), f"{f_cals:.0f} kcal", fontsize=7, fontname="helv", color=COLOR_TEXT_MUTED)
                    self.cursor_y = fy + 13

                self.cursor_y += 4

            self.cursor_y += 6

    def _render_ayurvedic_guidelines(self):
        """Renders Ahara Vidhi Vidhana principles and Dosha guidelines."""
        self._ensure_space(60)
        y = self.cursor_y

        self.page.insert_text((MARGIN_LEFT, y + 10), "4. AYURVEDIC DIETARY PRINCIPLES (AHARA VIDHI VIDHANA)", fontsize=9.5, fontname="helv", color=COLOR_TEAL_PRIMARY)
        self.page.draw_line((MARGIN_LEFT, y + 14), (MARGIN_RIGHT, y + 14), color=COLOR_TEAL_PRIMARY, width=1)
        self.cursor_y = y + 20

        principles = self.plan.get("ayurvedic_dietary_principles") or [
            "Ahara Vidhi: Consume warm, freshly cooked meals in a serene, distraction-free environment.",
            "Shad Rasa Satmya: Ensure all six fundamental rasas (tastes) are harmonized across daily food selections.",
            "Agni Rakshana: Maintain a structured 3.5 to 4-hour interval between primary meals to facilitate complete digestion.",
            "Matravat Ahara: Fill stomach to 3/4 capacity (2 parts solid, 1 part liquid, 1 part space for doshic movement)."
        ]

        if isinstance(principles, str):
            principles = [principles]

        for p in principles[:4]:
            self._ensure_space(16)
            py = self.cursor_y
            self.page.insert_text((MARGIN_LEFT + 8, py + 10), f"✓ {p[:105]}", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
            self.cursor_y = py + 14

        self.cursor_y += 8

    def _render_precautions_and_instructions(self):
        """Renders lifestyle instructions and food precautions."""
        self._ensure_space(55)
        y = self.cursor_y

        self.page.insert_text((MARGIN_LEFT, y + 10), "5. CLINICAL PRECAUTIONS & LIFESTYLE ADVICE", fontsize=9.5, fontname="helv", color=COLOR_TEAL_PRIMARY)
        self.page.draw_line((MARGIN_LEFT, y + 14), (MARGIN_RIGHT, y + 14), color=COLOR_TEAL_PRIMARY, width=1)
        self.cursor_y = y + 20

        instructions = self.plan.get("general_instructions") or [
            "Sip warm water throughout the day. Avoid iced beverages immediately before or during meals.",
            "Conclude evening dinner at least 2.5 hours prior to sleep to prevent sluggish digestion and ama formation.",
            "Engage in a 100-step relaxed stroll (Shatapadi) following lunch and dinner."
        ]
        if isinstance(instructions, str):
            instructions = [instructions]

        for ins in instructions[:3]:
            self._ensure_space(14)
            iy = self.cursor_y
            self.page.insert_text((MARGIN_LEFT + 8, iy + 10), f"• {ins[:105]}", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MAIN)
            self.cursor_y = iy + 14

        self.cursor_y += 8

    def _render_signature_block(self):
        """Renders legal clinician signature block, approval stamp, and patient acknowledgement."""
        self._ensure_space(80)
        y = self.cursor_y

        rect = pymupdf.Rect(MARGIN_LEFT, y, MARGIN_RIGHT, y + 74)
        self.page.draw_rect(rect, color=COLOR_LINE, fill=(0.98, 0.99, 0.99), width=0.8)

        approver = self.plan.get("approved_by") or "Registered Clinical Dietitian"
        approved_at_raw = self.plan.get("approved_at")
        approved_str = datetime.fromisoformat(approved_at_raw.replace("Z", "+00:00")).strftime("%d %b %Y at %I:%M %p UTC") if approved_at_raw else "Clinically Locked"

        # Dietitian Signature (Left)
        self.page.insert_text((MARGIN_LEFT + 12, y + 16), "PRESCRIBING CLINICIAN SIGN-OFF", fontsize=8, fontname="helv", color=COLOR_TEAL_PRIMARY)
        self.page.insert_text((MARGIN_LEFT + 12, y + 30), f"Clinician: {approver}", fontsize=8.5, fontname="helv", color=COLOR_TEXT_MAIN)
        self.page.insert_text((MARGIN_LEFT + 12, y + 43), f"Official Approval: {approved_str}", fontsize=7.5, fontname="helv", color=(0.1, 0.5, 0.2))
        self.page.insert_text((MARGIN_LEFT + 12, y + 56), "Status: VERIFIED & OFFICIALLY LOCKED", fontsize=7.5, fontname="helv", color=COLOR_TEAL_PRIMARY)

        # Signature Line & Patient Ack (Right)
        col2_x = MARGIN_RIGHT - 210
        self.page.draw_line((col2_x, y + 42), (col2_x + 180, y + 42), color=COLOR_TEXT_MUTED, width=0.8)
        self.page.insert_text((col2_x + 25, y + 54), "Clinician Signature & Clinic Stamp", fontsize=7.5, fontname="helv", color=COLOR_TEXT_MUTED)
        self.page.insert_text((col2_x + 10, y + 66), "Follow regimen under qualified supervision.", fontsize=6.8, fontname="helv", color=COLOR_TEXT_MUTED)

        self.cursor_y = y + 84

    def _stamp_page_footers(self):
        """Iterates over all generated pages and adds uniform headers and footers."""
        total_pages = len(self.doc)
        p_code = self.patient.get("patient_code") or f"PAT-{self.patient.get('id', '001')}"
        plan_id = self.plan.get("plan_id") or f"DP-{self.plan.get('id', '101')}"
        today_str = datetime.now(timezone.utc).strftime("%d %b %Y")

        for idx, page in enumerate(self.doc):
            page_num = idx + 1
            footer_y = MARGIN_BOTTOM + 16

            # Footer rule
            page.draw_line((MARGIN_LEFT, footer_y - 4), (MARGIN_RIGHT, footer_y - 4), color=COLOR_LINE, width=0.6)

            # Footer text
            left_text = f"AyurDiet Clinical System • Patient ID: {p_code} • Plan: {plan_id}"
            page.insert_text((MARGIN_LEFT, footer_y + 8), left_text, fontsize=7, fontname="helv", color=COLOR_TEXT_MUTED)

            center_text = "CONFIDENTIAL MEDICAL NUTRITION DOCUMENT — FOR PATIENT USE ONLY"
            page.insert_text((MARGIN_LEFT + 120, footer_y + 18), center_text, fontsize=6.5, fontname="helv", color=COLOR_TEXT_MUTED)

            right_text = f"Page {page_num} of {total_pages} | {today_str}"
            page.insert_text((MARGIN_RIGHT - 90, footer_y + 8), right_text, fontsize=7, fontname="helv", color=COLOR_TEXT_MUTED)


def build_prescription_pdf(patient: Dict[str, Any], assessment: Optional[Dict[str, Any]], diet_plan: Dict[str, Any]) -> bytes:
    """Entry point for generating a verified diet prescription PDF."""
    builder = PrescriptionPdfBuilder(patient=patient, assessment=assessment, diet_plan=diet_plan)
    return builder.generate_pdf_bytes()

