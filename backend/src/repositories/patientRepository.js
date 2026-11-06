const { getPool, checkDatabaseConnection } = require('../config/database');
const assessmentRepository = require('./assessmentRepository');
const labDataRepository = require('./labDataRepository');
const mealPlanRepository = require('./mealPlanRepository');
const dietPlanRepository = require('./dietPlanRepository');

// In-memory fallback store for offline development / hermetic test execution
let memoryPatients = [];
let nextPatientId = 1;

/**
 * Generate a standard sequential patient code (e.g., PAT-2026-0001)
 */
function generatePatientCode(id) {
  const year = new Date().getFullYear();
  const paddedId = String(id).padStart(4, '0');
  return `PAT-${year}-${paddedId}`;
}

async function isDbConnected() {
  try {
    const health = await checkDatabaseConnection();
    return health.connected;
  } catch {
    return false;
  }
}

const patientRepository = {
  /**
   * Reset in-memory store (useful for tests)
   */
  _resetMemoryStore() {
    memoryPatients = [];
    nextPatientId = 1;
  },

  /**
   * List / search patients
   */
  async findAll({ search, dietitian_id, limit = 50, offset = 0, allowAll = false } = {}) {
    const connected = await isDbConnected();

    if (connected) {
      try {
        const pool = getPool();
        let query = `
          SELECT p.*,
            (SELECT COUNT(*) FROM patient_assessments pa WHERE pa.patient_id = p.id) as assessment_count,
            (SELECT json_build_object(
                'id', pa.id,
                'assessment_date', pa.assessment_date,
                'prakriti', pa.prakriti,
                'diet_goal', pa.diet_goal
              )
             FROM patient_assessments pa
             WHERE pa.patient_id = p.id
             ORDER BY pa.assessment_date DESC, pa.id DESC
             LIMIT 1
            ) as latest_assessment
          FROM patients p
        `;
        const params = [];
        const whereClauses = [];

        if (search) {
          params.push(`%${search}%`);
          whereClauses.push(`(p.name ILIKE $${params.length} OR p.patient_code ILIKE $${params.length} OR p.phone ILIKE $${params.length})`);
        }

        if (dietitian_id !== undefined && dietitian_id !== null) {
          params.push(parseInt(dietitian_id, 10));
          whereClauses.push(`p.dietitian_id = $${params.length}`);
        } else if (!allowAll) {
          whereClauses.push(`1 = 0`);
        }

        if (whereClauses.length > 0) {
          query += ` WHERE ` + whereClauses.join(' AND ');
        }

        query += ` ORDER BY p.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const res = await pool.query(query, params);
        return res.rows;
      } catch (err) {
        console.warn('[PatientRepository] DB query failed, falling back to memory:', err.message);
      }
    }

    // In-memory fallback
    let list = [...memoryPatients];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.patient_code && p.patient_code.toLowerCase().includes(q)) ||
          (p.phone && p.phone.toLowerCase().includes(q))
      );
    }
    if (dietitian_id !== undefined && dietitian_id !== null) {
      const targetId = parseInt(dietitian_id, 10);
      list = list.filter((p) => p.dietitian_id === targetId);
    } else if (!allowAll) {
      list = [];
    }
    return list.slice(offset, offset + limit);
  },

  /**
   * Find patient by ID, optionally verifying dietitian ownership directly in query
   */
  async findById(id, dietitian_id = null) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return null;
    const connected = await isDbConnected();

    if (connected) {
      try {
        const pool = getPool();
        let query = `SELECT p.*,
            (SELECT COUNT(*)::int FROM patient_assessments pa WHERE pa.patient_id = p.id) as assessment_count,
            (SELECT json_build_object(
                'id', pa.id,
                'assessment_date', pa.assessment_date,
                'prakriti', pa.prakriti,
                'diet_goal', pa.diet_goal
              )
             FROM patient_assessments pa
             WHERE pa.patient_id = p.id
             ORDER BY pa.assessment_date DESC, pa.id DESC
             LIMIT 1
            ) as latest_assessment
           FROM patients p WHERE p.id = $1`;
        const params = [numericId];
        if (dietitian_id !== null && dietitian_id !== undefined) {
          params.push(parseInt(dietitian_id, 10));
          query += ` AND (p.dietitian_id = $2 OR p.dietitian_id IS NULL)`;
        }
        const res = await pool.query(query, params);
        return res.rows[0] || null;
      } catch (err) {
        console.warn('[PatientRepository] DB findById failed, falling back to memory:', err.message);
      }
    }

    const patient = memoryPatients.find((p) => {
      if (p.id !== numericId) return false;
      if (dietitian_id !== null && dietitian_id !== undefined) {
        return p.dietitian_id === parseInt(dietitian_id, 10) || p.dietitian_id == null;
      }
      return true;
    });
    if (!patient) return null;
    const patientAssessments = (await assessmentRepository.findByPatientId(numericId)) || [];
    return {
      ...patient,
      assessment_count: patientAssessments.length,
      latest_assessment: patientAssessments[0] || patient.latest_assessment || null,
    };
  },

  /**
   * Find patient by patient code
   */
  async findByCode(patientCode) {
    if (!patientCode) return null;
    const connected = await isDbConnected();

    if (connected) {
      try {
        const pool = getPool();
        const res = await pool.query(`SELECT * FROM patients WHERE UPPER(patient_code) = UPPER($1)`, [patientCode]);
        return res.rows[0] || null;
      } catch (err) {
        console.warn('[PatientRepository] DB findByCode failed, falling back to memory:', err.message);
      }
    }

    return memoryPatients.find((p) => p.patient_code.toUpperCase() === patientCode.toUpperCase()) || null;
  },

  /**
   * Create new patient
   */
  async create(data) {
    const connected = await isDbConnected();
    const dietitianId = data.dietitian_id ? parseInt(data.dietitian_id, 10) : null;

    if (connected) {
      try {
        const pool = getPool();
        let code = data.patient_code;
        if (!code) {
          const countRes = await pool.query("SELECT nextval(pg_get_serial_sequence('patients', 'id')) as next_id");
          const nextId = countRes.rows[0].next_id;
          code = generatePatientCode(nextId);
          const insertRes = await pool.query(
            `INSERT INTO patients (id, patient_code, name, age, sex, occupation, phone, email, photo_url, dietitian_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
              nextId,
              code,
              data.name,
              data.age,
              data.sex,
              data.occupation || null,
              data.phone || null,
              data.email || null,
              data.photo_url || null,
              dietitianId,
            ]
          );
          return insertRes.rows[0];
        }

        const res = await pool.query(
          `INSERT INTO patients (patient_code, name, age, sex, occupation, phone, email, photo_url, dietitian_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            code,
            data.name,
            data.age,
            data.sex,
            data.occupation || null,
            data.phone || null,
            data.email || null,
            data.photo_url || null,
            dietitianId,
          ]
        );
        return res.rows[0];
      } catch (err) {
        console.warn('[PatientRepository] DB create failed, falling back to memory:', err.message);
      }
    }

    const id = nextPatientId++;
    const code = data.patient_code || generatePatientCode(id);
    const now = new Date().toISOString();

    const newPatient = {
      id,
      patient_code: code,
      name: data.name,
      age: parseInt(data.age, 10),
      sex: data.sex,
      occupation: data.occupation || '',
      phone: data.phone || '',
      email: data.email || '',
      photo_url: data.photo_url || '',
      dietitian_id: dietitianId,
      created_at: now,
      updated_at: now,
      assessment_count: 0,
      latest_assessment: null,
    };

    memoryPatients.unshift(newPatient);
    return newPatient;
  },

  /**
   * Update existing patient with owner verification and immutable ownership
   */
  async update(id, data, ownerDietitianId = null) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return null;
    const connected = await isDbConnected();

    if (connected) {
      try {
        const pool = getPool();
        const setClauses = [];
        const params = [];

        if (data.name !== undefined) {
          params.push(data.name ? data.name.trim() : '');
          setClauses.push(`name = $${params.length}`);
        }
        if (data.age !== undefined) {
          params.push(parseInt(data.age, 10));
          setClauses.push(`age = $${params.length}`);
        }
        if (data.sex !== undefined) {
          params.push(data.sex.toLowerCase());
          setClauses.push(`sex = $${params.length}`);
        }
        if (data.occupation !== undefined) {
          params.push(data.occupation ? data.occupation.trim() : null);
          setClauses.push(`occupation = $${params.length}`);
        }
        if (data.phone !== undefined) {
          params.push(data.phone ? data.phone.trim() : null);
          setClauses.push(`phone = $${params.length}`);
        }
        if (data.email !== undefined) {
          params.push(data.email ? data.email.trim() : null);
          setClauses.push(`email = $${params.length}`);
        }
        if (data.photo_url !== undefined) {
          params.push(data.photo_url || null);
          setClauses.push(`photo_url = $${params.length}`);
        }

        // Always update updated_at timestamp
        setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

        params.push(numericId);
        let query = `UPDATE patients SET ${setClauses.join(', ')} WHERE id = $${params.length}`;

        if (ownerDietitianId !== null && ownerDietitianId !== undefined) {
          params.push(parseInt(ownerDietitianId, 10));
          query += ` AND (dietitian_id = $${params.length} OR dietitian_id IS NULL)`;
        }

        query += ` RETURNING *`;
        const res = await pool.query(query, params);
        if (res.rows.length > 0) {
          // If in-memory copy exists, sync it
          const mem = memoryPatients.find((p) => p.id === numericId);
          if (mem) {
            Object.assign(mem, res.rows[0]);
          }
          return res.rows[0];
        }
        return null;
      } catch (err) {
        console.warn('[PatientRepository] DB update failed, falling back to memory:', err.message);
      }
    }

    const patient = memoryPatients.find((p) => {
      if (p.id !== numericId) return false;
      if (ownerDietitianId !== null && ownerDietitianId !== undefined) {
        return p.dietitian_id === parseInt(ownerDietitianId, 10) || p.dietitian_id == null;
      }
      return true;
    });
    if (!patient) return null;

    if (data.name !== undefined) patient.name = data.name;
    if (data.age !== undefined) patient.age = parseInt(data.age, 10);
    if (data.sex !== undefined) patient.sex = data.sex;
    if (data.occupation !== undefined) patient.occupation = data.occupation;
    if (data.phone !== undefined) patient.phone = data.phone;
    if (data.email !== undefined) patient.email = data.email;
    if (data.photo_url !== undefined) patient.photo_url = data.photo_url || null;
    patient.updated_at = new Date().toISOString();

    return patient;
  },

  /**
   * Delete patient with owner verification, DB transaction, and in-memory child record synchronization
   */
  async delete(id, ownerDietitianId = null) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return false;
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        let query = `DELETE FROM patients WHERE id = $1`;
        const params = [numericId];
        if (ownerDietitianId !== null && ownerDietitianId !== undefined) {
          params.push(parseInt(ownerDietitianId, 10));
          query += ` AND (dietitian_id = $2 OR dietitian_id IS NULL)`;
        }
        query += ` RETURNING id`;
        const res = await client.query(query, params);
        if (res.rowCount > 0) {
          await client.query('COMMIT');
          return true;
        } else {
          await client.query('ROLLBACK');
          return false;
        }
      } catch (err) {
        if (client) {
          try {
            await client.query('ROLLBACK');
          } catch (rbErr) {
            // ignore rollback error
          }
        }
        console.warn('[PatientRepository] DB delete failed:', err.message);
        throw err;
      } finally {
        if (client) {
          client.release();
        }
      }
    }

    const index = memoryPatients.findIndex((p) => {
      if (p.id !== numericId) return false;
      if (ownerDietitianId !== null && ownerDietitianId !== undefined) {
        return p.dietitian_id === parseInt(ownerDietitianId, 10) || p.dietitian_id == null;
      }
      return true;
    });
    if (index !== -1) {
      memoryPatients.splice(index, 1);
      // Synchronize in-memory cleanup across all child stores
      await Promise.all([
        assessmentRepository.deleteByPatientId(numericId),
        labDataRepository.deleteByPatientId(numericId),
        mealPlanRepository.deleteByPatientId(numericId),
        dietPlanRepository.deleteByPatientId(numericId),
      ]);
      return true;
    }
    return false;
  },

  /**
   * Get counts of dependent records (assessments, labs, meal plans, diet plans)
   */
  async getDependentCounts(id) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return { assessments: 0, labReports: 0, mealPlans: 0, dietPlans: 0, total: 0 };
    const connected = await isDbConnected();

    if (connected) {
      try {
        const pool = getPool();
        const res = await pool.query(
          `SELECT
            (SELECT COUNT(*)::int FROM patient_assessments WHERE patient_id = $1) as assessments,
            (SELECT COUNT(*)::int FROM clinical_lab_data WHERE patient_id = $1) as lab_reports,
            (SELECT COUNT(*)::int FROM meal_plans WHERE patient_id = $1) as meal_plans,
            (SELECT COUNT(*)::int FROM diet_plans WHERE patient_id = $1) as diet_plans`,
          [numericId]
        );
        const row = res.rows[0] || {};
        const assessments = row.assessments || 0;
        const labReports = row.lab_reports || 0;
        const mealPlans = row.meal_plans || 0;
        const dietPlans = row.diet_plans || 0;
        return {
          assessments,
          labReports,
          mealPlans,
          dietPlans,
          total: assessments + labReports + mealPlans + dietPlans,
        };
      } catch (err) {
        console.warn('[PatientRepository] DB getDependentCounts failed, falling back to memory:', err.message);
      }
    }

    const assessments = (await assessmentRepository.findByPatientId(numericId)).length;
    const labReports = (await labDataRepository.findByPatientId(numericId)).length;
    const mealPlans = (await mealPlanRepository.findByPatientId(numericId)).length;
    const dietPlans = (await dietPlanRepository.findByPatientId(numericId)).length;
    return {
      assessments,
      labReports,
      mealPlans,
      dietPlans,
      total: assessments + labReports + mealPlans + dietPlans,
    };
  },
};

module.exports = patientRepository;
