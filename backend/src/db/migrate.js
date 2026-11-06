const fs = require('fs');
const path = require('path');
const { getPool, checkDatabaseConnection } = require('../config/database');

async function runMigration() {
  const health = await checkDatabaseConnection();
  if (!health.connected) {
    console.warn('[Migration] PostgreSQL not reachable. Skipping migration until database is active.');
    return false;
  }

  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const pool = getPool();
  try {
    console.log('[Migration] Executing Phase 2 schema migrations...');
    await pool.query(sql);
    console.log('[Migration] Phase 2 schema created successfully.');
    return true;
  } catch (error) {
    console.error('[Migration Error]', error.message);
    throw error;
  }
}

if (require.main === module) {
  runMigration()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch(() => process.exit(1));
}

module.exports = { runMigration };
