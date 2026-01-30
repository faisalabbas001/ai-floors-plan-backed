const jwt = require('jsonwebtoken');
const User = require('./auth.model');
const { env } = require('../../config/env');
const { AppError } = require('../../middlewares/error.middleware');
const logger = require('../../utils/logger');

class AuthService {
  async signup(userData) {
    const { name, email, password } = userData;

    // Check if email exists
    const emailExists = await User.emailExists(email);
    if (emailExists) {
      throw new AppError('Email already registered', 409);
    }

    const user = await User.create({
      name,
      email,
      password,
    });

    logger.info('User registered successfully', { userId: user.id, email });

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.created_at,
      },
      token,
    };
  }

  async login(credentials) {
    const { email, password } = credentials;

    const user = await User.findByEmail(email);
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isPasswordValid = await User.comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    logger.info('User logged in successfully', { userId: user.id, email });

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.created_at,
      },
      token,
    };
  }

  async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.created_at,
    };
  }

  generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      env.JWT_SECRET,
      {
        expiresIn: env.JWT_EXPIRES_IN,
      }
    );
  }
}

module.exports = new AuthService();
