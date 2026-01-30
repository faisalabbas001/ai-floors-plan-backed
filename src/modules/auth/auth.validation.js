const { z } = require('zod');

const signupSchema = z.object({
  name: z
    .string({
      required_error: 'Name is required',
    })
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .trim(),

  email: z
    .string({
      required_error: 'Email is required',
    })
    .email('Please provide a valid email')
    .toLowerCase()
    .trim(),

  password: z
    .string({
      required_error: 'Password is required',
    })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters'),
});

const loginSchema = z.object({
  email: z
    .string({
      required_error: 'Email is required',
    })
    .email('Please provide a valid email')
    .toLowerCase()
    .trim(),

  password: z
    .string({
      required_error: 'Password is required',
    })
    .min(1, 'Password is required'),
});

const validateSignup = (data) => signupSchema.parse(data);
const validateLogin = (data) => loginSchema.parse(data);

module.exports = {
  signupSchema,
  loginSchema,
  validateSignup,
  validateLogin,
};
