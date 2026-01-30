const express = require('express');
const plannerController = require('./planner.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

const router = express.Router();

router.post('/generate', authMiddleware, plannerController.generatePlan);

module.exports = router;
