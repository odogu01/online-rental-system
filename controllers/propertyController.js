const Property = require('../models/Property');
const Lease = require('../models/Lease');
const User = require('../models/User');
const { AppError } = require('../middleware/errorMiddleware');

exports.uploadPropertyImage = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No image file uploaded', 400, 'NO_FILE');
    }

    const property = await Property.findById(req.params.id);
    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    if (req.user.role !== 'admin' && property.landlordId.toString() !== req.user._id.toString()) {
      throw new AppError('You do not own this property', 403, 'NOT_OWNER');
    }

    property.images = '/uploads/' + req.file.filename;
    await property.save();

    res.json({
      success: true,
      message: 'Image uploaded',
      data: { property }
    });
  } catch (error) {
    next(error);
  }
};

exports.createProperty = async (req, res, next) => {
  try {
    const propertyData = {
      ...req.body,
      landlordId: req.user._id
    };

    const property = await Property.create(propertyData);

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      data: { property }
    });
  } catch (error) {
    next(error);
  }
};

exports.getAllProperties = async (req, res, next) => {
  try {
    const filter = {};
    const { status, minRent, maxRent, bedrooms, location, ownerName } = req.query;

    if (status) filter.status = status;
    if (location) filter.location = { $regex: location, $options: 'i' };
    if (bedrooms) filter.bedrooms = parseInt(bedrooms);

    if (minRent || maxRent) {
      filter.rentAmount = {};
      if (minRent) filter.rentAmount.$gte = parseFloat(minRent);
      if (maxRent) filter.rentAmount.$lte = parseFloat(maxRent);
    }

    if (req.user?.role === 'landlord') {
      filter.landlordId = req.user._id;
    }

    if (ownerName) {
      const landlords = await User.find({
        fullName: { $regex: ownerName, $options: 'i' },
        role: 'landlord'
      }).select('_id');
      filter.landlordId = { $in: landlords.map(l => l._id) };
    }

    const sortOrder = req.query.sort === 'oldest' ? 1 : -1;

    const properties = await Property.find(filter)
      .populate('landlordId', 'fullName email phoneNumber')
      .sort({ createdAt: sortOrder });

    const summary = {
      total: properties.length,
      vacant: properties.filter(p => p.status === 'vacant').length,
      occupied: properties.filter(p => p.status === 'occupied').length,
      maintenance: properties.filter(p => p.status === 'maintenance').length
    };

    res.json({
      success: true,
      data: {
        properties,
        total: properties.length,
        summary,
        filters: { status, minRent, maxRent, bedrooms, location, ownerName }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getPropertyById = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate('landlordId', 'fullName email phoneNumber');

    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    const activeLease = await Lease.findOne({
      propertyId: property._id,
      status: 'active'
    }).populate('tenantId', 'fullName email phoneNumber');

    res.json({
      success: true,
      data: {
        property,
        currentTenant: activeLease?.tenantId || null,
        hasActiveLease: !!activeLease
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProperty = async (req, res, next) => {
  try {
    const allowedUpdates = [
      'title', 'location', 'description', 'rentAmount',
      'bedrooms', 'bathrooms', 'amenities', 'images', 'status'
    ];

    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError('No valid fields to update', 400, 'NO_UPDATE_FIELDS');
    }

    const property = await Property.findOneAndUpdate(
      { _id: req.params.id, landlordId: req.user._id },
      updates,
      { new: true, runValidators: true }
    );

    if (!property) {
      throw new AppError('Property not found or you are not authorized', 404, 'PROPERTY_NOT_FOUND');
    }

    res.json({
      success: true,
      message: 'Property updated successfully',
      data: { property }
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteProperty = async (req, res, next) => {
  try {
    const activeLease = await Lease.findOne({
      propertyId: req.params.id,
      status: 'active'
    });

    if (activeLease) {
      throw new AppError(
        'Cannot delete property with an active lease. Terminate the lease first.',
        400,
        'PROPERTY_HAS_ACTIVE_LEASE'
      );
    }

    const property = await Property.findOneAndDelete({
      _id: req.params.id,
      landlordId: req.user._id
    });

    if (!property) {
      throw new AppError('Property not found or you are not authorized', 404, 'PROPERTY_NOT_FOUND');
    }

    res.json({
      success: true,
      message: 'Property deleted successfully',
      data: { propertyId: req.params.id }
    });
  } catch (error) {
    next(error);
  }
};

exports.getLandlordProperties = async (req, res, next) => {
  try {
    const properties = await Property.find({ landlordId: req.user._id })
      .populate('landlordId', 'fullName email phoneNumber')
      .sort({ createdAt: -1 });

    const summary = {
      total: properties.length,
      vacant: properties.filter(p => p.status === 'vacant').length,
      occupied: properties.filter(p => p.status === 'occupied').length,
      maintenance: properties.filter(p => p.status === 'maintenance').length,
      totalMonthlyRent: properties.reduce((sum, p) => sum + (p.status === 'occupied' ? p.rentAmount : 0), 0)
    };

    res.json({
      success: true,
      data: { properties, summary }
    });
  } catch (error) {
    next(error);
  }
};
