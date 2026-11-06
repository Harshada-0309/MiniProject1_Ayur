/**
 * AyurDiet Database Entities Foundation
 *
 * This configuration layer defines the planned PostgreSQL schema architecture.
 * Detailed column schemas and migrations will be implemented in subsequent steps.
 *
 * Targeted Entities:
 * 1. Dietitian        - Primary authorized practitioner credentials & profile
 * 2. Patient          - Patient demographics, contact, and dietitian association
 * 3. PatientAssessment- Anthropometrics, clinical state, Prakriti, Vikriti, Agni
 * 4. ClinicalLabData  - Extracted lab biomarkers, units, reference ranges
 * 5. Medication       - Current patient medications & potential food-drug contraindications
 * 6. DietPlan         - 7-day personalized Ayurvedic diet plan metadata & status
 * 7. DietPlanMeal     - Day-by-day, meal-by-meal dietary recommendations & nutrition totals
 * 8. DietitianReview  - Practitioner review notes, edits, overrides, and final approval timestamp
 */

const EntitySchemas = {
  Dietitian: {
    tableName: 'dietitians',
    description: 'Practitioner user records managing dietary assessments and plan approvals.',
  },
  Patient: {
    tableName: 'patients',
    description: 'Patient records associated with the managing dietitian.',
  },
  PatientAssessment: {
    tableName: 'patient_assessments',
    description: 'Holistic clinical, physiological, and Ayurvedic doshic assessment data.',
  },
  ClinicalLabData: {
    tableName: 'clinical_lab_data',
    description: 'Verified clinical laboratory values, test parameters, and observation dates.',
  },
  Medication: {
    tableName: 'medications',
    description: 'Active medications, dosage, and pharmacological interactions.',
  },
  DietPlan: {
    tableName: 'diet_plans',
    description: 'Personalized 7-day plan versions, target macro/micro targets, status (draft/reviewed/approved).',
  },
  DietPlanMeal: {
    tableName: 'diet_plan_meals',
    description: 'Individual meal slots (Breakfast, Lunch, Dinner, Snacks) with food items and quantities.',
  },
  DietitianReview: {
    tableName: 'dietitian_reviews',
    description: 'Clinical review notes, manual modifications, and final approval log.',
  },
};

const patientRepository = require('../repositories/patientRepository');
const assessmentRepository = require('../repositories/assessmentRepository');
const labDataRepository = require('../repositories/labDataRepository');

module.exports = {
  EntitySchemas,
  patientRepository,
  assessmentRepository,
  labDataRepository,
};
