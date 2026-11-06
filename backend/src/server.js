const app = require('./app');
const config = require('./config/env');
const { closePool } = require('./config/database');
const { runMigration } = require('./db/migrate');
const { seedData } = require('./db/seed');
const dietitianRepository = require('./repositories/dietitianRepository');
const patientRepository = require('./repositories/patientRepository');
const { validateJwtSecret } = require('./services/authService');

// Verify mandatory production security requirements before opening network ports
try {
  validateJwtSecret();
} catch (secErr) {
  console.error('\n' + secErr.message + '\n');
  process.exit(1);
}

const server = app.listen(config.port, async () => {
  console.log(`[AyurDiet Backend] Running in ${config.env} mode on port ${config.port}`);
  console.log(`[AyurDiet Backend] Health endpoint: http://localhost:${config.port}/health`);
  console.log(`[AyurDiet Backend] Patients API: http://localhost:${config.port}/api/patients`);

  try {
    // 1. Run database migration automatically on startup
    await runMigration();

    // 2. Seed default authorized clinic dietitians into PostgreSQL
    await dietitianRepository.seedDefaults();

    // 3. Seed demo patients if database is fresh
    if (config.env === 'development') {
      const existing = await patientRepository.findAll({ limit: 1, allowAll: true });
      if (existing.length === 0) {
        await seedData();
      }
    }
  } catch (e) {
    console.warn('[AyurDiet Backend] Startup initialization warning:', e.message);
  }
});

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n[AyurDiet Backend] Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await closePool();
      console.log('[AyurDiet Backend] Database pool closed.');
      process.exit(0);
    } catch (err) {
      console.error('[AyurDiet Backend] Error during shutdown:', err);
      process.exit(1);
    }
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = server;
