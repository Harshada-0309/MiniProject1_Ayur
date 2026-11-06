"""
Input validation utilities for Deterministic Nutrition Engine.
Enforces explicit boundaries; does not allow silent substitutions for missing clinical metrics.
"""

from typing import List
from .constants import ACTIVITY_MULTIPLIERS, GOAL_ADJUSTMENTS


class NutritionValidationError(ValueError):
    """Raised when patient assessment data fails numerical or categorical validation."""
    def __init__(self, errors: List[str]):
        self.errors = errors
        super().__init__("; ".join(errors))


def validate_assessment_input(data: dict) -> None:
    """
    Validates required demographic, anthropometric, and clinical values
    prior to deterministic nutrition processing.
    """
    errors: List[str] = []

    # 1. Age
    age = data.get("age")
    if age is None:
        errors.append("Age is required for BMR estimation.")
    elif not isinstance(age, int) or age < 0 or age > 120:
        errors.append("Age must be an integer between 0 and 120 years.")

    # 2. Sex
    sex = data.get("sex")
    if not sex:
        errors.append("Sex is required for Mifflin-St Jeor BMR estimation.")
    elif str(sex).strip().lower() not in ("male", "female", "other"):
        errors.append("Sex must be one of: 'male', 'female', 'other'.")

    # 3. Height
    height = data.get("height")
    if height is None:
        errors.append("Height in cm is required for BMI and BMR calculation.")
    else:
        try:
            h = float(height)
            if h < 30.0 or h > 300.0:
                errors.append("Height must be a valid measurement between 30.0 cm and 300.0 cm.")
        except (ValueError, TypeError):
            errors.append("Height must be a numeric value.")

    # 4. Weight
    weight = data.get("weight")
    if weight is None:
        errors.append("Weight in kg is required for BMI, BMR, and protein calculations.")
    else:
        try:
            w = float(weight)
            if w < 10.0 or w > 500.0:
                errors.append("Weight must be a valid measurement between 10.0 kg and 500.0 kg.")
        except (ValueError, TypeError):
            errors.append("Weight must be a numeric value.")

    # 5. Activity Level
    activity = data.get("activity_level", "sedentary")
    if activity not in ACTIVITY_MULTIPLIERS:
        valid_acts = ", ".join(ACTIVITY_MULTIPLIERS.keys())
        errors.append(f"Invalid activity level '{activity}'. Must be one of: {valid_acts}.")

    # 6. Dietary Goal
    goal = data.get("diet_goal")
    if not goal:
        errors.append("Diet goal is required for energy requirement determination.")
    elif goal not in GOAL_ADJUSTMENTS:
        valid_goals = ", ".join(GOAL_ADJUSTMENTS.keys())
        errors.append(f"Invalid diet goal '{goal}'. Must be one of: {valid_goals}.")

    # 7. Target Weight (if provided)
    target_weight = data.get("target_weight")
    if target_weight is not None and target_weight != "":
        try:
            tw = float(target_weight)
            if tw < 10.0 or tw > 500.0:
                errors.append("Target weight must be a realistic number between 10.0 kg and 500.0 kg.")
        except (ValueError, TypeError):
            errors.append("Target weight must be a numeric value.")

    if errors:
        raise NutritionValidationError(errors)
