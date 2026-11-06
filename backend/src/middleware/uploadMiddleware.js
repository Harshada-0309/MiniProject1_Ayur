const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload root and subdirectories exist
const UPLOADS_ROOT = path.join(__dirname, '../../uploads');
const DIETITIAN_UPLOADS = path.join(UPLOADS_ROOT, 'dietitians');
const PATIENT_UPLOADS = path.join(UPLOADS_ROOT, 'patients');

[UPLOADS_ROOT, DIETITIAN_UPLOADS, PATIENT_UPLOADS].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Allowed MIME types and extensions
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Verify file magic bytes to guarantee file is truly JPEG, PNG, or WebP
 */
function verifyMagicBytes(filePath) {
  try {
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return true;
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return true;
    }

    // WebP: RIFF (bytes 0-3: 52 49 46 46) and WEBP (bytes 8-11: 57 45 42 50)
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return true;
    }

    return false;
  } catch (err) {
    console.error('[Upload] Magic byte verification error:', err.message);
    return false;
  }
}

/**
 * Configure Multer disk storage for dietitians
 */
const dietitianStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DIETITIAN_UPLOADS);
  },
  filename: (req, file, cb) => {
    const dietitianId = req.dietitian?.id || req.user?.id || 'default';
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const sanitizedExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.jpg';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `dietitian-${dietitianId}-${uniqueSuffix}${sanitizedExt}`);
  },
});

/**
 * Configure Multer disk storage for patients
 */
const patientStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PATIENT_UPLOADS);
  },
  filename: (req, file, cb) => {
    const patientId = req.params.patientId || req.params.id || 'new';
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const sanitizedExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.jpg';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `patient-${patientId}-${uniqueSuffix}${sanitizedExt}`);
  },
});

/**
 * File filter checking MIME types and extensions
 */
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    const err = new Error('Invalid file format. Only JPEG, PNG, and WebP images are allowed.');
    err.status = 400;
    cb(err, false);
  }
}

const uploadDietitian = multer({
  storage: dietitianStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

const uploadPatient = multer({
  storage: patientStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

/**
 * Middleware wrapper that validates magic bytes after multer saves the file
 */
function validateMagicBytesMiddleware(req, res, next) {
  if (!req.file) {
    return res.status(400).json({
      status: 'fail',
      message: 'No image file uploaded. Please select an image.',
    });
  }

  const isValid = verifyMagicBytes(req.file.path);
  if (!isValid) {
    // Delete the invalid file
    try {
      fs.unlinkSync(req.file.path);
    } catch (e) {
      console.warn('[Upload] Failed to remove invalid file:', e.message);
    }
    return res.status(400).json({
      status: 'fail',
      message: 'Uploaded file signature is invalid. Only genuine JPEG, PNG, and WebP images are accepted.',
    });
  }

  next();
}

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
 * Optional single photo upload middleware for endpoints that can accept
 * either multipart/form-data with a file or standard application/json
 */
function optionalDietitianUpload(req, res, next) {
  if (req.is('multipart/form-data')) {
    uploadDietitian.single('photo')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            status: 'fail',
            message: 'Image file size must be less than 5 MB.',
          });
        }
        return res.status(400).json({
          status: 'fail',
          message: err.message || 'File upload error.',
        });
      }
      if (req.file) {
        const isValid = verifyMagicBytes(req.file.path);
        if (!isValid) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (_) {}
          return res.status(400).json({
            status: 'fail',
            message: 'Uploaded file signature is invalid. Only genuine JPEG, PNG, and WebP images are accepted.',
          });
        }
      }
      next();
    });
  } else {
    next();
  }
}

module.exports = {
  uploadDietitian,
  uploadPatient,
  validateMagicBytesMiddleware,
  verifyMagicBytes,
  deleteLocalUploadFile,
  optionalDietitianUpload,
  UPLOADS_ROOT,
  DIETITIAN_UPLOADS,
  PATIENT_UPLOADS,
};

