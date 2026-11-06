const dietitianRepository = require('../repositories/dietitianRepository');
const { verifyPassword, generateToken, revokeToken } = require('../services/authService');
const { deleteLocalUploadFile } = require('../middleware/uploadMiddleware');

const authController = {
  /**
   * POST /api/auth/login
   * Authenticate dietitian practitioner credentials
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          status: 'fail',
          message: 'Both clinic email and password are required',
          errors: [
            !email ? { field: 'email', message: 'Clinic email is required' } : null,
            !password ? { field: 'password', message: 'Password is required' } : null,
          ].filter(Boolean),
        });
      }

      const dietitian = await dietitianRepository.findByEmail(email);
      if (!dietitian) {
        return res.status(401).json({
          status: 'fail',
          message: 'Invalid email or password',
        });
      }

      const isValidPassword = verifyPassword(password, dietitian.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          status: 'fail',
          message: 'Invalid email or password',
        });
      }

      const safeProfile = {
        id: dietitian.id,
        dietitian_code: dietitian.dietitian_code,
        name: dietitian.name,
        email: dietitian.email,
        role: dietitian.role,
        clinic_name: dietitian.clinic_name || 'AyurDiet Integrative Health Clinic',
        phone: dietitian.phone || '+91 98765 43210',
        qualifications: dietitian.qualifications || 'BAMS, MD (Ayurveda), PGD Clinical Nutrition',
        photo_url: dietitian.photo_url || '/images/dietitian-hero-doctor.jpg',
      };

      const token = generateToken(safeProfile);

      return res.status(200).json({
        status: 'success',
        message: 'Authentication successful',
        data: {
          token,
          dietitian: safeProfile,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/auth/register
   * Register a new dietitian practitioner account
   */
  async register(req, res, next) {
    try {
      const { name, email, password, role, clinic_name, phone, qualifications } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          status: 'fail',
          message: 'Full practitioner name, email, and password are required',
          errors: [
            !name ? { field: 'name', message: 'Full name is required' } : null,
            !email ? { field: 'email', message: 'Clinic email is required' } : null,
            !password ? { field: 'password', message: 'Password is required' } : null,
          ].filter(Boolean),
        });
      }

      const trimmedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({
          status: 'fail',
          message: 'Please provide a valid email address',
          errors: [{ field: 'email', message: 'Invalid email address format' }],
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          status: 'fail',
          message: 'Password must be at least 6 characters long',
          errors: [{ field: 'password', message: 'Password must have minimum 6 characters' }],
        });
      }

      const existing = await dietitianRepository.findByEmail(trimmedEmail);
      if (existing) {
        return res.status(409).json({
          status: 'fail',
          message: `An account with email '${trimmedEmail}' already exists. Please log in instead.`,
        });
      }

      const newDietitian = await dietitianRepository.create({
        name: name.trim(),
        email: trimmedEmail,
        password,
        role: role ? role.trim() : 'Clinical Dietitian',
        clinic_name: clinic_name ? clinic_name.trim() : 'AyurDiet Integrative Health Clinic',
        phone: phone ? phone.trim() : '',
        qualifications: qualifications ? qualifications.trim() : 'BAMS, Certified Ayurvedic Nutritionist',
        photo_url: '/images/dietitian-hero-doctor.jpg',
      });

      const token = generateToken(newDietitian);

      return res.status(201).json({
        status: 'success',
        message: 'Dietitian practitioner registered successfully',
        data: {
          token,
          dietitian: newDietitian,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/auth/me
   * Return authenticated practitioner profile
   */
  async me(req, res, next) {
    try {
      const dietitian = req.dietitian || req.user;
      if (!dietitian) {
        return res.status(401).json({
          status: 'error',
          message: 'Not authenticated',
        });
      }

      // Refresh from repository to get latest profile
      const fullDietitian = await dietitianRepository.findById(dietitian.id);
      const safeProfile = fullDietitian || dietitian;

      return res.status(200).json({
        status: 'success',
        data: {
          dietitian: safeProfile,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/auth/dietitians
   * Return list of active clinic practitioners
   */
  async listDietitians(req, res, next) {
    try {
      const dietitians = await dietitianRepository.findAll();
      return res.status(200).json({
        status: 'success',
        results: dietitians.length,
        data: { dietitians },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/auth/profile
   * Update authenticated practitioner profile
   */
  async updateProfile(req, res, next) {
    try {
      const dietitianId = req.dietitian?.id || req.user?.id;
      if (!dietitianId) {
        return res.status(401).json({
          status: 'fail',
          message: 'Not authenticated',
        });
      }

      const { name, phone, qualifications, clinic_name, photo_url, role } = req.body;

      if (name !== undefined && !name.trim()) {
        return res.status(400).json({
          status: 'fail',
          message: 'Practitioner full name is required and cannot be empty',
          errors: [{ field: 'name', message: 'Doctor full name is required' }],
        });
      }

      let photoUrlToSet = undefined;
      if (req.file) {
        // Uploaded a new photo via multipart/form-data
        const current = await dietitianRepository.findById(dietitianId);
        if (current?.photo_url) {
          deleteLocalUploadFile(current.photo_url);
        }
        photoUrlToSet = `/uploads/dietitians/${req.file.filename}`;
      } else if (photo_url === '' || photo_url === 'null' || photo_url === null) {
        // Explicit removal of photo
        const current = await dietitianRepository.findById(dietitianId);
        if (current?.photo_url) {
          deleteLocalUploadFile(current.photo_url);
        }
        photoUrlToSet = null;
      } else if (typeof photo_url === 'string' && photo_url.trim().length > 0) {
        photoUrlToSet = photo_url.trim();
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name.trim();
      if (phone !== undefined) updateData.phone = phone.trim();
      if (qualifications !== undefined) updateData.qualifications = qualifications.trim();
      if (clinic_name !== undefined) updateData.clinic_name = clinic_name.trim();
      if (role !== undefined) updateData.role = role.trim();
      if (photoUrlToSet !== undefined) updateData.photo_url = photoUrlToSet;

      const updated = await dietitianRepository.updateProfile(dietitianId, updateData);

      if (!updated) {
        return res.status(404).json({
          status: 'fail',
          message: 'Dietitian practitioner profile not found',
        });
      }

      const newToken = generateToken(updated);

      return res.status(200).json({
        status: 'success',
        message: 'Dietitian clinical profile updated successfully',
        data: {
          token: newToken,
          dietitian: updated,
          photo_url: updated.photo_url,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/auth/logout
   * Invalidate current session token
   */
  async logout(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        revokeToken(token);
      }

      return res.status(200).json({
        status: 'success',
        message: 'Session successfully invalidated and logged out',
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = authController;
