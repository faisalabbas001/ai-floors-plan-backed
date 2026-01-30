const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.unauthorized(res, 'Access token is required');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return ApiResponse.unauthorized(res, 'Access token is required');
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      email: decoded.email,
    };

    next();
  } catch (error) {
    logger.debug('Auth middleware error', { error: error.message });

    if (error.name === 'TokenExpiredError') {
      return ApiResponse.unauthorized(res, 'Token has expired');
    }

    if (error.name === 'JsonWebTokenError') {
      return ApiResponse.unauthorized(res, 'Invalid token');
    }

    return ApiResponse.unauthorized(res, 'Authentication failed');
  }
};

module.exports = authMiddleware;
