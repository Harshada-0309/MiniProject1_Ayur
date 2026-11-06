const { getPool, checkDatabaseConnection } = require('../config/database');

// In-memory fallback store for offline tests and development
let memoryAuditLogs = [];
let nextLogId = 1;

async function isDbConnected() {
  try {
    const health = await checkDatabaseConnection();
    return health.connected;
  } catch {
    return false;
  }
}

const whatsappAuditRepository = {
  _resetMemoryStore() {
    memoryAuditLogs = [];
    nextLogId = 1;
  },

  async create({
    plan_id,
    patient_id,
    dietitian_id,
    recipient_phone,
    masked_phone,
    delivery_method,
    status,
    message_id = null,
    error_message = null,
    plan_version = '1.0',
  }) {
    const connected = await isDbConnected();

    if (connected) {
      try {
        const pool = getPool();
        const res = await pool.query(
          `INSERT INTO whatsapp_audit_logs 
           (plan_id, patient_id, dietitian_id, recipient_phone, masked_phone, delivery_method, status, message_id, error_message, plan_version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            plan_id,
            patient_id,
            dietitian_id || null,
            recipient_phone,
            masked_phone,
            delivery_method,
            status,
            message_id,
            error_message,
            plan_version,
          ]
        );
        return res.rows[0];
      } catch (err) {
        console.warn('[WhatsappAuditRepository] DB insert failed, falling back to memory:', err.message);
      }
    }

    const log = {
      id: nextLogId++,
      plan_id,
      patient_id,
      dietitian_id: dietitian_id || null,
      recipient_phone,
      masked_phone,
      delivery_method,
      status,
      message_id,
      error_message,
      plan_version,
      created_at: new Date().toISOString(),
    };
    memoryAuditLogs.push(log);
    return log;
  },

  async findByPlanId(planId) {
    const numericId = parseInt(planId, 10);
    const connected = await isDbConnected();

    if (connected) {
      try {
        const pool = getPool();
        const res = await pool.query(
          `SELECT wal.*, d.name as dietitian_name
           FROM whatsapp_audit_logs wal
           LEFT JOIN dietitians d ON d.id = wal.dietitian_id
           WHERE wal.plan_id = $1
           ORDER BY wal.created_at DESC`,
          [numericId]
        );
        return res.rows;
      } catch (err) {
        console.warn('[WhatsappAuditRepository] DB query failed, falling back to memory:', err.message);
      }
    }

    return memoryAuditLogs
      .filter((l) => l.plan_id === numericId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
};

module.exports = whatsappAuditRepository;

