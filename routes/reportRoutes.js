const express = require('express');
const { query } = require('express-validator');
const { validate } = require('../middleware/validationMiddleware');
const { protect } = require('../middleware/authMiddleware');
const reportController = require('../controllers/reportController');

const router = express.Router();

// All routes require authentication
router.use(protect);

// GET /api/reports/rent-collection - Rent collection summary (json/pdf/csv)
router.get(
  '/rent-collection',
  [
    query('format')
      .optional()
      .isIn(['json', 'pdf', 'csv']).withMessage('Format must be json, pdf, or csv'),
    query('startDate')
      .optional()
      .isISO8601().withMessage('Invalid start date format'),
    query('endDate')
      .optional()
      .isISO8601().withMessage('Invalid end date format'),
    validate
  ],
  reportController.generateRentReport
);

// GET /api/reports/vacancy - Vacancy report (json/pdf/csv)
router.get(
  '/vacancy',
  [
    query('format')
      .optional()
      .isIn(['json', 'pdf', 'csv']).withMessage('Format must be json, pdf, or csv'),
    validate
  ],
  reportController.generateVacancyReport
);

// GET /api/reports/maintenance - Maintenance request log (json/pdf/csv)
router.get(
  '/maintenance',
  [
    query('format')
      .optional()
      .isIn(['json', 'pdf', 'csv']).withMessage('Format must be json, pdf, or csv'),
    query('status')
      .optional()
      .isIn(['pending', 'in-progress', 'completed', 'rejected']).withMessage('Invalid status filter'),
    query('urgency')
      .optional()
      .isIn(['low', 'medium', 'high']).withMessage('Invalid urgency filter'),
    validate
  ],
  reportController.generateMaintenanceReport
);

// GET /api/reports/arrears - Outstanding arrears list (json/pdf/csv)
router.get(
  '/arrears',
  [
    query('format')
      .optional()
      .isIn(['json', 'pdf', 'csv']).withMessage('Format must be json, pdf, or csv'),
    validate
  ],
  reportController.generateArrearsReport
);

module.exports = router;
