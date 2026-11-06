const express = require('express');
const {
  getAssessmentById,
  updateAssessment,
} = require('../controllers/assessmentController');
const {
  getLabDataByAssessment,
  createLabData,
} = require('../controllers/labDataController');
const {
  validateAssessmentInput,
  validateLabDataInput,
} = require('../middleware/validation');

const router = express.Router();

// Assessment by ID
router.get('/:id', getAssessmentById);
router.put('/:id', validateAssessmentInput, updateAssessment);

// Nested Lab Data for Assessment
router.get('/:assessmentId/lab-data', getLabDataByAssessment);
router.post('/:assessmentId/lab-data', validateLabDataInput, createLabData);

module.exports = router;
