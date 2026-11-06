"""
Pydantic Schemas for Phase 6 Gemini-Powered 7-Day Diet Plan Presentation.
Defines strict data contracts for the formatted plan, daily/meal structures,
post-generation validation results, and API request/response payloads.
"""

from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class FormattedItem(BaseModel):
    """A formatted food item within a meal with clinical preparation details."""
    food_id: str = Field(..., description="Unique food identifier slug from grounded DB")
    food_name: str = Field(..., description="Canonical food name")
    quantity: float = Field(..., gt=0, description="Exact serving quantity")
    unit: str = Field(..., description="Serving unit e.g. g, ml, katori, piece")
    preparation_notes: str = Field(
        ..., description="Culinary instructions, spices, or therapeutic preparation tips"
    )
    calories: float = Field(..., ge=0, description="Energy in kcal (must match deterministic total)")
    protein_g: float = Field(..., ge=0, description="Protein in grams")
    carbohydrate_g: float = Field(..., ge=0, description="Carbohydrates in grams")
    fat_g: float = Field(..., ge=0, description="Fat in grams")
    fiber_g: float = Field(default=0.0, ge=0, description="Dietary fiber in grams")
    ayurvedic_properties: Optional[str] = Field(
        None, description="Ayurvedic qualities (e.g., Laghu, Ushna, Vata-pacifying)"
    )


class FormattedMeal(BaseModel):
    """A meal slot containing formatted food items and calculated totals."""
    meal_id: str = Field(..., description="Unique meal slot identifier")
    meal_type: str = Field(..., description="breakfast, mid_morning, lunch, evening_snack, dinner")
    timing: str = Field(..., description="Recommended timing window, e.g. '8:00 AM - 8:30 AM'")
    foods: List[FormattedItem] = Field(default_factory=list)
    meal_summary: str = Field(..., description="Brief culinary and therapeutic overview of the meal")
    totals: Dict[str, float] = Field(
        default_factory=dict,
        description="Nutritional totals for the meal (calories, protein_g, carbohydrate_g, fat_g, fiber_g)"
    )


class FormattedDay(BaseModel):
    """A single day's complete meal schedule within the 7-day diet plan."""
    day_number: int = Field(..., ge=1, le=7, description="Day index from 1 to 7")
    day_name: str = Field(..., description="E.g. 'Day 1 (Monday)'")
    theme: str = Field(..., description="Therapeutic focus or seasonal/dosha alignment theme")
    meals: List[FormattedMeal] = Field(default_factory=list)
    daily_totals: Dict[str, float] = Field(
        default_factory=dict,
        description="Daily nutritional totals (calories, protein_g, carbohydrate_g, fat_g, fiber_g)"
    )
    daily_summary: str = Field(..., description="Summary of the day's nutritional strategy")
    clinical_rationale: str = Field(..., description="Clinical justification for food choices")
    ayurvedic_notes: str = Field(..., description="Dravyaguna and dosha alignment rationale")


class Gemini7DayDietPlan(BaseModel):
    """Complete 7-day diet plan formatted by Gemini and verified by deterministic guardrails."""
    plan_id: Optional[str] = None
    patient_id: Optional[Union[str, int]] = None
    assessment_id: Optional[Union[str, int]] = None
    title: str = Field("7-Day Personalized Ayurvedic Diet Plan", description="Plan title")
    status: str = Field("draft", description="'draft', 'needs_review', or 'approved'")
    patient_summary: str = Field(..., description="Concise assessment summary of prakriti, vikriti, conditions")
    clinical_rationale: str = Field(..., description="Overall clinical strategy linking targets to health goals")
    ayurvedic_dietary_principles: List[str] = Field(
        default_factory=list, description="Core Ahara guidelines (e.g., Ahara Vidhi Vidhana)"
    )
    dosha_guidelines: Dict[str, str] = Field(
        default_factory=dict, description="Dosha-specific dining recommendations"
    )
    days: List[FormattedDay] = Field(default_factory=list, description="7 distinct daily meal schedules")
    weekly_overview: str = Field(..., description="Weekly progression and transition notes")
    general_instructions: List[str] = Field(
        default_factory=list, description="Hydration, meal spacing, and lifestyle guidance"
    )
    evidence_citations: List[Dict[str, Any]] = Field(
        default_factory=list, description="Source provenance traceable to ICMR and Ayurvedic texts"
    )
    validation_results: Optional[Dict[str, Any]] = Field(
        None, description="Deterministic guardrail validation status and checks"
    )
    clinical_lab_summary: Optional[Dict[str, Any]] = Field(
        None, description="Section 9 structured clinical laboratory interpretation and alerts"
    )
    dietitian_notes: Optional[str] = Field(None, description="Notes written by dietitian")
    is_approved: bool = Field(False, description="Whether dietitian has formally signed off")
    approved_by: Optional[str] = Field(None, description="Dietitian username/identifier")
    approved_at: Optional[str] = Field(None, description="ISO timestamp of approval")


class DeterministicGuardrailResult(BaseModel):
    """Results of post-generation deterministic guardrails checking Gemini's output."""
    passed: bool = True
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    requires_dietitian_review: bool = False
    review_reasons: List[str] = Field(default_factory=list)
    item_check_count: int = 0
    macro_tolerance_passed: bool = True
    allergen_safety_passed: bool = True
    forbidden_claims_found: List[str] = Field(default_factory=list)


# -----------------------------------------------------------------------------
# API Request / Response Models
# -----------------------------------------------------------------------------

class Generate7DayDietPlanRequest(BaseModel):
    """Request payload to construct and format a 7-day diet plan."""
    patient_assessment: Dict[str, Any] = Field(..., description="Complete patient assessment object")
    nutrition_targets: Optional[Dict[str, Any]] = Field(
        None, description="Phase 3 nutrition targets (computed automatically if omitted)"
    )
    clinical_lab_data: Optional[List[Dict[str, Any]]] = Field(
        None, description="Optional Section 9 clinical lab records for reasoning and safety guardrails"
    )
    meal_structure: Optional[List[str]] = Field(
        None, description="Meal slots to generate e.g. ['breakfast', 'lunch', 'evening_snack', 'dinner']"
    )
    custom_meal_distribution: Optional[Dict[str, float]] = Field(
        None, description="Optional calorie split per meal slot"
    )
    dietitian_notes: Optional[str] = Field(None, description="Clinical notes or dietitian guidance")


class ValidateDietPlanRequest(BaseModel):
    """Request payload to deterministically revalidate a diet plan after edits."""
    diet_plan: Dict[str, Any] = Field(..., description="Diet plan payload to validate")
    patient_assessment: Dict[str, Any] = Field(..., description="Original patient assessment")
    nutrition_targets: Optional[Dict[str, Any]] = Field(None, description="Phase 3 nutrition targets")
    clinical_lab_data: Optional[List[Dict[str, Any]]] = Field(
        None, description="Optional Section 9 clinical lab records for reasoning and safety guardrails"
    )
