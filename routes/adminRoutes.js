const express = require('express');
const { body, query } = require('express-validator');
const { validate } = require('../middleware/validationMiddleware');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const adminController = require('../controllers/adminController');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(protect);
router.use(authorize('admin'));

// GET /api/admin/stats - System-wide statistics
router.get('/stats', adminController.getSystemStats);

// GET /api/admin/users - List all users
router.get(
  '/users',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    validate
  ],
  adminController.getAllUsers
);

// GET /api/admin/users/:id - Get user details
router.get('/users/:id', adminController.getUserById);

// PUT /api/admin/users/:id/role - Update user role
router.put(
  '/users/:id/role',
  [
    body('role')
      .isIn(['landlord', 'tenant', 'admin']).withMessage('Role must be landlord, tenant, or admin'),
    validate
  ],
  adminController.updateUserRole
);

// PUT /api/admin/users/:id/status - Activate/deactivate user
router.put(
  '/users/:id/status',
  [
    body('isActive')
      .isBoolean().withMessage('isActive must be a boolean'),
    validate
  ],
  adminController.toggleUserStatus
);

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', adminController.deleteUser);

module.exports = router;
