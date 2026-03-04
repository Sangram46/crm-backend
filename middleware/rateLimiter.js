const rateLimit = require('express-rate-limit');

const isTest = process.env.NODE_ENV === 'test';

/**
 * Login rate limiter
 * Limits login attempts to 3 requests per 10 minutes per IP
 * Disabled in test environment to avoid flaky tests
 */
const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000, // 10 minutes
  max: isTest ? 10000 : (parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 3),
  message: {
    success: false,
    message:
      'Too many login attempts. Please try again after 10 minutes.',
    retryAfter: '10 minutes',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    // Rate limit by IP + email combination
    return `${req.ip}-${req.body?.email || 'unknown'}`;
  },
});

/**
 * General API rate limiter
 * Limits API calls to 100 requests per 15 minutes
 * Disabled in test environment
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 10000 : 100,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter, apiLimiter };
