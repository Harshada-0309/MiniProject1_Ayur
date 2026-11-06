const aiService = require('../services/aiService');
const dietPlanRepository = require('../repositories/dietPlanRepository');
const patientRepository = require('../repositories/patientRepository');
const assessmentRepository = require('../repositories/assessmentRepository');
const labDataRepository = require('../repositories/labDataRepository');
const { validateNutritionTargetFreshness } = require('../middleware/validation');
const {
  normalizePhoneNumber,
  maskPhoneNumber,
  isCloudApiConfigured,
  buildPrescriptionMessage,
  generateFallbackUrl,
  sendViaCloudApi,
} = require('../services/whatsappService');
const whatsappAuditRepository = require('../repositories/whatsappAuditRepository');
const { generatePrescriptionAccessToken } = require('../services/authService');

const dietPlanController = {
  /**
   * Generate Gemini-formatted, deterministically validated 7-day diet plan
   * POST /api/diet-plan/generate
   */
  async generateDietPlan(req, res, next) {
    try {
      const {
        patient_assessment,
        nutrition_targets,
        meal_structure,
        custom_meal_distribution,
        dietitian_notes,
        target_inputs_snapshot,
        clinical_lab_data,
        save = true,
      } = req.body;

      if (!patient_assessment) {
        return res.status(400).json({
          status: 'fail',
          message: 'patient_assessment object is required for 7-day diet plan generation',
        });
      }

      const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
      let patient = null;
      if (patient_assessment.patient_id) {
        patient = await patientRepository.findById(patient_assessment.patient_id, authenticatedDietitianId);
      }

      let assessment = null;
      if (patient_assessment.assessment_id) {
        assessment = await assessmentRepository.findById(patient_assessment.assessment_id);
      }

      if (nutrition_targets !== undefined) {
        const freshness = validateNutritionTargetFreshness({
          nutritionTargets: nutrition_targets,
          currentInputs: patient_assessment,
          targetInputsSnapshot: target_inputs_snapshot || null,
          patient: patient || { id: patient_assessment.patient_id },
          assessment: assessment || { id: patient_assessment.assessment_id },
        });

        if (!freshness.valid) {
          return res.status(400).json({
            status: 'fail',
            message: freshness.error,
            errors: [{ field: 'nutrition_targets', message: freshness.error }],
          });
        }
      }

      // Resolve Section 9 clinical lab data if not directly provided in payload
      let labsToUse = clinical_lab_data;
      if (!labsToUse && patient_assessment.assessment_id) {
        try {
          labsToUse = await labDataRepository.findByAssessmentId(patient_assessment.assessment_id);
        } catch {
          labsToUse = [];
        }
      }

      const generatedPlan = await aiService.generate7DayDietPlan({
        patient_assessment,
        nutrition_targets,
        meal_structure,
        custom_meal_distribution,
        dietitian_notes,
        clinical_lab_data: labsToUse || [],
      });

      // Persist by default if patient_id is present
      const patientId = generatedPlan.patient_id || patient_assessment.patient_id;
      if (save && patientId) {
        const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
        const patient = await patientRepository.findById(patientId, authenticatedDietitianId);
        if (!patient) {
          return res.status(404).json({
            status: 'error',
            message: `Patient with ID ${patientId} not found`,
          });
        }

        const savedRecord = await dietPlanRepository.create({
          plan_id: generatedPlan.plan_id,
          patient_id: patientId,
          assessment_id: generatedPlan.assessment_id || patient_assessment.assessment_id || null,
          title: generatedPlan.title || '7-Day Personalized Ayurvedic Diet Plan',
          status: generatedPlan.status || 'draft',
          patient_summary: generatedPlan.patient_summary,
          clinical_rationale: generatedPlan.clinical_rationale,
          ayurvedic_dietary_principles: generatedPlan.ayurvedic_dietary_principles,
          dosha_guidelines: generatedPlan.dosha_guidelines,
          days: generatedPlan.days,
          weekly_overview: generatedPlan.weekly_overview,
          general_instructions: generatedPlan.general_instructions,
          evidence_citations: generatedPlan.evidence_citations,
          validation_results: {
            ...(generatedPlan.validation_results || {}),
            nutrition_targets: nutrition_targets || generatedPlan.nutrition_targets || null,
            clinical_lab_summary: generatedPlan.clinical_lab_summary || null,
          },
          dietitian_notes: dietitian_notes || generatedPlan.dietitian_notes,
          is_approved: false,
        });

        return res.status(200).json({
          status: 'success',
          data: {
            ...generatedPlan,
            nutrition_targets: nutrition_targets || generatedPlan.nutrition_targets || null,
            id: savedRecord.id,
          },
        });
      }

      return res.status(200).json({
        status: 'success',
        data: {
          ...generatedPlan,
          nutrition_targets: nutrition_targets || generatedPlan.nutrition_targets || null,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Save a diet plan record
   * POST /api/diet-plan
   */
  async saveDietPlan(req, res, next) {
    try {
      const planData = { ...req.body };

      if (!planData.patient_id) {
        return res.status(400).json({
          status: 'error',
          message: 'patient_id is required to save a diet plan',
        });
      }

      const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
      const patient = await patientRepository.findById(planData.patient_id, authenticatedDietitianId);
      if (!patient) {
        return res.status(404).json({
          status: 'error',
          message: `Patient with ID ${planData.patient_id} not found`,
        });
      }

      if (planData.nutrition_targets && planData.validation_results && !planData.validation_results.nutrition_targets) {
        planData.validation_results.nutrition_targets = planData.nutrition_targets;
      }

      const saved = await dietPlanRepository.create(planData);
      return res.status(201).json({
        status: 'success',
        data: saved,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get diet plan by numeric ID or string plan_id
   * GET /api/diet-plan/:id
   */
  async getDietPlanById(req, res, next) {
    try {
      const { id } = req.params;
      const plan = await dietPlanRepository.findById(id);

      if (!plan) {
        return res.status(404).json({
          status: 'error',
          message: `Diet plan with ID '${id}' not found`,
        });
      }

      const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
      const patient = await patientRepository.findById(plan.patient_id, authenticatedDietitianId);
      if (!patient) {
        return res.status(404).json({
          status: 'error',
          message: `Diet plan with ID '${id}' not found`,
        });
      }

      return res.status(200).json({
        status: 'success',
        data: plan,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get all diet plans for a patient
   * GET /api/diet-plan/patient/:patientId
   */
  async getDietPlansByPatient(req, res, next) {
    try {
      const { patientId } = req.params;
      const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
      const patient = await patientRepository.findById(patientId, authenticatedDietitianId);
      if (!patient) {
        return res.status(404).json({
          status: 'error',
          message: `Patient with ID ${patientId} not found`,
        });
      }

      const plans = await dietPlanRepository.findByPatientId(patientId);

      return res.status(200).json({
        status: 'success',
        count: plans.length,
        data: plans,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Deterministically revalidate an edited diet plan
   * POST /api/diet-plan/validate
   */
  async validateDietPlan(req, res, next) {
    try {
      const { diet_plan, patient_assessment, nutrition_targets } = req.body;

      if (!diet_plan || !patient_assessment) {
        return res.status(400).json({
          status: 'error',
          message: 'diet_plan and patient_assessment objects are required for validation',
        });
      }

      const validationResult = await aiService.validateDietPlan({
        diet_plan,
        patient_assessment,
        nutrition_targets,
      });

      return res.status(200).json({
        status: 'success',
        data: validationResult,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Update diet plan contents (e.g. food edits, notes)
   * PUT /api/diet-plan/:id
   */
  async updateDietPlan(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      const current = await dietPlanRepository.findById(id);
      if (!current) {
        return res.status(404).json({
          status: 'error',
          message: `Diet plan with ID '${id}' not found`,
        });
      }

      const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
      const patient = await patientRepository.findById(current.patient_id, authenticatedDietitianId);
      if (!patient) {
        return res.status(404).json({
          status: 'error',
          message: `Diet plan with ID '${id}' not found`,
        });
      }

      // Editing an approved plan resets approval state
      if (updateData.is_approved === undefined) {
        updateData.is_approved = false;
        if (current.status === 'approved' && !updateData.status) {
          updateData.status = 'needs_review';
        }
      }

      if (updateData.validation_results && !updateData.validation_results.nutrition_targets && current.validation_results?.nutrition_targets) {
        updateData.validation_results.nutrition_targets = current.validation_results.nutrition_targets;
      }

      const updated = await dietPlanRepository.update(id, updateData);

      return res.status(200).json({
        status: 'success',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Formally approve a diet plan
   * POST /api/diet-plan/:id/approve
   */
  async approveDietPlan(req, res, next) {
    try {
      const { id } = req.params;
      const { approved_by = 'dietitian-primary' } = req.body;

      const plan = await dietPlanRepository.findById(id);
      if (!plan) {
        return res.status(404).json({
          status: 'error',
          message: `Diet plan with ID '${id}' not found`,
        });
      }

      const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
      const patient = await patientRepository.findById(plan.patient_id, authenticatedDietitianId);
      if (!patient) {
        return res.status(404).json({
          status: 'error',
          message: `Diet plan with ID '${id}' not found`,
        });
      }

      const approved = await dietPlanRepository.approve(id, { approved_by });

      return res.status(200).json({
        status: 'success',
        message: 'Diet plan approved successfully',
        data: approved,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Export approved diet plan as a high-fidelity PDF
   * GET /api/diet-plan/:id/pdf
   */
  async exportDietPlanPdf(req, res, next) {
    try {
      const { id } = req.params;
      const plan = await dietPlanRepository.findById(id);

      if (!plan) {
        return res.status(404).json({
          status: 'error',
          message: `Diet plan with ID '${id}' not found`,
        });
      }

      // Security & Authorization: verify patient ownership or prescription access token
      let patient = null;
      if (req.isPrescriptionAccess) {
        if (req.user?.plan_id !== plan.id) {
          return res.status(403).json({
            status: 'error',
            message: 'Prescription access token is invalid for this diet plan',
          });
        }
        patient = await patientRepository.findById(plan.patient_id);
      } else {
        const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
        patient = await patientRepository.findById(plan.patient_id, authenticatedDietitianId);
      }

      if (!patient) {
        return res.status(404).json({
          status: 'error',
          message: `Patient associated with diet plan '${id}' not found or access denied`,
        });
      }

      // Verification: Plan must be approved before printing/exporting official prescription
      if (!plan.is_approved) {
        return res.status(400).json({
          status: 'fail',
          message: 'Diet plan must be formally approved by a registered dietitian before generating the official prescription report.',
        });
      }

      // Retrieve assessment if linked
      let assessment = null;
      if (plan.assessment_id) {
        assessment = await assessmentRepository.findById(plan.assessment_id);
      }

      const pdfBuffer = await aiService.exportDietPlanPdf({
        patient,
        assessment,
        diet_plan: plan,
      });

      const patientCode = patient.patient_code || `PAT-${patient.id}`;
      const todayStr = new Date().toISOString().split('T')[0];
      const filename = `AyurDiet_Prescription_${patientCode}_${todayStr}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.end(pdfBuffer);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Dispatch official clinical diet prescription via WhatsApp
   * POST /api/diet-plan/:id/whatsapp
   */
  async dispatchWhatsApp(req, res, next) {
    try {
      const { id } = req.params;
      const { phone, consent_confirmed } = req.body;

      const plan = await dietPlanRepository.findById(id);
      if (!plan) {
        return res.status(404).json({
          status: 'error',
          message: `Diet plan with ID '${id}' not found`,
        });
      }

      // Security check: verify patient ownership
      const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
      const patient = await patientRepository.findById(plan.patient_id, authenticatedDietitianId);
      if (!patient) {
        return res.status(404).json({
          status: 'error',
          message: `Patient associated with diet plan '${id}' not found or access denied`,
        });
      }

      // Prescription must be approved
      if (!plan.is_approved) {
        return res.status(400).json({
          status: 'fail',
          message: 'Diet plan must be formally approved by a registered dietitian before sending via WhatsApp.',
        });
      }

      // Require consent confirmation
      if (consent_confirmed !== true && consent_confirmed !== 'true') {
        return res.status(400).json({
          status: 'fail',
          message: 'Patient consent confirmation is required before dispatching clinical prescription.',
        });
      }

      // Determine recipient phone
      const rawPhone = phone || patient.phone;
      const norm = normalizePhoneNumber(rawPhone);
      if (!norm.isValid) {
        return res.status(400).json({
          status: 'fail',
          message: norm.error || 'A valid patient phone number is required.',
        });
      }

      // If custom phone provided or patient didn't have one, update patient profile
      if (phone && phone.trim() && phone.trim() !== patient.phone) {
        try {
          await patientRepository.update(patient.id, { phone: norm.e164 }, authenticatedDietitianId);
          patient.phone = norm.e164;
        } catch (err) {
          console.warn('[DietPlanController] Patient phone auto-update failed:', err.message);
        }
      }

      const maskedPhone = maskPhoneNumber(norm.e164);

      // Generate secure signed access token for prescription download link
      const accessToken = generatePrescriptionAccessToken(plan.id, patient.id);
      const host = req.get('host') || 'localhost:5000';
      const protocol = req.protocol || 'http';
      const downloadUrl = `${protocol}://${host}/api/diet-plan/${plan.id}/pdf?token=${accessToken}`;

      let assessment = null;
      if (plan.assessment_id) {
        assessment = await assessmentRepository.findById(plan.assessment_id);
      }

      const planVersion = plan.approved_at ? new Date(plan.approved_at).toISOString().split('T')[0] : '1.0';

      // Path A: Official Meta WhatsApp Business Cloud API
      if (isCloudApiConfigured()) {
        try {
          const pdfBuffer = await aiService.exportDietPlanPdf({
            patient,
            assessment,
            diet_plan: plan,
          });

          const patientCode = patient.patient_code || `PAT-${patient.id}`;
          const filename = `AyurDiet_Prescription_${patientCode}.pdf`;
          const caption = `🌿 Official AyurDiet Prescription for ${patient.name} (${patientCode}). Approved by ${plan.approved_by || 'Dr. Vaidya'}.`;

          const cloudRes = await sendViaCloudApi({
            recipientPhone: norm.e164,
            pdfBuffer,
            filename,
            caption,
          });

          const audit = await whatsappAuditRepository.create({
            plan_id: plan.id,
            patient_id: patient.id,
            dietitian_id: authenticatedDietitianId,
            recipient_phone: norm.e164,
            masked_phone: maskedPhone,
            delivery_method: 'cloud_api',
            status: 'sent',
            message_id: cloudRes.messageId,
            plan_version: planVersion,
          });

          return res.status(200).json({
            status: 'success',
            message: 'Prescription document sent successfully via WhatsApp Business Cloud API.',
            data: {
              delivery_method: 'cloud_api',
              status: 'sent',
              masked_phone: maskedPhone,
              message_id: cloudRes.messageId,
              audit_id: audit.id,
              dispatched_at: audit.created_at,
            },
          });
        } catch (apiErr) {
          console.warn('[WhatsApp] Cloud API dispatch failed, falling back to manual wa.me link:', apiErr.message);
        }
      }

      // Path B: Automatic Fallback (wa.me link with prefilled clinical prescription message)
      const messageText = buildPrescriptionMessage({
        patient,
        dietPlan: plan,
        assessment,
        dietitian: req.dietitian || { name: plan.approved_by },
        downloadUrl,
      });

      const fallbackUrl = generateFallbackUrl({
        recipientPhone: norm.e164,
        messageText,
      });

      const audit = await whatsappAuditRepository.create({
        plan_id: plan.id,
        patient_id: patient.id,
        dietitian_id: authenticatedDietitianId,
        recipient_phone: norm.e164,
        masked_phone: maskedPhone,
        delivery_method: 'manual_fallback',
        status: 'fallback_ready',
        plan_version: planVersion,
      });

      return res.status(200).json({
        status: 'success',
        message: 'WhatsApp delivery prepared for manual clinical dispatch.',
        data: {
          delivery_method: 'manual_fallback',
          status: 'fallback_ready',
          fallback_url: fallbackUrl,
          masked_phone: maskedPhone,
          recipient_phone: norm.e164,
          message_preview: messageText,
          download_url: downloadUrl,
          audit_id: audit.id,
          dispatched_at: audit.created_at,
          notice: 'Cloud API credentials are not active. The prefilled message has been generated for manual review and sending via WhatsApp Web or mobile app.',
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get WhatsApp dispatch history for a diet plan
   * GET /api/diet-plan/:id/whatsapp-history
   */
  async getWhatsAppHistory(req, res, next) {
    try {
      const { id } = req.params;
      const plan = await dietPlanRepository.findById(id);
      if (!plan) {
        return res.status(404).json({
          status: 'error',
          message: `Diet plan with ID '${id}' not found`,
        });
      }

      const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
      const patient = await patientRepository.findById(plan.patient_id, authenticatedDietitianId);
      if (!patient) {
        return res.status(404).json({
          status: 'error',
          message: `Patient associated with diet plan '${id}' not found or access denied`,
        });
      }

      const history = await whatsappAuditRepository.findByPlanId(plan.id);
      return res.status(200).json({
        status: 'success',
        data: {
          history,
        },
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = dietPlanController;
