const bcrypt = require('bcrypt');
const { getPool } = require('../../config/db');

// User model for PostgreSQL
const User = {
  // Create a new user
  async create({ name, email, password }) {
    const pool = getPool();
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at, updated_at`,
      [name, email, hashedPassword]
    );

    return result.rows[0];
  },

  // Find user by email
  async findByEmail(email) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, name, email, password, created_at, updated_at
       FROM users WHERE email = $1`,
      [email]
    );
    return result.rows[0] || null;
  },

  // Find user by ID
  async findById(id) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, name, email, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  // Compare password
  async comparePassword(candidatePassword, hashedPassword) {
    return bcrypt.compare(candidatePassword, hashedPassword);
  },

  // Check if email exists
  async emailExists(email) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    );
    return result.rows.length > 0;
  },
};

module.exports = User;
