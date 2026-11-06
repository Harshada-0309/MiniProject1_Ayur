const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from root or backend-specific .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config(); // fallback to local .env if present

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  database: {
    url: process.env.DATABASE_URL || 'postgresql://ayurdiet_user:ayurdiet_password@localhost:5432/ayurdiet_db',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'ayurdiet_user',
    password: process.env.DB_PASSWORD || 'ayurdiet_password',
    name: process.env.DB_NAME || 'ayurdiet_db',
  },
  aiService: {
    url: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  },
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
};

module.exports = config;
