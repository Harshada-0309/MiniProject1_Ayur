"""
AyurDiet Phase 5: Deterministic Food & Meal Planning Engine.
Provides grounded food databases, eligibility filtering, explainable scoring,
portion optimization, substitution recommendations, and plan validation.
"""

from .eligibility import EligibilityResult, FoodEligibilityEngine
from .food_db import FoodDatabase, get_food_db
from .meal_builder import MealBuilder
from .models import (
    DailyTotals,
    FoodItem,
    FoodSelectionResult,
    FoodSubstitutionOption,
    GenerateMealPlanRequest,
    MealPlanMeal,
    NutritionProfile,
    NutritionTargetComparison,
    PlanValidationResult,
    ServingInfo,
    SourceProvenance,
    StructuredMealPlan,
    SubstituteRequest,
)
from .portion_engine import PortionEngine, scale_nutrition
from .scoring import FoodScorer
from .substitutions import SubstitutionEngine
from .validator import PlanValidator

__all__ = [
    "FoodDatabase",
    "get_food_db",
    "FoodEligibilityEngine",
    "EligibilityResult",
    "FoodScorer",
    "PortionEngine",
    "scale_nutrition",
    "PlanValidator",
    "SubstitutionEngine",
    "MealBuilder",
    "FoodItem",
    "NutritionProfile",
    "ServingInfo",
    "SourceProvenance",
    "FoodSelectionResult",
    "MealPlanMeal",
    "DailyTotals",
    "NutritionTargetComparison",
    "PlanValidationResult",
    "FoodSubstitutionOption",
    "StructuredMealPlan",
    "GenerateMealPlanRequest",
    "SubstituteRequest",
]
