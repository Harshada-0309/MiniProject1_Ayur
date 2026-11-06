"""
AyurDiet Deterministic Nutrition Calculation Engine - Constants & Formulas
Centralized repository of validated nutritional equations, activity multipliers,
macronutrient distribution coefficients, and clinical classification standards.
"""

from typing import Dict, Tuple

# -----------------------------------------------------------------------------
# 1. Anthropometric & BMI Standards (WHO Adult Classification)
# -----------------------------------------------------------------------------
# BMI Categories: (min_bmi, max_bmi, classification_label)
BMI_CATEGORIES: Tuple[Tuple[float, float, str], ...] = (
    (0.0, 16.0, "Severe Underweight"),
    (16.0, 16.99, "Moderate Underweight"),
    (17.0, 18.49, "Mild Underweight"),
    (18.5, 24.99, "Normal weight"),
    (25.0, 29.99, "Overweight"),
    (30.0, 34.99, "Obesity Class I"),
    (35.0, 39.99, "Obesity Class II"),
    (40.0, 100.0, "Obesity Class III"),
)

# -----------------------------------------------------------------------------
# 2. BMR Equation: Mifflin-St Jeor (Am J Clin Nutr 1990; 51:241-247)
# -----------------------------------------------------------------------------
# Formula:
# Men:   BMR = (10 × weight_kg) + (6.25 × height_cm) - (5 × age_years) + 5
# Women: BMR = (10 × weight_kg) + (6.25 × height_cm) - (5 × age_years) - 161
BMR_FORMULA_NAME = "Mifflin-St Jeor"
BMR_CITATION = "Mifflin MD, St Jeor ST, et al. Am J Clin Nutr 1990; 51:241-247 (RMR estimation in NIDDK Body Weight Planner research)"
BMR_WEIGHT_COEFF = 10.0
BMR_HEIGHT_COEFF = 6.25
BMR_AGE_COEFF = -5.0
BMR_MALE_CONSTANT = 5.0
BMR_FEMALE_CONSTANT = -161.0

# -----------------------------------------------------------------------------
# 3. Physical Activity Multipliers (Physical Activity Level - PAL)
# -----------------------------------------------------------------------------
# Phase 2 mapped activity categories
ACTIVITY_MULTIPLIERS: Dict[str, float] = {
    "sedentary": 1.20,           # Little or no exercise, desk job
    "lightly_active": 1.375,     # Light exercise 1-3 days/week
    "moderately_active": 1.55,   # Moderate exercise 3-5 days/week
    "very_active": 1.725,        # Heavy exercise 6-7 days/week
    "extremely_active": 1.90,    # Very heavy physical labor or athlete training
}

# -----------------------------------------------------------------------------
# 4. Dietary Goal Energy Adjustments (kcal/day)
# -----------------------------------------------------------------------------
# Non-aggressive planning estimates
GOAL_ADJUSTMENTS: Dict[str, Dict[str, any]] = {
    "weight_loss": {
        "adjustment_kcal": -500.0,
        "method": "Standard moderate energy deficit (-500 kcal/day) targeting ~0.5 kg/week gradual loss",
    },
    "weight_maintenance": {
        "adjustment_kcal": 0.0,
        "method": "Isocaloric energy maintenance matching estimated daily expenditure",
    },
    "weight_gain": {
        "adjustment_kcal": 400.0,
        "method": "Gradual lean mass caloric surplus (+400 kcal/day)",
    },
    "general_healthy_diet": {
        "adjustment_kcal": 0.0,
        "method": "Eucaloric balanced intake matching daily energy expenditure",
    },
    "condition_specific_nutrition": {
        "adjustment_kcal": 0.0,
        "method": "Clinical maintenance baseline, subject to knowledge-grounded clinical review",
    },
}

# Energy safety floors (prevent unsafe severe deficits)
ENERGY_FLOOR_MALE = 1500.0
ENERGY_FLOOR_FEMALE = 1200.0
ENERGY_FLOOR_GENERAL = 1200.0

# -----------------------------------------------------------------------------
# 5. Macronutrient Energy Conversions (Atwater General Factors)
# -----------------------------------------------------------------------------
KCAL_PER_G_PROTEIN = 4.0
KCAL_PER_G_CARB = 4.0
KCAL_PER_G_FAT = 9.0

# -----------------------------------------------------------------------------
# 6. Protein Target Factors (g/kg body weight/day)
# -----------------------------------------------------------------------------
# Configurable based on dietary goal and clinical guidelines (ICMR / RDA)
PROTEIN_FACTORS_BY_GOAL: Dict[str, float] = {
    "weight_loss": 1.2,              # Elevated to spare lean mass during caloric restriction
    "weight_maintenance": 0.9,       # Standard adult maintenance
    "weight_gain": 1.3,              # Elevated to facilitate lean tissue accretion
    "general_healthy_diet": 1.0,     # Balanced optimal baseline (1.0 g/kg)
    "condition_specific_nutrition": 1.0,  # Baseline pending specific disease protocol
}

# -----------------------------------------------------------------------------
# 7. Dietary Fat Target Distribution
# -----------------------------------------------------------------------------
# Target 25% of total caloric intake from healthy fats (ICMR / WHO guidelines)
DEFAULT_FAT_ENERGY_PERCENTAGE = 0.25

# -----------------------------------------------------------------------------
# 8. Dietary Fiber Targets (g/day)
# -----------------------------------------------------------------------------
# Institute of Medicine (IOM) recommendation: 14 g per 1,000 kcal intake
FIBER_GRAMS_PER_1000_KCAL = 14.0
FIBER_MINIMUM_DAILY_GRAMS = 25.0

# -----------------------------------------------------------------------------
# 9. Hydration / Fluid Targets (ml/day)
# -----------------------------------------------------------------------------
# Baseline physiological estimate: 35 ml per kg body weight
WATER_ML_PER_KG = 35.0
WATER_MINIMUM_DAILY_ML = 2000.0

# -----------------------------------------------------------------------------
# 10. Medical Conditions Requiring Knowledge-Grounded Guidance
# -----------------------------------------------------------------------------
FLAGGED_CONDITIONS = (
    "diabetes", "diabetic", "glycemic", "sugar",
    "hypertension", "bp", "cardiac", "heart", "coronary",
    "lipid", "cholesterol", "triglycerides", "dyslipidemia",
    "renal", "kidney", "ckd", "nephro",
    "hepatic", "liver", "cirrhosis", "fatty liver",
    "thyroid", "hypothyroid", "hyperthyroid",
    "pcos", "pcod",
    "gerd", "acid reflux", "gastritis", "ulcer",
    "ibs", "ibd", "crohn", "colitis", "celiac",
    "gout", "uric acid",
    "cancer", "oncology",
)
