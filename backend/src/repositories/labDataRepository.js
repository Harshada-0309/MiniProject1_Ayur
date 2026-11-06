const { getPool, checkDatabaseConnection } = require('../config/database');

let memoryLabData = [];
let nextLabId = 1;

async function isDbConnected() {
  const health = await checkDatabaseConnection();
  return health.connected;
}

const labDataRepository = {
  _resetMemoryStore() {
    memoryLabData = [];
    nextLabId = 1;
  },

  async findByAssessmentId(assessmentId) {
    const numericAssessmentId = parseInt(assessmentId, 10);
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      const res = await pool.query(
        `SELECT * FROM clinical_lab_data
         WHERE assessment_id = $1
         ORDER BY test_date DESC, id DESC`,
        [numericAssessmentId]
      );
      return res.rows;
    }

    return memoryLabData.filter((item) => item.assessment_id === numericAssessmentId);
  },

  async findById(id) {
    const numericId = parseInt(id, 10);
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      const res = await pool.query(`SELECT * FROM clinical_lab_data WHERE id = $1`, [numericId]);
      return res.rows[0] || null;
    }

    return memoryLabData.find((item) => item.id === numericId) || null;
  },

  async create(assessmentId, patientId, data) {
    const numericAssessmentId = parseInt(assessmentId, 10);
    const numericPatientId = parseInt(patientId, 10);
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      const res = await pool.query(
        `INSERT INTO clinical_lab_data (
          assessment_id, patient_id, test_name, value, unit, reference_range,
          test_date, source_laboratory, reported_flag, report_file_metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          numericAssessmentId,
          numericPatientId,
          data.test_name,
          String(data.value),
          data.unit || null,
          data.reference_range || null,
          data.test_date || null,
          data.source_laboratory || null,
          data.reported_flag !== undefined ? data.reported_flag : null,
          data.report_file_metadata ? JSON.stringify(data.report_file_metadata) : null,
        ]
      );
      return res.rows[0];
    }

    const id = nextLabId++;
    const now = new Date().toISOString();
    const newRecord = {
      id,
      assessment_id: numericAssessmentId,
      patient_id: numericPatientId,
      test_name: data.test_name,
      value: String(data.value),
      unit: data.unit || '',
      reference_range: data.reference_range || '',
      test_date: data.test_date || now.split('T')[0],
      source_laboratory: data.source_laboratory || '',
      reported_flag: data.reported_flag !== undefined ? data.reported_flag : null,
      report_file_metadata: data.report_file_metadata || null,
      created_at: now,
      updated_at: now,
    };

    memoryLabData.push(newRecord);
    return newRecord;
  },

  async update(id, data) {
    const numericId = parseInt(id, 10);
    const connected = await isDbConnected();

    const hasAttachmentField = Object.prototype.hasOwnProperty.call(data, 'report_file_metadata');
    const attachmentValue = data.report_file_metadata ? JSON.stringify(data.report_file_metadata) : null;
    const hasReportedFlag = Object.prototype.hasOwnProperty.call(data, 'reported_flag');

    if (connected) {
      const pool = getPool();
      const res = await pool.query(
        `UPDATE clinical_lab_data
         SET test_name = COALESCE($1, test_name),
             value = COALESCE($2, value),
             unit = COALESCE($3, unit),
             reference_range = COALESCE($4, reference_range),
             test_date = COALESCE($5, test_date),
             source_laboratory = COALESCE($6, source_laboratory),
             reported_flag = CASE WHEN $7::boolean THEN $8 ELSE reported_flag END,
             report_file_metadata = CASE WHEN $9::boolean THEN $10::jsonb ELSE report_file_metadata END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $11
         RETURNING *`,
        [
          data.test_name,
          data.value !== undefined ? String(data.value) : null,
          data.unit,
          data.reference_range,
          data.test_date,
          data.source_laboratory,
          hasReportedFlag,
          data.reported_flag !== undefined ? data.reported_flag : null,
          hasAttachmentField,
          attachmentValue,
          numericId,
        ]
      );
      return res.rows[0] || null;
    }

    const record = memoryLabData.find((item) => item.id === numericId);
    if (!record) return null;

    if (data.test_name !== undefined) record.test_name = data.test_name;
    if (data.value !== undefined) record.value = String(data.value);
    if (data.unit !== undefined) record.unit = data.unit;
    if (data.reference_range !== undefined) record.reference_range = data.reference_range;
    if (data.test_date !== undefined) record.test_date = data.test_date;
    if (data.source_laboratory !== undefined) record.source_laboratory = data.source_laboratory;
    if (hasReportedFlag) record.reported_flag = data.reported_flag;
    if (hasAttachmentField) record.report_file_metadata = data.report_file_metadata;
    record.updated_at = new Date().toISOString();

    return record;
  },

  async deleteAttachment(id) {
    const numericId = parseInt(id, 10);
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      const res = await pool.query(
        `UPDATE clinical_lab_data
         SET report_file_metadata = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [numericId]
      );
      return res.rows[0] || null;
    }

    const record = memoryLabData.find((item) => item.id === numericId);
    if (!record) return null;

    record.report_file_metadata = null;
    record.updated_at = new Date().toISOString();
    return record;
  },

  async delete(id) {
    const numericId = parseInt(id, 10);
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      const res = await pool.query(`DELETE FROM clinical_lab_data WHERE id = $1 RETURNING id`, [numericId]);
      return res.rowCount > 0;
    }

    const index = memoryLabData.findIndex((item) => item.id === numericId);
    if (index !== -1) {
      memoryLabData.splice(index, 1);
      return true;
    }
    return false;
  },

  async findByPatientId(patientId) {
    const numericPatientId = parseInt(patientId, 10);
    if (isNaN(numericPatientId)) return [];
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      const res = await pool.query(
        `SELECT * FROM clinical_lab_data
         WHERE patient_id = $1
         ORDER BY test_date DESC, id DESC`,
        [numericPatientId]
      );
      return res.rows;
    }

    return memoryLabData.filter((item) => item.patient_id === numericPatientId);
  },

  async deleteByPatientId(patientId) {
    const numericPatientId = parseInt(patientId, 10);
    if (isNaN(numericPatientId)) return false;
    const connected = await isDbConnected();

    if (connected) {
      const pool = getPool();
      await pool.query(`DELETE FROM clinical_lab_data WHERE patient_id = $1`, [numericPatientId]);
      return true;
    }

    memoryLabData = memoryLabData.filter((item) => item.patient_id !== numericPatientId);
    return true;
  },
};

module.exports = labDataRepository;
