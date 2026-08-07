const User = require('../models/User');
const Property = require('../models/Property');
const Lease = require('../models/Lease');
const Payment = require('../models/Payment');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const { AppError } = require('../middleware/errorMiddleware');

/**
 * GET /api/admin/users
 * List all users with optional role/status/search filtering
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const { role, status, search, page = 1, limit = 50 } = req.query;

    const filter = {};

    if (role && ['landlord', 'tenant', 'admin'].includes(role)) {
      filter.role = role;
    }

    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments(filter);

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/users/:id
 * Get single user details with stats (properties, leases, payments, maintenance)
 */
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    let stats = {};

    if (user.role === 'landlord') {
      const [properties, leases] = await Promise.all([
        Property.countDocuments({ landlordId: user._id }),
        Lease.countDocuments({ propertyId: { $in: (await Property.find({ landlordId: user._id }).select('_id')).map(p => p._id) } })
      ]);
      stats = { properties, leases };
    } else if (user.role === 'tenant') {
      const [leases, payments, maintenance] = await Promise.all([
        Lease.countDocuments({ tenantId: user._id }),
        Payment.countDocuments({ leaseId: { $in: (await Lease.find({ tenantId: user._id }).select('_id')).map(l => l._id) } }),
        MaintenanceRequest.countDocuments({ tenantId: user._id })
      ]);
      stats = { leases, payments, maintenance };
    }

    res.json({
      success: true,
      data: { user, stats }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/users/:id/role
 * Update user role
 */
exports.updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;

    if (!role || !['landlord', 'tenant', 'admin'].includes(role)) {
      throw new AppError('Valid role is required (landlord, tenant, admin)', 400, 'INVALID_ROLE');
    }

    if (req.params.id === req.user._id.toString()) {
      throw new AppError('Cannot change your own role', 400, 'SELF_ROLE_CHANGE');
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/users/:id/status
 * Activate or deactivate a user account
 */
exports.toggleUserStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      throw new AppError('isActive must be a boolean value', 400, 'INVALID_STATUS');
    }

    if (req.params.id === req.user._id.toString()) {
      throw new AppError('Cannot deactivate your own account', 400, 'SELF_DEACTIVATE');
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/users/:id
 * Delete a user account (admin only)
 */
exports.deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      throw new AppError('Cannot delete your own account', 400, 'SELF_DELETE');
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Check for active leases
    if (user.role === 'landlord') {
      const activeLeases = await Lease.countDocuments({
        propertyId: { $in: (await Property.find({ landlordId: user._id }).select('_id')).map(p => p._id) },
        status: 'active'
      });
      if (activeLeases > 0) {
        throw new AppError('Cannot delete landlord with active leases. Terminate leases first.', 400, 'ACTIVE_LEASES_EXIST');
      }
    } else if (user.role === 'tenant') {
      const activeLeases = await Lease.countDocuments({ tenantId: user._id, status: 'active' });
      if (activeLeases > 0) {
        throw new AppError('Cannot delete tenant with active leases. Terminate leases first.', 400, 'ACTIVE_LEASES_EXIST');
      }
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/stats
 * Get system-wide statistics
 */
exports.getSystemStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalLandlords,
      totalTenants,
      totalAdmins,
      totalProperties,
      vacantProperties,
      occupiedProperties,
      totalLeases,
      activeLeases,
      totalPayments,
      paidAmount,
      overdueAmount,
      totalMaintenance,
      pendingMaintenance
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'landlord' }),
      User.countDocuments({ role: 'tenant' }),
      User.countDocuments({ role: 'admin' }),
      Property.countDocuments(),
      Property.countDocuments({ status: 'vacant' }),
      Property.countDocuments({ status: 'occupied' }),
      Lease.countDocuments(),
      Lease.countDocuments({ status: 'active' }),
      Payment.countDocuments({ status: 'paid' }),
      Payment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Payment.aggregate([{ $match: { status: 'overdue' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      MaintenanceRequest.countDocuments(),
      MaintenanceRequest.countDocuments({ status: 'pending' })
    ]);

    res.json({
      success: true,
      data: {
        users: { total: totalUsers, landlords: totalLandlords, tenants: totalTenants, admins: totalAdmins },
        properties: { total: totalProperties, vacant: vacantProperties, occupied: occupiedProperties },
        leases: { total: totalLeases, active: activeLeases },
        payments: { totalPaid: totalPayments, collectedAmount: paidAmount[0]?.total || 0, overdueAmount: overdueAmount[0]?.total || 0 },
        maintenance: { total: totalMaintenance, pending: pendingMaintenance }
      }
    });
  } catch (error) {
    next(error);
  }
};
