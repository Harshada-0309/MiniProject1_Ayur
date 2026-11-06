const { getPool, checkDatabaseConnection } = require('../config/database');

// In-memory fallback store for offline development / hermetic test execution
let memoryDietPlans = [];
let nextDietPlanId = 1;

async function isDbConnected() {
  const health = await checkDatabaseConnection();
  return health.connected;
}

const dietPlanRepository = {
  /**
   * Reset in-memory store (useful for tests)
   */
  _resetMemoryStore() {
    memoryDietPlans = [];
    nextDietPlanId = 1;
  },

  /**
   * Create a new 7-day diet plan record
   */
  async create(planData) {
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      const query = `
        INSERT INTO diet_plans (
          plan_id, patient_id, assessment_id, title, status,
          patient_summary, clinical_rationale, ayurvedic_dietary_principles,
          dosha_guidelines, days, weekly_overview, general_instructions,
          evidence_citations, validation_results, dietitian_notes,
          is_approved, approved_by, approved_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *;
      `;
      const values = [
        planData.plan_id || null,
        planData.patient_id,
        planData.assessment_id || null,
        planData.title || '7-Day Personalized Ayurvedic Diet Plan',
        planData.status || 'draft',
        planData.patient_summary || '',
        planData.clinical_rationale || '',
        JSON.stringify(planData.ayurvedic_dietary_principles || []),
        JSON.stringify(planData.dosha_guidelines || {}),
        JSON.stringify(planData.days || []),
        planData.weekly_overview || '',
        JSON.stringify(planData.general_instructions || []),
        JSON.stringify(planData.evidence_citations || []),
        JSON.stringify(planData.validation_results || {}),
        planData.dietitian_notes || null,
        Boolean(planData.is_approved),
        planData.approved_by || null,
        planData.approved_at || null,
      ];

      const result = await pool.query(query, values);
      return result.rows[0];
    } else {
      const newPlan = {
        id: nextDietPlanId++,
        plan_id: planData.plan_id || `dp_mem_${Date.now()}`,
        patient_id: planData.patient_id,
        assessment_id: planData.assessment_id || null,
        title: planData.title || '7-Day Personalized Ayurvedic Diet Plan',
        status: planData.status || 'draft',
        patient_summary: planData.patient_summary || '',
        clinical_rationale: planData.clinical_rationale || '',
        ayurvedic_dietary_principles: planData.ayurvedic_dietary_principles || [],
        dosha_guidelines: planData.dosha_guidelines || {},
        days: planData.days || [],
        weekly_overview: planData.weekly_overview || '',
        general_instructions: planData.general_instructions || [],
        evidence_citations: planData.evidence_citations || [],
        validation_results: planData.validation_results || {},
        dietitian_notes: planData.dietitian_notes || null,
        is_approved: Boolean(planData.is_approved),
        approved_by: planData.approved_by || null,
        approved_at: planData.approved_at || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      memoryDietPlans.push(newPlan);
      return { ...newPlan };
    }
  },

  /**
   * Find diet plan by primary key or plan_id
   */
  async findById(id) {
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      const isNum = !isNaN(Number(id));
      const query = isNum
        ? `SELECT * FROM diet_plans WHERE id = $1 OR plan_id = $2;`
        : `SELECT * FROM diet_plans WHERE plan_id = $1;`;
      const values = isNum ? [Number(id), String(id)] : [String(id)];
      const result = await pool.query(query, values);
      return result.rows[0] || null;
    } else {
      const found = memoryDietPlans.find(p => p.id === Number(id) || p.plan_id === String(id));
      return found ? { ...found } : null;
    }
  },

  /**
   * Find all diet plans for a specific patient
   */
  async findByPatientId(patientId) {
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      const query = `
        SELECT * FROM diet_plans
        WHERE patient_id = $1
        ORDER BY created_at DESC;
      `;
      const result = await pool.query(query, [patientId]);
      return result.rows;
    } else {
      return memoryDietPlans
        .filter(p => Number(p.patient_id) === Number(patientId))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map(p => ({ ...p }));
    }
  },

  /**
   * Update diet plan fields (e.g. after dietitian edits or revalidation)
   */
  async update(id, updateData) {
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      const isNum = !isNaN(Number(id));
      const current = await this.findById(id);
      if (!current) return null;

      const updated = {
        title: updateData.title !== undefined ? updateData.title : current.title,
        status: updateData.status !== undefined ? updateData.status : current.status,
        patient_summary: updateData.patient_summary !== undefined ? updateData.patient_summary : current.patient_summary,
        clinical_rationale: updateData.clinical_rationale !== undefined ? updateData.clinical_rationale : current.clinical_rationale,
        ayurvedic_dietary_principles: updateData.ayurvedic_dietary_principles !== undefined ? updateData.ayurvedic_dietary_principles : current.ayurvedic_dietary_principles,
        dosha_guidelines: updateData.dosha_guidelines !== undefined ? updateData.dosha_guidelines : current.dosha_guidelines,
        days: updateData.days !== undefined ? updateData.days : current.days,
        weekly_overview: updateData.weekly_overview !== undefined ? updateData.weekly_overview : current.weekly_overview,
        general_instructions: updateData.general_instructions !== undefined ? updateData.general_instructions : current.general_instructions,
        validation_results: updateData.validation_results !== undefined ? updateData.validation_results : current.validation_results,
        dietitian_notes: updateData.dietitian_notes !== undefined ? updateData.dietitian_notes : current.dietitian_notes,
        is_approved: updateData.is_approved !== undefined ? updateData.is_approved : current.is_approved,
        approved_by: updateData.approved_by !== undefined ? updateData.approved_by : current.approved_by,
        approved_at: updateData.approved_at !== undefined ? updateData.approved_at : current.approved_at,
      };

      const query = `
        UPDATE diet_plans
        SET title = $1, status = $2, patient_summary = $3, clinical_rationale = $4,
            ayurvedic_dietary_principles = $5, dosha_guidelines = $6, days = $7,
            weekly_overview = $8, general_instructions = $9, validation_results = $10,
            dietitian_notes = $11, is_approved = $12, approved_by = $13, approved_at = $14,
            updated_at = CURRENT_TIMESTAMP
        WHERE ${isNum ? 'id = $15' : 'plan_id = $15'}
        RETURNING *;
      `;

      const values = [
        updated.title,
        updated.status,
        updated.patient_summary,
        updated.clinical_rationale,
        JSON.stringify(updated.ayurvedic_dietary_principles),
        JSON.stringify(updated.dosha_guidelines),
        JSON.stringify(updated.days),
        updated.weekly_overview,
        JSON.stringify(updated.general_instructions),
        JSON.stringify(updated.validation_results),
        updated.dietitian_notes,
        Boolean(updated.is_approved),
        updated.approved_by,
        updated.approved_at,
        isNum ? Number(id) : String(id),
      ];

      const result = await pool.query(query, values);
      return result.rows[0] || null;
    } else {
      const idx = memoryDietPlans.findIndex(p => p.id === Number(id) || p.plan_id === String(id));
      if (idx === -1) return null;

      const current = memoryDietPlans[idx];
      const updated = {
        ...current,
        ...updateData,
        updated_at: new Date().toISOString(),
      };
      memoryDietPlans[idx] = updated;
      return { ...updated };
    }
  },

  /**
   * Formally approve a diet plan
   */
  async approve(id, { approved_by = 'dietitian-primary' } = {}) {
    return this.update(id, {
      status: 'approved',
      is_approved: true,
      approved_by,
      approved_at: new Date().toISOString(),
    });
  },

  /**
   * Delete a diet plan
   */
  async delete(id) {
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      const isNum = !isNaN(Number(id));
      const query = isNum ? `DELETE FROM diet_plans WHERE id = $1;` : `DELETE FROM diet_plans WHERE plan_id = $1;`;
      const values = isNum ? [Number(id)] : [String(id)];
      const result = await pool.query(query, values);
      return result.rowCount > 0;
    } else {
      const initialLength = memoryDietPlans.length;
      memoryDietPlans = memoryDietPlans.filter(p => p.id !== Number(id) && p.plan_id !== String(id));
      return memoryDietPlans.length < initialLength;
    }
  },

  /**
   * Delete all diet plans for a patient
   */
  async deleteByPatientId(patientId) {
    const numericPatientId = parseInt(patientId, 10);
    if (isNaN(numericPatientId)) return false;
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      await pool.query('DELETE FROM diet_plans WHERE patient_id = $1;', [numericPatientId]);
      return true;
    } else {
      memoryDietPlans = memoryDietPlans.filter(p => Number(p.patient_id) !== numericPatientId);
      return true;
    }
  },
};

module.exports = dietPlanRepository;
