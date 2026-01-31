const express = require('express');
const cors = require('cors');
const { env } = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const authRoutes = require('./modules/auth/auth.routes');
const plannerRoutes = require('./modules/planner/planner.routes');
const cadRoutes = require('./modules/cad/cad.routes');
const logger = require('./utils/logger');

const app = express();

// CORS configuration - allow multiple origins
const allowedOrigins = [
  'http://localhost:3000',
  'https://ai-floors-plan-generators.vercel.app',
  env.CORS_ORIGIN,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'AI Floor Plan Generator API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      planner: '/api/planner',
      cad: '/api/cad',
    },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/cad', cadRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
