const express = require('express');
const { body, query } = require('express-validator');
const { validate } = require('../middleware/validationMiddleware');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const propertyController = require('../controllers/propertyController');

const router = express.Router();

// GET /api/properties - List properties with optional filtering (public browsing, optional auth)
router.get(
  '/',
  optionalAuth,
  [
    query('minRent').optional().isFloat({ min: 0 }).withMessage('minRent must be a non-negative number'),
    query('maxRent').optional().isFloat({ min: 0 }).withMessage('maxRent must be a non-negative number'),
    query('bedrooms').optional().isInt({ min: 0 }).withMessage('bedrooms must be a non-negative integer'),
    validate
  ],
  propertyController.getAllProperties
);

// GET /api/properties/mine - Get current landlord's properties
router.get(
  '/mine',
  protect,
  authorize('landlord'),
  propertyController.getLandlordProperties
);

// GET /api/properties/:id - Get single property details
router.get('/:id', protect, propertyController.getPropertyById);

// POST /api/properties - Create new property listing
router.post(
  '/',
  protect,
  authorize('landlord', 'admin'),
  [
    body('title')
      .trim()
      .notEmpty().withMessage('Title is required')
      .isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
    body('location')
      .trim()
      .notEmpty().withMessage('Location is required'),
    body('description')
      .trim()
      .notEmpty().withMessage('Description is required')
      .isLength({ max: 2000 }).withMessage('Description must not exceed 2000 characters'),
    body('rentAmount')
      .isFloat({ min: 0 }).withMessage('Rent amount must be a non-negative number'),
    body('bedrooms')
      .isInt({ min: 0 }).withMessage('Bedrooms must be a non-negative integer'),
    body('bathrooms')
      .isInt({ min: 0 }).withMessage('Bathrooms must be a non-negative integer'),
    body('status')
      .optional()
      .isIn(['vacant', 'occupied', 'maintenance']).withMessage('Status must be vacant, occupied, or maintenance'),
    validate
  ],
  propertyController.createProperty
);

// POST /api/properties/:id/image - Upload property image
router.post(
  '/:id/image',
  protect,
  authorize('landlord', 'admin'),
  uploadSingle,
  propertyController.uploadPropertyImage
);

// PUT /api/properties/:id - Update property details
router.put(
  '/:id',
  protect,
  authorize('landlord', 'admin'),
  propertyController.updateProperty
);

// DELETE /api/properties/:id - Delete property
router.delete(
  '/:id',
  protect,
  authorize('landlord', 'admin'),
  propertyController.deleteProperty
);

module.exports = router;