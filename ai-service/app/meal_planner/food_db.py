"""
Authoritative Grounded Food Database for AyurDiet Phase 5.
Combines exact nutritional composition grounded in ICMR-NIN Indian Food Composition Tables (IFCT)
and classical Ayurvedic Dravyaguna properties grounded in the AyurDiet Phase 4 knowledge base.
Every food item retains full provenance traceability to source documents.
"""

from typing import Dict, List, Optional
from .models import (
    AyurvedicProperties,
    DietaryClassification,
    FoodItem,
    NutritionProfile,
    ServingInfo,
    SourceProvenance,
)

# Reference source documents from Phase 4 Knowledge Base
SRC_IFCT = "Indian Food Composition Tables (IFCT / NIN / ICMR)"
SRC_AYUR_FOOD = "Ayurvedic Food Properties: Rasa, Guna, Virya, Vipaka, and Prabhava Compendium"
SRC_PATHYA = "Ayurvedic Compendium of Pathya and Apathya in Health and Disease"
SRC_CHARAKA_SUTRA = "Charaka Samhita (Sutra Sthana, Sharira Sthana - Ahara Vidhi Vidhana)"
SRC_CHARAKA_CHIKITSA = "Charaka Samhita Volume 2 (Chikitsa, Kalpa, Siddhi Sthana)"
SRC_DIABETES = "Clinical Diet and Management Guidelines for Diabetes Mellitus"
SRC_CARDIAC = "Ayurveda-Based Diet and Lifestyle Guidelines for Cardiac Disorders (Hridroga)"
SRC_SKIN = "Ayurveda-Based Diet and Lifestyle Guidelines for Prevention and Management of Skin Diseases (Kushta)"
SRC_MENTAL = "Ayurveda-Based Dietary Guidelines for Mental Health Disorders (Manasa Roga)"
SRC_ALLERGEN = "Food Allergen Reference Doses and Risk Thresholds"
SRC_DRUG_INT = "Food-Drug Interactions in Clinical Practice"

RAW_FOOD_CATALOG: List[Dict] = [
    # =========================================================================
    # 1. CEREALS & GRAINS (Shuka Dhanya)
    # =========================================================================
    {
        "food_id": "cereal_red_rice",
        "food_name": "Red Rice (Cooked)",
        "local_name": "Raktashali",
        "category": "cereal_grain",
        "subcategory": "whole_grain",
        "nutrition": {"basis": "100g", "calories": 111.0, "protein_g": 2.6, "carbohydrate_g": 23.5, "fat_g": 0.9, "fiber_g": 1.8},
        "serving": {"default_quantity": 150.0, "unit": "g", "min_quantity": 50.0, "max_quantity": 250.0, "step_size": 25.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["madhura", "kashaya"],
            "guna": ["laghu", "snigdha"],
            "virya": "sheeta",
            "vipaka": "madhura",
            "dosha_effect": {"vata": "pacifies", "pitta": "pacifies", "kapha": "pacifies"},
            "pathya_for": ["general_healthy_diet", "diabetes", "skin_diseases", "digestive_weakness"],
            "apathya_for": [],
            "seasonal_relevance": ["all_seasons", "sharad", "varsha"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 45, "notes": "IFCT Table A.1 Cooked indigenous rice"},
            {"document": SRC_CHARAKA_SUTRA, "page": 112, "notes": "Sutra Sthana Ch. 27: Raktashali is foremost among wholesome grains (Shreshtha Ahara)."},
        ],
    },
    {
        "food_id": "cereal_barley",
        "food_name": "Barley Porridge / Water (Cooked)",
        "local_name": "Yava",
        "category": "cereal_grain",
        "subcategory": "whole_grain",
        "nutrition": {"basis": "100g", "calories": 123.0, "protein_g": 2.3, "carbohydrate_g": 28.2, "fat_g": 0.4, "fiber_g": 3.8},
        "serving": {"default_quantity": 150.0, "unit": "g", "min_quantity": 50.0, "max_quantity": 250.0, "step_size": 25.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": True},
        "allergens": ["gluten"],
        "ayurvedic": {
            "rasa": ["kashaya", "madhura"],
            "guna": ["ruksha", "laghu"],
            "virya": "sheeta",
            "vipaka": "katu",
            "dosha_effect": {"vata": "increases_if_excessive", "pitta": "pacifies", "kapha": "pacifies"},
            "pathya_for": ["diabetes", "weight_loss", "cardiac_disorders", "obesity_medoroga"],
            "apathya_for": ["severe_vata_aggravation", "celiac_disease"],
            "seasonal_relevance": ["spring", "summer", "vasanta"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": ["celiac_gluten_sensitivity"],
        "sources": [
            {"document": SRC_IFCT, "page": 48, "notes": "IFCT Table A.4 Barley cooked"},
            {"document": SRC_DIABETES, "page": 14, "notes": "Yava is recommended as primary staple grain for Madhumeha (low glycemic index, high soluble fiber)."},
            {"document": SRC_PATHYA, "page": 28, "notes": "Pathya in Prameha and Medoroga."},
        ],
    },
    {
        "food_id": "cereal_whole_wheat_roti",
        "food_name": "Whole Wheat Roti (No Oil)",
        "local_name": "Godhuma Chapati",
        "category": "cereal_grain",
        "subcategory": "flatbread",
        "nutrition": {"basis": "100g", "calories": 242.0, "protein_g": 8.5, "carbohydrate_g": 48.0, "fat_g": 1.5, "fiber_g": 7.2},
        "serving": {"default_quantity": 70.0, "unit": "g", "min_quantity": 35.0, "max_quantity": 150.0, "step_size": 35.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": True},
        "allergens": ["gluten", "wheat"],
        "ayurvedic": {
            "rasa": ["madhura"],
            "guna": ["guru", "snigdha"],
            "virya": "sheeta",
            "vipaka": "madhura",
            "dosha_effect": {"vata": "pacifies", "pitta": "pacifies", "kapha": "mild_increase"},
            "pathya_for": ["weight_gain", "weight_maintenance", "general_healthy_diet", "vata_disorders"],
            "apathya_for": ["celiac_disease", "wheat_allergy"],
            "seasonal_relevance": ["winter", "shishira", "hemanta"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": ["wheat_allergy", "celiac_disease"],
        "sources": [
            {"document": SRC_IFCT, "page": 52, "notes": "IFCT Table A.6 Whole wheat flour prepared roti"},
            {"document": SRC_AYUR_FOOD, "page": 18, "notes": "Godhuma is Brimhana (nourishing), Vata-Pitta hara, sweet post-digestive vipaka."},
        ],
    },
    {
        "food_id": "cereal_finger_millet_ragi",
        "food_name": "Finger Millet / Ragi Porridge",
        "local_name": "Nachni / Ragi",
        "category": "cereal_grain",
        "subcategory": "millet",
        "nutrition": {"basis": "100g", "calories": 115.0, "protein_g": 2.2, "carbohydrate_g": 24.0, "fat_g": 0.5, "fiber_g": 3.6},
        "serving": {"default_quantity": 150.0, "unit": "g", "min_quantity": 50.0, "max_quantity": 250.0, "step_size": 25.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["madhura", "tikta", "kashaya"],
            "guna": ["laghu"],
            "virya": "sheeta",
            "vipaka": "madhura",
            "dosha_effect": {"vata": "neutral", "pitta": "pacifies", "kapha": "pacifies"},
            "pathya_for": ["diabetes", "osteoporosis", "weight_loss", "cardiac_disorders"],
            "apathya_for": [],
            "seasonal_relevance": ["summer", "winter", "all_seasons"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 60, "notes": "IFCT Table A.12 Finger millet (Ragi) cooked porridge"},
            {"document": SRC_PATHYA, "page": 32, "notes": "Rich in calcium and iron, wholesome for bone density and blood sugar regulation."},
        ],
    },
    {
        "food_id": "cereal_rolled_oats",
        "food_name": "Rolled Oats (Cooked in Water)",
        "local_name": "Jai / Oats",
        "category": "cereal_grain",
        "subcategory": "whole_grain",
        "nutrition": {"basis": "100g", "calories": 71.0, "protein_g": 2.5, "carbohydrate_g": 12.0, "fat_g": 1.4, "fiber_g": 1.7},
        "serving": {"default_quantity": 180.0, "unit": "g", "min_quantity": 60.0, "max_quantity": 300.0, "step_size": 30.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["madhura"],
            "guna": ["laghu", "snigdha"],
            "virya": "sheeta",
            "vipaka": "madhura",
            "dosha_effect": {"vata": "pacifies", "pitta": "pacifies", "kapha": "neutral"},
            "pathya_for": ["cardiac_disorders", "diabetes", "hypercholesterolemia", "weight_loss"],
            "apathya_for": [],
            "seasonal_relevance": ["all_seasons"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 64, "notes": "IFCT Table A.15 Cooked oats porridge"},
            {"document": SRC_CARDIAC, "page": 21, "notes": "Beta-glucan content aids in managing dyslipidemia and arterial health."},
        ],
    },

    # =========================================================================
    # 2. PULSES & LEGUMES (Shimbi Dhanya)
    # =========================================================================
    {
        "food_id": "pulse_green_moong_dal",
        "food_name": "Green Moong Dal Soup (Cooked)",
        "local_name": "Mudga Yusha",
        "category": "pulse_legume",
        "subcategory": "whole_pulse",
        "nutrition": {"basis": "100g", "calories": 105.0, "protein_g": 7.0, "carbohydrate_g": 18.0, "fat_g": 0.4, "fiber_g": 4.5},
        "serving": {"default_quantity": 150.0, "unit": "g", "min_quantity": 50.0, "max_quantity": 250.0, "step_size": 25.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["kashaya", "madhura"],
            "guna": ["laghu", "ruksha"],
            "virya": "sheeta",
            "vipaka": "katu",
            "dosha_effect": {"vata": "mild_increase_if_unspiced", "pitta": "pacifies", "kapha": "pacifies"},
            "pathya_for": ["general_healthy_diet", "diabetes", "cardiac_disorders", "skin_diseases", "fever_jwara", "digestive_weakness"],
            "apathya_for": [],
            "seasonal_relevance": ["all_seasons", "varsha", "grishma"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 82, "notes": "IFCT Table B.1 Green gram dal cooked"},
            {"document": SRC_CHARAKA_SUTRA, "page": 115, "notes": "Sutra Sthana Ch. 27: Mudga is the most wholesome (Shrestha) of all pulses, easily digested and non-flatulent when prepared with ginger and cumin."},
        ],
    },
    {
        "food_id": "pulse_yellow_moong_dal",
        "food_name": "Yellow Split Moong Dal (Cooked)",
        "local_name": "Mudga Dhauta",
        "category": "pulse_legume",
        "subcategory": "split_pulse",
        "nutrition": {"basis": "100g", "calories": 102.0, "protein_g": 7.2, "carbohydrate_g": 17.5, "fat_g": 0.3, "fiber_g": 3.8},
        "serving": {"default_quantity": 150.0, "unit": "g", "min_quantity": 50.0, "max_quantity": 250.0, "step_size": 25.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["kashaya", "madhura"],
            "guna": ["laghu"],
            "virya": "sheeta",
            "vipaka": "katu",
            "dosha_effect": {"vata": "pacifies", "pitta": "pacifies", "kapha": "pacifies"},
            "pathya_for": ["digestive_weakness", "fever", "convalescence", "general_healthy_diet"],
            "apathya_for": [],
            "seasonal_relevance": ["all_seasons"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 84, "notes": "IFCT Table B.2 Split yellow gram cooked"},
            {"document": SRC_PATHYA, "page": 15, "notes": "Split moong dal provides light nutrition ideal for Mandagni (sluggish digestive fire)."},
        ],
    },
    {
        "food_id": "pulse_masoor_dal",
        "food_name": "Red Lentil / Masoor Dal (Cooked)",
        "local_name": "Masura",
        "category": "pulse_legume",
        "subcategory": "split_pulse",
        "nutrition": {"basis": "100g", "calories": 116.0, "protein_g": 9.0, "carbohydrate_g": 19.5, "fat_g": 0.5, "fiber_g": 3.9},
        "serving": {"default_quantity": 150.0, "unit": "g", "min_quantity": 50.0, "max_quantity": 250.0, "step_size": 25.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["madhura", "kashaya"],
            "guna": ["laghu", "ruksha"],
            "virya": "sheeta",
            "vipaka": "madhura",
            "dosha_effect": {"vata": "mild_increase", "pitta": "pacifies", "kapha": "pacifies"},
            "pathya_for": ["pitta_disorders", "bleeding_disorders", "weight_loss"],
            "apathya_for": ["severe_constipation", "high_vata"],
            "seasonal_relevance": ["summer", "sharad"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 88, "notes": "IFCT Table B.4 Masoor dal cooked"},
            {"document": SRC_AYUR_FOOD, "page": 25, "notes": "Masura is Sangrahi (bowel binding) and cooling, pacifies Pitta and Kapha."},
        ],
    },
    {
        "food_id": "pulse_kala_chana",
        "food_name": "Black Chickpea Curry (Cooked)",
        "local_name": "Kala Chana",
        "category": "pulse_legume",
        "subcategory": "whole_pulse",
        "nutrition": {"basis": "100g", "calories": 164.0, "protein_g": 8.9, "carbohydrate_g": 27.4, "fat_g": 2.6, "fiber_g": 7.6},
        "serving": {"default_quantity": 130.0, "unit": "g", "min_quantity": 50.0, "max_quantity": 200.0, "step_size": 25.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["kashaya", "madhura"],
            "guna": ["laghu", "ruksha"],
            "virya": "sheeta",
            "vipaka": "katu",
            "dosha_effect": {"vata": "increases", "pitta": "pacifies", "kapha": "pacifies"},
            "pathya_for": ["diabetes", "obesity", "cardiac_disorders"],
            "apathya_for": ["vishamagni", "severe_vata_disorders", "bloating"],
            "seasonal_relevance": ["spring", "summer"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 92, "notes": "IFCT Table B.6 Bengal gram whole cooked"},
            {"document": SRC_DIABETES, "page": 19, "notes": "Low glycemic index and high resistant starch content make black chana optimal for glycemic stability."},
        ],
    },
    {
        "food_id": "pulse_tofu",
        "food_name": "Tofu (Firm / Steamed)",
        "local_name": "Soy Paneer",
        "category": "pulse_legume",
        "subcategory": "soy_product",
        "nutrition": {"basis": "100g", "calories": 144.0, "protein_g": 15.5, "carbohydrate_g": 3.2, "fat_g": 8.0, "fiber_g": 2.3},
        "serving": {"default_quantity": 100.0, "unit": "g", "min_quantity": 40.0, "max_quantity": 180.0, "step_size": 20.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": ["soy"],
        "ayurvedic": {
            "rasa": ["madhura", "kashaya"],
            "guna": ["guru"],
            "virya": "sheeta",
            "vipaka": "madhura",
            "dosha_effect": {"vata": "neutral", "pitta": "pacifies", "kapha": "increases_if_excessive"},
            "pathya_for": ["vegan_protein_target", "diabetes"],
            "apathya_for": ["soy_allergy", "hypothyroidism"],
            "seasonal_relevance": ["all_seasons"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": ["soy_allergy", "thyroid_medication_timing"],
        "sources": [
            {"document": SRC_IFCT, "page": 98, "notes": "IFCT Table B.10 Soybean curd (Tofu)"},
            {"document": SRC_ALLERGEN, "page": 8, "notes": "Soy is an established priority food allergen requiring explicit screening."},
            {"document": SRC_DRUG_INT, "page": 4, "notes": "Soy isoflavones can interfere with levothyroxine absorption; recommend 4h separation."},
        ],
    },

    # =========================================================================
    # 3. VEGETABLES (Shaka Varga)
    # =========================================================================
    {
        "food_id": "veg_bottle_gourd",
        "food_name": "Bottle Gourd Sabzi (Cooked with Jeera)",
        "local_name": "Lauki / Alabu",
        "category": "vegetable",
        "subcategory": "gourd",
        "nutrition": {"basis": "100g", "calories": 15.0, "protein_g": 0.6, "carbohydrate_g": 2.5, "fat_g": 0.2, "fiber_g": 1.2},
        "serving": {"default_quantity": 150.0, "unit": "g", "min_quantity": 80.0, "max_quantity": 250.0, "step_size": 25.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["madhura"],
            "guna": ["laghu", "snigdha"],
            "virya": "sheeta",
            "vipaka": "madhura",
            "dosha_effect": {"vata": "pacifies", "pitta": "pacifies", "kapha": "neutral"},
            "pathya_for": ["cardiac_disorders", "hypertension", "diabetes", "pitta_disorders", "urinary_tract_health"],
            "apathya_for": [],
            "seasonal_relevance": ["summer", "grishma", "sharad"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 120, "notes": "IFCT Table C.5 Bottle gourd cooked"},
            {"document": SRC_CARDIAC, "page": 16, "notes": "Alabu is Hridya (cardiac tonic), diuretic, and pacifies metabolic heat without straining digestion."},
        ],
    },
    {
        "food_id": "veg_bitter_gourd",
        "food_name": "Bitter Gourd / Karela (Steamed/Spiced)",
        "local_name": "Karavellaka",
        "category": "vegetable",
        "subcategory": "gourd",
        "nutrition": {"basis": "100g", "calories": 25.0, "protein_g": 1.6, "carbohydrate_g": 4.3, "fat_g": 0.2, "fiber_g": 2.8},
        "serving": {"default_quantity": 100.0, "unit": "g", "min_quantity": 50.0, "max_quantity": 180.0, "step_size": 25.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["tikta"],
            "guna": ["laghu", "ruksha"],
            "virya": "sheeta",
            "vipaka": "katu",
            "dosha_effect": {"vata": "mild_increase_if_excessive", "pitta": "pacifies", "kapha": "pacifies"},
            "pathya_for": ["diabetes", "skin_diseases", "blood_purification_rakta_shodhana", "liver_health", "weight_loss"],
            "apathya_for": ["high_vata", "emaciation"],
            "seasonal_relevance": ["monsoon", "varsha", "spring"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 124, "notes": "IFCT Table C.8 Bitter gourd cooked"},
            {"document": SRC_DIABETES, "page": 12, "notes": "Karavellaka is classical prime Pathya for Prameha due to charantin and bitter insulin-mimetic principles."},
            {"document": SRC_SKIN, "page": 18, "notes": "Tikta rasa purifies Rakta dhatu and soothes inflammatory skin dermatoses."},
        ],
    },
    {
        "food_id": "veg_palak_spinach",
        "food_name": "Spinach / Palak Subzi (Cooked)",
        "local_name": "Palankya",
        "category": "vegetable",
        "subcategory": "leafy_green",
        "nutrition": {"basis": "100g", "calories": 26.0, "protein_g": 2.9, "carbohydrate_g": 2.9, "fat_g": 0.6, "fiber_g": 2.6},
        "serving": {"default_quantity": 120.0, "unit": "g", "min_quantity": 50.0, "max_quantity": 200.0, "step_size": 25.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["madhura", "kashaya"],
            "guna": ["guru", "snigdha"],
            "virya": "sheeta",
            "vipaka": "katu",
            "dosha_effect": {"vata": "mild_increase", "pitta": "pacifies", "kapha": "pacifies"},
            "pathya_for": ["anemia", "nutrient_deficiencies", "cardiac_disorders", "general_healthy_diet"],
            "apathya_for": ["calcium_oxalate_kidney_stones"],
            "seasonal_relevance": ["winter", "hemanta"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": ["kidney_oxalate_calculi"],
        "sources": [
            {"document": SRC_IFCT, "page": 132, "notes": "IFCT Table C.14 Spinach cooked"},
            {"document": SRC_PATHYA, "page": 44, "notes": "Leafy green rich in folate and iron, balances Pitta when cooked with cumin and ghee."},
        ],
    },
    {
        "food_id": "veg_methi_leaves",
        "food_name": "Fenugreek Leaves / Methi (Cooked)",
        "local_name": "Methika",
        "category": "vegetable",
        "subcategory": "leafy_green",
        "nutrition": {"basis": "100g", "calories": 49.0, "protein_g": 4.4, "carbohydrate_g": 6.0, "fat_g": 0.9, "fiber_g": 4.9},
        "serving": {"default_quantity": 100.0, "unit": "g", "min_quantity": 40.0, "max_quantity": 180.0, "step_size": 20.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["tikta"],
            "guna": ["laghu", "snigdha"],
            "virya": "ushna",
            "vipaka": "katu",
            "dosha_effect": {"vata": "pacifies", "pitta": "mild_increase_if_excessive", "kapha": "pacifies"},
            "pathya_for": ["diabetes", "joint_pain_sandhivata", "digestive_weakness", "hyperlipidemia"],
            "apathya_for": ["bleeding_disorders_raktapitta"],
            "seasonal_relevance": ["winter", "shishira", "hemanta"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 138, "notes": "IFCT Table C.18 Fenugreek leaves cooked"},
            {"document": SRC_DIABETES, "page": 22, "notes": "Stimulates peripheral glucose utilization and delays gastric emptying."},
        ],
    },
    {
        "food_id": "veg_ash_gourd",
        "food_name": "Ash Gourd / Petha (Steamed)",
        "local_name": "Kushmanda",
        "category": "vegetable",
        "subcategory": "gourd",
        "nutrition": {"basis": "100g", "calories": 13.0, "protein_g": 0.4, "carbohydrate_g": 2.9, "fat_g": 0.1, "fiber_g": 1.1},
        "serving": {"default_quantity": 150.0, "unit": "g", "min_quantity": 80.0, "max_quantity": 250.0, "step_size": 25.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["madhura"],
            "guna": ["guru", "snigdha"],
            "virya": "sheeta",
            "vipaka": "madhura",
            "dosha_effect": {"vata": "pacifies", "pitta": "pacifies", "kapha": "mild_increase"},
            "pathya_for": ["mental_health", "anxiety", "insomnia", "acidity_amlapitta", "cardiac_disorders"],
            "apathya_for": [],
            "seasonal_relevance": ["summer", "sharad"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 142, "notes": "IFCT Table C.22 Ash gourd cooked"},
            {"document": SRC_MENTAL, "page": 11, "notes": "Kushmanda is a prime Medhya Rasayana (neuroprotective intellect-enhancer), soothes nervous irritation."},
        ],
    },
    {
        "food_id": "veg_carrot",
        "food_name": "Carrot Steamed / Sabzi",
        "local_name": "Garanjara",
        "category": "vegetable",
        "subcategory": "root_vegetable",
        "nutrition": {"basis": "100g", "calories": 38.0, "protein_g": 0.9, "carbohydrate_g": 8.5, "fat_g": 0.2, "fiber_g": 2.8},
        "serving": {"default_quantity": 100.0, "unit": "g", "min_quantity": 50.0, "max_quantity": 180.0, "step_size": 25.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["madhura", "tikta"],
            "guna": ["laghu", "tikshna"],
            "virya": "ushna",
            "vipaka": "katu",
            "dosha_effect": {"vata": "pacifies", "pitta": "neutral", "kapha": "pacifies"},
            "pathya_for": ["vision_health", "digestive_weakness", "general_healthy_diet"],
            "apathya_for": [],
            "seasonal_relevance": ["winter"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 150, "notes": "IFCT Table C.28 Carrot cooked"},
            {"document": SRC_AYUR_FOOD, "page": 31, "notes": "Carrot stimulates Agni and balances Vata-Kapha due to Ushna virya and sweet taste."},
        ],
    },

    # =========================================================================
    # 4. FRUITS (Phala Varga)
    # =========================================================================
    {
        "food_id": "fruit_amla",
        "food_name": "Indian Gooseberry / Fresh Amla",
        "local_name": "Amalaki",
        "category": "fruit",
        "subcategory": "berry",
        "nutrition": {"basis": "100g", "calories": 48.0, "protein_g": 0.8, "carbohydrate_g": 11.2, "fat_g": 0.1, "fiber_g": 3.4},
        "serving": {"default_quantity": 50.0, "unit": "g", "min_quantity": 25.0, "max_quantity": 100.0, "step_size": 25.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["amla", "madhura", "tikta", "katu", "kashaya"],
            "guna": ["laghu", "ruksha"],
            "virya": "sheeta",
            "vipaka": "madhura",
            "dosha_effect": {"vata": "pacifies", "pitta": "pacifies", "kapha": "pacifies"},
            "pathya_for": ["diabetes", "cardiac_disorders", "skin_diseases", "general_healthy_diet", "anti_aging_rasayana"],
            "apathya_for": [],
            "seasonal_relevance": ["all_seasons", "winter"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 175, "notes": "IFCT Table D.1 Indian gooseberry (Amla) fresh"},
            {"document": SRC_CHARAKA_SUTRA, "page": 118, "notes": "Amalaki possesses five rasas (all except salt), is the premier Rasayana, and pacifies all three doshas."},
            {"document": SRC_DIABETES, "page": 15, "notes": "Amla with turmeric (Nisha-Amalaki) is classic gold standard Pathya for Prameha."},
        ],
    },
    {
        "food_id": "fruit_pomegranate",
        "food_name": "Pomegranate Arils (Fresh)",
        "local_name": "Dadima",
        "category": "fruit",
        "subcategory": "fresh_fruit",
        "nutrition": {"basis": "100g", "calories": 68.0, "protein_g": 1.6, "carbohydrate_g": 14.5, "fat_g": 0.3, "fiber_g": 2.8},
        "serving": {"default_quantity": 100.0, "unit": "g", "min_quantity": 50.0, "max_quantity": 180.0, "step_size": 25.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["madhura", "kashaya", "amla"],
            "guna": ["laghu", "snigdha"],
            "virya": "anushna",
            "vipaka": "madhura",
            "dosha_effect": {"vata": "pacifies", "pitta": "pacifies", "kapha": "pacifies"},
            "pathya_for": ["cardiac_disorders", "digestive_weakness", "anemia", "general_healthy_diet"],
            "apathya_for": [],
            "seasonal_relevance": ["all_seasons", "autumn"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 180, "notes": "IFCT Table D.5 Pomegranate arils"},
            {"document": SRC_CARDIAC, "page": 14, "notes": "Dadima is classic Hridya dravya (cardiac tonic), strengthens cardiac muscles and arterial endothelium."},
        ],
    },
    {
        "food_id": "fruit_apple",
        "food_name": "Apple with Skin",
        "local_name": "Seva",
        "category": "fruit",
        "subcategory": "pome",
        "nutrition": {"basis": "100g", "calories": 52.0, "protein_g": 0.3, "carbohydrate_g": 13.8, "fat_g": 0.2, "fiber_g": 2.4},
        "serving": {"default_quantity": 130.0, "unit": "g", "min_quantity": 60.0, "max_quantity": 200.0, "step_size": 30.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["madhura", "kashaya"],
            "guna": ["guru", "laghu"],
            "virya": "sheeta",
            "vipaka": "madhura",
            "dosha_effect": {"vata": "mild_increase_if_raw", "pitta": "pacifies", "kapha": "pacifies"},
            "pathya_for": ["cardiac_disorders", "diabetes", "diarrhea", "general_healthy_diet"],
            "apathya_for": [],
            "seasonal_relevance": ["all_seasons"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 184, "notes": "IFCT Table D.8 Apple with peel"},
            {"document": SRC_PATHYA, "page": 50, "notes": "Astringent sweet taste, strengthens colon and binds loose stool."},
        ],
    },
    {
        "food_id": "fruit_papaya",
        "food_name": "Ripe Papaya (Fresh Cubes)",
        "local_name": "Erandakarkati",
        "category": "fruit",
        "subcategory": "tropical_fruit",
        "nutrition": {"basis": "100g", "calories": 43.0, "protein_g": 0.5, "carbohydrate_g": 10.8, "fat_g": 0.1, "fiber_g": 1.7},
        "serving": {"default_quantity": 150.0, "unit": "g", "min_quantity": 60.0, "max_quantity": 220.0, "step_size": 30.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["madhura", "tikta"],
            "guna": ["laghu", "ruksha"],
            "virya": "ushna",
            "vipaka": "katu",
            "dosha_effect": {"vata": "pacifies", "pitta": "mild_increase_if_excessive", "kapha": "pacifies"},
            "pathya_for": ["constipation", "mandagni", "sluggish_liver", "weight_loss"],
            "apathya_for": ["pregnancy", "bleeding_piles"],
            "seasonal_relevance": ["winter", "monsoon"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": ["pregnancy_unripe_papaya_caution"],
        "sources": [
            {"document": SRC_IFCT, "page": 190, "notes": "IFCT Table D.12 Papaya ripe"},
            {"document": SRC_AYUR_FOOD, "page": 36, "notes": "Enzyme-rich fruit stimulating Agni and resolving Ama (metabolic toxins)."},
        ],
    },
    {
        "food_id": "fruit_black_raisins",
        "food_name": "Black Raisins (Soaked)",
        "local_name": "Munakka / Draksha",
        "category": "fruit",
        "subcategory": "dried_fruit",
        "nutrition": {"basis": "100g", "calories": 299.0, "protein_g": 3.1, "carbohydrate_g": 75.0, "fat_g": 0.5, "fiber_g": 3.7},
        "serving": {"default_quantity": 20.0, "unit": "g", "min_quantity": 10.0, "max_quantity": 40.0, "step_size": 5.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["madhura", "kashaya"],
            "guna": ["guru", "snigdha"],
            "virya": "sheeta",
            "vipaka": "madhura",
            "dosha_effect": {"vata": "pacifies", "pitta": "pacifies", "kapha": "neutral"},
            "pathya_for": ["anemia", "constipation", "pitta_disorders", "mental_health", "general_healthy_diet"],
            "apathya_for": [],
            "seasonal_relevance": ["all_seasons", "summer", "sharad"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 196, "notes": "IFCT Table D.16 Dried black grapes (raisins)"},
            {"document": SRC_CHARAKA_SUTRA, "page": 121, "notes": "Draksha is declared foremost among fruits (Phalottama), nourishing and pacifying Pitta-Vata."},
        ],
    },

    # =========================================================================
    # 5. DAIRY & PLANT ALTERNATIVES (Gorasa Varga)
    # =========================================================================
    {
        "food_id": "dairy_cow_milk",
        "food_name": "Boiled Cow's Milk (Low Fat / Toned)",
        "local_name": "Gokshira",
        "category": "dairy",
        "subcategory": "milk",
        "nutrition": {"basis": "100g", "calories": 61.0, "protein_g": 3.2, "carbohydrate_g": 4.8, "fat_g": 3.2, "fiber_g": 0.0},
        "serving": {"default_quantity": 200.0, "unit": "ml", "min_quantity": 100.0, "max_quantity": 300.0, "step_size": 50.0},
        "dietary": {"vegetarian": True, "vegan": False, "eggetarian": False, "dairy": True, "gluten": False},
        "allergens": ["milk", "lactose"],
        "ayurvedic": {
            "rasa": ["madhura"],
            "guna": ["guru", "snigdha"],
            "virya": "sheeta",
            "vipaka": "madhura",
            "dosha_effect": {"vata": "pacifies", "pitta": "pacifies", "kapha": "increases_if_excessive"},
            "pathya_for": ["mental_health", "sleep_insomnia", "emaciation", "general_healthy_diet"],
            "apathya_for": ["lactose_intolerance", "milk_allergy", "active_skin_disease_kushta", "mandagni"],
            "seasonal_relevance": ["autumn", "winter"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": ["lactose_intolerance", "milk_allergy"],
        "sources": [
            {"document": SRC_IFCT, "page": 210, "notes": "IFCT Table E.1 Cow milk toned"},
            {"document": SRC_CHARAKA_SUTRA, "page": 124, "notes": "Cow milk is Rasayana, Jivaniya (vitalizing), and Ojo-vardhaka (enhances immunity)."},
            {"document": SRC_ALLERGEN, "page": 6, "notes": "Cow's milk protein is a priority food allergen requiring screening."},
        ],
    },
    {
        "food_id": "dairy_buttermilk_takra",
        "food_name": "Spiced Buttermilk (Takra with Roasted Jeera)",
        "local_name": "Takra",
        "category": "dairy",
        "subcategory": "fermented_beverage",
        "nutrition": {"basis": "100g", "calories": 25.0, "protein_g": 1.5, "carbohydrate_g": 2.2, "fat_g": 0.9, "fiber_g": 0.0},
        "serving": {"default_quantity": 200.0, "unit": "ml", "min_quantity": 100.0, "max_quantity": 300.0, "step_size": 50.0},
        "dietary": {"vegetarian": True, "vegan": False, "eggetarian": False, "dairy": True, "gluten": False},
        "allergens": ["milk"],
        "ayurvedic": {
            "rasa": ["kashaya", "amla", "madhura"],
            "guna": ["laghu", "ruksha"],
            "virya": "ushna",
            "vipaka": "madhura",
            "dosha_effect": {"vata": "pacifies", "pitta": "neutral", "kapha": "pacifies"},
            "pathya_for": ["mandagni", "digestive_weakness", "irritable_bowel_grahani", "hemorrhoids", "diabetes", "obesity"],
            "apathya_for": ["dairy_allergy", "acute_peptic_ulcer"],
            "seasonal_relevance": ["all_seasons", "winter", "varsha"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": ["dairy_allergy"],
        "sources": [
            {"document": SRC_IFCT, "page": 214, "notes": "IFCT Table E.3 Buttermilk prepared from curd with water"},
            {"document": SRC_CHARAKA_CHIKITSA, "page": 215, "notes": "Chikitsa Sthana Ch. 15 (Grahani): Takra is described as Amrita (nectar) for digestive restoration."},
        ],
    },
    {
        "food_id": "dairy_cow_ghee",
        "food_name": "A2 Cow's Ghee",
        "local_name": "Goghrita",
        "category": "dairy",
        "subcategory": "clarified_butter",
        "nutrition": {"basis": "100g", "calories": 892.0, "protein_g": 0.0, "carbohydrate_g": 0.0, "fat_g": 99.5, "fiber_g": 0.0},
        "serving": {"default_quantity": 10.0, "unit": "g", "min_quantity": 5.0, "max_quantity": 25.0, "step_size": 5.0},
        "dietary": {"vegetarian": True, "vegan": False, "eggetarian": False, "dairy": True, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["madhura"],
            "guna": ["guru", "snigdha"],
            "virya": "sheeta",
            "vipaka": "madhura",
            "dosha_effect": {"vata": "pacifies", "pitta": "pacifies", "kapha": "neutral_in_moderation"},
            "pathya_for": ["mental_health", "memory_smriti", "agni_stimulation_without_pitta", "general_healthy_diet"],
            "apathya_for": ["active_ama_state", "acute_fever_nava_jwara", "severe_hyperlipidemia"],
            "seasonal_relevance": ["all_seasons", "autumn", "winter"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 218, "notes": "IFCT Table E.5 Clarified butter (Ghee)"},
            {"document": SRC_CHARAKA_SUTRA, "page": 126, "notes": "Sutra Sthana Ch. 27: Ghrita is the best of all unctuous substances (Sneha Shreshtha), enhances memory, intellect, and digestive fire."},
        ],
    },
    {
        "food_id": "dairy_fresh_paneer",
        "food_name": "Low Fat Paneer (Cottage Cheese)",
        "local_name": "Paneer",
        "category": "dairy",
        "subcategory": "cheese",
        "nutrition": {"basis": "100g", "calories": 185.0, "protein_g": 18.0, "carbohydrate_g": 3.0, "fat_g": 11.5, "fiber_g": 0.0},
        "serving": {"default_quantity": 75.0, "unit": "g", "min_quantity": 30.0, "max_quantity": 150.0, "step_size": 15.0},
        "dietary": {"vegetarian": True, "vegan": False, "eggetarian": False, "dairy": True, "gluten": False},
        "allergens": ["milk"],
        "ayurvedic": {
            "rasa": ["madhura"],
            "guna": ["guru", "snigdha"],
            "virya": "sheeta",
            "vipaka": "madhura",
            "dosha_effect": {"vata": "pacifies", "pitta": "pacifies", "kapha": "increases"},
            "pathya_for": ["weight_gain", "protein_supplementation", "high_vata"],
            "apathya_for": ["mandagni", "sluggish_metabolism", "obesity", "dairy_allergy"],
            "seasonal_relevance": ["winter"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": ["dairy_allergy"],
        "sources": [
            {"document": SRC_IFCT, "page": 222, "notes": "IFCT Table E.7 Cottage cheese paneer low fat"},
            {"document": SRC_AYUR_FOOD, "page": 40, "notes": "Heavy to digest, strengthening (Balya) for high physical activity and athletic recovery."},
        ],
    },
    {
        "food_id": "dairy_almond_milk",
        "food_name": "Unsweetened Almond Milk",
        "local_name": "Badam Kshira",
        "category": "dairy",
        "subcategory": "plant_milk",
        "nutrition": {"basis": "100g", "calories": 15.0, "protein_g": 0.6, "carbohydrate_g": 0.3, "fat_g": 1.2, "fiber_g": 0.4},
        "serving": {"default_quantity": 200.0, "unit": "ml", "min_quantity": 100.0, "max_quantity": 300.0, "step_size": 50.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": ["tree_nuts"],
        "ayurvedic": {
            "rasa": ["madhura"],
            "guna": ["laghu", "snigdha"],
            "virya": "sheeta",
            "vipaka": "madhura",
            "dosha_effect": {"vata": "pacifies", "pitta": "pacifies", "kapha": "neutral"},
            "pathya_for": ["lactose_intolerance", "vegan_diet", "general_healthy_diet"],
            "apathya_for": ["tree_nut_allergy"],
            "seasonal_relevance": ["all_seasons"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": ["tree_nut_allergy"],
        "sources": [
            {"document": SRC_IFCT, "page": 226, "notes": "IFCT Table E.9 Plant-based almond milk"},
            {"document": SRC_ALLERGEN, "page": 9, "notes": "Tree nut allergen requiring strict exclusion in nut-allergic patients."},
        ],
    },

    # =========================================================================
    # 6. NUTS, SEEDS & HEALTHY FATS (Sneha / Majja Varga)
    # =========================================================================
    {
        "food_id": "nut_soaked_almonds",
        "food_name": "Soaked & Peeled Almonds",
        "local_name": "Vatada",
        "category": "nut_seed",
        "subcategory": "tree_nut",
        "nutrition": {"basis": "100g", "calories": 579.0, "protein_g": 21.2, "carbohydrate_g": 21.6, "fat_g": 49.9, "fiber_g": 12.5},
        "serving": {"default_quantity": 15.0, "unit": "g", "min_quantity": 5.0, "max_quantity": 30.0, "step_size": 5.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": ["tree_nuts"],
        "ayurvedic": {
            "rasa": ["madhura"],
            "guna": ["guru", "snigdha"],
            "virya": "ushna",
            "vipaka": "madhura",
            "dosha_effect": {"vata": "pacifies", "pitta": "neutral", "kapha": "increases_if_excessive"},
            "pathya_for": ["mental_health", "memory", "general_healthy_diet", "vitality_balya"],
            "apathya_for": ["tree_nut_allergy", "severe_acne_pitta_skin"],
            "seasonal_relevance": ["winter", "all_seasons"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": ["tree_nut_allergy"],
        "sources": [
            {"document": SRC_IFCT, "page": 240, "notes": "IFCT Table F.1 Almonds raw soaked"},
            {"document": SRC_MENTAL, "page": 14, "notes": "Vatada is Medhya and Balya, best consumed soaked and peeled in morning hours."},
        ],
    },
    {
        "food_id": "nut_walnuts",
        "food_name": "Walnuts (Raw Halves)",
        "local_name": "Akshota",
        "category": "nut_seed",
        "subcategory": "tree_nut",
        "nutrition": {"basis": "100g", "calories": 654.0, "protein_g": 15.2, "carbohydrate_g": 13.7, "fat_g": 65.2, "fiber_g": 6.7},
        "serving": {"default_quantity": 15.0, "unit": "g", "min_quantity": 5.0, "max_quantity": 30.0, "step_size": 5.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": ["tree_nuts"],
        "ayurvedic": {
            "rasa": ["madhura", "kashaya"],
            "guna": ["guru", "snigdha"],
            "virya": "ushna",
            "vipaka": "madhura",
            "dosha_effect": {"vata": "pacifies", "pitta": "mild_increase_if_excessive", "kapha": "increases_if_excessive"},
            "pathya_for": ["cardiac_disorders", "mental_health", "omega_3_source", "vata_disorders"],
            "apathya_for": ["tree_nut_allergy"],
            "seasonal_relevance": ["winter", "hemanta"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": ["tree_nut_allergy"],
        "sources": [
            {"document": SRC_IFCT, "page": 244, "notes": "IFCT Table F.3 Walnuts raw"},
            {"document": SRC_CARDIAC, "page": 19, "notes": "High alpha-linolenic acid content supports cardiovascular arterial compliance."},
        ],
    },
    {
        "food_id": "seed_flaxseed_powder",
        "food_name": "Roasted Flaxseed Powder",
        "local_name": "Atasi Churna",
        "category": "nut_seed",
        "subcategory": "seed",
        "nutrition": {"basis": "100g", "calories": 534.0, "protein_g": 18.3, "carbohydrate_g": 28.9, "fat_g": 42.2, "fiber_g": 27.3},
        "serving": {"default_quantity": 10.0, "unit": "g", "min_quantity": 5.0, "max_quantity": 25.0, "step_size": 5.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["madhura", "tikta"],
            "guna": ["guru", "snigdha"],
            "virya": "ushna",
            "vipaka": "katu",
            "dosha_effect": {"vata": "pacifies", "pitta": "mild_increase", "kapha": "pacifies"},
            "pathya_for": ["cardiac_disorders", "constipation", "diabetes", "hyperlipidemia"],
            "apathya_for": ["bleeding_disorders"],
            "seasonal_relevance": ["winter", "monsoon"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 248, "notes": "IFCT Table F.5 Flaxseeds roasted"},
            {"document": SRC_PATHYA, "page": 36, "notes": "Atasi aids in bowel regularity and pacifies aggravated Vata dosha."},
        ],
    },

    # =========================================================================
    # 7. SPICES & DIGESTIVE HERBS (Deepana / Pachana Varga)
    # =========================================================================
    {
        "food_id": "spice_ginger",
        "food_name": "Fresh Ginger / Ginger Tea",
        "local_name": "Ardraka / Shunthi",
        "category": "spice_herb",
        "subcategory": "rhizome",
        "nutrition": {"basis": "100g", "calories": 80.0, "protein_g": 1.8, "carbohydrate_g": 17.8, "fat_g": 0.8, "fiber_g": 2.0},
        "serving": {"default_quantity": 5.0, "unit": "g", "min_quantity": 2.0, "max_quantity": 15.0, "step_size": 2.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["katu"],
            "guna": ["guru", "ruksha", "tikshna"],
            "virya": "ushna",
            "vipaka": "madhura",
            "dosha_effect": {"vata": "pacifies", "pitta": "neutral_in_moderation", "kapha": "pacifies"},
            "pathya_for": ["mandagni", "digestive_weakness", "respiratory_disorders", "joint_pain", "general_healthy_diet"],
            "apathya_for": ["acute_gastric_ulcer", "bleeding_disorders"],
            "seasonal_relevance": ["winter", "monsoon", "spring"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 260, "notes": "IFCT Table G.1 Fresh ginger rhizome"},
            {"document": SRC_CHARAKA_SUTRA, "page": 128, "notes": "Ardraka/Shunthi is celebrated as Vishwabheshaja (universal medicine), premier Deepana (appetizer) and Pachana (digestant)."},
        ],
    },
    {
        "food_id": "spice_turmeric",
        "food_name": "Pure Turmeric Powder",
        "local_name": "Haridra",
        "category": "spice_herb",
        "subcategory": "rhizome",
        "nutrition": {"basis": "100g", "calories": 312.0, "protein_g": 9.7, "carbohydrate_g": 67.1, "fat_g": 3.2, "fiber_g": 22.7},
        "serving": {"default_quantity": 3.0, "unit": "g", "min_quantity": 1.0, "max_quantity": 8.0, "step_size": 1.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["tikta", "katu"],
            "guna": ["ruksha", "laghu"],
            "virya": "ushna",
            "vipaka": "katu",
            "dosha_effect": {"vata": "pacifies", "pitta": "pacifies_in_moderation", "kapha": "pacifies"},
            "pathya_for": ["diabetes", "skin_diseases", "inflammation", "liver_health", "general_healthy_diet"],
            "apathya_for": [],
            "seasonal_relevance": ["all_seasons"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 264, "notes": "IFCT Table G.3 Turmeric powder"},
            {"document": SRC_SKIN, "page": 22, "notes": "Haridra is classical Kushtaghna (skin curative) and Rakta shodhana (blood detoxifier)."},
            {"document": SRC_DIABETES, "page": 16, "notes": "Curcumin controls oxidative stress and insulin resistance in Prameha."},
        ],
    },
    {
        "food_id": "spice_cumin",
        "food_name": "Roasted Cumin Seeds / Powder",
        "local_name": "Jeeraka",
        "category": "spice_herb",
        "subcategory": "seed_spice",
        "nutrition": {"basis": "100g", "calories": 375.0, "protein_g": 17.8, "carbohydrate_g": 44.2, "fat_g": 22.3, "fiber_g": 10.5},
        "serving": {"default_quantity": 3.0, "unit": "g", "min_quantity": 1.0, "max_quantity": 8.0, "step_size": 1.0},
        "dietary": {"vegetarian": True, "vegan": True, "eggetarian": False, "dairy": False, "gluten": False},
        "allergens": [],
        "ayurvedic": {
            "rasa": ["katu"],
            "guna": ["laghu", "ruksha"],
            "virya": "ushna",
            "vipaka": "katu",
            "dosha_effect": {"vata": "pacifies", "pitta": "neutral_in_moderation", "kapha": "pacifies"},
            "pathya_for": ["mandagni", "bloating", "gas", "indigestion", "pitta_friendly_appetizer"],
            "apathya_for": [],
            "seasonal_relevance": ["all_seasons", "summer"],
            "evidence_status": "grounded",
        },
        "clinical_restrictions": [],
        "sources": [
            {"document": SRC_IFCT, "page": 268, "notes": "IFCT Table G.6 Cumin seeds"},
            {"document": SRC_AYUR_FOOD, "page": 44, "notes": "Jeeraka stimulates digestion without aggravating body heat (Pitta-friendly Deepana)."},
        ],
    },
]


class FoodDatabase:
    """
    Search, retrieval, and categorization engine for grounded food items.
    """

    def __init__(self):
        self._foods: Dict[str, FoodItem] = {}
        for raw in RAW_FOOD_CATALOG:
            item = FoodItem(
                food_id=raw["food_id"],
                food_name=raw["food_name"],
                local_name=raw.get("local_name"),
                category=raw["category"],
                subcategory=raw.get("subcategory"),
                nutrition=NutritionProfile(**raw["nutrition"]),
                serving=ServingInfo(**raw["serving"]),
                dietary=DietaryClassification(**raw["dietary"]),
                allergens=raw.get("allergens", []),
                ayurvedic=AyurvedicProperties(**raw["ayurvedic"]),
                clinical_restrictions=raw.get("clinical_restrictions", []),
                sources=[SourceProvenance(**s) for s in raw.get("sources", [])],
            )
            self._foods[item.food_id] = item

    def get_food(self, food_id: str) -> Optional[FoodItem]:
        """Fetch food item by unique ID."""
        return self._foods.get(food_id)

    def get_all_foods(self) -> List[FoodItem]:
        """Fetch all available foods."""
        return list(self._foods.values())

    def get_by_category(self, category: str) -> List[FoodItem]:
        """Filter foods by category."""
        return [f for f in self._foods.values() if f.category == category]

    def search_foods(self, query: str) -> List[FoodItem]:
        """Search foods by name, local name, category, or dosha effect."""
        q = query.lower().strip()
        results = []
        for f in self._foods.values():
            if (
                q in f.food_name.lower()
                or (f.local_name and q in f.local_name.lower())
                or q in f.category.lower()
                or any(q in r.lower() for r in f.ayurvedic.rasa)
                or any(q in cond.lower() for cond in f.ayurvedic.pathya_for)
            ):
                results.append(f)
        return results


# Global singleton instance
_FOOD_DB_INSTANCE: Optional[FoodDatabase] = None


def get_food_db() -> FoodDatabase:
    """Provides singleton access to the food database."""
    global _FOOD_DB_INSTANCE
    if _FOOD_DB_INSTANCE is None:
        _FOOD_DB_INSTANCE = FoodDatabase()
    return _FOOD_DB_INSTANCE
