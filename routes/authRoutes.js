const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validationMiddleware');
const { protect } = require('../middleware/authMiddleware');
const authController = require('../controllers/authController');

const router = express.Router();

// POST /api/auth/register - Register new user
router.post(
  '/register',
  [
    body('fullName')
      .trim()
      .notEmpty().withMessage('Full name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Full name must be 2-100 characters'),
    body('email')
      .isEmail().withMessage('Valid email is required')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and a number'),
    body('role')
      .optional()
      .isIn(['landlord', 'tenant', 'admin']).withMessage('Role must be landlord, tenant, or admin'),
    body('phoneNumber')
      .optional()
      .matches(/^\+?[\d\s\-()]{7,20}$/).withMessage('Invalid phone number format'),
    validate
  ],
  authController.register
);

// POST /api/auth/login - Authenticate and receive token
router.post(
  '/login',
  [
    body('email')
      .isEmail().withMessage('Valid email is required')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required'),
    validate
  ],
  authController.login
);

// POST /api/auth/refresh - Refresh authentication token
router.post(
  '/refresh',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
    validate
  ],
  authController.refreshToken
);

// GET /api/auth/profile - Get current user profile
router.get('/profile', protect, authController.getProfile);

// PUT /api/auth/profile - Update user profile
router.put(
  '/profile',
  protect,
  [
    body('fullName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Full name must be 2-100 characters'),
    body('phoneNumber')
      .optional()
      .matches(/^\+?[\d\s\-()]{7,20}$/).withMessage('Invalid phone number format'),
    validate
  ],
  authController.updateProfile
);

// PUT /api/auth/change-password - Change user password
router.put(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('New password must contain uppercase, lowercase, and a number'),
    validate
  ],
  authController.changePassword
);

module.exports = router;
