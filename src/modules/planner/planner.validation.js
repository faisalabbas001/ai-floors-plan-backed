const { z } = require('zod');

const metaSchema = z
  .object({
    buildingType: z.string().optional(),
    city: z.string().optional(),
    authority: z.string().optional(),
    plotArea: z.number().positive('Plot area must be positive').optional(),
    floors: z.array(z.string()).optional(),
    budget: z.string().optional(),
    style: z.string().optional(),
    specialRequirements: z.array(z.string()).optional(),
  })
  .optional();

const generatePlanSchema = z.object({
  prompt: z
    .string({
      required_error: 'Prompt is required',
    })
    .min(10, 'Prompt must be at least 10 characters')
    .max(5000, 'Prompt cannot exceed 5000 characters')
    .trim(),

  meta: metaSchema,
});

const validateGeneratePlan = (data) => generatePlanSchema.parse(data);

module.exports = {
  generatePlanSchema,
  validateGeneratePlan,
};
