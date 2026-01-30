const { env } = require('../config/env');

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const colors = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[35m',
  reset: '\x1b[0m',
};

const formatMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const colorCode = colors[level] || colors.reset;
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';

  if (env.NODE_ENV === 'production') {
    return JSON.stringify({ timestamp, level, message, ...meta });
  }

  return `${colorCode}[${timestamp}] [${level.toUpperCase()}]${colors.reset} ${message}${metaStr}`;
};

const shouldLog = (level) => {
  const currentLevel = env.NODE_ENV === 'production' ? 'info' : 'debug';
  return levels[level] <= levels[currentLevel];
};

const logger = {
  error: (message, meta) => {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message, meta));
    }
  },

  warn: (message, meta) => {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, meta));
    }
  },

  info: (message, meta) => {
    if (shouldLog('info')) {
      console.log(formatMessage('info', message, meta));
    }
  },

  debug: (message, meta) => {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message, meta));
    }
  },
};

module.exports = logger;
