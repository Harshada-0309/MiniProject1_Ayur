const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const {
  uploadDietitian,
  uploadPatient,
  validateMagicBytesMiddleware,
  UPLOADS_ROOT,
} = require('../middleware/uploadMiddleware');
const { authenticateDietitian } = require('../middleware/authMiddleware');
const { generateToken } = require('../services/authService');
const dietitianRepository = require('../repositories/dietitianRepository');
const patientRepository = require('../repositories/patientRepository');

/**
 * Safely removes a previously uploaded file from persistent disk storage
 */
function deleteLocalUploadFile(photoUrl) {
  if (!photoUrl || typeof photoUrl !== 'string') return;
  // Prevent deleting default asset images or directories
  if (!photoUrl.startsWith('/uploads/')) return;

  try {
    const cleanRelativePath = photoUrl.split('?')[0].replace(/^\/uploads\//, '');
    const absoluteFilePath = path.normalize(path.join(UPLOADS_ROOT, cleanRelativePath));

    // Guard against path traversal
    if (absoluteFilePath.startsWith(path.normalize(UPLOADS_ROOT))) {
      if (fs.existsSync(absoluteFilePath) && fs.statSync(absoluteFilePath).isFile()) {
        fs.unlinkSync(absoluteFilePath);
        console.log(`[Upload] Cleaned up obsolete photo file: ${cleanRelativePath}`);
      }
    }
  } catch (err) {
    console.warn('[Upload] Failed to remove previous photo file:', err.message);
  }
}

/**
 * POST /api/upload/dietitian-photo
 * Upload and persist dietitian practitioner profile photograph
 */
router.post(
  '/dietitian-photo',
  authenticateDietitian,
  uploadDietitian.single('photo'),
  validateMagicBytesMiddleware,
  async (req, res, next) => {
    try {
      const dietitianId = req.dietitian.id;
      const current = await dietitianRepository.findById(dietitianId);

      const photoUrl = `/uploads/dietitians/${req.file.filename}`;

      // Clean up previous custom uploaded photo if it exists
      if (current?.photo_url && current.photo_url !== photoUrl) {
        deleteLocalUploadFile(current.photo_url);
      }

      const updated = await dietitianRepository.updateProfile(dietitianId, {
        photo_url: photoUrl,
      });

      if (!updated) {
        // Rollback uploaded file if DB update failed
        try {
          fs.unlinkSync(req.file.path);
        } catch (_) {}
        return res.status(500).json({
          status: 'error',
          message: 'Failed to update practitioner profile with uploaded photograph.',
        });
      }

      const newToken = generateToken(updated);

      return res.status(200).json({
        status: 'success',
        message: 'Dietitian profile photograph uploaded and persisted successfully',
        data: {
          photo_url: photoUrl,
          token: newToken,
          dietitian: updated,
        },
      });
    } catch (err) {
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (_) {}
      }
      next(err);
    }
  }
);

/**
 * DELETE /api/upload/dietitian-photo
 * Remove dietitian profile photograph and reset to default avatar
 */
router.delete(
  '/dietitian-photo',
  authenticateDietitian,
  async (req, res, next) => {
    try {
      const dietitianId = req.dietitian.id;
      const current = await dietitianRepository.findById(dietitianId);

      if (current?.photo_url) {
        deleteLocalUploadFile(current.photo_url);
      }

      const updated = await dietitianRepository.updateProfile(dietitianId, {
        photo_url: null,
      });

      const newToken = generateToken(updated);

      return res.status(200).json({
        status: 'success',
        message: 'Dietitian profile photograph removed successfully',
        data: {
          photo_url: null,
          token: newToken,
          dietitian: updated,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/upload/patient-photo/:id
 * Upload and persist patient profile photograph
 */
router.post(
  '/patient-photo/:id',
  authenticateDietitian,
  uploadPatient.single('photo'),
  validateMagicBytesMiddleware,
  async (req, res, next) => {
    try {
      const patientId = req.params.id;
      const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
      const existing = await patientRepository.findById(patientId, authenticatedDietitianId);

      if (!existing) {
        // Delete uploaded file if patient not found or unauthorized
        if (req.file?.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (_) {}
        }
        return res.status(404).json({
          status: 'fail',
          message: `Patient with ID ${patientId} not found or you do not have permission to modify this record.`,
        });
      }

      const photoUrl = `/uploads/patients/${req.file.filename}`;

      // Clean up previous custom uploaded photo
      if (existing.photo_url && existing.photo_url !== photoUrl) {
        deleteLocalUploadFile(existing.photo_url);
      }

      const updated = await patientRepository.update(
        patientId,
        {
          photo_url: photoUrl,
        },
        authenticatedDietitianId
      );

      if (!updated) {
        if (req.file?.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (_) {}
        }
        return res.status(500).json({
          status: 'error',
          message: 'Failed to update patient record with uploaded photograph in database.',
        });
      }

      return res.status(200).json({
        status: 'success',
        message: 'Patient profile photograph uploaded and persisted successfully',
        data: {
          photo_url: photoUrl,
          patient: updated,
        },
      });
    } catch (err) {
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (_) {}
      }
      next(err);
    }
  }
);

/**
 * DELETE /api/upload/patient-photo/:id
 * Remove patient profile photograph and reset to default avatar
 */
router.delete(
  '/patient-photo/:id',
  authenticateDietitian,
  async (req, res, next) => {
    try {
      const patientId = req.params.id;
      const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
      const existing = await patientRepository.findById(patientId, authenticatedDietitianId);

      if (!existing) {
        return res.status(404).json({
          status: 'fail',
          message: `Patient with ID ${patientId} not found or you do not have permission to modify this record.`,
        });
      }

      if (existing.photo_url) {
        deleteLocalUploadFile(existing.photo_url);
      }

      const updated = await patientRepository.update(
        patientId,
        {
          photo_url: null,
        },
        authenticatedDietitianId
      );

      return res.status(200).json({
        status: 'success',
        message: 'Patient profile photograph removed successfully',
        data: {
          photo_url: null,
          patient: updated,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
