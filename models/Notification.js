const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  type: {
    type: String,
    enum: {
      values: ['rent_reminder', 'maintenance_update', 'lease_expiry', 'payment_confirmation', 'property_inquiry'],
      message: 'Type must be rent_reminder, maintenance_update, lease_expiry, payment_confirmation, or property_inquiry'
    },
    required: [true, 'Notification type is required']
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    maxlength: [2000, 'Message must not exceed 2000 characters']
  },
  link: {
    type: String,
    default: ''
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 7776000
  }
}, {
  timestamps: true
});

notificationSchema.index({ userId: 1, isRead: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
