/**
 * CAD Routes
 * API endpoints for CAD file generation
 */

const express = require('express');
const router = express.Router();
const cadController = require('./cad.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

/**
 * @route   POST /api/cad/generate
 * @desc    Generate CAD files (DXF/DWG) from floor plan
 * @access  Protected
 * @body    { planData, outputFormats, floorIndex, scale }
 */
router.post('/generate', authMiddleware, cadController.generateCAD);

/**
 * @route   POST /api/cad/dxf
 * @desc    Quick DXF generation (direct download)
 * @access  Protected
 * @body    { planData, floorIndex, scale }
 */
router.post('/dxf', authMiddleware, cadController.generateDXFOnly);

/**
 * @route   GET /api/cad/download/:format
 * @desc    Download CAD file
 * @access  Protected
 * @params  format: 'dxf' or 'dwg'
 * @query   plan (base64), floor, scale
 */
router.get('/download/:format', authMiddleware, cadController.downloadCAD);

/**
 * @route   GET /api/cad/stats
 * @desc    Get CAD service statistics
 * @access  Protected
 */
router.get('/stats', authMiddleware, cadController.getStats);

module.exports = router;
