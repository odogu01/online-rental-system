const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  landlordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Landlord reference is required']
  },
  title: {
    type: String,
    required: [true, 'Property title is required'],
    trim: true,
    minlength: [3, 'Title must be at least 3 characters'],
    maxlength: [200, 'Title must not exceed 200 characters']
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [2000, 'Description must not exceed 2000 characters']
  },
  rentAmount: {
    type: Number,
    required: [true, 'Rent amount is required'],
    min: [0, 'Rent amount cannot be negative']
  },
  bedrooms: {
    type: Number,
    required: [true, 'Number of bedrooms is required'],
    min: [0, 'Bedrooms cannot be negative'],
    default: 0
  },
  bathrooms: {
    type: Number,
    required: [true, 'Number of bathrooms is required'],
    min: [0, 'Bathrooms cannot be negative'],
    default: 0
  },
  amenities: {
    type: String,
    trim: true
  },
  images: {
    type: String
  },
  status: {
    type: String,
    enum: {
      values: ['vacant', 'occupied', 'maintenance'],
      message: 'Status must be vacant, occupied, or maintenance'
    },
    default: 'vacant'
  }
}, {
  timestamps: true
});

propertySchema.index({ landlordId: 1 });
propertySchema.index({ status: 1 });
propertySchema.index({ status: 1, rentAmount: 1 });
propertySchema.index({ title: 'text', description: 'text', location: 'text' });

module.exports = mongoose.model('Property', propertySchema);
