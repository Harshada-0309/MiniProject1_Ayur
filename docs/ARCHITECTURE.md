# AyurDiet System Architecture Documentation

## Overview
**AyurDiet** is a dietitian-centric personalized Ayurvedic diet recommendation system. It empowers professional dietitians to assess patients holistically (combining clinical, anthropometric, and Ayurvedic prakriti/vikriti parameters), calculate deterministic nutritional requirements, retrieve verified Ayurvedic dietary evidence via Hybrid RAG, and generate editable 7-day personalized diet plans using Gemini AI.

---

## Key Product Philosophy & Persona
- **Dietitian-Only Application**: There is **no patient dashboard**.
- The primary user is the **Clinical Dietitian**.
- The workflow follows:
  1. Create / Select Patient
  2. Enter Patient Assessment (Basic, Clinical, Ayurvedic)
  3. Upload & verify Clinical / Lab reports (future)
  4. Generate AI draft diet plan based on deterministic targets
  5. Review, customize, edit, and approve final diet plan

---

## High-Level Architecture Flow

```text
                    DIETITIAN DASHBOARD (React.js)
                               │
                               ▼
                    CREATE / SELECT PATIENT
                               │
                               ▼
                       PATIENT ASSESSMENT
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
   Basic Details         Clinical Data          Ayurvedic Data
  (Age, Gender, BMI,    (Blood, Metabolic,    (Prakriti, Vikriti,
   Activity Level)       Conditions, Meds)     Agni, Digestion)
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               ▼
                      SAFETY & VALIDATION
                               │
                               ▼
                 NUTRITION CALCULATION ENGINE
              (Deterministic: BMR, TDEE, Protein)
                               │
                               ▼
                       QUERY EXPANSION
                               │
                               ▼
                       HYBRID RAG RETRIEVAL
                       /                  \
                      /                    \
              Dense Search               BM25 Search
             (SentenceX / Qdrant)       (Lexical Matching)
                     │                         │
                     └────────────┬────────────┘
                                  ▼
                          Reciprocal Rank Fusion
                                  ▼
                           Retrieved Evidence
                                  │
                                  ▼
                        FOOD / MEAL SELECTION
                                  │
                                  ▼
                         NUTRITION VALIDATION
                                  │
                                  ▼
                         GEMINI GENERATION
                                  │
                                  ▼
                        7-DAY DRAFT DIET PLAN
                                  │
                                  ▼
                          DIETITIAN REVIEW
                                  │
                         ┌────────┴────────┐
                         ▼                 ▼
                       EDIT             APPROVE
                                           │
                                           ▼
                                FINAL APPROVED PLAN
```

---

## Service Responsibilities & Boundaries

### 1. Frontend (React.js / Vite)
- Dietitian dashboard interface
- Patient management and assessment forms
- Diet plan review, live editing, and approval UI
- **Strict Boundary**: Frontend NEVER makes direct Gemini or RAG calls; all operations flow through the Node.js backend.

### 2. Application Backend (Node.js / Express.js)
- REST APIs for dietitian workflows
- Patient and assessment data management
- PostgreSQL database persistence
- Orchestrator for calling the Python AI Service

### 3. AI Service (Python / FastAPI)
- Deterministic nutrition calculation engine (BMR, TDEE, macronutrients)
- Clinical & Ayurvedic safety validation rules
- Query expansion & Hybrid RAG (Qdrant + BM25)
- Gemini prompt construction & response validation
- Structured 7-day diet draft generation

### 4. Database Layer (PostgreSQL)
- Relational storage for:
  - `Dietitian`
  - `Patient`
  - `PatientAssessment`
  - `ClinicalLabData`
  - `Medication`
  - `DietPlan`
  - `DietPlanMeal`
  - `DietitianReview`

### 5. Knowledge Layer (Qdrant & BM25)
- Classical Ayurvedic dietary knowledge base
- Food characteristics (Rasa, Guna, Virya, Vipaka, Prabhava)
- Dense vector embeddings + Lexical BM25 index

---

## Strict Nutrition Design Rule
Gemini does **NOT** freely guess or calculate nutritional goals.
The Python nutrition calculation engine computes deterministic targets (Energy, Protein, Micronutrients, Dosha balance) first.
Gemini is used strictly for contextual synthesis, draft formulation, and natural language presentation adhering to those pre-computed targets.
