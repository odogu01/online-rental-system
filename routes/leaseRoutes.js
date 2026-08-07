const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validationMiddleware');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const leaseController = require('../controllers/leaseController');

const router = express.Router();

// All routes require authentication
router.use(protect);

// POST /api/leases - Create new lease agreement
router.post(
  '/',
  authorize('landlord', 'admin'),
  [
    body('propertyId')
      .isMongoId().withMessage('Valid property ID is required'),
    body('tenantId')
      .isMongoId().withMessage('Valid tenant ID is required'),
    body('startDate')
      .isISO8601().withMessage('Valid start date is required (ISO 8601)'),
    body('endDate')
      .isISO8601().withMessage('Valid end date is required (ISO 8601)'),
    body('monthlyRent')
      .isFloat({ min: 0 }).withMessage('Monthly rent must be a non-negative number'),
    body('securityDeposit')
      .optional()
      .isFloat({ min: 0 }).withMessage('Security deposit must be non-negative'),
    validate
  ],
  leaseController.createLease
);

// GET /api/leases - List leases
router.get('/', leaseController.getLeases);

// GET /api/leases/active - Get all active leases
router.get('/active', leaseController.getActiveLeases);

// GET /api/leases/:id - Get single lease details
router.get('/:id', leaseController.getLeaseById);

// PUT /api/leases/:id/status - Update lease status
router.put(
  '/:id/status',
  authorize('landlord', 'admin'),
  [
    body('status')
      .isIn(['active', 'expired', 'terminated']).withMessage('Status must be active, expired, or terminated'),
    validate
  ],
  leaseController.updateLeaseStatus
);

module.exports = router;
