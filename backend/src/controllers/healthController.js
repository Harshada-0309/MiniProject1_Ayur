const { checkDatabaseConnection } = require('../config/database');
const config = require('../config/env');

/**
 * Health Controller
 * Provides system liveness and optional detailed dependency status (PostgreSQL & FastAPI AI Service)
 */
const getHealth = async (req, res) => {
  const responseData = {
    status: 'ok',
    service: 'ayurdiet-backend',
  };

  if (req.query.detailed === 'true' || req.headers['x-health-detail']) {
    const dbHealth = await checkDatabaseConnection();

    let aiConnected = false;
    try {
      const aiRes = await fetch(`${config.aiService.url}/health`, { signal: AbortSignal.timeout(2000) });
      aiConnected = aiRes.ok;
    } catch {
      aiConnected = false;
    }

    responseData.mode = config.env;
    responseData.port = config.port;
    responseData.database = {
      connected: dbHealth.connected,
      timestamp: dbHealth.timestamp || null,
    };
    responseData.ai_service = {
      connected: aiConnected,
    };
  }

  return res.status(200).json(responseData);
};

module.exports = {
  getHealth,
};
