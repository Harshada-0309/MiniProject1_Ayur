-- ====================================================================
-- AyurDiet Database Schema - Phase 2: Dietitian Patient Assessment
-- ====================================================================

-- 0. Dietitians Table (Practitioner Authentication & Profiles)
CREATE TABLE IF NOT EXISTS dietitians (
  id SERIAL PRIMARY KEY,
  dietitian_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(60) DEFAULT 'Chief Clinical Dietitian',
  clinic_name VARCHAR(150) DEFAULT 'AyurDiet Integrative Health Clinic',
  phone VARCHAR(50),
  qualifications VARCHAR(255),
  photo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE dietitians ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE dietitians ADD COLUMN IF NOT EXISTS qualifications VARCHAR(255);
ALTER TABLE dietitians ADD COLUMN IF NOT EXISTS photo_url TEXT;

CREATE INDEX IF NOT EXISTS idx_dietitians_email ON dietitians(email);

-- 1. Patients Table
CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  patient_code VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 0 AND age <= 130),
  sex VARCHAR(20) NOT NULL CHECK (sex IN ('male', 'female', 'other')),
  occupation VARCHAR(150),
  phone VARCHAR(50),
  email VARCHAR(150),
  photo_url TEXT,
  dietitian_id INTEGER REFERENCES dietitians(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE patients ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS dietitian_id INTEGER REFERENCES dietitians(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patients_patient_code ON patients(patient_code);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
CREATE INDEX IF NOT EXISTS idx_patients_dietitian_id ON patients(dietitian_id);

-- Backfill verified historical ownership for seeded/registered patient records where ownership is proven
UPDATE patients SET dietitian_id = 1 WHERE id = 1 AND dietitian_id IS NULL;
UPDATE patients SET dietitian_id = 2 WHERE id = 2 AND dietitian_id IS NULL;
UPDATE patients SET dietitian_id = 1 WHERE id = 3 AND dietitian_id IS NULL;
UPDATE patients SET dietitian_id = 4 WHERE id = 4 AND dietitian_id IS NULL;
UPDATE patients SET dietitian_id = 5 WHERE id = 37 AND dietitian_id IS NULL;

-- 2. Patient Assessments Table
CREATE TABLE IF NOT EXISTS patient_assessments (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  dietitian_id VARCHAR(50) DEFAULT 'dietitian-primary',

  -- Section 2: Body Measurements
  height NUMERIC(5,2) CHECK (height > 0),
  weight NUMERIC(5,2) CHECK (weight > 0),
  waist_circumference NUMERIC(5,2),
  weight_trend VARCHAR(30) CHECK (weight_trend IN ('losing', 'stable', 'gaining')),

  -- Section 3: Diet Goal
  diet_goal VARCHAR(60) NOT NULL CHECK (diet_goal IN (
    'weight_loss',
    'weight_maintenance',
    'weight_gain',
    'general_healthy_diet',
    'condition_specific_nutrition'
  )),
  target_weight NUMERIC(5,2),
  goal_notes TEXT,

  -- Section 4: Lifestyle
  activity_level VARCHAR(40) CHECK (activity_level IN (
    'sedentary',
    'lightly_active',
    'moderately_active',
    'very_active',
    'extremely_active'
  )),
  exercise_type VARCHAR(100),
  exercise_frequency VARCHAR(60),
  exercise_duration VARCHAR(60),
  sleep_duration NUMERIC(4,2),
  sleep_quality VARCHAR(30) CHECK (sleep_quality IN ('poor', 'fair', 'good', 'excellent')),
  water_intake NUMERIC(4,2),

  -- Section 5: Dietary Profile
  diet_category VARCHAR(40) NOT NULL CHECK (diet_category IN (
    'vegetarian',
    'vegan',
    'eggetarian',
    'non_vegetarian',
    'other'
  )),
  meal_frequency INTEGER,
  meal_timings JSONB DEFAULT '[]'::jsonb,
  food_preferences TEXT,
  foods_disliked TEXT,

  -- Section 6: Safety Restrictions
  food_allergies JSONB DEFAULT '[]'::jsonb,
  food_intolerances JSONB DEFAULT '[]'::jsonb,
  dietary_restrictions JSONB DEFAULT '[]'::jsonb,

  -- Section 7: Medical Information
  existing_conditions JSONB DEFAULT '[]'::jsonb,
  medical_history TEXT,
  symptoms JSONB DEFAULT '[]'::jsonb,
  supplements TEXT,

  -- Section 8: Ayurvedic Information
  prakriti VARCHAR(40) NOT NULL CHECK (prakriti IN (
    'Vata',
    'Pitta',
    'Kapha',
    'Vata-Pitta',
    'Pitta-Kapha',
    'Vata-Kapha',
    'Tridosha',
    'Unknown / Not assessed'
  )),
  vikriti TEXT,
  appetite VARCHAR(60) CHECK (appetite IN (
    'Mandagni (Low)',
    'Tikshnagni (Sharp/High)',
    'Vishamagni (Irregular)',
    'Samagni (Balanced)'
  )),
  digestion VARCHAR(60),
  bowel_habits VARCHAR(60),
  meal_regularity VARCHAR(30) CHECK (meal_regularity IN ('regular', 'irregular')),
  season_ritu VARCHAR(60) CHECK (season_ritu IN (
    'Shishira (Late Winter)',
    'Vasanta (Spring)',
    'Grishma (Summer)',
    'Varsha (Monsoon)',
    'Sharad (Autumn)',
    'Hemanta (Early Winter)'
  )),
  dietitian_observations TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assessments_patient_id ON patient_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_assessments_date ON patient_assessments(assessment_date);

-- 3. Medications Table
CREATE TABLE IF NOT EXISTS medications (
  id SERIAL PRIMARY KEY,
  assessment_id INTEGER NOT NULL REFERENCES patient_assessments(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  medication_name VARCHAR(150) NOT NULL,
  dosage VARCHAR(60),
  frequency VARCHAR(60),
  purpose TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_medications_assessment_id ON medications(assessment_id);
CREATE INDEX IF NOT EXISTS idx_medications_patient_id ON medications(patient_id);

-- 4. Clinical & Laboratory Data Table (Section 9: Optional)
CREATE TABLE IF NOT EXISTS clinical_lab_data (
  id SERIAL PRIMARY KEY,
  assessment_id INTEGER NOT NULL REFERENCES patient_assessments(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  test_name VARCHAR(150) NOT NULL,
  value VARCHAR(80) NOT NULL,
  unit VARCHAR(50),
  reference_range VARCHAR(80),
  test_date DATE,
  source_laboratory VARCHAR(150),
  reported_flag VARCHAR(30) DEFAULT 'normal' CHECK (reported_flag IN ('normal', 'abnormal', 'critical')),
  report_file_metadata JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clinical_lab_assessment_id ON clinical_lab_data(assessment_id);
CREATE INDEX IF NOT EXISTS idx_clinical_lab_patient_id ON clinical_lab_data(patient_id);

-- 5. Structured Meal Plans Table (Phase 5: Food & Meal Planning Engine)
CREATE TABLE IF NOT EXISTS meal_plans (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  assessment_id INTEGER REFERENCES patient_assessments(id) ON DELETE SET NULL,
  plan_status VARCHAR(30) DEFAULT 'draft' CHECK (plan_status IN ('draft', 'needs_review', 'validated', 'approved')),
  nutrition_targets JSONB NOT NULL DEFAULT '{}'::jsonb,
  meals JSONB NOT NULL DEFAULT '[]'::jsonb,
  daily_totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_comparison JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  requires_dietitian_review BOOLEAN DEFAULT false,
  review_reasons JSONB DEFAULT '[]'::jsonb,
  dietitian_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meal_plans_patient_id ON meal_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_assessment_id ON meal_plans(assessment_id);

-- 6. Gemini 7-Day Diet Plans Table (Phase 6: Dietitian Diet Plan Generation)
CREATE TABLE IF NOT EXISTS diet_plans (
  id SERIAL PRIMARY KEY,
  plan_id VARCHAR(50) UNIQUE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  assessment_id INTEGER REFERENCES patient_assessments(id) ON DELETE SET NULL,
  title VARCHAR(200) DEFAULT '7-Day Personalized Ayurvedic Diet Plan',
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'needs_review', 'validated', 'approved')),
  patient_summary TEXT,
  clinical_rationale TEXT,
  ayurvedic_dietary_principles JSONB DEFAULT '[]'::jsonb,
  dosha_guidelines JSONB DEFAULT '{}'::jsonb,
  days JSONB NOT NULL DEFAULT '[]'::jsonb,
  weekly_overview TEXT,
  general_instructions JSONB DEFAULT '[]'::jsonb,
  evidence_citations JSONB DEFAULT '[]'::jsonb,
  validation_results JSONB DEFAULT '{}'::jsonb,
  dietitian_notes TEXT,
  is_approved BOOLEAN DEFAULT false,
  approved_by VARCHAR(100),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_diet_plans_patient_id ON diet_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_diet_plans_plan_id ON diet_plans(plan_id);

-- 7. WhatsApp Prescription Dispatch Audit Log
CREATE TABLE IF NOT EXISTS whatsapp_audit_logs (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES diet_plans(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  dietitian_id INTEGER REFERENCES dietitians(id) ON DELETE SET NULL,
  recipient_phone VARCHAR(50) NOT NULL,
  masked_phone VARCHAR(50) NOT NULL,
  delivery_method VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL,
  message_id VARCHAR(100),
  error_message TEXT,
  plan_version VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_audit_plan_id ON whatsapp_audit_logs(plan_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_audit_patient_id ON whatsapp_audit_logs(patient_id);
