"""
Ayurvedic & Evidence-Based Clinical Dietary Rules for Laboratory Findings.
Maps normalized laboratory derangements and normal patterns to clinical rationale snippets,
food emphasis, food restrictions, and nutrient precautions.
"""

from typing import List, Dict, Any, Tuple
from .models import NormalizedLabItem, LabDietaryGuideline, LabStatus


def generate_lab_dietary_guidelines(
    items: List[NormalizedLabItem],
    patient_assessment: Dict[str, Any]
) -> Tuple[List[LabDietaryGuideline], List[str], List[str], Dict[str, bool]]:
    """
    Synthesizes clinical and Ayurvedic dietary recommendations from normalized lab findings.
    Returns (guidelines, emphasized_foods, contraindicated_foods, condition_flags).
    """
    guidelines: List[LabDietaryGuideline] = []
    emphasized_foods: List[str] = []
    contraindicated_foods: List[str] = []

    flags = {
        "has_renal_impairment": False,
        "has_hyperkalemia_risk": False,
        "has_hypokalemia": False,
        "has_glycemic_derangement": False,
        "has_calcium_derangement": False,
        "has_anemia_or_iron_deficiency": False,
        "has_dyslipidemia": False,
        "has_thyroid_derangement": False,
        "all_normal": False,
    }

    if not items:
        return guidelines, emphasized_foods, contraindicated_foods, flags

    abnormal_items = [it for it in items if it.status in [LabStatus.LOW, LabStatus.HIGH, LabStatus.CRITICAL_LOW, LabStatus.CRITICAL_HIGH]]

    if not abnormal_items:
        flags["all_normal"] = True
        guidelines.append(LabDietaryGuideline(
            finding="All reported laboratory parameters are within normal reference intervals.",
            food_recommendations=[
                "Wholesome seasonal grains (Barley, red/brown rice, whole wheat)",
                "Easily digestible pulses (Moong dal, masoor dal)",
                "Fresh seasonal vegetables and fruits aligned with dominant Prakriti",
                "Healthy fats in moderation (Pure cow's ghee, cold-pressed sesame or mustard oil)"
            ],
            foods_to_avoid_or_limit=["Ultra-processed foods", "Refined sugars", "Excessive deep-fried items"],
            ayurvedic_perspective="Dhatusamya (physiological equilibrium of bodily tissues). No therapeutic restrictions needed; focus on Ritucharya (seasonal alignment) and preserving Agni.",
            nutrient_cautions=["Maintain balanced macro and micronutrient distribution matching baseline targets."],
            requires_dietitian_review=False,
            rationale="Normal laboratory profile indicates stable metabolic equilibrium. Preserving baseline Ayurvedic dietary balance."
        ))
        return guidelines, emphasized_foods, contraindicated_foods, flags

    # 1. Glycemic Derangements (Elevated Glucose / HbA1c)
    fbs_item = next((it for it in items if it.canonical_key == "glucose_fasting"), None)
    a1c_item = next((it for it in items if it.canonical_key == "hba1c"), None)
    if (fbs_item and fbs_item.status in [LabStatus.HIGH, LabStatus.CRITICAL_HIGH]) or \
       (a1c_item and a1c_item.status in [LabStatus.HIGH, LabStatus.CRITICAL_HIGH]):
        flags["has_glycemic_derangement"] = True
        val_str = []
        if fbs_item: val_str.append(f"FBS {fbs_item.numeric_value} mg/dL")
        if a1c_item: val_str.append(f"HbA1c {a1c_item.numeric_value}%")

        recs = [
            "Barley (Yava) porridge or rotis (rich in beta-glucans, low GI)",
            "Bitter gourd (Karela) and Ivy gourd (Kundru) cooked with mild spices",
            "Fenugreek seeds (Methi) soaked overnight or added to dal",
            "Indian gooseberry (Amla) fresh or in warm water",
            "Green gram (Moong Dal) and horse gram (Kulatti)",
            "Cinnamon (Twak) and turmeric (Haridra)"
        ]
        avoids = [
            "Refined wheat flour (Maida)", "White polished rice",
            "Refined sugar and jaggery", "Sweetened beverages and packaged fruit juices",
            "Deep-fried snacks (Samosas, pakoras)"
        ]
        emphasized_foods.extend(["Barley / Yava", "Bitter Gourd / Karela", "Fenugreek / Methi", "Amla", "Moong Dal"])
        contraindicated_foods.extend(["Refined Sugar", "White Flour / Maida", "Sweetened Juices"])

        guidelines.append(LabDietaryGuideline(
            finding=f"Elevated Glycemic Markers ({', '.join(val_str)}) indicating impaired glucose regulation (Prameha trend).",
            food_recommendations=recs,
            foods_to_avoid_or_limit=avoids,
            ayurvedic_perspective="Prameha-hara (anti-diabetic) principles emphasizing Tikta (bitter) and Kashaya (astringent) tastes to clear excess Kleda (metabolic fluidity) and pacify Kapha.",
            nutrient_cautions=["Consistent carbohydrate intake across meals; avoid skipping meals if on hypoglycemic agents."],
            requires_dietitian_review=True,
            rationale="Glycemic elevation requires low glycemic index substitutions and carbohydrate pacing to blunt postprandial glucose excursions."
        ))

    # 2. Renal Impairment (Elevated Creatinine, Low eGFR, High BUN)
    cr_item = next((it for it in items if it.canonical_key == "creatinine"), None)
    egfr_item = next((it for it in items if it.canonical_key == "egfr"), None)
    bun_item = next((it for it in items if it.canonical_key == "urea_bun"), None)

    is_renal_abnormal = (
        (cr_item and cr_item.status in [LabStatus.HIGH, LabStatus.CRITICAL_HIGH]) or
        (egfr_item and (egfr_item.status in [LabStatus.LOW, LabStatus.CRITICAL_LOW] or (egfr_item.numeric_value and egfr_item.numeric_value < 60))) or
        (bun_item and bun_item.status in [LabStatus.HIGH, LabStatus.CRITICAL_HIGH])
    )
    if is_renal_abnormal:
        flags["has_renal_impairment"] = True
        renal_strs = []
        if cr_item: renal_strs.append(f"Creatinine {cr_item.numeric_value} mg/dL")
        if egfr_item: renal_strs.append(f"eGFR {egfr_item.numeric_value} mL/min/1.73m2")
        if bun_item: renal_strs.append(f"BUN {bun_item.numeric_value} mg/dL")

        recs = [
            "Bottle gourd (Lauki), Ridge gourd (Turai), and Pointed gourd (Parwal)",
            "Ash gourd (Kushmanda) soup with cumin and coriander",
            "Well-cooked Shali white rice (easier to digest, lower mineral burden)",
            "Diluted yellow moong dal soup in controlled portions",
            "Apples, pears, and papaya in moderate portions"
        ]
        avoids = [
            "High-protein pulse overloading (Chana, Rajma, Urad, soy)",
            "Tender coconut water and excessive bananas (due to potassium accumulation risk)",
            "Pickles, papads, and canned foods with high sodium",
            "Processed meats and protein powders",
            "Excess raw dark leafy greens and tomato-heavy purees"
        ]
        emphasized_foods.extend(["Bottle Gourd / Lauki", "Ridge Gourd / Turai", "Ash Gourd / Kushmanda"])
        contraindicated_foods.extend(["Protein Overloading", "Tender Coconut Water (Renal Precaution)", "High-Sodium Pickles"])

        guidelines.append(LabDietaryGuideline(
            finding=f"Impaired Kidney Function / Reduced Filtration ({', '.join(renal_strs)}).",
            food_recommendations=recs,
            foods_to_avoid_or_limit=avoids,
            ayurvedic_perspective="Vrikka (kidney) support prioritizing Laghu (light), Mutrala (gentle diuretic), and Sheeta (cooling) foods that prevent Mutravaha srotas (urinary channel) obstruction.",
            nutrient_cautions=[
                "Strict protein moderation to 0.6 - 0.8 g/kg body weight/day to reduce nitrogenous load.",
                "Sodium restriction (< 1500-2000 mg/day).",
                "Close monitoring of dietary potassium and phosphorus."
            ],
            requires_dietitian_review=True,
            rationale="Reduced GFR and nitrogenous retention necessitate controlled protein intake and restricted mineral load to avoid hyperkalemia and renal stress."
        ))

    # 3. Potassium Derangements
    k_item = next((it for it in items if it.canonical_key == "potassium"), None)
    if k_item:
        if k_item.status in [LabStatus.LOW, LabStatus.CRITICAL_LOW]:
            flags["has_hypokalemia"] = True
            # Check if patient has renal impairment; if so, potassium loading is restricted!
            if flags["has_renal_impairment"]:
                guidelines.append(LabDietaryGuideline(
                    finding=f"Low Potassium ({k_item.numeric_value} mEq/L) in context of impaired kidney function.",
                    food_recommendations=["Mildly potassium-supportive cooked squash, moong dal in planned portions"],
                    foods_to_avoid_or_limit=["Aggressive potassium loading", "Potassium chloride salt substitutes"],
                    ayurvedic_perspective="Gentle electrolyte restoration without overwhelming renal filtration capacity.",
                    nutrient_cautions=["Renal impairment limits potassium clearance. Medical electrolyte correction required; do not self-supplement with high-potassium foods."],
                    requires_dietitian_review=True,
                    rationale="Hypokalemia concurrent with renal impairment requires cautious nephrological management rather than liberal food potassium loading."
                ))
            else:
                recs = [
                    "Tender coconut water (Nariyal Pani) fresh (1 glass daily)",
                    "Ripe bananas (Kadali) and pomegranate (Dadima)",
                    "Cooked spinach (Palak) and steamed potatoes with skin",
                    "Moong dal soup and boiled lentils"
                ]
                avoids = ["Excessive caffeine and black tea", "Ultra-processed sodium-dense snacks"]
                emphasized_foods.extend(["Tender Coconut Water", "Ripe Banana", "Pomegranate / Dadima"])
                guidelines.append(LabDietaryGuideline(
                    finding=f"Low Serum Potassium ({k_item.numeric_value} mEq/L) - Hypokalemia.",
                    food_recommendations=recs,
                    foods_to_avoid_or_limit=avoids,
                    ayurvedic_perspective="Hridya (cardiac restorative) and Pitta-pacifying cooling fluids to rehydrate Dhatus and restore electrolyte equilibrium.",
                    nutrient_cautions=["If on diuretics, coordinate with prescribing physician; recheck potassium within 1-2 weeks."],
                    requires_dietitian_review=True,
                    rationale="Dietary potassium repletion through bioavailable whole foods to prevent muscle weakness and support cardiac rhythm."
                ))

        elif k_item.status in [LabStatus.HIGH, LabStatus.CRITICAL_HIGH]:
            flags["has_hyperkalemia_risk"] = True
            avoids = [
                "Tender coconut water (STRICTLY PROHIBITED)",
                "Bananas, oranges, kiwis, avocados",
                "Dried fruits (dates, raisins, apricots)",
                "Raw spinach juice and concentrated tomato paste",
                "Potassium chloride low-sodium salt substitutes"
            ]
            recs = [
                "Low-potassium vegetables: bottle gourd, ridge gourd, cabbage, cucumber",
                "Boiled and leached vegetables",
                "Apples, berries, white rice, semolina"
            ]
            contraindicated_foods.extend(["Tender Coconut Water", "Bananas", "Dried Fruits / Raisins", "Potassium Salt Substitutes"])
            guidelines.append(LabDietaryGuideline(
                finding=f"Elevated Serum Potassium ({k_item.numeric_value} mEq/L) - Hyperkalemia Risk.",
                food_recommendations=recs,
                foods_to_avoid_or_limit=avoids,
                ayurvedic_perspective="Astringent and cooling light foods; eliminate mineral-dense heavy fluids to avert cardiac conduction strain.",
                nutrient_cautions=["Strict dietary potassium restriction (< 2000 mg/day). Urgent physician review required if > 5.5 mEq/L."],
                requires_dietitian_review=True,
                rationale="Hyperkalemia presents acute cardiac arrhythmia risk. High-potassium staples must be completely eliminated from the meal plan."
            ))

    # 4. Calcium Derangements
    ca_item = next((it for it in items if it.canonical_key == "calcium"), None)
    if ca_item and ca_item.status in [LabStatus.LOW, LabStatus.CRITICAL_LOW]:
        flags["has_calcium_derangement"] = True
        recs = [
            "Finger millet (Ragi / Nachni) porridge, rotis, or idlis (highest calcium cereal: ~344 mg/100g)",
            "White and black sesame seeds (Til) lightly roasted or in chutney",
            "Moringa / Drumstick leaves (Shigru) cooked with lentils",
            "Cow's milk or fresh cottage cheese (Paneer) if digestive Agni permits",
            "Almonds soaked overnight and peeled"
        ]
        avoids = [
            "Excessive strong black tea or coffee consumed directly with calcium-rich meals (tannins inhibit absorption)",
            "Unsoaked, raw high-phytate grain bran",
            "Excessive carbonated soft drinks"
        ]
        emphasized_foods.extend(["Finger Millet / Ragi", "Sesame Seeds / Til", "Moringa / Drumstick", "Almonds"])
        guidelines.append(LabDietaryGuideline(
            finding=f"Low Serum Calcium ({ca_item.numeric_value} mg/dL) - Hypocalcemia trend.",
            food_recommendations=recs,
            foods_to_avoid_or_limit=avoids,
            ayurvedic_perspective="Asthi Dhatu Poshana (bone tissue nourishment). Til and Ragi provide Madhura, Tikta rasa with Snigdha (unctuous) quality to pacify Vata in Asthi.",
            nutrient_cautions=[
                "Ensure adequate Vitamin D status for intestinal calcium absorption.",
                "Do not administer high-dose calcium simultaneously with iron supplements (competitive absorption inhibition)."
            ],
            requires_dietitian_review=True,
            rationale="Dietary calcium augmentation through rich bioavailable Indian whole food sources paired with absorption inhibitors avoidance."
        ))

    # 5. Hematology & Iron Studies (Anemia / Pandu Roga)
    hb_item = next((it for it in items if it.canonical_key == "hemoglobin"), None)
    ferr_item = next((it for it in items if it.canonical_key == "ferritin"), None)
    fe_item = next((it for it in items if it.canonical_key == "serum_iron"), None)

    is_anemia = (
        (hb_item and hb_item.status in [LabStatus.LOW, LabStatus.CRITICAL_LOW]) or
        (ferr_item and ferr_item.status in [LabStatus.LOW, LabStatus.CRITICAL_LOW]) or
        (fe_item and fe_item.status in [LabStatus.LOW, LabStatus.CRITICAL_LOW])
    )
    if is_anemia:
        flags["has_anemia_or_iron_deficiency"] = True
        fe_strs = []
        if hb_item: fe_strs.append(f"Hemoglobin {hb_item.numeric_value} g/dL")
        if ferr_item: fe_strs.append(f"Ferritin {ferr_item.numeric_value} ng/mL")

        recs = [
            "Pomegranate (Dadima) fresh arils or freshly extracted juice",
            "Black raisins (Draksha) soaked overnight in water (taken morning)",
            "Beetroot and carrot steamed or in warm soup",
            "Fresh dates (Kharjura) and dried figs (Anjeer)",
            "Moringa / Drumstick leaves (Shigru)",
            "Amla (Indian gooseberry) or lemon juice added to meals for Vitamin C to enhance non-heme iron absorption"
        ]
        avoids = [
            "Drinking tea or coffee with or within 1 hour of meals (polyphenols and tannins inhibit iron absorption)",
            "Consuming large servings of calcium dairy alongside iron-dense meals"
        ]
        emphasized_foods.extend(["Pomegranate / Dadima", "Black Raisins / Draksha", "Beetroot", "Dates / Kharjura", "Amla"])
        guidelines.append(LabDietaryGuideline(
            finding=f"Iron Deficiency / Suboptimal Hemoglobin ({', '.join(fe_strs)}) - Pandu Roga pattern.",
            food_recommendations=recs,
            foods_to_avoid_or_limit=avoids,
            ayurvedic_perspective="Rakta Dhatu Vardhana (blood tissue regeneration). Dadima and Draksha pacify Pitta while kindling Dhatvagni to build Rakta.",
            nutrient_cautions=[
                "Pair plant non-heme iron with natural Vitamin C (Amla, citrus).",
                "Separate tea, coffee, and dairy by at least 2 hours from iron-rich meals.",
                "Confirm etiology with full iron panel before aggressive supplementation."
            ],
            requires_dietitian_review=True,
            rationale="Optimizing non-heme iron intake and maximizing absorption bioavailability through strategic Ayurvedic food synergy."
        ))

    # 6. Lipid Derangements (Dyslipidemia / Medoroga)
    tc_item = next((it for it in items if it.canonical_key == "total_cholesterol"), None)
    ldl_item = next((it for it in items if it.canonical_key == "ldl_cholesterol"), None)
    tg_item = next((it for it in items if it.canonical_key == "triglycerides"), None)

    is_dyslipidemia = (
        (tc_item and tc_item.status in [LabStatus.HIGH, LabStatus.CRITICAL_HIGH]) or
        (ldl_item and ldl_item.status in [LabStatus.HIGH, LabStatus.CRITICAL_HIGH]) or
        (tg_item and tg_item.status in [LabStatus.HIGH, LabStatus.CRITICAL_HIGH])
    )
    if is_dyslipidemia:
        flags["has_dyslipidemia"] = True
        recs = [
            "Barley (Yava) and whole oats (high in soluble beta-glucan)",
            "Garlic (Lashuna) lightly sauteed with cumin",
            "Flaxseeds (Atasi) ground freshly (1 tablespoon daily)",
            "Takra (diluted spiced buttermilk with roasted cumin and ginger)",
            "Steamed green vegetables and gourd family vegetables",
            "Methi (fenugreek seeds) in cooking"
        ]
        avoids = [
            "Deep-fried foods, pakoras, vanaspati trans fats",
            "Full-fat dairy cream, heavy paneer, excess butter",
            "Refined simple carbohydrates (promotes triglyceride synthesis)",
            "Bakery confectionery containing palm oil and hydrogenated fats"
        ]
        emphasized_foods.extend(["Barley / Yava", "Garlic / Lashuna", "Flaxseed / Atasi", "Takra (Spiced Buttermilk)"])
        contraindicated_foods.extend(["Deep-Fried Foods", "Trans Fats", "Heavy Dairy Cream"])
        guidelines.append(LabDietaryGuideline(
            finding="Elevated Lipid Profile (Total Cholesterol, LDL, or Triglycerides) - Medoroga trend.",
            food_recommendations=recs,
            foods_to_avoid_or_limit=avoids,
            ayurvedic_perspective="Medohara (lipid reducing) and Lekhana (scraping) Ahara. Takra and Lashuna clear Srotas (microchannels) and promote healthy metabolic transformation.",
            nutrient_cautions=["Limit saturated fat to < 7% of caloric target; ensure dietary fiber >= 30 g/day."],
            requires_dietitian_review=True,
            rationale="Targeted reductions in saturated and trans fats combined with soluble viscous fiber to promote bile acid excretion."
        ))

    # 7. Thyroid Derangements (Elevated TSH / Hypothyroidism)
    tsh_item = next((it for it in items if it.canonical_key == "tsh"), None)
    if tsh_item and tsh_item.status in [LabStatus.HIGH, LabStatus.CRITICAL_HIGH]:
        flags["has_thyroid_derangement"] = True
        recs = [
            "Warm, light, cooked meals with digestive spices (Ginger, black pepper, Pippali)",
            "Pumpkin seeds and sunflower seeds (zinc and selenium sources)",
            "Well-cooked cruciferous vegetables (cooking deactivates goitrogens)",
            "Moong dal and barley"
        ]
        avoids = [
            "Raw cruciferous vegetables (raw cabbage, raw broccoli, raw cauliflower)",
            "Excess unfermented soy products",
            "Cold, heavy, slimy foods (Dahi at night, cold drinks) that depress Agni"
        ]
        emphasized_foods.extend(["Ginger / Shunthi", "Digestive Spices", "Pumpkin Seeds"])
        guidelines.append(LabDietaryGuideline(
            finding=f"Elevated TSH ({tsh_item.numeric_value} uIU/mL) - Subclinical or overt Hypothyroidism trend.",
            food_recommendations=recs,
            foods_to_avoid_or_limit=avoids,
            ayurvedic_perspective="Deepana-Pachana (kindling sluggish cellular metabolic Agni / Dhatvagni). Pacifying Kapha accumulation in Galaganda / thyroid axis.",
            nutrient_cautions=[
                "If on Levothyroxine, take on empty stomach with plain water at least 4 hours apart from calcium, iron, or soy products.",
                "Dietary measures do not replace necessary thyroid hormone replacement."
            ],
            requires_dietitian_review=True,
            rationale="Metabolic rate stimulation through warming spices while eliminating dietary goitrogens in their raw state."
        ))

    # Deduplicate food lists
    emphasized_foods = list(dict.fromkeys(emphasized_foods))
    contraindicated_foods = list(dict.fromkeys(contraindicated_foods))

    return guidelines, emphasized_foods, contraindicated_foods, flags

