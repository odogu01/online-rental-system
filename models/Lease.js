const mongoose = require('mongoose');

const leaseSchema = new mongoose.Schema({
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: [true, 'Property reference is required']
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tenant reference is required']
  },
  startDate: {
    type: Date,
    required: [true, 'Lease start date is required'],
    validate: {
      validator: function (value) {
        return value < this.endDate;
      },
      message: 'Start date must be before end date'
    }
  },
  endDate: {
    type: Date,
    required: [true, 'Lease end date is required'],
    validate: {
      validator: function (value) {
        return value > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  monthlyRent: {
    type: Number,
    required: [true, 'Monthly rent is required'],
    min: [0, 'Monthly rent cannot be negative']
  },
  securityDeposit: {
    type: Number,
    default: 0,
    min: [0, 'Security deposit cannot be negative']
  },
  status: {
    type: String,
    enum: {
      values: ['active', 'expired', 'terminated'],
      message: 'Status must be active, expired, or terminated'
    },
    default: 'active'
  }
}, {
  timestamps: true
});

leaseSchema.index({ propertyId: 1, status: 1 });
leaseSchema.index({ tenantId: 1, status: 1 });
leaseSchema.index({ endDate: 1 });

module.exports = mongoose.model('Lease', leaseSchema);
