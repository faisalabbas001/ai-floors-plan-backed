/**
 * CAD Module Index
 * Exports all CAD-related functionality
 */

const cadRoutes = require('./cad.routes');
const cadController = require('./cad.controller');
const cadService = require('./cad.service');
const dxfGenerator = require('./dxf.generator');
const dwgConverter = require('./dwg.converter');
const { cadGenerateSchema, validateCadGenerate } = require('./cad.validation');

module.exports = {
  // Routes
  cadRoutes,

  // Controller
  cadController,

  // Service
  cadService,

  // Generators
  dxfGenerator,
  dwgConverter,

  // Validation
  cadGenerateSchema,
  validateCadGenerate,
};
