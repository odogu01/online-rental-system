const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

// All routes require authentication
router.use(protect);

// PUT /api/notifications/read-all - Mark all as read (MUST be before /:id)
router.put('/read-all', notificationController.markAllRead);

// GET /api/notifications - List current user's notifications
router.get('/', notificationController.getNotifications);

// GET /api/notifications/unread-count
router.get('/unread-count', notificationController.getUnreadCount);

// PUT /api/notifications/:id/read - Mark single notification as read
router.put('/:id/read', notificationController.markRead);

module.exports = router;