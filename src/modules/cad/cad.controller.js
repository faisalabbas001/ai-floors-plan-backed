/**
 * CAD Controller
 * Handles HTTP requests for CAD file generation
 */

const cadService = require('./cad.service');
const { validateCadGenerate } = require('./cad.validation');
const ApiResponse = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Generate CAD files from floor plan data
 * POST /api/cad/generate
 */
async function generateCAD(req, res) {
  try {
    // Validate request body
    const validatedData = validateCadGenerate(req.body);

    const { planData, outputFormats, floorIndex, scale } = validatedData;

    // Validate plan data
    const validation = cadService.validatePlanData(planData);
    if (!validation.valid) {
      return ApiResponse.error(res, 'Invalid plan data', 400, validation.errors);
    }

    logger.info(`CAD generation requested by user ${req.user?.id}`, {
      buildingType: planData.buildingType,
      floorIndex,
      formats: outputFormats,
    });

    // Generate CAD files
    const result = await cadService.generateCADFiles(planData, {
      outputFormats,
      floorIndex,
      scale,
    });

    if (!result.success) {
      return ApiResponse.error(res, result.error || 'CAD generation failed', 500);
    }

    // Convert file content to base64 for JSON response
    const response = {
      success: true,
      files: {},
      metadata: result.metadata,
      warnings: result.warnings,
    };

    if (result.files.dxf) {
      response.files.dxf = {
        filename: result.files.dxf.filename,
        mimeType: result.files.dxf.mimeType,
        size: result.files.dxf.size,
        content: Buffer.from(result.files.dxf.content).toString('base64'),
        note: result.files.dxf.note,
      };
    }

    if (result.files.dwg) {
      response.files.dwg = {
        filename: result.files.dwg.filename,
        mimeType: result.files.dwg.mimeType,
        size: result.files.dwg.size,
        content: Buffer.isBuffer(result.files.dwg.content)
          ? result.files.dwg.content.toString('base64')
          : Buffer.from(result.files.dwg.content).toString('base64'),
        note: result.files.dwg.note,
      };
    }

    return ApiResponse.success(res, response, 'CAD files generated successfully');

  } catch (error) {
    logger.error(`CAD generation error: ${error.message}`, { stack: error.stack });

    if (error.name === 'ZodError') {
      return ApiResponse.error(res, 'Validation error', 400, error.errors);
    }

    return ApiResponse.error(res, error.message || 'CAD generation failed', 500);
  }
}

/**
 * Download CAD file directly (binary response)
 * GET /api/cad/download/:format
 */
async function downloadCAD(req, res) {
  try {
    const { format } = req.params;

    if (!['dxf', 'dwg'].includes(format)) {
      return ApiResponse.error(res, 'Invalid format. Use dxf or dwg.', 400);
    }

    // Plan data should be passed in query (base64 encoded) or session
    const planDataBase64 = req.query.plan;
    if (!planDataBase64) {
      return ApiResponse.error(res, 'Plan data required', 400);
    }

    const planData = JSON.parse(Buffer.from(planDataBase64, 'base64').toString());

    const result = await cadService.generateCADFiles(planData, {
      outputFormats: { dxf: format === 'dxf', dwg: format === 'dwg' },
      floorIndex: parseInt(req.query.floor) || 0,
      scale: parseFloat(req.query.scale) || 1,
    });

    if (!result.success) {
      return ApiResponse.error(res, result.error || 'Generation failed', 500);
    }

    const file = result.files[format];
    if (!file) {
      return ApiResponse.error(res, 'File not generated', 500);
    }

    // Set headers for file download
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Content-Length', file.size);

    // Send file content
    const content = Buffer.isBuffer(file.content)
      ? file.content
      : Buffer.from(file.content);

    return res.send(content);

  } catch (error) {
    logger.error(`CAD download error: ${error.message}`);
    return ApiResponse.error(res, error.message || 'Download failed', 500);
  }
}

/**
 * Get CAD generation status and stats
 * GET /api/cad/stats
 */
async function getStats(req, res) {
  try {
    const cacheStats = cadService.getCacheStats();

    return ApiResponse.success(res, {
      cache: cacheStats,
      supportedFormats: ['dxf', 'dwg'],
      dwgConversionAvailable: !!process.env.CLOUDCONVERT_API_KEY,
    }, 'CAD service stats');

  } catch (error) {
    logger.error(`CAD stats error: ${error.message}`);
    return ApiResponse.error(res, error.message, 500);
  }
}

/**
 * Generate DXF only (quick endpoint)
 * POST /api/cad/dxf
 */
async function generateDXFOnly(req, res) {
  try {
    const { planData, floorIndex = 0, scale = 1 } = req.body;

    if (!planData) {
      return ApiResponse.error(res, 'Plan data required', 400);
    }

    const validation = cadService.validatePlanData(planData);
    if (!validation.valid) {
      return ApiResponse.error(res, 'Invalid plan data', 400, validation.errors);
    }

    const result = await cadService.generateCADFiles(planData, {
      outputFormats: { dxf: true, dwg: false },
      floorIndex,
      scale,
    });

    if (!result.success || !result.files.dxf) {
      return ApiResponse.error(res, result.error || 'DXF generation failed', 500);
    }

    // Return DXF as direct download
    res.setHeader('Content-Type', 'application/dxf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.files.dxf.filename}"`);

    return res.send(result.files.dxf.content);

  } catch (error) {
    logger.error(`DXF generation error: ${error.message}`);
    return ApiResponse.error(res, error.message, 500);
  }
}

module.exports = {
  generateCAD,
  downloadCAD,
  getStats,
  generateDXFOnly,
};
