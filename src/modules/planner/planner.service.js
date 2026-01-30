const { openai } = require('../../config/openai');
const { env } = require('../../config/env');
const { SYSTEM_PROMPT, buildUserPrompt } = require('./planner.prompt');
const { AppError } = require('../../middlewares/error.middleware');
const logger = require('../../utils/logger');

// Configuration for more accurate and reliable generation
const AI_CONFIG = {
  temperature: 0.3, // Lower temperature for more deterministic, accurate outputs
  maxTokens: 8192, // Increased for detailed plans
  maxRetries: 3,
  retryDelay: 1000, // ms
};

class PlannerService {
  constructor() {
    // Simple in-memory cache for identical prompts (optional optimization)
    this.responseCache = new Map();
    this.cacheMaxAge = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Generate architectural plan with retry logic and validation
   */
  async generatePlan(prompt, meta = {}) {
    const userPrompt = buildUserPrompt(prompt, meta);
    const cacheKey = this.getCacheKey(prompt, meta);

    // Check cache for identical recent requests
    const cachedResponse = this.getFromCache(cacheKey);
    if (cachedResponse) {
      logger.debug('Returning cached plan');
      return cachedResponse;
    }

    logger.debug('Generating architectural plan', {
      promptLength: prompt.length,
      hasMeta: Object.keys(meta).length > 0,
      buildingType: meta.buildingType,
    });

    let lastError = null;

    // Retry loop for reliability
    for (let attempt = 1; attempt <= AI_CONFIG.maxRetries; attempt++) {
      try {
        const response = await openai.chat.completions.create({
          model: env.OPENAI_MODEL,
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: AI_CONFIG.temperature,
          max_tokens: AI_CONFIG.maxTokens,
        });

        const content = response.choices[0]?.message?.content;

        if (!content) {
          throw new AppError('Failed to generate plan: Empty response from AI', 500);
        }

        // Parse and validate the response
        const plan = this.parseAndValidateResponse(content, meta);

        // Additional geometric validation
        const validationResult = this.validatePlanGeometry(plan);
        if (!validationResult.valid) {
          logger.warn('Plan geometry validation failed', {
            attempt,
            errors: validationResult.errors,
          });

          // If validation fails but we have retries left, try again
          if (attempt < AI_CONFIG.maxRetries) {
            await this.delay(AI_CONFIG.retryDelay * attempt);
            continue;
          }

          // On last attempt, return with warnings but don't fail
          plan.validationWarnings = validationResult.errors;
        }

        logger.info('Architectural plan generated successfully', {
          buildingType: plan.buildingType,
          floorsCount: plan.floors?.length || 0,
          totalArea: plan.totalArea,
          attempt,
        });

        const result = {
          plan,
          usage: {
            promptTokens: response.usage?.prompt_tokens,
            completionTokens: response.usage?.completion_tokens,
            totalTokens: response.usage?.total_tokens,
          },
        };

        // Cache successful response
        this.setCache(cacheKey, result);

        return result;
      } catch (error) {
        lastError = error;

        if (error instanceof AppError) {
          // Don't retry for known errors
          if (error.statusCode === 400 || error.statusCode === 503) {
            throw error;
          }
        }

        logger.warn(`Generation attempt ${attempt} failed`, {
          message: error.message,
          code: error.code,
        });

        // Check for non-retryable API errors
        if (error.code === 'insufficient_quota') {
          throw new AppError('AI service quota exceeded. Please try again later.', 503);
        }

        if (error.code === 'context_length_exceeded') {
          throw new AppError('Request too large. Please simplify your requirements.', 400);
        }

        // Wait before retry (exponential backoff)
        if (attempt < AI_CONFIG.maxRetries) {
          await this.delay(AI_CONFIG.retryDelay * attempt);
        }
      }
    }

    // All retries exhausted
    logger.error('All generation attempts failed', {
      message: lastError?.message,
      code: lastError?.code,
    });

    if (lastError?.code === 'rate_limit_exceeded') {
      throw new AppError('Too many requests. Please wait and try again.', 429);
    }

    throw new AppError('Failed to generate architectural plan after multiple attempts. Please try again.', 500);
  }

  /**
   * Parse JSON response and validate required fields
   */
  parseAndValidateResponse(content, meta = {}) {
    try {
      const plan = JSON.parse(content);

      // Required field validation
      if (!plan.buildingType) {
        plan.buildingType = meta.buildingType || 'Residential';
      }

      if (!plan.floors || !Array.isArray(plan.floors)) {
        throw new Error('Missing or invalid floors array in response');
      }

      if (plan.floors.length === 0) {
        throw new Error('Plan must have at least one floor');
      }

      // Ensure each floor has required fields
      plan.floors.forEach((floor, floorIndex) => {
        if (!floor.level) {
          floor.level = floorIndex === 0 ? 'Ground' : `Floor ${floorIndex}`;
        }

        if (!floor.rooms || !Array.isArray(floor.rooms)) {
          throw new Error(`Floor ${floor.level} is missing rooms array`);
        }

        if (floor.rooms.length === 0) {
          throw new Error(`Floor ${floor.level} must have at least one room`);
        }

        // Validate and normalize each room
        floor.rooms.forEach((room, roomIndex) => {
          // Ensure room has an ID
          if (!room.id) {
            room.id = `room-${floorIndex}-${roomIndex}`;
          }

          // Ensure room has a name
          if (!room.name) {
            room.name = room.type || `Room ${roomIndex + 1}`;
          }

          // Ensure room has a type
          if (!room.type) {
            room.type = this.inferRoomType(room.name);
          }

          // Calculate area if missing
          if (!room.areaSqft && room.dimensions) {
            room.areaSqft = Math.round(room.dimensions.length * room.dimensions.width);
          }

          // Ensure dimensions exist
          if (!room.dimensions && room.areaSqft) {
            const side = Math.sqrt(room.areaSqft);
            room.dimensions = {
              length: Math.round(side),
              width: Math.round(side),
            };
          }

          // Ensure position exists (default to 0,0 if missing)
          if (!room.position) {
            room.position = { x: 0, y: 0 };
          }

          // Ensure doors array exists
          if (!room.doors) {
            room.doors = [];
          }

          // Ensure windows array exists
          if (!room.windows) {
            room.windows = [];
          }
        });

        // Calculate floor total area if missing
        if (!floor.totalArea) {
          floor.totalArea = floor.rooms.reduce((sum, room) => sum + (room.areaSqft || 0), 0);
        }
      });

      // Calculate building dimensions if missing
      if (!plan.buildingDimensions) {
        plan.buildingDimensions = this.calculateBuildingDimensions(plan.floors[0].rooms);
      }

      // Calculate total area if missing
      if (!plan.totalArea) {
        plan.totalArea = plan.floors.reduce((sum, floor) => sum + (floor.totalArea || 0), 0);
      }

      // Ensure exterior object exists
      if (!plan.exterior) {
        plan.exterior = {
          mainEntrance: { wall: 'south', position: 0 },
          style: 'modern',
        };
      }

      // Ensure designNotes exists
      if (!plan.designNotes) {
        plan.designNotes = [];
      }

      return plan;
    } catch (error) {
      logger.error('Failed to parse AI response', {
        error: error.message,
        contentPreview: content.substring(0, 500),
      });

      throw new AppError(`Failed to parse AI response: ${error.message}`, 500);
    }
  }

  /**
   * Validate plan geometry - rooms don't overlap, fit within building, etc.
   */
  validatePlanGeometry(plan) {
    const errors = [];

    if (!plan.buildingDimensions) {
      errors.push('Missing building dimensions');
      return { valid: false, errors };
    }

    const { width: buildingWidth, depth: buildingDepth } = plan.buildingDimensions;

    plan.floors.forEach((floor, floorIndex) => {
      const floorRooms = floor.rooms;

      floorRooms.forEach((room, roomIndex) => {
        const { position, dimensions } = room;

        if (!position || !dimensions) {
          errors.push(`Room "${room.name}" on ${floor.level} missing position or dimensions`);
          return;
        }

        // Check room fits within building
        if (position.x + dimensions.width > buildingWidth + 1) {
          errors.push(`Room "${room.name}" exceeds building width (${position.x} + ${dimensions.width} > ${buildingWidth})`);
        }

        if (position.y + dimensions.length > buildingDepth + 1) {
          errors.push(`Room "${room.name}" exceeds building depth (${position.y} + ${dimensions.length} > ${buildingDepth})`);
        }

        // Check for negative positions
        if (position.x < 0 || position.y < 0) {
          errors.push(`Room "${room.name}" has negative position`);
        }

        // Check for overlapping rooms
        floorRooms.forEach((otherRoom, otherIndex) => {
          if (roomIndex >= otherIndex) return;

          if (this.roomsOverlap(room, otherRoom)) {
            errors.push(`Rooms "${room.name}" and "${otherRoom.name}" overlap on ${floor.level}`);
          }
        });

        // Validate minimum room sizes
        const minSizes = {
          bedroom: 70,
          bathroom: 35,
          kitchen: 50,
          living: 120,
          dining: 80,
          office: 64,
        };

        const roomType = room.type?.toLowerCase() || '';
        for (const [type, minSize] of Object.entries(minSizes)) {
          if (roomType.includes(type) && room.areaSqft < minSize) {
            errors.push(`Room "${room.name}" (${room.areaSqft} sqft) is below minimum size for ${type} (${minSize} sqft)`);
            break;
          }
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if two rooms overlap
   */
  roomsOverlap(room1, room2) {
    const r1 = {
      left: room1.position.x,
      right: room1.position.x + room1.dimensions.width,
      top: room1.position.y,
      bottom: room1.position.y + room1.dimensions.length,
    };

    const r2 = {
      left: room2.position.x,
      right: room2.position.x + room2.dimensions.width,
      top: room2.position.y,
      bottom: room2.position.y + room2.dimensions.length,
    };

    // Allow 0.5ft tolerance for shared walls
    const tolerance = 0.5;

    return !(
      r1.right <= r2.left + tolerance ||
      r1.left >= r2.right - tolerance ||
      r1.bottom <= r2.top + tolerance ||
      r1.top >= r2.bottom - tolerance
    );
  }

  /**
   * Calculate building dimensions from rooms
   */
  calculateBuildingDimensions(rooms) {
    if (!rooms || rooms.length === 0) {
      return { width: 40, depth: 30 };
    }

    let maxX = 0;
    let maxY = 0;

    rooms.forEach((room) => {
      if (room.position && room.dimensions) {
        const roomRight = room.position.x + room.dimensions.width;
        const roomBottom = room.position.y + room.dimensions.length;

        if (roomRight > maxX) maxX = roomRight;
        if (roomBottom > maxY) maxY = roomBottom;
      }
    });

    return {
      width: Math.max(maxX, 20),
      depth: Math.max(maxY, 20),
    };
  }

  /**
   * Infer room type from name
   */
  inferRoomType(name) {
    const nameLower = name.toLowerCase();

    if (nameLower.includes('bedroom') || nameLower.includes('master')) return 'bedroom';
    if (nameLower.includes('bath') || nameLower.includes('toilet') || nameLower.includes('wc')) return 'bathroom';
    if (nameLower.includes('kitchen')) return 'kitchen';
    if (nameLower.includes('living') || nameLower.includes('lounge') || nameLower.includes('drawing')) return 'living';
    if (nameLower.includes('dining')) return 'dining';
    if (nameLower.includes('office') || nameLower.includes('study')) return 'office';
    if (nameLower.includes('corridor') || nameLower.includes('hall') || nameLower.includes('lobby')) return 'corridor';
    if (nameLower.includes('stair')) return 'staircase';
    if (nameLower.includes('storage') || nameLower.includes('closet') || nameLower.includes('store')) return 'storage';
    if (nameLower.includes('garage') || nameLower.includes('parking')) return 'garage';
    if (nameLower.includes('balcony') || nameLower.includes('porch') || nameLower.includes('veranda')) return 'outdoor';

    return 'room';
  }

  /**
   * Generate cache key from prompt and meta
   */
  getCacheKey(prompt, meta) {
    return `${prompt}-${JSON.stringify(meta)}`;
  }

  /**
   * Get from cache if not expired
   */
  getFromCache(key) {
    const cached = this.responseCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set cache with timestamp
   */
  setCache(key, data) {
    this.responseCache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // Clean old entries if cache gets too large
    if (this.responseCache.size > 100) {
      const now = Date.now();
      for (const [k, v] of this.responseCache.entries()) {
        if (now - v.timestamp > this.cacheMaxAge) {
          this.responseCache.delete(k);
        }
      }
    }
  }

  /**
   * Delay helper for retry logic
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = new PlannerService();
