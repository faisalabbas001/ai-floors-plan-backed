const plannerService = require('./planner.service');
const { validateGeneratePlan } = require('./planner.validation');
const { asyncHandler } = require('../../middlewares/error.middleware');
const ApiResponse = require('../../utils/response');

const generatePlan = asyncHandler(async (req, res) => {
  const validatedData = validateGeneratePlan(req.body);
  const { prompt, meta } = validatedData;

  const result = await plannerService.generatePlan(prompt, meta);

  return ApiResponse.success(res, result, 'Plan generated successfully');
});

module.exports = {
  generatePlan,
};
