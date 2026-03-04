const express = require('express');
const router = express.Router();
const { getActivityLogs } = require('../controllers/activityLogController');
const { authenticate } = require('../middleware/auth');
const { validatePagination } = require('../middleware/validate');

// All routes require authentication
router.use(authenticate);

router.get('/', validatePagination, getActivityLogs);

module.exports = router;
