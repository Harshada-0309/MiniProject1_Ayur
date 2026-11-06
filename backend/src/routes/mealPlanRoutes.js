const express = require('express');
const router = express.Router();
const mealPlanController = require('../controllers/mealPlanController');
const { validateMealPlanGenerateInput } = require('../middleware/validation');

// Catalog routes
router.get('/foods', mealPlanController.listFoods);
router.get('/foods/:foodId', mealPlanController.getFoodDetail);

// Generation & substitution routes
router.post('/generate', validateMealPlanGenerateInput, mealPlanController.generateMealPlan);
router.post('/substitutions', mealPlanController.getSubstitutions);

// Persistence routes
router.post('/', mealPlanController.saveMealPlan);
router.get('/:id', mealPlanController.getMealPlanById);
router.get('/patient/:patientId', mealPlanController.getMealPlansByPatient);

module.exports = router;
