const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,

  // PostgreSQL/Neon Database
  DATABASE_URL: process.env.DATABASE_URL,

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',

  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // CAD/DWG Conversion (optional - CloudConvert for DXF to DWG)
  CLOUDCONVERT_API_KEY: process.env.CLOUDCONVERT_API_KEY,

  // ODA File Converter path (optional - local DWG conversion)
  ODA_CONVERTER_PATH: process.env.ODA_CONVERTER_PATH,
};

const validateEnv = () => {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'OPENAI_API_KEY'];
  const missing = required.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

module.exports = { env, validateEnv };
