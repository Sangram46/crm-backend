const express = require('express');
const router = express.Router();
const {
  signup,
  signin,
  refreshToken,
  logout,
  getMe,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validateSignup, validateSignin } = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimiter');

// Public routes
router.post('/signup', validateSignup, signup);
router.post('/signin', loginLimiter, validateSignin, signin);
router.post('/refresh', refreshToken);

// Protected routes
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);

module.exports = router;
