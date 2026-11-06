"""
AyurDiet AI Service - FastAPI Application.
Hosts the Phase 3 Deterministic Nutrition Calculation Engine.
"""

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .nutrition import (
    calculate_nutrition_targets,
    PatientAssessmentInput,
    NutritionTargetResponse,
    NutritionValidationError,
)

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="AyurDiet Deterministic Clinical & Ayurvedic Nutrition Engine",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
async def health_check():
    """
    Service health check endpoint.
    """
    return {
        "status": "ok",
        "service": "ayurdiet-ai-service",
        "version": settings.version,
    }


@app.post(
    "/api/nutrition/calculate",
    response_model=NutritionTargetResponse,
    status_code=status.HTTP_200_OK,
    tags=["Nutrition Engine"],
    summary="Compute deterministic nutrition targets",
)
async def calculate_nutrition(payload: PatientAssessmentInput):
    """
    Consumes structured patient assessment metrics and returns reproducible,
    explainable caloric, macronutrient, and Ayurvedic personalization targets.
    Does NOT call Gemini or perform RAG in Phase 3.
    """
    try:
        data_dict = payload.model_dump()
        result = calculate_nutrition_targets(data_dict)
        return result
    except NutritionValidationError as val_err:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "status": "fail",
                "message": "Assessment validation failed for nutrition calculation",
                "errors": val_err.errors,
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error executing deterministic calculation: {str(exc)}",
        )


# ==============================================================================
# Phase 4: Hybrid RAG Knowledge Retrieval Layer
# ==============================================================================
from typing import Optional
from .rag import (
    HybridRetriever,
    RetrieveRequest,
    RetrieveResponse,
)

_retriever_instance: Optional[HybridRetriever] = None


def get_retriever() -> HybridRetriever:
    global _retriever_instance
    if _retriever_instance is None:
        _retriever_instance = HybridRetriever()
    return _retriever_instance


@app.get(
    "/api/rag/status",
    tags=["RAG Knowledge Retrieval"],
    summary="Get Qdrant and BM25 index status",
)
async def get_rag_status():
    """
    Returns connection mode, location, collection status, and index sizes.
    """
    try:
        retriever = get_retriever()
        qdrant_stat = retriever.vector_store.get_connection_status()
        bm25_loaded = retriever.bm25_index.bm25 is not None or retriever.bm25_index.load()
        bm25_count = len(retriever.bm25_index.chunk_store) if bm25_loaded else 0

        return {
            "status": "ok",
            "qdrant": qdrant_stat,
            "bm25": {
                "loaded": bm25_loaded,
                "chunks_indexed": bm25_count,
                "index_dir": str(settings.bm25_index_dir),
            },
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving RAG status: {str(exc)}",
        )


@app.post(
    "/api/rag/retrieve",
    response_model=RetrieveResponse,
    status_code=status.HTTP_200_OK,
    tags=["RAG Knowledge Retrieval"],
    summary="Retrieve evidence via Hybrid Dense + BM25 RRF",
)
async def retrieve_knowledge_evidence(payload: RetrieveRequest):
    """
    Consumes a dietitian search query and optional metadata filters,
    executing deterministic query expansion, dense semantic search via Qdrant,
    lexical search via BM25, and Reciprocal Rank Fusion (RRF).
    Returns structured evidence chunks with exact source references.
    Does NOT call Gemini or generate diet plans.
    """
    try:
        retriever = get_retriever()
        response = retriever.retrieve(payload)
        return response
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error executing hybrid retrieval: {str(exc)}",
        )


# ==============================================================================
# Phase 5: Food & Meal Planning Engine (Deterministic, No Gemini)
# ==============================================================================
from typing import List, Optional
from .meal_planner import (
    FoodItem,
    FoodSubstitutionOption,
    GenerateMealPlanRequest,
    MealBuilder,
    PlanValidationResult,
    StructuredMealPlan,
    SubstituteRequest,
    SubstitutionEngine,
    get_food_db,
)
from .meal_planner.validator import PlanValidator

_meal_builder_instance: Optional[MealBuilder] = None
_sub_engine_instance: Optional[SubstitutionEngine] = None
_validator_instance: Optional[PlanValidator] = None


def get_meal_builder() -> MealBuilder:
    global _meal_builder_instance
    if _meal_builder_instance is None:
        _meal_builder_instance = MealBuilder()
    return _meal_builder_instance


def get_sub_engine() -> SubstitutionEngine:
    global _sub_engine_instance
    if _sub_engine_instance is None:
        _sub_engine_instance = SubstitutionEngine()
    return _sub_engine_instance


def get_plan_validator() -> PlanValidator:
    global _validator_instance
    if _validator_instance is None:
        _validator_instance = PlanValidator()
    return _validator_instance


@app.post(
    "/api/meal-plan/generate",
    response_model=StructuredMealPlan,
    status_code=status.HTTP_200_OK,
    tags=["Meal Planning Engine"],
    summary="Generate deterministic structured meal plan",
)
async def generate_meal_plan(payload: GenerateMealPlanRequest):
    """
    Deterministically constructs a structured meal plan adhering to patient metrics,
    Phase 3 nutrition targets, and Phase 4 knowledge base evidence.
    Does NOT invoke LLM/Gemini for meal generation.
    """
    try:
        builder = get_meal_builder()
        plan = builder.generate_plan(
            assessment=payload.patient_assessment,
            nutrition_targets=payload.nutrition_targets,
            meal_structure=payload.meal_structure,
            custom_meal_distribution=payload.custom_meal_distribution,
        )
        return plan
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating meal plan: {str(exc)}",
        )


@app.post(
    "/api/meal-plan/substitutions",
    response_model=List[FoodSubstitutionOption],
    status_code=status.HTTP_200_OK,
    tags=["Meal Planning Engine"],
    summary="Get eligible food substitutions with nutritional deltas",
)
async def get_food_substitutions(payload: SubstituteRequest):
    """
    Returns clinically safe, nutritionally equivalent food alternatives for a given item.
    """
    try:
        sub_engine = get_sub_engine()
        subs = sub_engine.get_substitutions(
            food_id=payload.food_id,
            current_quantity=payload.current_quantity,
            patient_assessment=payload.patient_assessment,
            meal_type=payload.meal_type,
        )
        return subs
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error finding food substitutions: {str(exc)}",
        )


@app.get(
    "/api/meal-plan/foods",
    response_model=List[FoodItem],
    status_code=status.HTTP_200_OK,
    tags=["Meal Planning Engine"],
    summary="List available grounded food database catalog items",
)
async def list_foods(category: Optional[str] = None, search: Optional[str] = None):
    """
    Lists foods from the Phase 5 food database catalog, optionally filtered by category or search term.
    """
    try:
        db = get_food_db()
        if search:
            return db.search_foods(search)
        elif category:
            return db.get_by_category(category)
        else:
            return db.get_all_foods()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching food catalog: {str(exc)}",
        )


@app.get(
    "/api/meal-plan/foods/{food_id}",
    response_model=FoodItem,
    status_code=status.HTTP_200_OK,
    tags=["Meal Planning Engine"],
    summary="Get detailed food item by ID with full provenance",
)
async def get_food_detail(food_id: str):
    """
    Fetches full food profile including IFCT macros, Ayurvedic Dravyaguna attributes, and citations.
    """
    db = get_food_db()
    food = db.get_food(food_id)
    if not food:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Food with ID '{food_id}' not found in catalog",
        )
    return food


# ==============================================================================
# Phase 6: Gemini-Powered 7-Day Diet Plan Presentation & Guardrails
# ==============================================================================
from .gemini import (
    DietPlanGenerator,
    Generate7DayDietPlanRequest,
    ValidateDietPlanRequest,
)

_diet_plan_generator_instance: Optional[DietPlanGenerator] = None


def get_diet_plan_generator() -> DietPlanGenerator:
    global _diet_plan_generator_instance
    if _diet_plan_generator_instance is None:
        _diet_plan_generator_instance = DietPlanGenerator()
    return _diet_plan_generator_instance


@app.post(
    "/api/diet-plan/generate-7day",
    status_code=status.HTTP_200_OK,
    tags=["Diet Plan Engine"],
    summary="Generate Gemini-formatted, deterministically validated 7-day diet plan",
)
async def generate_7day_diet_plan(payload: Generate7DayDietPlanRequest):
    """
    Constructs a clinically grounded 7-day diet plan using deterministic meal assembly,
    formats with Gemini (preserving exact deterministic quantities and macros), and
    enforces deterministic safety and allergen guardrails.
    """
    try:
        generator = get_diet_plan_generator()
        plan = generator.generate_plan(
            patient_assessment=payload.patient_assessment,
            nutrition_targets=payload.nutrition_targets,
            meal_structure=payload.meal_structure,
            custom_meal_distribution=payload.custom_meal_distribution,
            dietitian_notes=payload.dietitian_notes,
            clinical_lab_data=payload.clinical_lab_data,
        )
        return plan
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating 7-day diet plan: {str(exc)}",
        )


@app.post(
    "/api/diet-plan/validate",
    status_code=status.HTTP_200_OK,
    tags=["Diet Plan Engine"],
    summary="Deterministically revalidate diet plan after dietitian edits",
)
async def validate_diet_plan(payload: ValidateDietPlanRequest):
    """
    Deterministically revalidates an edited diet plan checking allergen safety,
    macro tolerances, positive quantities, and prohibited clinical claims.
    """
    try:
        generator = get_diet_plan_generator()
        result = generator.revalidate_plan(
            diet_plan=payload.diet_plan,
            patient_assessment=payload.patient_assessment,
            nutrition_targets=payload.nutrition_targets,
            clinical_lab_data=payload.clinical_lab_data,
        )
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error validating diet plan: {str(exc)}",
        )





# ==============================================================================
# Clinical Laboratory Interpretation Engine (Section 9)
# ==============================================================================
from pydantic import BaseModel
from typing import Dict, Any, List

class InterpretLabsRequest(BaseModel):
    patient_assessment: Dict[str, Any]
    clinical_lab_data: Optional[List[Dict[str, Any]]] = None

@app.post(
    "/api/clinical-labs/interpret",
    status_code=status.HTTP_200_OK,
    tags=["Clinical Laboratory Engine"],
    summary="Interpret patient lab records and generate clinical/Ayurvedic dietary guidance",
)
async def interpret_clinical_labs(payload: InterpretLabsRequest):
    try:
        from .clinical_labs import interpret_patient_labs
        summary = interpret_patient_labs(payload.clinical_lab_data or [], payload.patient_assessment)
        return summary.model_dump()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interpreting clinical lab data: {str(exc)}",
        )


# ==============================================================================
# Clinical Prescription PDF Generation Engine
# ==============================================================================
from datetime import datetime, timezone
from fastapi.responses import Response

class ExportPdfRequest(BaseModel):
    patient: Dict[str, Any]
    assessment: Optional[Dict[str, Any]] = None
    diet_plan: Dict[str, Any]

@app.post(
    "/api/diet-plan/export-pdf",
    status_code=status.HTTP_200_OK,
    tags=["Diet Plan Engine"],
    summary="Export clinical diet prescription PDF",
)
async def export_diet_plan_pdf(payload: ExportPdfRequest):
    try:
        from .pdf_generator import build_prescription_pdf
        pdf_bytes = build_prescription_pdf(
            patient=payload.patient,
            assessment=payload.assessment,
            diet_plan=payload.diet_plan,
        )
        p_code = payload.patient.get("patient_code") or f"PAT-{payload.patient.get('id', '001')}"
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        filename = f"AyurDiet_Prescription_{p_code}_{today_str}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Type": "application/pdf",
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating diet prescription PDF: {str(exc)}",
        )
