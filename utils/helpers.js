/**
 * Utility helper functions
 */

/**
 * Parse sort parameter from query string
 * Format: "field:order" (e.g., "createdAt:desc")
 */
const parseSortParam = (sortParam, allowedFields = []) => {
  if (!sortParam) return { createdAt: -1 };

  const [field, order] = sortParam.split(':');
  
  if (allowedFields.length > 0 && !allowedFields.includes(field)) {
    return { createdAt: -1 };
  }

  return { [field]: order === 'asc' ? 1 : -1 };
};

/**
 * Sanitize user input to prevent NoSQL injection
 */
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.replace(/[${}]/g, '');
  }
  return input;
};

/**
 * Format pagination response
 */
const formatPaginationResponse = (paginateResult) => {
  return {
    data: paginateResult.docs,
    pagination: {
      total: paginateResult.totalDocs,
      page: paginateResult.page,
      limit: paginateResult.limit,
      totalPages: paginateResult.totalPages,
      hasNextPage: paginateResult.hasNextPage,
      hasPrevPage: paginateResult.hasPrevPage,
      nextPage: paginateResult.nextPage,
      prevPage: paginateResult.prevPage,
    },
  };
};

module.exports = {
  parseSortParam,
  sanitizeInput,
  formatPaginationResponse,
};
