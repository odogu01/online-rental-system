const MaintenanceRequest = require('../models/MaintenanceRequest');
const Property = require('../models/Property');
const Lease = require('../models/Lease');
const Notification = require('../models/Notification');
const { AppError } = require('../middleware/errorMiddleware');
const { sendMaintenanceUpdate, sendMaintenanceNotification } = require('../services/emailService');

exports.createRequest = async (req, res, next) => {
  try {
    const { propertyId, subject, description, urgency } = req.body;

    const property = await Property.findById(propertyId).populate('landlordId', 'email fullName');
    if (!property) {
      throw new AppError('Property not found', 404, 'PROPERTY_NOT_FOUND');
    }

    if (req.user.role === 'tenant') {
      const activeLease = await Lease.findOne({
        tenantId: req.user._id,
        propertyId,
        status: 'active'
      });
      if (!activeLease) {
        throw new AppError('You do not have an active lease on this property', 403, 'NOT_YOUR_PROPERTY');
      }
    }

    const request = await MaintenanceRequest.create({
      tenantId: req.user._id,
      propertyId,
      subject,
      description,
      urgency: urgency || 'medium',
      requestedDate: new Date(),
      status: 'pending'
    });

    // Notify landlord
    sendMaintenanceNotification(property.landlordId.email, {
      landlordName: property.landlordId.fullName,
      subject,
      propertyTitle: property.title,
      tenantName: req.user.fullName,
      description,
      urgency: urgency || 'medium'
    }).catch(err => console.warn('Maintenance notification email failed:', err.message));

    res.status(201).json({
      success: true,
      message: 'Maintenance request submitted successfully',
      data: { request }
    });
  } catch (error) {
    next(error);
  }
};

exports.getRequests = async (req, res, next) => {
  try {
    const filter = {};
    const { status, urgency, propertyId } = req.query;

    if (status) filter.status = status;
    if (urgency) filter.urgency = urgency;
    if (propertyId) filter.propertyId = propertyId;

    if (req.user.role === 'tenant') {
      filter.tenantId = req.user._id;
    } else if (req.user.role === 'landlord') {
      const properties = await Property.find({ landlordId: req.user._id }).select('_id');
      filter.propertyId = { $in: properties.map(p => p._id) };
    }

    const requests = await MaintenanceRequest.find(filter)
      .populate('propertyId', 'title location')
      .populate('tenantId', 'fullName email phoneNumber')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { requests }
    });
  } catch (error) {
    next(error);
  }
};

exports.getRequestById = async (req, res, next) => {
  try {
    const request = await MaintenanceRequest.findById(req.params.id)
      .populate('propertyId', 'title location landlordId')
      .populate('tenantId', 'fullName email phoneNumber');

    if (!request) {
      throw new AppError('Maintenance request not found', 404, 'REQUEST_NOT_FOUND');
    }

    // Authorization check
    const isTenant = request.tenantId._id.toString() === req.user._id?.toString();
    const property = await Property.findById(request.propertyId);
    const isLandlord = property?.landlordId?.toString() === req.user._id?.toString();

    if (!isTenant && !isLandlord && req.user.role !== 'admin') {
      throw new AppError('Not authorized to view this request', 403, 'UNAUTHORIZED');
    }

    res.json({
      success: true,
      data: { request }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateRequestStatus = async (req, res, next) => {
  try {
    const { status, resolutionNotes } = req.body;

    const validTransitions = {
      'pending': ['in-progress', 'rejected'],
      'in-progress': ['completed', 'pending'],
      'completed': ['in-progress'],
      'rejected': ['pending']
    };

    const request = await MaintenanceRequest.findById(req.params.id)
      .populate('propertyId', 'title landlordId')
      .populate('tenantId', 'fullName email');
    if (!request) {
      throw new AppError('Maintenance request not found', 404, 'REQUEST_NOT_FOUND');
    }

    if (req.user.role !== 'admin' &&
        request.propertyId?.landlordId?.toString() !== req.user._id?.toString()) {
      throw new AppError('Not authorized to update this request', 403, 'MAINTENANCE_ACCESS_DENIED');
    }

    if (!validTransitions[request.status]?.includes(status)) {
      throw new AppError(
        `Cannot transition from '${request.status}' to '${status}'`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const updateData = { status };
    if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;
    if (status === 'completed') updateData.resolvedDate = new Date();

    Object.assign(request, updateData);
    await request.save();

    // Notify tenant
    sendMaintenanceUpdate(request.tenantId.email, request.tenantId.fullName, {
      subject: request.subject,
      propertyTitle: request.propertyId?.title,
      status: request.status,
      urgency: request.urgency,
      resolutionNotes: resolutionNotes || undefined
    }).catch(err => console.warn('Maintenance update email failed:', err.message));

    if (status === 'in-progress' || status === 'completed') {
      Notification.create({
        userId: request.tenantId._id,
        type: 'maintenance_update',
        message: `Your maintenance request "${request.subject}" is now ${status}`,
        link: '/tenant/maintenance.html'
      }).catch(err => console.warn('Maintenance notification failed:', err.message));
    }

    res.json({
      success: true,
      message: `Request status updated to '${status}'`,
      data: { request }
    });
  } catch (error) {
    next(error);
  }
};

exports.addResolutionNotes = async (req, res, next) => {
  try {
    const { resolutionNotes } = req.body;

    if (!resolutionNotes || !resolutionNotes.trim()) {
      throw new AppError('Resolution notes are required', 400, 'MISSING_NOTES');
    }

    const request = await MaintenanceRequest.findByIdAndUpdate(
      req.params.id,
      {
        $set: { resolutionNotes: resolutionNotes.trim() }
      },
      { new: true, runValidators: true }
    )
      .populate('propertyId', 'title landlordId')
      .populate('tenantId', 'fullName email');

    if (!request) {
      throw new AppError('Maintenance request not found', 404, 'REQUEST_NOT_FOUND');
    }

    if (req.user.role !== 'admin' &&
        request.propertyId?.landlordId?.toString() !== req.user._id?.toString()) {
      throw new AppError('Not authorized to update this request', 403, 'MAINTENANCE_ACCESS_DENIED');
    }

    res.json({
      success: true,
      message: 'Resolution notes added',
      data: { request }
    });
  } catch (error) {
    next(error);
  }
};

exports.getRequestStatistics = async (req, res, next) => {
  try {
    const filter = {};

    if (req.user.role === 'tenant') {
      filter.tenantId = req.user._id;
    } else if (req.user.role === 'landlord') {
      const properties = await Property.find({ landlordId: req.user._id }).select('_id');
      filter.propertyId = { $in: properties.map(p => p._id) };
    }

    const statistics = await MaintenanceRequest.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          highUrgency: { $sum: { $cond: [{ $eq: ['$urgency', 'high'] }, 1, 0] } },
          avgResolutionTime: {
            $avg: {
              $cond: [
                { $and: [{ $ne: ['$resolvedDate', null] }, { $ne: ['$requestedDate', null] }] },
                { $subtract: ['$resolvedDate', '$requestedDate'] },
                null
              ]
            }
          }
        }
      }
    ]);

    const byUrgency = await MaintenanceRequest.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$urgency',
          count: { $sum: 1 }
        }
      }
    ]);

    const byCategory = await MaintenanceRequest.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = statistics[0] || {
      total: 0, pending: 0, inProgress: 0, completed: 0, rejected: 0,
      highUrgency: 0, avgResolutionTime: null
    };

    res.json({
      success: true,
      data: {
        summary: {
          total: stats.total,
          pending: stats.pending,
          inProgress: stats.inProgress,
          completed: stats.completed,
          rejected: stats.rejected,
          highUrgency: stats.highUrgency,
          avgResolutionHours: stats.avgResolutionTime
            ? (stats.avgResolutionTime / (1000 * 60 * 60)).toFixed(1)
            : null
        },
        byUrgency,
        byStatus: byCategory,
        completionRate: stats.total > 0
          ? ((stats.completed / stats.total) * 100).toFixed(1)
          : 0
      }
    });
  } catch (error) {
    next(error);
  }
};
