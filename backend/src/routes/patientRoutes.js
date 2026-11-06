const express = require('express');
const {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientDependentCounts,
} = require('../controllers/patientController');
const {
  createAssessment,
  getPatientAssessments,
} = require('../controllers/assessmentController');
const {
  validatePatientInput,
  validatePatientUpdateInput,
  validateAssessmentInput,
} = require('../middleware/validation');

const router = express.Router();

// Patient CRUD
router.get('/', getPatients);
router.post('/', validatePatientInput, createPatient);
router.get('/:id/dependent-counts', getPatientDependentCounts);
router.get('/:id', getPatientById);
router.put('/:id', validatePatientUpdateInput, updatePatient);
router.delete('/:id', deletePatient);

// Nested Patient Assessment Endpoints
router.post('/:patientId/assessments', validateAssessmentInput, createAssessment);
router.get('/:patientId/assessments', getPatientAssessments);

module.exports = router;
