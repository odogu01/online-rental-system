const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  leaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lease',
    required: [true, 'Lease reference is required']
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Payment amount cannot be negative']
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: [true, 'Payment due date is required']
  },
  paymentMethod: {
    type: String,
    enum: {
      values: ['cash', 'bank_transfer', 'online', 'cheque'],
      message: 'Payment method must be cash, bank_transfer, online, or cheque'
    },
    default: 'cash'
  },
  status: {
    type: String,
    enum: {
      values: ['paid', 'pending', 'overdue'],
      message: 'Status must be paid, pending, or overdue'
    },
    default: 'pending'
  },
  paymentReference: {
    type: String,
    unique: true
  },
  receiptPath: {
    type: String
  }
}, {
  timestamps: true
});

paymentSchema.index({ leaseId: 1 });
paymentSchema.index({ dueDate: 1 });
paymentSchema.index({ status: 1, dueDate: 1 });

paymentSchema.pre('save', function (next) {
  if (!this.paymentReference) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.paymentReference = `PAY-${timestamp}-${random}`;
  }
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);
