const authService = require('./auth.service');
const { validateSignup, validateLogin } = require('./auth.validation');
const { asyncHandler } = require('../../middlewares/error.middleware');
const ApiResponse = require('../../utils/response');

const signup = asyncHandler(async (req, res) => {
  const validatedData = validateSignup(req.body);
  const result = await authService.signup(validatedData);

  return ApiResponse.created(res, result, 'User registered successfully');
});

const login = asyncHandler(async (req, res) => {
  const validatedData = validateLogin(req.body);
  const result = await authService.login(validatedData);

  return ApiResponse.success(res, result, 'Login successful');
});

const getProfile = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user.id);

  return ApiResponse.success(res, user, 'Profile retrieved successfully');
});

module.exports = {
  signup,
  login,
  getProfile,
};
