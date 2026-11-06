const express = require('express');
const router = express.Router();
const dietPlanController = require('../controllers/dietPlanController');
const { validateMealPlanGenerateInput } = require('../middleware/validation');

// Generate 7-day plan
router.post('/generate', validateMealPlanGenerateInput, dietPlanController.generateDietPlan);

// Deterministically revalidate edited plan
router.post('/validate', dietPlanController.validateDietPlan);

// Save diet plan
router.post('/', dietPlanController.saveDietPlan);

// Get diet plans for a patient
router.get('/patient/:patientId', dietPlanController.getDietPlansByPatient);

// Get diet plan by ID
router.get('/:id', dietPlanController.getDietPlanById);

// Update diet plan (e.g. food/portion adjustments)
router.put('/:id', dietPlanController.updateDietPlan);

// Approve diet plan
router.post('/:id/approve', dietPlanController.approveDietPlan);

// Export approved diet plan as clinical prescription PDF
router.get('/:id/pdf', dietPlanController.exportDietPlanPdf);

// Dispatch approved clinical diet prescription via WhatsApp
router.post('/:id/whatsapp', dietPlanController.dispatchWhatsApp);

// Retrieve WhatsApp dispatch audit history
router.get('/:id/whatsapp-history', dietPlanController.getWhatsAppHistory);

module.exports = router;
