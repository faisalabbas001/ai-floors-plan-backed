/**
 * CAD Service
 * Handles floor plan to CAD file generation
 */

const { generateDXF } = require('./dxf.generator');
const { convertDXFtoDWG } = require('./dwg.converter');
const logger = require('../../utils/logger');

// In-memory cache for recent generations (5 minute TTL)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 50;

/**
 * Generate CAD files from floor plan data
 * @param {Object} planData - Generated floor plan JSON
 * @param {Object} options - Generation options
 * @returns {Object} - Generated files and metadata
 */
async function generateCADFiles(planData, options = {}) {
  const {
    outputFormats = { dxf: true, dwg: false },
    floorIndex = 0,
    scale = 1,
  } = options;

  const startTime = Date.now();
  const result = {
    success: true,
    files: {},
    metadata: {
      buildingType: planData.buildingType,
      floorLevel: planData.floors[floorIndex]?.level || 'Ground Floor',
      totalArea: planData.floors[floorIndex]?.totalArea || 0,
      roomCount: planData.floors[floorIndex]?.rooms?.length || 0,
      generatedAt: new Date().toISOString(),
      scale: scale,
    },
    warnings: [],
  };

  try {
    // Check cache
    const cacheKey = generateCacheKey(planData, floorIndex, scale);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.info('Returning cached CAD files');
      return cached.data;
    }

    // Validate floor exists
    if (!planData.floors || !planData.floors[floorIndex]) {
      throw new Error(`Floor index ${floorIndex} not found in plan data`);
    }

    // Generate DXF
    logger.info('Generating DXF file...');
    const dxfContent = generateDXF(planData, floorIndex, { scale });

    if (outputFormats.dxf) {
      result.files.dxf = {
        content: dxfContent,
        filename: generateFilename(planData, floorIndex, 'dxf'),
        mimeType: 'application/dxf',
        size: Buffer.byteLength(dxfContent, 'utf8'),
      };
      logger.info(`DXF generated: ${result.files.dxf.size} bytes`);
    }

    // Generate DWG if requested
    if (outputFormats.dwg) {
      logger.info('Converting to DWG format...');
      try {
        const dwgResult = await convertDXFtoDWG(dxfContent);

        if (dwgResult.format === 'dxf') {
          // Conversion failed, falling back to DXF
          result.warnings.push(dwgResult.message);
          result.files.dwg = {
            content: dwgResult.buffer,
            filename: generateFilename(planData, floorIndex, 'dxf'),
            mimeType: 'application/dxf',
            size: dwgResult.buffer.length,
            note: 'DWG conversion unavailable - DXF provided instead',
          };
        } else {
          result.files.dwg = {
            content: dwgResult,
            filename: generateFilename(planData, floorIndex, 'dwg'),
            mimeType: 'application/acad',
            size: dwgResult.length,
          };
        }
        logger.info(`DWG generated: ${result.files.dwg.size} bytes`);

      } catch (dwgError) {
        logger.warn(`DWG conversion failed: ${dwgError.message}`);
        result.warnings.push(`DWG conversion failed: ${dwgError.message}. DXF file is still available.`);

        // Provide DXF as fallback
        result.files.dwg = {
          content: Buffer.from(dxfContent),
          filename: generateFilename(planData, floorIndex, 'dxf'),
          mimeType: 'application/dxf',
          size: Buffer.byteLength(dxfContent, 'utf8'),
          note: 'DWG conversion failed - DXF provided instead (compatible with AutoCAD)',
        };
      }
    }

    // Add generation time to metadata
    result.metadata.generationTimeMs = Date.now() - startTime;

    // Cache the result
    cacheResult(cacheKey, result);

    logger.info(`CAD generation completed in ${result.metadata.generationTimeMs}ms`);
    return result;

  } catch (error) {
    logger.error(`CAD generation failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
      metadata: result.metadata,
    };
  }
}

/**
 * Generate filename for CAD files
 */
function generateFilename(planData, floorIndex, extension) {
  const buildingType = (planData.buildingType || 'floor-plan')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-');

  const floorLevel = (planData.floors[floorIndex]?.level || 'floor')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-');

  const timestamp = Date.now();

  return `${buildingType}-${floorLevel}-${timestamp}.${extension}`;
}

/**
 * Generate cache key for plan data
 */
function generateCacheKey(planData, floorIndex, scale) {
  const planStr = JSON.stringify({
    buildingType: planData.buildingType,
    dimensions: planData.buildingDimensions,
    floor: planData.floors[floorIndex],
    scale,
  });

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < planStr.length; i++) {
    const char = planStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `cad_${hash}_${floorIndex}_${scale}`;
}

/**
 * Cache result with TTL and size limit
 */
function cacheResult(key, data) {
  // Enforce max cache size
  if (cache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }

  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Clear cache (for testing or manual cleanup)
 */
function clearCache() {
  cache.clear();
  logger.info('CAD cache cleared');
}

/**
 * Get cache stats
 */
function getCacheStats() {
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    ttlMs: CACHE_TTL,
  };
}

/**
 * Validate plan data for CAD generation
 */
function validatePlanData(planData) {
  const errors = [];

  if (!planData) {
    errors.push('Plan data is required');
    return { valid: false, errors };
  }

  if (!planData.floors || !Array.isArray(planData.floors) || planData.floors.length === 0) {
    errors.push('Plan must have at least one floor');
  }

  planData.floors?.forEach((floor, index) => {
    if (!floor.rooms || !Array.isArray(floor.rooms) || floor.rooms.length === 0) {
      errors.push(`Floor ${index} must have at least one room`);
    }

    floor.rooms?.forEach((room, roomIndex) => {
      if (!room.name) {
        errors.push(`Floor ${index}, Room ${roomIndex}: name is required`);
      }
      if (!room.areaSqft || room.areaSqft <= 0) {
        errors.push(`Floor ${index}, Room ${roomIndex}: valid areaSqft is required`);
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  generateCADFiles,
  validatePlanData,
  clearCache,
  getCacheStats,
};
