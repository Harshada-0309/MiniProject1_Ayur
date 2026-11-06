const express = require('express');
const {
  calculateNutritionTargets,
  calculateForSavedAssessment,
} = require('../controllers/nutritionController');
const { validateNutritionCalculateInput } = require('../middleware/validation');

const router = express.Router();

/**
 * Phase 3: Deterministic Nutrition Calculation Routes
 */

// POST /api/nutrition/calculate
// Direct calculation from ad-hoc / draft assessment payload
router.post('/calculate', validateNutritionCalculateInput, calculateNutritionTargets);

// POST /api/nutrition/assessments/:id/calculate
// GET /api/nutrition/assessments/:id/calculate
// Calculate deterministic targets for an existing stored assessment
router.post('/assessments/:id/calculate', calculateForSavedAssessment);
router.get('/assessments/:id/calculate', calculateForSavedAssessment);

module.exports = router;
