const { Pool } = require('pg');
const { env } = require('./env');
const logger = require('../utils/logger');

let pool = null;

const connectDB = async () => {
  try {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Test connection
    const client = await pool.connect();
    logger.info(`PostgreSQL connected successfully`);

    // Create users table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    logger.info('Database tables initialized');
    client.release();

    return pool;
  } catch (error) {
    logger.error(`PostgreSQL connection failed: ${error.message || error}`);
    console.error('Full error:', error);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    if (pool) {
      await pool.end();
      logger.info('PostgreSQL connection closed');
    }
  } catch (error) {
    logger.error(`Error closing PostgreSQL connection: ${error.message}`);
  }
};

const getPool = () => pool;

module.exports = { connectDB, disconnectDB, getPool };
