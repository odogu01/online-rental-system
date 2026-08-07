const express = require('express');
const { body, query } = require('express-validator');
const { validate } = require('../middleware/validationMiddleware');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

// All routes require authentication
router.use(protect);

// POST /api/payments - Record rent payment
router.post(
  '/',
  authorize('landlord', 'admin'),
  [
    body('leaseId')
      .isMongoId().withMessage('Valid lease ID is required'),
    body('amount')
      .isFloat({ min: 0.01 }).withMessage('Amount must be greater than zero'),
    body('dueDate')
      .isISO8601().withMessage('Valid due date is required (ISO 8601)'),
    body('paymentMethod')
      .optional()
      .isIn(['cash', 'bank_transfer', 'online', 'cheque']).withMessage('Invalid payment method'),
    validate
  ],
  paymentController.recordPayment
);

// GET /api/payments - List payments with optional filtering
router.get(
  '/',
  [
    query('startDate').optional().isISO8601().withMessage('Invalid start date'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date'),
    validate
  ],
  paymentController.getPayments
);

// GET /api/payments/outstanding - Get outstanding balance
router.get('/outstanding', paymentController.getOutstandingBalance);

// GET /api/payments/overdue - Get overdue payments
router.get('/overdue', authorize('landlord', 'admin'), paymentController.getOverduePayments);

// GET /api/payments/receipt/:id - Generate/download PDF receipt
router.get('/receipt/:id', paymentController.generateReceipt);

// GET /api/payments/:id - Get single payment details
router.get('/:id', paymentController.getPaymentById);

module.exports = router;
