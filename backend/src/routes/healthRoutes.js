const express = require('express');
const { getHealth } = require('../controllers/healthController');

const router = express.Router();

// GET /health
router.get('/health', getHealth);

module.exports = router;
