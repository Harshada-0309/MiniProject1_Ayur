const { Pool } = require('pg');
const config = require('./env');

/**
 * PostgreSQL Connection Pool Configuration Foundation
 * This provides the foundational connection pooling for AyurDiet entities:
 * - Dietitian
 * - Patient
 * - PatientAssessment
 * - ClinicalLabData
 * - Medication
 * - DietPlan
 * - DietPlanMeal
 * - DietitianReview
 */

let pool;

function getPool() {
  if (!pool) {
    const connectionConfig = config.database.url
      ? { connectionString: config.database.url }
      : {
          host: config.database.host,
          port: config.database.port,
          user: config.database.user,
          password: config.database.password,
          database: config.database.name,
        };

    pool = new Pool({
      ...connectionConfig,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL client error on idle client:', err.message);
    });
  }
  return pool;
}

/**
 * Execute a query with connection pooling
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 */
async function query(text, params) {
  const currentPool = getPool();
  const start = Date.now();
  const res = await currentPool.query(text, params);
  const duration = Date.now() - start;
  // SQL Logging: Disabled in production. Never log query parameters to prevent exposing
  // confidential patient records, clinical markers, password hashes, or security tokens.
  if (config.env === 'development' && process.env.DEBUG_SQL === 'true') {
    const sanitizedText = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : 'SQL Query';
    console.log('[SQL Debug]', { query: sanitizedText, durationMs: duration, rowCount: res.rowCount });
  }
  return res;
}

let lastCheckTime = 0;
let lastCheckResult = null;
const CACHE_TTL = 10000; // 10 seconds

/**
 * Health check test for PostgreSQL connection with fast-fail caching
 */
async function checkDatabaseConnection(force = false) {
  // In automated test environments without explicit PG flag, skip waiting for external DB
  if (process.env.NODE_ENV === 'test' && !process.env.TEST_WITH_PG) {
    return { connected: false, error: 'Test mode using in-memory repository store' };
  }

  const now = Date.now();
  if (!force && lastCheckResult && now - lastCheckTime < CACHE_TTL) {
    return lastCheckResult;
  }

  try {
    const currentPool = getPool();
    // Fast query with race condition timeout
    const queryPromise = currentPool.query('SELECT NOW()');
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('PostgreSQL connection timeout')), 4000)
    );

    const result = await Promise.race([queryPromise, timeoutPromise]);
    lastCheckTime = Date.now();
    lastCheckResult = {
      connected: true,
      timestamp: result.rows[0].now,
    };
    return lastCheckResult;
  } catch (error) {
    lastCheckTime = Date.now();
    lastCheckResult = {
      connected: false,
      error: error.message,
    };
    return lastCheckResult;
  }
}

/**
 * Gracefully close the database pool
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getPool,
  query,
  checkDatabaseConnection,
  closePool,
};
