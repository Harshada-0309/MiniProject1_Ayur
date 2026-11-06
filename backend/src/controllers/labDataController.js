const labDataRepository = require('../repositories/labDataRepository');
const assessmentRepository = require('../repositories/assessmentRepository');
const patientRepository = require('../repositories/patientRepository');
const { determineLabStatus } = require('../middleware/validation');

/**
 * Controller for Section 9: Clinical & Laboratory Data (Optional)
 * Enforces account-level patient data isolation
 */

const getLabDataByAssessment = async (req, res, next) => {
  try {
    const { assessmentId } = req.params;
    const assessment = await assessmentRepository.findById(assessmentId);

    if (!assessment) {
      return res.status(404).json({
        status: 'fail',
        message: `Assessment with ID ${assessmentId} not found`,
      });
    }

    const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
    const patient = await patientRepository.findById(assessment.patient_id, authenticatedDietitianId);
    if (!patient) {
      return res.status(404).json({
        status: 'fail',
        message: `Assessment with ID ${assessmentId} not found`,
      });
    }

    const labData = await labDataRepository.findByAssessmentId(assessmentId);

    return res.status(200).json({
      status: 'success',
      results: labData.length,
      data: { labData },
    });
  } catch (error) {
    next(error);
  }
};

const createLabData = async (req, res, next) => {
  try {
    const { assessmentId } = req.params;
    const assessment = await assessmentRepository.findById(assessmentId);

    if (!assessment) {
      return res.status(404).json({
        status: 'fail',
        message: `Assessment with ID ${assessmentId} not found`,
      });
    }

    const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
    const patient = await patientRepository.findById(assessment.patient_id, authenticatedDietitianId);
    if (!patient) {
      return res.status(404).json({
        status: 'fail',
        message: `Assessment with ID ${assessmentId} not found`,
      });
    }

    // Automatically determine reported status from observed value and reference range
    const reported_flag = determineLabStatus(req.body.value, req.body.reference_range);

    const labRecord = await labDataRepository.create(
      assessmentId,
      assessment.patient_id,
      {
        ...req.body,
        reported_flag,
      }
    );

    return res.status(201).json({
      status: 'success',
      message: 'Clinical/laboratory data record added successfully',
      data: { labData: labRecord },
    });
  } catch (error) {
    next(error);
  }
};

const updateLabData = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await labDataRepository.findById(id);

    if (!existing) {
      return res.status(404).json({
        status: 'fail',
        message: `Clinical/laboratory record with ID ${id} not found`,
      });
    }

    const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
    const patient = await patientRepository.findById(existing.patient_id, authenticatedDietitianId);
    if (!patient) {
      return res.status(404).json({
        status: 'fail',
        message: `Clinical/laboratory record with ID ${id} not found`,
      });
    }

    const valueToUse = req.body.value !== undefined ? req.body.value : existing.value;
    const rangeToUse = req.body.reference_range !== undefined ? req.body.reference_range : existing.reference_range;
    const reported_flag = determineLabStatus(valueToUse, rangeToUse);

    const updated = await labDataRepository.update(id, {
      ...req.body,
      reported_flag,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Clinical/laboratory record updated successfully',
      data: { labData: updated },
    });
  } catch (error) {
    next(error);
  }
};

const deleteLabData = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await labDataRepository.findById(id);

    if (!existing) {
      return res.status(404).json({
        status: 'fail',
        message: `Clinical/laboratory record with ID ${id} not found`,
      });
    }

    const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
    const patient = await patientRepository.findById(existing.patient_id, authenticatedDietitianId);
    if (!patient) {
      return res.status(404).json({
        status: 'fail',
        message: `Clinical/laboratory record with ID ${id} not found`,
      });
    }

    await labDataRepository.delete(id);

    return res.status(200).json({
      status: 'success',
      message: 'Clinical/laboratory record deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

const deleteLabAttachment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await labDataRepository.findById(id);

    if (!existing) {
      return res.status(404).json({
        status: 'fail',
        message: `Clinical/laboratory record with ID ${id} not found`,
      });
    }

    const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
    const patient = await patientRepository.findById(existing.patient_id, authenticatedDietitianId);
    if (!patient) {
      return res.status(404).json({
        status: 'fail',
        message: `Clinical/laboratory record with ID ${id} not found`,
      });
    }

    const updated = await labDataRepository.deleteAttachment(id);

    return res.status(200).json({
      status: 'success',
      message: 'Report attachment metadata removed successfully',
      data: { labData: updated },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLabDataByAssessment,
  createLabData,
  updateLabData,
  deleteLabData,
  deleteLabAttachment,
};
