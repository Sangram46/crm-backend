const ActivityLog = require('../models/ActivityLog');

/**
 * @desc    Get activity logs with pagination
 * @route   GET /api/activity-logs
 * @access  Private
 */
const getActivityLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, action = '' } = req.query;

    const query = { user: req.user.userId };

    // Filter by action type
    if (action && ['CREATE', 'UPDATE', 'DELETE'].includes(action)) {
      query.action = action;
    }

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 },
      lean: true,
    };

    const result = await ActivityLog.paginate(query, options);

    res.status(200).json({
      success: true,
      data: {
        logs: result.docs,
        pagination: {
          total: result.totalDocs,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasNextPage: result.hasNextPage,
          hasPrevPage: result.hasPrevPage,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActivityLogs,
};
