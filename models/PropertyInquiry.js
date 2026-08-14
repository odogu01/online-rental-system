const mongoose = require('mongoose');

const propertyInquirySchema = new mongoose.Schema({
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: [true, 'Property reference is required']
  },
  landlordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Landlord reference is required']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name must not exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s\-()]{7,20}$/, 'Please provide a valid phone number']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [2000, 'Message must not exceed 2000 characters']
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  }
}, {
  timestamps: true
});

propertyInquirySchema.index({ landlordId: 1, isRead: 1 });
propertyInquirySchema.index({ propertyId: 1 });
propertyInquirySchema.index({ userId: 1 });

module.exports = mongoose.model('PropertyInquiry', propertyInquirySchema);