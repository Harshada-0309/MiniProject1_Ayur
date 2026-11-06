"""
Pydantic Schemas for AyurDiet Phase 5 Food & Meal Planning Engine.
Defines strongly typed, deterministic data contracts for foods, meals, portions,
substitutions, and plan validation.
"""

from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class NutritionProfile(BaseModel):
    """Nutritional density values, typically per 100g or per calculated portion."""
    basis: str = Field("100g", description="Reference basis e.g. 100g or portion")
    calories: float = Field(..., ge=0, description="Energy in kcal")
    protein_g: float = Field(..., ge=0, description="Protein in grams")
    carbohydrate_g: float = Field(..., ge=0, description="Carbohydrates in grams")
    fat_g: float = Field(..., ge=0, description="Fats in grams")
    fiber_g: float = Field(default=0.0, ge=0, description="Dietary fiber in grams")


class ServingInfo(BaseModel):
    """Standard serving size and practical portion boundaries."""
    default_quantity: float = Field(100.0, gt=0, description="Default serving weight or volume")
    unit: str = Field("g", description="Serving unit e.g. g, ml, katori, piece")
    min_quantity: float = Field(10.0, ge=0, description="Minimum clinically reasonable serving")
    max_quantity: float = Field(400.0, gt=0, description="Maximum clinically reasonable serving")
    step_size: float = Field(10.0, gt=0, description="Discrete increment step")


class AyurvedicProperties(BaseModel):
    """Ayurvedic Dravyaguna attributes grounded in classical texts."""
    rasa: List[str] = Field(default_factory=list, description="Taste profile e.g. madhura, tikta, kashaya")
    guna: List[str] = Field(default_factory=list, description="Qualities e.g. laghu, guru, ruksha, snigdha")
    virya: str = Field("sheeta", description="Thermal potency: 'sheeta' (cooling) or 'ushna' (warming)")
    vipaka: str = Field("madhura", description="Post-digestive effect: 'madhura', 'amla', or 'katu'")
    dosha_effect: Dict[str, str] = Field(
        default_factory=dict,
        description="Effect on doshas: e.g. {'vata': 'pacifies', 'pitta': 'pacifies', 'kapha': 'neutral'}"
    )
    pathya_for: List[str] = Field(default_factory=list, description="Conditions where this food is wholesome")
    apathya_for: List[str] = Field(default_factory=list, description="Conditions where this food is contraindicated")
    seasonal_relevance: List[str] = Field(default_factory=list, description="Recommended seasons e.g. winter, summer")
    evidence_status: str = Field("grounded", description="'grounded', 'requires_review', or 'unknown'")


class DietaryClassification(BaseModel):
    """Dietary habit adherence flags."""
    vegetarian: bool = True
    vegan: bool = True
    eggetarian: bool = False
    dairy: bool = False
    gluten: bool = False


class SourceProvenance(BaseModel):
    """Traceable citation to Phase 4 PDF document and knowledge base."""
    document: str = Field(..., description="Canonical source document title or filename")
    page: Optional[int] = Field(None, description="Page number in source PDF")
    chunk_id: Optional[str] = Field(None, description="Knowledge base chunk ID")
    notes: Optional[str] = Field(None, description="Clinical or nutritional excerpt")


class FoodItem(BaseModel):
    """Comprehensive, grounded food record."""
    food_id: str = Field(..., description="Unique food identifier slug")
    food_name: str = Field(..., description="Standard English food name")
    local_name: Optional[str] = Field(None, description="Hindi, Sanskrit, or regional name")
    category: str = Field(..., description="cereal_grain, pulse_legume, vegetable, fruit, dairy, nut_seed, oil_fat, spice_herb")
    subcategory: Optional[str] = Field(None, description="Detailed sub-classification")
    nutrition: NutritionProfile
    serving: ServingInfo
    dietary: DietaryClassification
    allergens: List[str] = Field(default_factory=list, description="Allergens present e.g. milk, wheat, gluten, soy, tree_nuts")
    ayurvedic: AyurvedicProperties
    clinical_restrictions: List[str] = Field(default_factory=list, description="Clinical flags e.g. high_gi, high_potassium")
    sources: List[SourceProvenance] = Field(default_factory=list)


# -----------------------------------------------------------------------------
# Meal Planning & Selection Models
# -----------------------------------------------------------------------------

class FoodSelectionResult(BaseModel):
    """A selected food item placed in a specific meal with portion and reasoning."""
    food_id: str
    food_name: str
    category: str
    quantity: float
    unit: str
    nutrition: NutritionProfile
    selection_reason: str
    ayurvedic_alignment: str
    sources: List[SourceProvenance] = Field(default_factory=list)
    requires_dietitian_review: bool = False
    review_notes: Optional[str] = None


class MealPlanMeal(BaseModel):
    """A constructed meal containing portions, calculated nutrients, and totals."""
    meal_id: str
    meal_type: str = Field(..., description="breakfast, mid_morning, lunch, evening_snack, dinner")
    target_calories: float = 0.0
    foods: List[FoodSelectionResult] = Field(default_factory=list)
    totals: Dict[str, float] = Field(default_factory=dict)


class DailyTotals(BaseModel):
    """Aggregate actual daily nutrition provided across all meals."""
    calories: float = 0.0
    protein_g: float = 0.0
    carbohydrate_g: float = 0.0
    fat_g: float = 0.0
    fiber_g: float = 0.0


class NutritionTargetComparison(BaseModel):
    """Comparison of actual daily totals against Phase 3 targets with explicit tolerances."""
    targets: Dict[str, float]
    actual: Dict[str, float]
    difference: Dict[str, float]
    within_target: bool
    tolerances_pct: Dict[str, float] = Field(
        default_factory=lambda: {
            "calories": 7.5,
            "protein": 10.0,
            "carbohydrate": 10.0,
            "fat": 10.0,
        }
    )


class PlanValidationResult(BaseModel):
    """Complete validation diagnostics evaluating safety, macros, portions, and evidence."""
    valid: bool = True
    warnings: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
    requires_dietitian_review: bool = False
    review_reasons: List[str] = Field(default_factory=list)


class FoodSubstitutionOption(BaseModel):
    """Nutritionally equivalent, restriction-safe replacement candidate."""
    replacement_food: FoodItem
    quantity: float
    unit: str
    nutritional_delta: Dict[str, float] = Field(
        ..., description="Difference in calories, protein, carbs, fat, fiber"
    )
    reason: str
    evidence_sources: List[SourceProvenance] = Field(default_factory=list)
    requires_dietitian_review: bool = False


class StructuredMealPlan(BaseModel):
    """
    Final Phase 5 structured meal plan application data.
    Does NOT contain natural language Gemini prose.
    """
    patient_id: Optional[Union[str, int]] = None
    assessment_id: Optional[Union[str, int]] = None
    plan_status: str = Field("draft", description="'draft', 'needs_review', or 'validated'")
    nutrition_targets: Dict[str, Any] = Field(default_factory=dict)
    meals: List[MealPlanMeal] = Field(default_factory=list)
    daily_totals: DailyTotals
    target_comparison: NutritionTargetComparison
    validation: PlanValidationResult
    evidence: List[Dict[str, Any]] = Field(default_factory=list)
    requires_dietitian_review: bool = False
    review_reasons: List[str] = Field(default_factory=list)


# -----------------------------------------------------------------------------
# API Request Models
# -----------------------------------------------------------------------------

class GenerateMealPlanRequest(BaseModel):
    """Payload to build a deterministic meal plan from assessment metrics and Phase 3 targets."""
    patient_assessment: Dict[str, Any] = Field(..., description="Full assessment payload")
    nutrition_targets: Optional[Dict[str, Any]] = Field(
        None, description="Optional pre-calculated Phase 3 nutrition targets. If omitted, engine computes them."
    )
    meal_structure: Optional[List[str]] = Field(
        None, description="Optional custom meal structure e.g. ['breakfast', 'lunch', 'evening_snack', 'dinner']"
    )
    custom_meal_distribution: Optional[Dict[str, float]] = Field(
        None, description="Optional meal percentage distribution e.g. {'breakfast': 0.25, 'lunch': 0.35, ...}"
    )


class SubstituteRequest(BaseModel):
    """Payload to request eligible alternatives for a specific food."""
    food_id: str = Field(..., description="Food ID to replace")
    current_quantity: float = Field(..., gt=0, description="Current serving quantity")
    patient_assessment: Dict[str, Any] = Field(default_factory=dict)
    meal_type: Optional[str] = None
