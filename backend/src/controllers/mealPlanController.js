const aiService = require('../services/aiService');
const mealPlanRepository = require('../repositories/mealPlanRepository');
const patientRepository = require('../repositories/patientRepository');

const mealPlanController = {
  /**
   * Deterministically generate a structured meal plan
   * POST /api/meal-plan/generate
   */
  async generateMealPlan(req, res, next) {
    try {
      const { patient_assessment, nutrition_targets, meal_structure, custom_meal_distribution, save } = req.body;

      if (!patient_assessment) {
        return res.status(400).json({
          status: 'error',
          message: 'patient_assessment object is required for meal plan generation',
        });
      }

      const generatedPlan = await aiService.generateMealPlan({
        patient_assessment,
        nutrition_targets,
        meal_structure,
        custom_meal_distribution,
      });

      // Optionally persist if requested and patient_id is present
      if (save && (generatedPlan.patient_id || patient_assessment.patient_id)) {
        const patientId = generatedPlan.patient_id || patient_assessment.patient_id;
        const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
        const patient = await patientRepository.findById(patientId, authenticatedDietitianId);
        if (!patient) {
          return res.status(404).json({
            status: 'error',
            message: `Patient with ID ${patientId} not found`,
          });
        }

        const savedPlan = await mealPlanRepository.create({
          patient_id: patientId,
          assessment_id: generatedPlan.assessment_id || patient_assessment.assessment_id || null,
          plan_status: generatedPlan.plan_status,
          nutrition_targets: generatedPlan.nutrition_targets,
          meals: generatedPlan.meals,
          daily_totals: generatedPlan.daily_totals,
          target_comparison: generatedPlan.target_comparison,
          validation: generatedPlan.validation,
          evidence: generatedPlan.evidence,
          requires_dietitian_review: generatedPlan.requires_dietitian_review,
          review_reasons: generatedPlan.review_reasons,
        });
        return res.status(200).json({
          status: 'success',
          data: { ...generatedPlan, id: savedPlan.id },
        });
      }

      return res.status(200).json({
        status: 'success',
        data: generatedPlan,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Save a meal plan explicitly
   * POST /api/meal-plan
   */
  async saveMealPlan(req, res, next) {
    try {
      const planData = req.body;

      if (!planData.patient_id) {
        return res.status(400).json({
          status: 'error',
          message: 'patient_id is required to save a meal plan',
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

      const saved = await mealPlanRepository.create(planData);
      return res.status(201).json({
        status: 'success',
        data: saved,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get meal plan by ID
   * GET /api/meal-plan/:id
   */
  async getMealPlanById(req, res, next) {
    try {
      const { id } = req.params;
      const plan = await mealPlanRepository.findById(id);

      if (!plan) {
        return res.status(404).json({
          status: 'error',
          message: `Meal plan with ID ${id} not found`,
        });
      }

      const authenticatedDietitianId = req.dietitian?.id || req.user?.id;
      const patient = await patientRepository.findById(plan.patient_id, authenticatedDietitianId);
      if (!patient) {
        return res.status(404).json({
          status: 'error',
          message: `Meal plan with ID ${id} not found`,
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
   * Get all meal plans for a patient
   * GET /api/meal-plan/patient/:patientId
   */
  async getMealPlansByPatient(req, res, next) {
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

      const plans = await mealPlanRepository.findByPatientId(patientId);

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
   * Get safe, nutritionally equivalent food substitutions
   * POST /api/meal-plan/substitutions
   */
  async getSubstitutions(req, res, next) {
    try {
      const { food_id, current_quantity, patient_assessment, meal_type } = req.body;

      if (!food_id || !current_quantity) {
        return res.status(400).json({
          status: 'error',
          message: 'food_id and current_quantity are required',
        });
      }

      const substitutions = await aiService.getSubstitutions({
        food_id,
        current_quantity: Number(current_quantity),
        patient_assessment: patient_assessment || {},
        meal_type,
      });

      return res.status(200).json({
        status: 'success',
        count: substitutions.length,
        data: substitutions,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * List grounded foods catalog
   * GET /api/meal-plan/foods
   */
  async listFoods(req, res, next) {
    try {
      const { category, search } = req.query;
      const foods = await aiService.listFoods({ category, search });

      return res.status(200).json({
        status: 'success',
        count: foods.length,
        data: foods,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get food item detail
   * GET /api/meal-plan/foods/:foodId
   */
  async getFoodDetail(req, res, next) {
    try {
      const { foodId } = req.params;
      const food = await aiService.getFoodDetail(foodId);

      return res.status(200).json({
        status: 'success',
        data: food,
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = mealPlanController;
