const ROLE_HIERARCHY = {
  admin: ['admin', 'landlord', 'tenant'],
  landlord: ['landlord', 'tenant'],
  tenant: ['tenant']
};

const ROLE_PERMISSIONS = {
  admin: {
    description: 'Full system access - manage users, properties, disputes, and oversight',
    grants: ['read:all', 'write:all', 'delete:all', 'manage:users', 'manage:system']
  },
  landlord: {
    description: 'Manage own properties, tenants, leases, payments, and maintenance',
    grants: ['create:property', 'read:own_properties', 'write:own_properties',
             'delete:own_properties', 'create:lease', 'read:own_leases',
             'write:own_leases', 'record:payment', 'read:own_payments',
             'read:own_maintenance', 'write:own_maintenance']
  },
  tenant: {
    description: 'View properties, submit maintenance requests, view payment history',
    grants: ['read:property', 'create:maintenance_request', 'read:own_maintenance',
             'read:own_payments', 'read:own_leases']
  }
};

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login first.'
      });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      const userPermissions = ROLE_PERMISSIONS[userRole];
      const requiredDescriptions = allowedRoles
        .map(role => ROLE_PERMISSIONS[role]?.description || role)
        .join(' or ');

      console.warn(`Access denied: User ${req.user._id} with role '${userRole}' attempted to access route restricted to [${allowedRoles.join(', ')}]`);

      return res.status(403).json({
        success: false,
        message: `Access denied. Role '${userRole}' does not have permission for this operation.`,
        requiredRole: allowedRoles.length === 1 ? allowedRoles[0] : allowedRoles,
        currentRole: userRole,
        hint: userPermissions
          ? `Your role '${userRole}' can: ${userPermissions.description}`
          : undefined
      });
    }

    next();
  };
};

const requirePermission = (...requiredGrants) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const userGrants = ROLE_PERMISSIONS[req.user.role]?.grants || [];
    const hasAllGrants = requiredGrants.every(grant => userGrants.includes(grant));

    if (!hasAllGrants) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions for this operation.'
      });
    }

    next();
  };
};

const checkOwnership = (resourceField) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    const resourceOwnerId = req.params[resourceField] ||
                            req.body[resourceField] ||
                            req.query[resourceField];

    if (resourceOwnerId && resourceOwnerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not own this resource.'
      });
    }

    next();
  };
};

module.exports = { authorize, requirePermission, checkOwnership, ROLE_PERMISSIONS, ROLE_HIERARCHY };
