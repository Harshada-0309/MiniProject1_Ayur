const express = require('express');
const cors = require('cors');
const path = require('path');
const healthRoutes = require('./routes/healthRoutes');
const patientRoutes = require('./routes/patientRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const labDataRoutes = require('./routes/labDataRoutes');
const nutritionRoutes = require('./routes/nutritionRoutes');
const ragRoutes = require('./routes/ragRoutes');
const authRoutes = require('./routes/authRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const mealPlanRoutes = require('./routes/mealPlanRoutes');
const dietPlanRoutes = require('./routes/dietPlanRoutes');
const errorHandler = require('./middleware/errorHandler');
const { authenticateDietitian } = require('./middleware/authMiddleware');
const config = require('./config/env');

const app = express();

// Configure strict CORS: Whitelist explicit frontend origins in production, permit local dev in development
const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile app, server-to-server, curl, automated testing) with no origin header
    if (!origin) {
      return callback(null, true);
    }

    const isProduction = process.env.NODE_ENV === 'production' || config.env === 'production';
    const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    // Whitelist production Vercel frontend deployments
    const defaultProductionOrigins = [
      'https://mini-project1-ayur.vercel.app',
      'https://miniproject1-ayur.vercel.app',
    ];

    for (const dpo of defaultProductionOrigins) {
      if (!configuredOrigins.includes(dpo)) {
        configuredOrigins.push(dpo);
      }
    }

    if (process.env.FRONTEND_URL && !configuredOrigins.includes(process.env.FRONTEND_URL)) {
      configuredOrigins.push(process.env.FRONTEND_URL);
    }
    if (config.frontend?.url && !configuredOrigins.includes(config.frontend.url)) {
      configuredOrigins.push(config.frontend.url);
    }

    // Check explicitly configured origins
    if (configuredOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In non-production environments (development / test), allow standard local development hosts and ports
    if (!isProduction) {
      const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (isLocalhost) {
        return callback(null, true);
      }
    }

    // In production or unapproved origins, reject without wildcard fallback
    return callback(new Error(`CORS blocked: Origin '${origin}' is not authorized.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-enforce-auth'],
};

// Middlewares
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Static file serving for uploaded practitioner & patient photographs
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health Check Routes
app.use('/', healthRoutes);

// Authentication Routes (Public login & dietitian list, Protected me/profile/logout)
app.use('/api/auth', authRoutes);

// Photo Upload Routes (Protected with Multer & disk storage)
app.use('/api/upload', uploadRoutes);

// Phase 2: Dietitian Patient Assessment REST APIs (Protected)
app.use('/api/patients', authenticateDietitian, patientRoutes);
app.use('/api/assessments', authenticateDietitian, assessmentRoutes);
app.use('/api/lab-data', authenticateDietitian, labDataRoutes);

// Phase 3: Deterministic Nutrition Calculation Engine APIs (Protected)
app.use('/api/nutrition', authenticateDietitian, nutritionRoutes);

// Phase 4: Hybrid RAG Knowledge Retrieval Layer APIs (Protected)
app.use('/api/rag', authenticateDietitian, ragRoutes);

// Phase 5: Food & Meal Planning Engine APIs (Protected)
app.use('/api/meal-plan', authenticateDietitian, mealPlanRoutes);

// Phase 6: Gemini-Powered 7-Day Diet Plan APIs (Protected)
app.use('/api/diet-plan', authenticateDietitian, dietPlanRoutes);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
