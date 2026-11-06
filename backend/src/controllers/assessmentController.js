const assessmentRepository = require('../repositories/assessmentRepository');
const patientRepository = require('../repositories/patientRepository');

/**
 * Controller for Dietitian Patient Assessment Workflow
 * Enforces account-level patient data isolation
 */

const getPatientAssessments = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
    const patient = await patientRepository.findById(patientId, authenticatedDietitianId);

    if (!patient) {
      return res.status(404).json({
        status: 'fail',
        message: `Patient with ID ${patientId} not found`,
      });
    }

    const assessments = await assessmentRepository.findByPatientId(patientId);

    return res.status(200).json({
      status: 'success',
      results: assessments.length,
      data: { assessments },
    });
  } catch (error) {
    next(error);
  }
};

const getAssessmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const assessment = await assessmentRepository.findById(id);

    if (!assessment) {
      return res.status(404).json({
        status: 'fail',
        message: `Assessment with ID ${id} not found`,
      });
    }

    const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
    // Verify patient ownership
    const patient = await patientRepository.findById(assessment.patient_id, authenticatedDietitianId);

    if (!patient) {
      return res.status(404).json({
        status: 'fail',
        message: `Assessment with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        assessment: {
          ...assessment,
          patient,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const createAssessment = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
    const patient = await patientRepository.findById(patientId, authenticatedDietitianId);

    if (!patient) {
      return res.status(404).json({
        status: 'fail',
        message: `Patient with ID ${patientId} not found`,
      });
    }

    const assessmentPayload = {
      ...req.body,
      dietitian_id: req.user?.dietitian_code || req.user?.name || String(authenticatedDietitianId),
    };

    const assessment = await assessmentRepository.create(patientId, assessmentPayload);

    return res.status(201).json({
      status: 'success',
      message: 'Patient assessment created successfully',
      data: { assessment },
    });
  } catch (error) {
    next(error);
  }
};

const updateAssessment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await assessmentRepository.findById(id);

    if (!existing) {
      return res.status(404).json({
        status: 'fail',
        message: `Assessment with ID ${id} not found`,
      });
    }

    const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
    // Verify patient ownership
    const patient = await patientRepository.findById(existing.patient_id, authenticatedDietitianId);
    if (!patient) {
      return res.status(404).json({
        status: 'fail',
        message: `Assessment with ID ${id} not found`,
      });
    }

    const { name, patient_name, age, sex, occupation, phone, email, ...assessmentData } = req.body;
    const patientName = name || patient_name;

    let updatedPatient = null;
    if (patientName !== undefined || age !== undefined || sex !== undefined || occupation !== undefined || phone !== undefined || email !== undefined) {
      updatedPatient = await patientRepository.update(
        existing.patient_id,
        {
          name: patientName ? patientName.trim() : undefined,
          age: age !== undefined && age !== '' ? parseInt(age, 10) : undefined,
          sex: sex ? sex.toLowerCase() : undefined,
          occupation: occupation !== undefined ? occupation.trim() : undefined,
          phone: phone !== undefined ? phone.trim() : undefined,
          email: email !== undefined ? email.trim() : undefined,
        },
        authenticatedDietitianId
      );
    }

    const updated = await assessmentRepository.update(id, assessmentData);
    const latestPatient = updatedPatient || (await patientRepository.findById(existing.patient_id, authenticatedDietitianId));

    return res.status(200).json({
      status: 'success',
      message: 'Assessment updated successfully',
      data: {
        assessment: {
          ...updated,
          patient: latestPatient,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPatientAssessments,
  getAssessmentById,
  createAssessment,
  updateAssessment,
};
