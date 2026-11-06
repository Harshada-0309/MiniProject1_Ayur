"""
Pydantic schemas for Deterministic Nutrition Calculation Engine.
Defines strongly typed input and output contracts.
"""

from typing import List, Optional, Union, Any, Dict
from pydantic import BaseModel, Field


# -----------------------------------------------------------------------------
# Input Models
# -----------------------------------------------------------------------------
class PatientAssessmentInput(BaseModel):
    """
    Patient and Assessment data received from Phase 2 schema.
    """
    patient_id: Optional[Union[str, int]] = Field(None, description="Patient identifier")
    assessment_id: Optional[Union[str, int]] = Field(None, description="Assessment identifier")

    # Demographics (Required for BMR)
    age: int = Field(..., description="Age in completed years (0-120)")
    sex: str = Field(..., description="Biological sex ('male', 'female', 'other')")

    # Body measurements (Required for BMI & BMR)
    height: float = Field(..., description="Height in centimeters (e.g. 175.0)")
    weight: float = Field(..., description="Body weight in kilograms (e.g. 74.5)")
    waist_circumference: Optional[float] = Field(None, description="Waist circumference in cm")
    weight_trend: Optional[str] = Field("stable", description="'losing', 'stable', 'gaining'")

    # Dietary Goal (Required for TDEE adjustment)
    diet_goal: str = Field(
        ...,
        description="'weight_loss', 'weight_maintenance', 'weight_gain', 'general_healthy_diet', 'condition_specific_nutrition'"
    )
    target_weight: Optional[float] = Field(None, description="Optional target weight in kg")
    goal_notes: Optional[str] = Field(None, description="Clinician notes on dietary objective")

    # Lifestyle (Required for Activity multiplier)
    activity_level: str = Field(
        "sedentary",
        description="'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active'"
    )
    exercise_type: Optional[str] = Field(None, description="Type of physical exercise")
    exercise_frequency: Optional[str] = Field(None, description="Frequency of exercise sessions")
    exercise_duration: Optional[str] = Field(None, description="Duration per session")
    sleep_duration: Optional[float] = Field(None, description="Sleep duration in hours")
    sleep_quality: Optional[str] = Field(None, description="'poor', 'fair', 'good', 'excellent'")
    water_intake: Optional[float] = Field(None, description="Reported daily water intake in litres")

    # Dietary Profile
    diet_category: Optional[str] = Field("vegetarian", description="'vegetarian', 'vegan', 'eggetarian', 'non_vegetarian', 'other'")
    meal_frequency: Optional[int] = Field(3, description="Meals per day")
    meal_timings: Optional[List[str]] = Field(default_factory=list, description="Preferred meal schedule")
    food_preferences: Optional[str] = Field(None, description="Preferred food items")
    foods_disliked: Optional[str] = Field(None, description="Disliked/avoided foods")

    # Safety Restrictions
    food_allergies: Optional[List[str]] = Field(default_factory=list, description="Known allergies")
    food_intolerances: Optional[List[str]] = Field(default_factory=list, description="Known intolerances")
    dietary_restrictions: Optional[List[str]] = Field(default_factory=list, description="Clinician dietary restrictions")

    # Medical Information
    existing_conditions: Optional[List[str]] = Field(default_factory=list, description="Diagnosed clinical conditions")
    medical_history: Optional[str] = Field(None, description="Prior medical history")
    symptoms: Optional[List[Union[str, Dict[str, Any]]]] = Field(default_factory=list, description="Reported symptoms")
    medications: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Active prescriptions")
    supplements: Optional[str] = Field(None, description="Active supplements")

    # Ayurvedic Information
    prakriti: Optional[str] = Field("Unknown / Not assessed", description="Constitutional Prakriti type")
    vikriti: Optional[str] = Field(None, description="Current doshic imbalance state")
    appetite: Optional[str] = Field("Samagni (Balanced)", description="Agni / Appetite state")
    digestion: Optional[str] = Field("Normal", description="Digestive state")
    bowel_habits: Optional[str] = Field("Regular", description="Koshtha bowel pattern")
    meal_regularity: Optional[str] = Field("regular", description="'regular' or 'irregular'")
    season_ritu: Optional[str] = Field(None, description="Current seasonal Ritu")
    dietitian_observations: Optional[str] = Field(None, description="Clinical Ayurvedic notes")


# -----------------------------------------------------------------------------
# Output Sub-models
# -----------------------------------------------------------------------------
class AnthropometricsOutput(BaseModel):
    height_cm: float
    weight_kg: float
    bmi: float
    bmi_status: str
    waist_circumference_cm: Optional[float] = None
    weight_trend: Optional[str] = "stable"


class EnergyOutput(BaseModel):
    bmr_kcal_day: float
    formula: str
    activity_level: str
    activity_multiplier: float
    tdee_kcal_day: float
    goal: str
    target_energy_kcal_day: float
    adjustment_kcal_day: float
    adjustment_method: str


class MacrosOutput(BaseModel):
    protein_g_day: float
    protein_kcal_day: float
    protein_pct: float
    protein_factor_g_kg: float
    protein_method: str

    carbohydrate_g_day: float
    carbohydrate_kcal_day: float
    carbohydrate_pct: float

    fat_g_day: float
    fat_kcal_day: float
    fat_pct: float

    total_macro_kcal: float


class OtherTargetsOutput(BaseModel):
    fiber_g_day: float
    fiber_method: str
    water_ml_day: float
    water_method: str


class AyurvedicProfileOutput(BaseModel):
    prakriti: str
    vikriti: Optional[str] = None
    agni: str
    digestion: Optional[str] = None
    bowel_habits: Optional[str] = None
    meal_regularity: Optional[str] = None
    season: Optional[str] = None
    doshic_dietary_qualities: List[str] = Field(default_factory=list)


class CalculationMetadata(BaseModel):
    formulas_used: List[str]
    assumptions: List[str]
    warnings: List[str]
    disclaimer: str


# -----------------------------------------------------------------------------
# Top-Level Response Model
# -----------------------------------------------------------------------------
class NutritionTargetResponse(BaseModel):
    """
    Structured, fully deterministic, explainable nutrition targets for Phase 3.
    """
    patient_id: Optional[Union[str, int]] = None
    assessment_id: Optional[Union[str, int]] = None

    anthropometrics: AnthropometricsOutput
    energy: EnergyOutput
    macros: MacrosOutput
    other_targets: OtherTargetsOutput
    ayurvedic_profile: AyurvedicProfileOutput
    calculation_metadata: CalculationMetadata

    condition_specific: bool
    requires_knowledge_grounded_guidance: bool
