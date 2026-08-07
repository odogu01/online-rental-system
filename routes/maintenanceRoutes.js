const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validationMiddleware');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const maintenanceController = require('../controllers/maintenanceController');

const router = express.Router();

// All routes require authentication
router.use(protect);

// POST /api/maintenance - Submit maintenance request
router.post(
  '/',
  authorize('tenant', 'landlord', 'admin'),
  [
    body('propertyId')
      .isMongoId().withMessage('Valid property ID is required'),
    body('subject')
      .trim()
      .notEmpty().withMessage('Subject is required')
      .isLength({ max: 200 }).withMessage('Subject must not exceed 200 characters'),
    body('description')
      .trim()
      .notEmpty().withMessage('Description is required')
      .isLength({ max: 2000 }).withMessage('Description must not exceed 2000 characters'),
    body('urgency')
      .optional()
      .isIn(['low', 'medium', 'high']).withMessage('Urgency must be low, medium, or high'),
    validate
  ],
  maintenanceController.createRequest
);

// GET /api/maintenance - List maintenance requests
router.get('/', maintenanceController.getRequests);

// GET /api/maintenance/statistics - Get request statistics
router.get('/statistics', maintenanceController.getRequestStatistics);

// GET /api/maintenance/:id - Get single request details
router.get('/:id', maintenanceController.getRequestById);

// PUT /api/maintenance/:id/status - Update request status (landlord)
router.put(
  '/:id/status',
  authorize('landlord', 'admin'),
  [
    body('status')
      .isIn(['pending', 'in-progress', 'completed', 'rejected'])
      .withMessage('Status must be pending, in-progress, completed, or rejected'),
    body('resolutionNotes')
      .optional()
      .trim()
      .isLength({ max: 2000 }).withMessage('Notes must not exceed 2000 characters'),
    validate
  ],
  maintenanceController.updateRequestStatus
);

// PUT /api/maintenance/:id/notes - Add resolution notes
router.put(
  '/:id/notes',
  authorize('landlord', 'admin'),
  [
    body('resolutionNotes')
      .trim()
      .notEmpty().withMessage('Resolution notes are required')
      .isLength({ max: 2000 }).withMessage('Notes must not exceed 2000 characters'),
    validate
  ],
  maintenanceController.addResolutionNotes
);

module.exports = router;
