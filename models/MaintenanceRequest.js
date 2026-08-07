const mongoose = require('mongoose');

const maintenanceRequestSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tenant reference is required']
  },
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: [true, 'Property reference is required']
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [200, 'Subject must not exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [2000, 'Description must not exceed 2000 characters']
  },
  urgency: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high'],
      message: 'Urgency must be low, medium, or high'
    },
    default: 'medium'
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'in-progress', 'completed', 'rejected'],
      message: 'Status must be pending, in-progress, completed, or rejected'
    },
    default: 'pending'
  },
  requestedDate: {
    type: Date,
    default: Date.now
  },
  resolvedDate: {
    type: Date
  },
  resolutionNotes: {
    type: String,
    maxlength: [2000, 'Resolution notes must not exceed 2000 characters']
  },
  images: {
    type: String
  }
}, {
  timestamps: true
});

maintenanceRequestSchema.index({ propertyId: 1, status: 1 });
maintenanceRequestSchema.index({ tenantId: 1 });

module.exports = mongoose.model('MaintenanceRequest', maintenanceRequestSchema);
