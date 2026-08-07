/**
 * Tests for Mongoose model schemas - structural and validation checks.
 * Focuses on what the models actually export.
 */

describe('Model Schemas', () => {
  test('User model has correct schema paths', () => {
    const User = require('../models/User');
    const paths = Object.keys(User.schema.paths);
    expect(paths).toContain('fullName');
    expect(paths).toContain('email');
    expect(paths).toContain('password');
    expect(paths).toContain('role');
    expect(paths).toContain('phoneNumber');
    expect(paths).toContain('isActive');
    expect(paths).toContain('createdAt');
    expect(paths).toContain('updatedAt');
  });

  test('User model has email as required and unique', () => {
    const User = require('../models/User');
    const emailPath = User.schema.path('email');
    expect(emailPath).toBeDefined();
    expect(emailPath.options.required).toBeTruthy();
    expect(emailPath.options.unique).toBe(true);
  });

  test('User role is restricted to enum values', () => {
    const User = require('../models/User');
    const rolePath = User.schema.path('role');
    expect(rolePath.enumValues).toContain('landlord');
    expect(rolePath.enumValues).toContain('tenant');
    expect(rolePath.enumValues).toContain('admin');
  });

  test('User schema has timestamps enabled', () => {
    const User = require('../models/User');
    expect(User.schema.options.timestamps).toBe(true);
  });

  test('Property model has required fields', () => {
    const Property = require('../models/Property');
    const paths = Object.keys(Property.schema.paths);
    expect(paths).toContain('title');
    expect(paths).toContain('location');
    expect(paths).toContain('rentAmount');
    expect(paths).toContain('bedrooms');
    expect(paths).toContain('bathrooms');
    expect(paths).toContain('status');
    expect(paths).toContain('landlordId');
  });

  test('Property status has correct enum values', () => {
    const Property = require('../models/Property');
    const statusPath = Property.schema.path('status');
    expect(statusPath.enumValues).toContain('vacant');
    expect(statusPath.enumValues).toContain('occupied');
    expect(statusPath.enumValues).toContain('maintenance');
  });

  test('Property has indexes defined', () => {
    const Property = require('../models/Property');
    const indexes = Property.schema.indexes();
    expect(indexes.length).toBeGreaterThanOrEqual(4);
    const indexFields = indexes.map(i => Object.keys(i[0]));
    expect(indexFields.some(f => f.includes('landlordId'))).toBe(true);
    expect(indexFields.some(f => f.includes('status'))).toBe(true);
  });

  test('Lease model has correct fields and status', () => {
    const Lease = require('../models/Lease');
    const paths = Object.keys(Lease.schema.paths);
    expect(paths).toContain('propertyId');
    expect(paths).toContain('tenantId');
    expect(paths).toContain('startDate');
    expect(paths).toContain('endDate');
    expect(paths).toContain('monthlyRent');
    expect(paths).toContain('securityDeposit');
    expect(paths).toContain('status');

    const statusPath = Lease.schema.path('status');
    expect(statusPath.enumValues).toContain('active');
    expect(statusPath.enumValues).toContain('expired');
    expect(statusPath.enumValues).toContain('terminated');
  });

  test('Payment model has correct fields', () => {
    const Payment = require('../models/Payment');
    const paths = Object.keys(Payment.schema.paths);
    expect(paths).toContain('leaseId');
    expect(paths).toContain('amount');
    expect(paths).toContain('paymentDate');
    expect(paths).toContain('dueDate');
    expect(paths).toContain('paymentMethod');
    expect(paths).toContain('status');
    expect(paths).toContain('paymentReference');

    const statusPath = Payment.schema.path('status');
    expect(statusPath.enumValues).toContain('paid');
    expect(statusPath.enumValues).toContain('pending');
    expect(statusPath.enumValues).toContain('overdue');
  });

  test('MaintenanceRequest has correct status and urgency enums', () => {
    const MR = require('../models/MaintenanceRequest');
    const paths = Object.keys(MR.schema.paths);
    expect(paths).toContain('tenantId');
    expect(paths).toContain('propertyId');
    expect(paths).toContain('subject');
    expect(paths).toContain('description');
    expect(paths).toContain('urgency');
    expect(paths).toContain('status');

    const statusPath = MR.schema.path('status');
    expect(statusPath.enumValues).toContain('pending');
    expect(statusPath.enumValues).toContain('in-progress');
    expect(statusPath.enumValues).toContain('completed');
    expect(statusPath.enumValues).toContain('rejected');

    const urgencyPath = MR.schema.path('urgency');
    expect(urgencyPath.enumValues).toContain('low');
    expect(urgencyPath.enumValues).toContain('medium');
    expect(urgencyPath.enumValues).toContain('high');
  });

  test('Notification model has TTL expiration on createdAt', () => {
    const Notification = require('../models/Notification');
    const createdAtPath = Notification.schema.path('createdAt');
    expect(createdAtPath).toBeDefined();
    // TTL is set via expires on the createdAt field definition
    // Also check secondary index
    const indexes = Notification.schema.indexes();
    const hasUserIdIndex = indexes.some(i =>
      i[0] && i[0].userId === 1 && i[0].isRead === 1
    );
    expect(hasUserIdIndex).toBe(true);
    // The TTL index may be handled by MongoDB at the field level via expires option
    expect(createdAtPath.options.expires).toBe(7776000); // 90 days
  });
});

describe('Server Configuration', () => {
  test('package.json has all required dependencies', () => {
    const pkg = require('../package.json');
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    const required = ['express', 'mongoose', 'bcrypt', 'jsonwebtoken', 'express-validator',
      'helmet', 'cors', 'dotenv', 'nodemailer', 'multer', 'pdfkit', 'csv-writer', 'node-cron', 'jest'];
    required.forEach(dep => {
      expect(deps[dep]).toBeDefined();
    });
  });
});

describe('Route Definitions', () => {
  test('all 7 route files export a router', () => {
    const routes = [
      '../routes/authRoutes',
      '../routes/propertyRoutes',
      '../routes/leaseRoutes',
      '../routes/paymentRoutes',
      '../routes/maintenanceRoutes',
      '../routes/reportRoutes',
      '../routes/adminRoutes'
    ];
    routes.forEach(r => {
      const router = require(r);
      expect(router).toBeDefined();
      expect(typeof router.use).toBe('function');
      expect(typeof router.get).toBe('function');
      expect(typeof router.post).toBe('function');
    });
  });
});
