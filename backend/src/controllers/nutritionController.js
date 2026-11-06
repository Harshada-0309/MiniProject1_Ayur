const aiService = require('../services/aiService');
const assessmentRepository = require('../repositories/assessmentRepository');
const patientRepository = require('../repositories/patientRepository');

/**
 * Controller orchestrating Phase 3: Deterministic Nutrition Target Calculations
 */

const calculateNutritionTargets = async (req, res, next) => {
  try {
    const payload = req.body;
    const result = await aiService.calculateNutrition(payload);

    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    if (error.status === 422 || error.status === 400) {
      return res.status(error.status).json({
        status: 'fail',
        message: error.message,
        details: error.details,
      });
    }
    next(error);
  }
};

const calculateForSavedAssessment = async (req, res, next) => {
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
    const patient = await patientRepository.findById(assessment.patient_id, authenticatedDietitianId);
    if (!patient) {
      return res.status(404).json({
        status: 'fail',
        message: `Assessment with ID ${id} not found`,
      });
    }

    // Merge patient demographic data and assessment metrics for FastAPI engine
    const enginePayload = {
      patient_id: patient.patient_code || String(patient.id),
      assessment_id: assessment.id,
      age: patient.age,
      sex: patient.sex,
      height: assessment.height,
      weight: assessment.weight,
      waist_circumference: assessment.waist_circumference,
      weight_trend: assessment.weight_trend,
      diet_goal: assessment.diet_goal,
      target_weight: assessment.target_weight,
      goal_notes: assessment.goal_notes,
      activity_level: assessment.activity_level || 'sedentary',
      exercise_type: assessment.exercise_type,
      exercise_frequency: assessment.exercise_frequency,
      exercise_duration: assessment.exercise_duration,
      sleep_duration: assessment.sleep_duration,
      sleep_quality: assessment.sleep_quality,
      water_intake: assessment.water_intake,
      diet_category: assessment.diet_category || 'vegetarian',
      meal_frequency: assessment.meal_frequency || 3,
      meal_timings: Array.isArray(assessment.meal_timings) ? assessment.meal_timings : [],
      food_preferences: assessment.food_preferences,
      foods_disliked: assessment.foods_disliked,
      food_allergies: Array.isArray(assessment.food_allergies) ? assessment.food_allergies : [],
      food_intolerances: Array.isArray(assessment.food_intolerances) ? assessment.food_intolerances : [],
      dietary_restrictions: Array.isArray(assessment.dietary_restrictions) ? assessment.dietary_restrictions : [],
      existing_conditions: Array.isArray(assessment.existing_conditions) ? assessment.existing_conditions : [],
      medical_history: assessment.medical_history,
      symptoms: Array.isArray(assessment.symptoms) ? assessment.symptoms : [],
      medications: Array.isArray(assessment.medications) ? assessment.medications : [],
      supplements: assessment.supplements,
      prakriti: assessment.prakriti,
      vikriti: assessment.vikriti,
      appetite: assessment.appetite,
      digestion: assessment.digestion,
      bowel_habits: assessment.bowel_habits,
      meal_regularity: assessment.meal_regularity,
      season_ritu: assessment.season_ritu,
      dietitian_observations: assessment.dietitian_observations,
    };

    const result = await aiService.calculateNutrition(enginePayload);

    return res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    if (error.status === 422 || error.status === 400) {
      return res.status(error.status).json({
        status: 'fail',
        message: error.message,
        details: error.details,
      });
    }
    next(error);
  }
};

module.exports = {
  calculateNutritionTargets,
  calculateForSavedAssessment,
};
