"""
Pydantic Models for Section 9: Clinical & Laboratory Data Interpretation Pipeline.
"""

from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class LabStatus(str, Enum):
    NORMAL = "normal"
    LOW = "low"
    HIGH = "high"
    CRITICAL_LOW = "critical_low"
    CRITICAL_HIGH = "critical_high"
    INDETERMINATE = "indeterminate"
    STALE = "stale"


class LabCategory(str, Enum):
    GLUCOSE = "glucose"
    ELECTROLYTE = "electrolyte"
    RENAL = "renal"
    LIVER = "liver"
    HEMATOLOGY_IRON = "hematology_iron"
    LIPID = "lipid"
    THYROID = "thyroid"
    VITAMINS = "vitamins"
    INFLAMMATORY = "inflammatory"
    OTHER = "other"


class NormalizedLabItem(BaseModel):
    """Structured, verified laboratory test finding."""
    original_test_name: str
    canonical_key: str = "custom"
    category: LabCategory = LabCategory.OTHER
    original_value: str
    numeric_value: Optional[float] = None
    qualitative_value: Optional[str] = None
    original_unit: Optional[str] = None
    normalized_unit: Optional[str] = None
    reference_range_raw: Optional[str] = None
    reference_range_min: Optional[float] = None
    reference_range_max: Optional[float] = None
    range_source: str = "none"  # "lab_specified" | "clinical_standard" | "none"
    test_date: Optional[str] = None
    days_old: Optional[int] = None
    source_laboratory: Optional[str] = None
    status: LabStatus = LabStatus.INDETERMINATE
    is_critical: bool = False
    is_stale: bool = False
    is_conflict: bool = False
    clinical_comment: str = ""


class ClinicalUrgentAlert(BaseModel):
    """High-priority clinical alert for acute laboratory derangements."""
    test_name: str
    value: str
    severity: str = "urgent"  # "urgent" | "critical" | "warning"
    message: str
    medical_action_required: str


class LabDietaryGuideline(BaseModel):
    """Evidence-informed dietary guideline linked to specific lab findings."""
    finding: str
    food_recommendations: List[str] = Field(default_factory=list)
    foods_to_avoid_or_limit: List[str] = Field(default_factory=list)
    ayurvedic_perspective: str = ""
    nutrient_cautions: List[str] = Field(default_factory=list)
    requires_dietitian_review: bool = False
    rationale: str = ""


class LabInterpretationSummary(BaseModel):
    """Comprehensive structured lab interpretation passed to Gemini and Validator."""
    total_tests_analyzed: int = 0
    normal_count: int = 0
    abnormal_count: int = 0
    critical_count: int = 0
    stale_count: int = 0
    indeterminate_count: int = 0
    items: List[NormalizedLabItem] = Field(default_factory=list)
    critical_alerts: List[ClinicalUrgentAlert] = Field(default_factory=list)
    dietary_guidelines: List[LabDietaryGuideline] = Field(default_factory=list)
    clinical_rationale_snippet: str = ""
    contraindicated_foods: List[str] = Field(default_factory=list)
    emphasized_foods: List[str] = Field(default_factory=list)
    requires_dietitian_review: bool = False
    review_reasons: List[str] = Field(default_factory=list)
    has_renal_impairment: bool = False
    has_hyperkalemia_risk: bool = False
    has_hypokalemia: bool = False
    has_glycemic_derangement: bool = False
    has_calcium_derangement: bool = False
    has_anemia_or_iron_deficiency: bool = False
    has_dyslipidemia: bool = False
    has_thyroid_derangement: bool = False
    all_normal: bool = False

