const { getPool, checkDatabaseConnection } = require('../config/database');

// In-memory fallback store for offline development / hermetic test execution
let memoryMealPlans = [];
let nextMealPlanId = 1;

async function isDbConnected() {
  const health = await checkDatabaseConnection();
  return health.connected;
}

const mealPlanRepository = {
  /**
   * Reset in-memory store (useful for tests)
   */
  _resetMemoryStore() {
    memoryMealPlans = [];
    nextMealPlanId = 1;
  },

  /**
   * Create a new structured meal plan record
   */
  async create(planData) {
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      const query = `
        INSERT INTO meal_plans (
          patient_id, assessment_id, plan_status, nutrition_targets, meals,
          daily_totals, target_comparison, validation, evidence,
          requires_dietitian_review, review_reasons, dietitian_notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *;
      `;
      const values = [
        planData.patient_id,
        planData.assessment_id || null,
        planData.plan_status || 'draft',
        JSON.stringify(planData.nutrition_targets || {}),
        JSON.stringify(planData.meals || []),
        JSON.stringify(planData.daily_totals || {}),
        JSON.stringify(planData.target_comparison || {}),
        JSON.stringify(planData.validation || {}),
        JSON.stringify(planData.evidence || []),
        Boolean(planData.requires_dietitian_review),
        JSON.stringify(planData.review_reasons || []),
        planData.dietitian_notes || null,
      ];

      const result = await pool.query(query, values);
      return result.rows[0];
    } else {
      const newPlan = {
        id: nextMealPlanId++,
        patient_id: planData.patient_id,
        assessment_id: planData.assessment_id || null,
        plan_status: planData.plan_status || 'draft',
        nutrition_targets: planData.nutrition_targets || {},
        meals: planData.meals || [],
        daily_totals: planData.daily_totals || {},
        target_comparison: planData.target_comparison || {},
        validation: planData.validation || {},
        evidence: planData.evidence || [],
        requires_dietitian_review: Boolean(planData.requires_dietitian_review),
        review_reasons: planData.review_reasons || [],
        dietitian_notes: planData.dietitian_notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      memoryMealPlans.push(newPlan);
      return { ...newPlan };
    }
  },

  /**
   * Find meal plan by primary key
   */
  async findById(id) {
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      const query = `SELECT * FROM meal_plans WHERE id = $1;`;
      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    } else {
      const found = memoryMealPlans.find(p => p.id === Number(id));
      return found ? { ...found } : null;
    }
  },

  /**
   * Find all meal plans for a specific patient
   */
  async findByPatientId(patientId) {
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      const query = `
        SELECT * FROM meal_plans
        WHERE patient_id = $1
        ORDER BY created_at DESC;
      `;
      const result = await pool.query(query, [patientId]);
      return result.rows;
    } else {
      return memoryMealPlans
        .filter(p => Number(p.patient_id) === Number(patientId))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  },

  /**
   * Find latest meal plan for an assessment
   */
  async findByAssessmentId(assessmentId) {
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      const query = `
        SELECT * FROM meal_plans
        WHERE assessment_id = $1
        ORDER BY created_at DESC
        LIMIT 1;
      `;
      const result = await pool.query(query, [assessmentId]);
      return result.rows[0] || null;
    } else {
      const matches = memoryMealPlans.filter(p => Number(p.assessment_id) === Number(assessmentId));
      return matches.length > 0 ? { ...matches[matches.length - 1] } : null;
    }
  },

  /**
   * Update plan by ID
   */
  async update(id, updates) {
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      const query = `
        UPDATE meal_plans
        SET
          plan_status = COALESCE($2, plan_status),
          meals = COALESCE($3, meals),
          daily_totals = COALESCE($4, daily_totals),
          target_comparison = COALESCE($5, target_comparison),
          validation = COALESCE($6, validation),
          requires_dietitian_review = COALESCE($7, requires_dietitian_review),
          review_reasons = COALESCE($8, review_reasons),
          dietitian_notes = COALESCE($9, dietitian_notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *;
      `;
      const values = [
        id,
        updates.plan_status || null,
        updates.meals ? JSON.stringify(updates.meals) : null,
        updates.daily_totals ? JSON.stringify(updates.daily_totals) : null,
        updates.target_comparison ? JSON.stringify(updates.target_comparison) : null,
        updates.validation ? JSON.stringify(updates.validation) : null,
        typeof updates.requires_dietitian_review === 'boolean' ? updates.requires_dietitian_review : null,
        updates.review_reasons ? JSON.stringify(updates.review_reasons) : null,
        updates.dietitian_notes !== undefined ? updates.dietitian_notes : null,
      ];
      const result = await pool.query(query, values);
      return result.rows[0] || null;
    } else {
      const idx = memoryMealPlans.findIndex(p => p.id === Number(id));
      if (idx === -1) return null;
      memoryMealPlans[idx] = {
        ...memoryMealPlans[idx],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      return { ...memoryMealPlans[idx] };
    }
  },

  /**
   * Delete plan by ID
   */
  async delete(id) {
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      const result = await pool.query('DELETE FROM meal_plans WHERE id = $1 RETURNING id;', [id]);
      return result.rowCount > 0;
    } else {
      const initLen = memoryMealPlans.length;
      memoryMealPlans = memoryMealPlans.filter(p => p.id !== Number(id));
      return memoryMealPlans.length < initLen;
    }
  },

  /**
   * Delete all meal plans for a patient
   */
  async deleteByPatientId(patientId) {
    const numericPatientId = parseInt(patientId, 10);
    if (isNaN(numericPatientId)) return false;
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      await pool.query('DELETE FROM meal_plans WHERE patient_id = $1;', [numericPatientId]);
      return true;
    } else {
      memoryMealPlans = memoryMealPlans.filter(p => Number(p.patient_id) !== numericPatientId);
      return true;
    }
  },
};

module.exports = mealPlanRepository;
