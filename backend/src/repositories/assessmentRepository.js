const { getPool, checkDatabaseConnection } = require('../config/database');

let memoryAssessments = [];
let memoryMedications = [];
let nextAssessmentId = 1;
let nextMedicationId = 1;

async function isDbConnected() {
  const health = await checkDatabaseConnection();
  return health.connected;
}

const assessmentRepository = {
  _resetMemoryStore() {
    memoryAssessments = [];
    memoryMedications = [];
    nextAssessmentId = 1;
    nextMedicationId = 1;
  },

  /**
   * Find all assessments for a patient
   */
  async findByPatientId(patientId) {
    const numericPatientId = parseInt(patientId, 10);
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      const res = await pool.query(
        `SELECT pa.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', m.id,
                'medication_name', m.medication_name,
                'dosage', m.dosage,
                'frequency', m.frequency,
                'purpose', m.purpose
              )
            ) FILTER (WHERE m.id IS NOT NULL),
            '[]'
          ) as medications
         FROM patient_assessments pa
         LEFT JOIN medications m ON m.assessment_id = pa.id
         WHERE pa.patient_id = $1
         GROUP BY pa.id
         ORDER BY pa.assessment_date DESC, pa.id DESC`,
        [numericPatientId]
      );
      return res.rows;
    }

    // In-memory fallback
    const list = memoryAssessments.filter((a) => a.patient_id === numericPatientId);
    return list.map((a) => {
      const meds = memoryMedications.filter((m) => m.assessment_id === a.id);
      return { ...a, medications: meds };
    });
  },

  /**
   * Find assessment by ID (including medications and lab data)
   */
  async findById(id) {
    const numericId = parseInt(id, 10);
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      const res = await pool.query(
        `SELECT pa.*,
          COALESCE(
            (SELECT json_agg(json_build_object(
              'id', m.id,
              'medication_name', m.medication_name,
              'dosage', m.dosage,
              'frequency', m.frequency,
              'purpose', m.purpose
            )) FROM medications m WHERE m.assessment_id = pa.id),
            '[]'
          ) as medications,
          COALESCE(
            (SELECT json_agg(json_build_object(
              'id', c.id,
              'test_name', c.test_name,
              'value', c.value,
              'unit', c.unit,
              'reference_range', c.reference_range,
              'test_date', c.test_date,
              'source_laboratory', c.source_laboratory,
              'reported_flag', c.reported_flag,
              'report_file_metadata', c.report_file_metadata
            )) FROM clinical_lab_data c WHERE c.assessment_id = pa.id),
            '[]'
          ) as lab_data
         FROM patient_assessments pa
         WHERE pa.id = $1`,
        [numericId]
      );
      return res.rows[0] || null;
    }

    const assessment = memoryAssessments.find((a) => a.id === numericId);
    if (!assessment) return null;

    const meds = memoryMedications.filter((m) => m.assessment_id === numericId);
    // Lab data repository handles its own memory store, we can attach if queried
    return {
      ...assessment,
      medications: meds,
    };
  },

  /**
   * Create a new assessment
   */
  async create(patientId, data) {
    const numericPatientId = parseInt(patientId, 10);
    const connected = await isDbConnected();

    const medications = Array.isArray(data.medications) ? data.medications : [];

    if (connected) {
      const pool = getPool();
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const insertQuery = `
          INSERT INTO patient_assessments (
            patient_id, assessment_date, dietitian_id,
            height, weight, waist_circumference, weight_trend,
            diet_goal, target_weight, goal_notes,
            activity_level, exercise_type, exercise_frequency, exercise_duration,
            sleep_duration, sleep_quality, water_intake,
            diet_category, meal_frequency, meal_timings, food_preferences, foods_disliked,
            food_allergies, food_intolerances, dietary_restrictions,
            existing_conditions, medical_history, symptoms, supplements,
            prakriti, vikriti, appetite, digestion, bowel_habits, meal_regularity, season_ritu, dietitian_observations
          ) VALUES (
            $1, $2, $3,
            $4, $5, $6, $7,
            $8, $9, $10,
            $11, $12, $13, $14,
            $15, $16, $17,
            $18, $19, $20, $21, $22,
            $23, $24, $25,
            $26, $27, $28, $29,
            $30, $31, $32, $33, $34, $35, $36, $37
          ) RETURNING *;
        `;

        const values = [
          numericPatientId,
          data.assessment_date || new Date().toISOString().split('T')[0],
          data.dietitian_id || 'dietitian-primary',
          data.height ? parseFloat(data.height) : null,
          data.weight ? parseFloat(data.weight) : null,
          data.waist_circumference ? parseFloat(data.waist_circumference) : null,
          data.weight_trend || 'stable',
          data.diet_goal,
          data.target_weight ? parseFloat(data.target_weight) : null,
          data.goal_notes || null,
          data.activity_level || 'sedentary',
          data.exercise_type || null,
          data.exercise_frequency || null,
          data.exercise_duration || null,
          data.sleep_duration ? parseFloat(data.sleep_duration) : null,
          data.sleep_quality || 'good',
          data.water_intake ? parseFloat(data.water_intake) : null,
          data.diet_category,
          data.meal_frequency ? parseInt(data.meal_frequency, 10) : 3,
          JSON.stringify(data.meal_timings || []),
          data.food_preferences || null,
          data.foods_disliked || null,
          JSON.stringify(data.food_allergies || []),
          JSON.stringify(data.food_intolerances || []),
          JSON.stringify(data.dietary_restrictions || []),
          JSON.stringify(data.existing_conditions || []),
          data.medical_history || null,
          JSON.stringify(data.symptoms || []),
          data.supplements || null,
          data.prakriti,
          data.vikriti || null,
          data.appetite || 'Samagni (Balanced)',
          data.digestion || 'Normal',
          data.bowel_habits || 'Regular',
          data.meal_regularity || 'regular',
          data.season_ritu || 'Vasanta (Spring)',
          data.dietitian_observations || null,
        ];

        const assessmentRes = await client.query(insertQuery, values);
        const savedAssessment = assessmentRes.rows[0];

        // Insert medications (filter out empty placeholder rows)
        const savedMeds = [];
        for (const med of medications) {
          const medName = med?.medication_name ? med.medication_name.trim() : '';
          if (medName.length > 0) {
            const medRes = await client.query(
              `INSERT INTO medications (assessment_id, patient_id, medication_name, dosage, frequency, purpose)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING *`,
              [savedAssessment.id, numericPatientId, medName, med.dosage ? med.dosage.trim() : null, med.frequency ? med.frequency.trim() : null, med.purpose ? med.purpose.trim() : null]
            );
            savedMeds.push(medRes.rows[0]);
          }
        }

        await client.query('COMMIT');
        savedAssessment.medications = savedMeds;
        savedAssessment.lab_data = [];
        return savedAssessment;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory fallback
    const id = nextAssessmentId++;
    const now = new Date().toISOString();

    const newAssessment = {
      id,
      patient_id: numericPatientId,
      assessment_date: data.assessment_date || now.split('T')[0],
      dietitian_id: data.dietitian_id || 'dietitian-primary',
      height: data.height ? parseFloat(data.height) : null,
      weight: data.weight ? parseFloat(data.weight) : null,
      waist_circumference: data.waist_circumference ? parseFloat(data.waist_circumference) : null,
      weight_trend: data.weight_trend || 'stable',
      diet_goal: data.diet_goal,
      target_weight: data.target_weight ? parseFloat(data.target_weight) : null,
      goal_notes: data.goal_notes || '',
      activity_level: data.activity_level || 'sedentary',
      exercise_type: data.exercise_type || '',
      exercise_frequency: data.exercise_frequency || '',
      exercise_duration: data.exercise_duration || '',
      sleep_duration: data.sleep_duration ? parseFloat(data.sleep_duration) : null,
      sleep_quality: data.sleep_quality || 'good',
      water_intake: data.water_intake ? parseFloat(data.water_intake) : null,
      diet_category: data.diet_category,
      meal_frequency: data.meal_frequency ? parseInt(data.meal_frequency, 10) : 3,
      meal_timings: data.meal_timings || [],
      food_preferences: data.food_preferences || '',
      foods_disliked: data.foods_disliked || '',
      food_allergies: data.food_allergies || [],
      food_intolerances: data.food_intolerances || [],
      dietary_restrictions: data.dietary_restrictions || [],
      existing_conditions: data.existing_conditions || [],
      medical_history: data.medical_history || '',
      symptoms: data.symptoms || [],
      supplements: data.supplements || '',
      prakriti: data.prakriti,
      vikriti: data.vikriti || '',
      appetite: data.appetite || 'Samagni (Balanced)',
      digestion: data.digestion || 'Normal',
      bowel_habits: data.bowel_habits || 'Regular',
      meal_regularity: data.meal_regularity || 'regular',
      season_ritu: data.season_ritu || 'Vasanta (Spring)',
      dietitian_observations: data.dietitian_observations || '',
      created_at: now,
      updated_at: now,
    };

    memoryAssessments.push(newAssessment);

    const savedMeds = [];
    medications.forEach((med) => {
      if (med.medication_name) {
        const medId = nextMedicationId++;
        const newMed = {
          id: medId,
          assessment_id: id,
          patient_id: numericPatientId,
          medication_name: med.medication_name,
          dosage: med.dosage || '',
          frequency: med.frequency || '',
          purpose: med.purpose || '',
          created_at: now,
        };
        memoryMedications.push(newMed);
        savedMeds.push(newMed);
      }
    });

    return {
      ...newAssessment,
      medications: savedMeds,
      lab_data: [],
    };
  },

  /**
   * Update an existing assessment
   */
  async update(id, data) {
    const numericId = parseInt(id, 10);
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const updateQuery = `
          UPDATE patient_assessments
          SET
            assessment_date = COALESCE($1, assessment_date),
            height = COALESCE($2, height),
            weight = COALESCE($3, weight),
            waist_circumference = COALESCE($4, waist_circumference),
            weight_trend = COALESCE($5, weight_trend),
            diet_goal = COALESCE($6, diet_goal),
            target_weight = COALESCE($7, target_weight),
            goal_notes = COALESCE($8, goal_notes),
            activity_level = COALESCE($9, activity_level),
            exercise_type = COALESCE($10, exercise_type),
            exercise_frequency = COALESCE($11, exercise_frequency),
            exercise_duration = COALESCE($12, exercise_duration),
            sleep_duration = COALESCE($13, sleep_duration),
            sleep_quality = COALESCE($14, sleep_quality),
            water_intake = COALESCE($15, water_intake),
            diet_category = COALESCE($16, diet_category),
            meal_frequency = COALESCE($17, meal_frequency),
            meal_timings = COALESCE($18, meal_timings),
            food_preferences = COALESCE($19, food_preferences),
            foods_disliked = COALESCE($20, foods_disliked),
            food_allergies = COALESCE($21, food_allergies),
            food_intolerances = COALESCE($22, food_intolerances),
            dietary_restrictions = COALESCE($23, dietary_restrictions),
            existing_conditions = COALESCE($24, existing_conditions),
            medical_history = COALESCE($25, medical_history),
            symptoms = COALESCE($26, symptoms),
            supplements = COALESCE($27, supplements),
            prakriti = COALESCE($28, prakriti),
            vikriti = COALESCE($29, vikriti),
            appetite = COALESCE($30, appetite),
            digestion = COALESCE($31, digestion),
            bowel_habits = COALESCE($32, bowel_habits),
            meal_regularity = COALESCE($33, meal_regularity),
            season_ritu = COALESCE($34, season_ritu),
            dietitian_observations = COALESCE($35, dietitian_observations),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $36
          RETURNING *;
        `;

        const values = [
          data.assessment_date,
          data.height !== undefined ? parseFloat(data.height) : null,
          data.weight !== undefined ? parseFloat(data.weight) : null,
          data.waist_circumference !== undefined ? parseFloat(data.waist_circumference) : null,
          data.weight_trend,
          data.diet_goal,
          data.target_weight !== undefined ? parseFloat(data.target_weight) : null,
          data.goal_notes,
          data.activity_level,
          data.exercise_type,
          data.exercise_frequency,
          data.exercise_duration,
          data.sleep_duration !== undefined ? parseFloat(data.sleep_duration) : null,
          data.sleep_quality,
          data.water_intake !== undefined ? parseFloat(data.water_intake) : null,
          data.diet_category,
          data.meal_frequency !== undefined ? parseInt(data.meal_frequency, 10) : null,
          data.meal_timings ? JSON.stringify(data.meal_timings) : null,
          data.food_preferences,
          data.foods_disliked,
          data.food_allergies ? JSON.stringify(data.food_allergies) : null,
          data.food_intolerances ? JSON.stringify(data.food_intolerances) : null,
          data.dietary_restrictions ? JSON.stringify(data.dietary_restrictions) : null,
          data.existing_conditions ? JSON.stringify(data.existing_conditions) : null,
          data.medical_history,
          data.symptoms ? JSON.stringify(data.symptoms) : null,
          data.supplements,
          data.prakriti,
          data.vikriti,
          data.appetite,
          data.digestion,
          data.bowel_habits,
          data.meal_regularity,
          data.season_ritu,
          data.dietitian_observations,
          numericId,
        ];

        const res = await client.query(updateQuery, values);
        if (res.rows.length === 0) {
          await client.query('ROLLBACK');
          return null;
        }

        const updatedAssessment = res.rows[0];

        // If medications array is provided in update, sync medications
        if (Array.isArray(data.medications)) {
          await client.query('DELETE FROM medications WHERE assessment_id = $1', [numericId]);
          const savedMeds = [];
          for (const med of data.medications) {
            const medName = med?.medication_name ? med.medication_name.trim() : '';
            if (medName.length > 0) {
              const medRes = await client.query(
                `INSERT INTO medications (assessment_id, patient_id, medication_name, dosage, frequency, purpose)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [numericId, updatedAssessment.patient_id, medName, med.dosage ? med.dosage.trim() : null, med.frequency ? med.frequency.trim() : null, med.purpose ? med.purpose.trim() : null]
              );
              savedMeds.push(medRes.rows[0]);
            }
          }
          updatedAssessment.medications = savedMeds;
        }

        await client.query('COMMIT');
        return updatedAssessment;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory fallback
    const assessment = memoryAssessments.find((a) => a.id === numericId);
    if (!assessment) return null;

    Object.keys(data).forEach((key) => {
      if (key !== 'id' && key !== 'patient_id' && key !== 'medications' && data[key] !== undefined) {
        assessment[key] = data[key];
      }
    });
    assessment.updated_at = new Date().toISOString();

    if (Array.isArray(data.medications)) {
      memoryMedications = memoryMedications.filter((m) => m.assessment_id !== numericId);
      const savedMeds = [];
      data.medications.forEach((med) => {
        const medName = med?.medication_name ? med.medication_name.trim() : '';
        if (medName.length > 0) {
          const newMed = {
            id: nextMedicationId++,
            assessment_id: numericId,
            patient_id: assessment.patient_id,
            medication_name: medName,
            dosage: med.dosage ? med.dosage.trim() : '',
            frequency: med.frequency ? med.frequency.trim() : '',
            purpose: med.purpose ? med.purpose.trim() : '',
            created_at: new Date().toISOString(),
          };
          memoryMedications.push(newMed);
          savedMeds.push(newMed);
        }
      });
      assessment.medications = savedMeds;
    } else {
      assessment.medications = memoryMedications.filter((m) => m.assessment_id === numericId);
    }

    return assessment;
  },

  /**
   * Delete all assessments and related medications for a patient
   */
  async deleteByPatientId(patientId) {
    const numericPatientId = parseInt(patientId, 10);
    if (isNaN(numericPatientId)) return false;
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      await pool.query('DELETE FROM patient_assessments WHERE patient_id = $1', [numericPatientId]);
      return true;
    }

    const assessmentIds = memoryAssessments
      .filter((a) => a.patient_id === numericPatientId)
      .map((a) => a.id);
    memoryMedications = memoryMedications.filter(
      (m) => !assessmentIds.includes(m.assessment_id) && m.patient_id !== numericPatientId
    );
    memoryAssessments = memoryAssessments.filter((a) => a.patient_id !== numericPatientId);
    return true;
  },
};

module.exports = assessmentRepository;
