const express = require('express');
const { body, query } = require('express-validator');
const { validate } = require('../middleware/validationMiddleware');
const { protect } = require('../middleware/authMiddleware');
const inquiryController = require('../controllers/inquiryController');

const router = express.Router();

// POST /api/inquiries - Send a contact message to a property's landlord (PUBLIC)
router.post(
  '/',
  [
    body('propertyId')
      .isMongoId().withMessage('Valid property ID is required'),
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('email')
      .isEmail().withMessage('A valid email is required')
      .normalizeEmail(),
    body('phone')
      .optional()
      .matches(/^\+?[\d\s\-()]{7,20}$/).withMessage('Invalid phone number format'),
    body('message')
      .trim()
      .notEmpty().withMessage('Message is required')
      .isLength({ max: 2000 }).withMessage('Message must not exceed 2000 characters'),
    validate
  ],
  inquiryController.createInquiry
);

// All routes below require authentication
router.use(protect);

// GET /api/inquiries - List inquiries (role-scoped)
router.get(
  '/',
  [
    query('status').optional().isIn(['read', 'unread']).withMessage('Status must be read or unread'),
    validate
  ],
  inquiryController.getInquiries
);

// GET /api/inquiries/:id - Get single inquiry
router.get('/:id', inquiryController.getInquiryById);

// PUT /api/inquiries/:id/read - Mark inquiry as read
router.put('/:id/read', inquiryController.markRead);

module.exports = router;
