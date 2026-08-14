const Notification = require('../models/Notification');
const { AppError } = require('../middleware/errorMiddleware');

/**
 * GET /api/notifications - Current user's notifications (newest first)
 */
exports.getNotifications = async (req, res, next) => {
  try {
    const filter = { userId: req.user._id };
    const { type } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    if (type) filter.type = type;

    const [notifications, unreadCount, total] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(limit),
      Notification.countDocuments({ userId: req.user._id, isRead: false }),
      Notification.countDocuments({ userId: req.user._id })
    ]);

    res.json({
      success: true,
      data: { notifications, unreadCount, total }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/notifications/unread-count
 */
exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user._id,
      isRead: false
    });

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/notifications/:id/read - Mark one notification as read (own only)
 */
exports.markRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { notification }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/notifications/read-all - Mark all of the user's notifications as read
 */
exports.markAllRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read',
      data: { modifiedCount: result.modifiedCount }
    });
  } catch (error) {
    next(error);
  }
};
