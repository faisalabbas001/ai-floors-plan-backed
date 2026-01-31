const { z } = require('zod');

// CAD generation request validation schema
const cadGenerateSchema = z.object({
  planData: z.object({
    buildingType: z.string().min(1),
    totalArea: z.number().optional(),
    buildingDimensions: z.object({
      width: z.number().positive().max(1000),
      depth: z.number().positive().max(1000),
    }).optional(),
    floors: z.array(z.object({
      level: z.string(),
      totalArea: z.number().optional(),
      floorHeight: z.number().optional(),
      rooms: z.array(z.object({
        id: z.string().optional(),
        name: z.string(),
        type: z.string(),
        areaSqft: z.number().positive(),
        dimensions: z.object({
          length: z.number().positive().max(500),
          width: z.number().positive().max(500),
        }).optional(),
        position: z.object({
          x: z.number().min(0),
          y: z.number().min(0),
        }).optional(),
        doors: z.array(z.object({
          id: z.string().optional(),
          wall: z.enum(['north', 'south', 'east', 'west']),
          position: z.number(),
          width: z.number().positive(),
          type: z.string().optional(),
          swingDirection: z.string().optional(),
        })).optional(),
        windows: z.array(z.object({
          id: z.string().optional(),
          wall: z.enum(['north', 'south', 'east', 'west']),
          position: z.number(),
          width: z.number().positive(),
          height: z.number().optional(),
          type: z.string().optional(),
        })).optional(),
        features: z.array(z.string()).optional(),
      })),
    })).min(1).max(20),
    designNotes: z.array(z.string()).optional(),
  }),
  outputFormats: z.object({
    dxf: z.boolean().default(true),
    dwg: z.boolean().default(false),
  }).refine(data => data.dxf || data.dwg, {
    message: 'At least one output format must be selected',
  }),
  floorIndex: z.number().min(0).default(0),
  scale: z.number().positive().max(100).default(1), // 1 foot = 1 unit
});

// Validate CAD generation request
const validateCadGenerate = (data) => {
  return cadGenerateSchema.parse(data);
};

module.exports = {
  cadGenerateSchema,
  validateCadGenerate,
};
