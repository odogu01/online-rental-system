const Lease = require('../models/Lease');
const Property = require('../models/Property');
const User = require('../models/User');
const { AppError } = require('../middleware/errorMiddleware');

exports.createLease = async (req, res, next) => {
  try {
    const { propertyId, tenantId, startDate, endDate, monthlyRent, securityDeposit } = req.body;

    const property = await Property.findById(propertyId);
    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    if (property.landlordId.toString() !== req.user._id.toString()) {
      throw new AppError('You do not own this property', 403, 'NOT_OWNER');
    }

    const tenant = await User.findById(tenantId);
    if (!tenant || tenant.role !== 'tenant') {
      throw new AppError('Invalid tenant', 400, 'INVALID_TENANT');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      throw new AppError('End date must be after start date', 400, 'INVALID_DATES');
    }

    if (start < new Date()) {
      throw new AppError('Start date cannot be in the past', 400, 'PAST_START_DATE');
    }

    const claimed = await Property.findOneAndUpdate(
      { _id: propertyId, status: { $ne: 'occupied' } },
      { status: 'occupied' },
      { new: true }
    );

    if (!claimed) {
      throw new AppError('Property is already occupied', 400, 'PROPERTY_OCCUPIED');
    }

    try {
      const lease = await Lease.create({
        propertyId,
        tenantId,
        startDate: start,
        endDate: end,
        monthlyRent,
        securityDeposit: securityDeposit || 0
      });

      res.status(201).json({
        success: true,
        message: 'Lease agreement created successfully',
        data: { lease }
      });
    } catch (leaseError) {
      await Property.updateOne({ _id: propertyId }, { status: 'vacant' }).catch(() => {});
      throw leaseError;
    }
  } catch (error) {
    next(error);
  }
};

exports.getLeases = async (req, res, next) => {
  try {
    const filter = {};
    const { status, startDate, endDate } = req.query;

    if (status) filter.status = status;

    if (req.user.role === 'landlord') {
      const properties = await Property.find({ landlordId: req.user._id }).select('_id');
      filter.propertyId = { $in: properties.map(p => p._id) };
    } else if (req.user.role === 'tenant') {
      filter.tenantId = req.user._id;
    }

    if (startDate) {
      filter.startDate = { ...(filter.startDate || {}), $gte: new Date(startDate) };
    }
    if (endDate) {
      filter.endDate = { ...(filter.endDate || {}), $lte: new Date(endDate) };
    }

    const leases = await Lease.find(filter)
      .populate('propertyId', 'title location rentAmount bedrooms bathrooms')
      .populate('tenantId', 'fullName email phoneNumber')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { leases }
    });
  } catch (error) {
    next(error);
  }
};

exports.getLeaseById = async (req, res, next) => {
  try {
    const lease = await Lease.findById(req.params.id)
      .populate('propertyId', 'title location rentAmount bedrooms bathrooms amenities images')
      .populate('tenantId', 'fullName email phoneNumber profileImage');

    if (!lease) {
      throw new AppError('Lease not found', 404, 'LEASE_NOT_FOUND');
    }

    const propertyOwner = await Property.findById(lease.propertyId).select('landlordId');
    const isLandlord = propertyOwner?.landlordId.toString() === req.user._id?.toString();
    const isTenant = lease.tenantId._id.toString() === req.user._id?.toString();

    if (!isLandlord && !isTenant && req.user.role !== 'admin') {
      throw new AppError('Not authorized to view this lease', 403, 'UNAUTHORIZED');
    }

    // Get payment history for this lease
    const Payment = require('../models/Payment');
    const payments = await Payment.find({ leaseId: lease._id }).sort({ paymentDate: -1 });

    const totalPaid = payments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);

    res.json({
      success: true,
      data: { lease, payments, totalPaid }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateLeaseStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const validTransitions = {
      'active': ['expired', 'terminated'],
      'expired': ['active'],
      'terminated': ['active']
    };

    const lease = await Lease.findById(req.params.id);
    if (!lease) {
      throw new AppError('Lease not found', 404, 'LEASE_NOT_FOUND');
    }

    if (!validTransitions[lease.status]?.includes(status)) {
      throw new AppError(
        `Cannot transition lease from '${lease.status}' to '${status}'`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    if (status === 'terminated') {
      await Property.findByIdAndUpdate(lease.propertyId, { status: 'vacant' });
    } else if (status === 'active' && (lease.status === 'terminated' || lease.status === 'expired')) {
      await Property.findByIdAndUpdate(lease.propertyId, { status: 'occupied' });
    } else if (status === 'expired') {
      await Property.findByIdAndUpdate(lease.propertyId, { status: 'vacant' });
    }

    lease.status = status;
    await lease.save();

    res.json({
      success: true,
      message: `Lease status updated to '${status}'`,
      data: { lease }
    });
  } catch (error) {
    next(error);
  }
};

exports.getTenantsByLandlord = async (req, res, next) => {
  try {
    const propertyFilter = {};

    if (req.user.role !== 'admin') {
      const properties = await Property.find({ landlordId: req.user._id }).select('_id');
      propertyFilter.propertyId = { $in: properties.map(p => p._id) };
    }

    const leases = await Lease.find(propertyFilter)
      .populate('propertyId', 'title')
      .sort({ createdAt: -1 });

    const activeByTenant = new Map();
    const tenantIds = new Set();

    for (const lease of leases) {
      tenantIds.add(lease.tenantId.toString());
      if (lease.status === 'active' && !activeByTenant.has(lease.tenantId.toString())) {
        activeByTenant.set(lease.tenantId.toString(), lease);
      }
    }

    const tenants = await User.find({ _id: { $in: [...tenantIds] } })
      .select('fullName email phoneNumber');

    const result = tenants.map(tenant => {
      const activeLease = activeByTenant.get(tenant._id.toString());
      return {
        _id: tenant._id,
        fullName: tenant.fullName,
        email: tenant.email,
        phoneNumber: tenant.phoneNumber,
        activeLease: activeLease ? {
          _id: activeLease._id,
          status: activeLease.status,
          startDate: activeLease.startDate,
          endDate: activeLease.endDate,
          monthlyRent: activeLease.monthlyRent,
          propertyTitle: activeLease.propertyId?.title || null
        } : null
      };
    });

    res.json({
      success: true,
      data: { tenants: result }
    });
  } catch (error) {
    next(error);
  }
};

exports.getActiveLeases = async (req, res, next) => {
  try {
    const filter = { status: 'active' };

    if (req.user.role === 'landlord') {
      const properties = await Property.find({ landlordId: req.user._id }).select('_id');
      filter.propertyId = { $in: properties.map(p => p._id) };
    } else if (req.user.role === 'tenant') {
      filter.tenantId = req.user._id;
    }

    const now = new Date();
    const leases = await Lease.find({
      ...filter,
      endDate: { $gte: now }
    })
      .populate('propertyId', 'title location rentAmount')
      .populate('tenantId', 'fullName email phoneNumber')
      .sort({ endDate: 1 });

    // Check for leases expiring within 30 days
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringSoon = leases.filter(l => l.endDate <= thirtyDaysFromNow);

    res.json({
      success: true,
      data: {
        leases,
        expiringSoonCount: expiringSoon.length,
        expiringSoon
      }
    });
  } catch (error) {
    next(error);
  }
};
