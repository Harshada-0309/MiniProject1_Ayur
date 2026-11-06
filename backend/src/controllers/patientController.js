const patientRepository = require('../repositories/patientRepository');

/**
 * Controller for Dietitian Patient Management
 * Enforces strict account-level patient data isolation
 */

const getPatients = async (req, res, next) => {
  try {
    const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
    if (!authenticatedDietitianId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required. Please log in as an authorized dietitian.',
      });
    }

    const { search, limit = 50, offset = 0 } = req.query;
    const patients = await patientRepository.findAll({
      search,
      dietitian_id: authenticatedDietitianId,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    return res.status(200).json({
      status: 'success',
      results: patients.length,
      data: { patients },
    });
  } catch (error) {
    next(error);
  }
};

const getPatientById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const authenticatedDietitianId = req.dietitian?.id || req.user?.id;

    const patient = await patientRepository.findById(id, authenticatedDietitianId);

    if (!patient) {
      return res.status(404).json({
        status: 'fail',
        message: `Patient with ID ${id} not found`,
      });
    }

    return res.status(200).json({
      status: 'success',
      data: { patient },
    });
  } catch (error) {
    next(error);
  }
};

const createPatient = async (req, res, next) => {
  try {
    const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
    if (!authenticatedDietitianId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required. Please log in as an authorized dietitian.',
      });
    }

    const { name, age, sex, occupation, phone, email, patient_code, photo_url } = req.body;

    // Check if custom patient code already exists
    if (patient_code) {
      const existing = await patientRepository.findByCode(patient_code);
      if (existing) {
        return res.status(409).json({
          status: 'fail',
          message: `Patient code '${patient_code}' already exists`,
        });
      }
    }

    // Always assign to authenticated dietitian - never trust client payload for dietitian_id
    const patient = await patientRepository.create({
      name: name.trim(),
      age: parseInt(age, 10),
      sex: sex.toLowerCase(),
      occupation: occupation ? occupation.trim() : '',
      phone: phone ? phone.trim() : '',
      email: email ? email.trim() : '',
      patient_code: patient_code ? patient_code.trim() : undefined,
      photo_url: photo_url ? photo_url.trim() : undefined,
      dietitian_id: authenticatedDietitianId,
    });

    return res.status(201).json({
      status: 'success',
      message: 'Patient created successfully',
      data: { patient },
    });
  } catch (error) {
    next(error);
  }
};

const updatePatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const authenticatedDietitianId = req.dietitian?.id || req.user?.id;

    // Verify patient belongs to authenticated dietitian
    const existing = await patientRepository.findById(id, authenticatedDietitianId);

    if (!existing) {
      return res.status(404).json({
        status: 'fail',
        message: `Patient with ID ${id} not found`,
      });
    }

    const { name, age, sex, occupation, phone, email, photo_url } = req.body;
    // Strip dietitian_id so ownership cannot be transferred or spoofed via update payload
    const updated = await patientRepository.update(
      id,
      {
        name: name ? name.trim() : undefined,
        age: age !== undefined ? parseInt(age, 10) : undefined,
        sex: sex ? sex.toLowerCase() : undefined,
        occupation: occupation !== undefined ? occupation.trim() : undefined,
        phone: phone !== undefined ? phone.trim() : undefined,
        email: email !== undefined ? email.trim() : undefined,
        photo_url: photo_url !== undefined ? photo_url : undefined,
      },
      authenticatedDietitianId
    );

    return res.status(200).json({
      status: 'success',
      message: 'Patient updated successfully',
      data: { patient: updated },
    });
  } catch (error) {
    next(error);
  }
};

const deletePatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const numericId = parseInt(id, 10);
    if (isNaN(numericId) || numericId <= 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid patient ID',
      });
    }

    const authenticatedDietitianId = req.dietitian?.id || req.user?.id;

    const existing = await patientRepository.findById(numericId, authenticatedDietitianId);
    if (!existing) {
      return res.status(404).json({
        status: 'fail',
        message: `Patient with ID ${id} not found`,
      });
    }

    const deleted = await patientRepository.delete(numericId, authenticatedDietitianId);
    if (!deleted) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to delete patient',
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Patient deleted successfully',
      data: {
        id: numericId,
        patient_code: existing.patient_code,
        name: existing.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getPatientDependentCounts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const numericId = parseInt(id, 10);
    if (isNaN(numericId) || numericId <= 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid patient ID',
      });
    }

    const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
    const existing = await patientRepository.findById(numericId, authenticatedDietitianId);
    if (!existing) {
      return res.status(404).json({
        status: 'fail',
        message: `Patient with ID ${id} not found`,
      });
    }

    const counts = await patientRepository.getDependentCounts(numericId);
    return res.status(200).json({
      status: 'success',
      data: { counts },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientDependentCounts,
};
