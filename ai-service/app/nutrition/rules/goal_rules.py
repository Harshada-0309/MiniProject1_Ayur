"""
Deterministic Goal Adjustment Rules.
Calculates target energy and protein coefficients based on clinician-selected goals
and clinical safety floors.
"""

from typing import Tuple, Optional
from ..constants import (
    GOAL_ADJUSTMENTS,
    PROTEIN_FACTORS_BY_GOAL,
    ENERGY_FLOOR_MALE,
    ENERGY_FLOOR_FEMALE,
    ENERGY_FLOOR_GENERAL,
)


def calculate_goal_adjusted_energy(
    tdee: float,
    goal: str,
    sex: str,
) -> Tuple[float, float, str, Optional[str]]:
    """
    Applies non-aggressive, clinically validated goal adjustments to TDEE.
    Enforces minimum physiological energy floors.

    Returns:
        (target_energy_kcal, adjustment_kcal, adjustment_method, warning)
    """
    config = GOAL_ADJUSTMENTS.get(
        goal,
        {
            "adjustment_kcal": 0.0,
            "method": "Isocaloric energy maintenance",
        },
    )

    adjustment_kcal = config["adjustment_kcal"]
    method_desc = config["method"]
    unclamped_target = tdee + adjustment_kcal

    # Determine biological sex energy floor
    s = sex.strip().lower()
    if s == "female":
        floor = ENERGY_FLOOR_FEMALE
    elif s == "male":
        floor = ENERGY_FLOOR_MALE
    else:
        floor = ENERGY_FLOOR_GENERAL

    warning = None
    if unclamped_target < floor:
        target_energy = floor
        warning = (
            f"Calculated energy target ({round(unclamped_target)} kcal) fell below the "
            f"safe clinical floor for {s}s ({round(floor)} kcal). Clamped to {round(floor)} kcal/day."
        )
    else:
        target_energy = round(unclamped_target, 1)

    return target_energy, adjustment_kcal, method_desc, warning


def determine_protein_factor(goal: str, activity_level: str) -> Tuple[float, str]:
    """
    Determines protein recommendation factor (g/kg body weight/day)
    based on dietary objective and physical activity level.

    Returns:
        (protein_factor_g_kg, protein_method_description)
    """
    base_factor = PROTEIN_FACTORS_BY_GOAL.get(goal, 1.0)
    method = f"Goal-aligned target ({goal.replace('_', ' ')}: {base_factor} g/kg/day)"

    # Athletic adjustment for high-intensity training
    if activity_level in ("very_active", "extremely_active") and base_factor < 1.3:
        adjusted_factor = 1.3
        method += f"; adjusted to {adjusted_factor} g/kg/day for intense physical activity demands"
        return adjusted_factor, method

    return base_factor, method
