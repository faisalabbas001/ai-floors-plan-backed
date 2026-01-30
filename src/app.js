const express = require('express');
const cors = require('cors');
const { env } = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const authRoutes = require('./modules/auth/auth.routes');
const plannerRoutes = require('./modules/planner/planner.routes');
const logger = require('./utils/logger');

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
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
    },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/planner', plannerRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
