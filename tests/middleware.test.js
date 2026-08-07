/**
 * Tests for Express middleware: auth, role, validation, error.
 */

describe('Error Middleware', () => {
  let AppError, asyncHandler;

  beforeAll(() => {
    const errorMiddleware = require('../middleware/errorMiddleware');
    AppError = errorMiddleware.AppError;
    asyncHandler = errorMiddleware.asyncHandler;
  });

  test('AppError creates error with message and statusCode', () => {
    const err = new AppError('Test error', 400, 'TEST_CODE');
    expect(err.message).toBe('Test error');
    expect(err.statusCode).toBe(400);
    expect(err.errorCode).toBe('TEST_CODE');
    expect(err.isOperational).toBe(true);
    expect(err).toBeInstanceOf(Error);
  });

  test('AppError handles missing statusCode', () => {
    const err = new AppError('Server error');
    expect(err.statusCode).toBeUndefined();
    expect(err.isOperational).toBe(true);
  });

  test('asyncHandler wraps async function and catches errors', async () => {
    const fn = async () => { throw new AppError('Async error', 400); };
    const wrapped = asyncHandler(fn);
    const req = {};
    const res = {};
    const next = jest.fn();
    await wrapped(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].message).toBe('Async error');
  });

  test('asyncHandler passes successful responses', async () => {
    const fn = async (req, res) => { res.json({ success: true }); };
    const wrapped = asyncHandler(fn);
    const req = {};
    const res = { json: jest.fn() };
    const next = jest.fn();
    await wrapped(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('Auth Middleware', () => {
  let protect;

  beforeAll(() => {
    const authMiddleware = require('../middleware/authMiddleware');
    protect = authMiddleware.protect;
  });

  test('returns 401 if no token provided', () => {
    const req = { headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    protect(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(next).not.toHaveBeenCalled();
  });
});

describe('Role Middleware', () => {
  let authorize, requirePermission, checkOwnership;

  beforeAll(() => {
    const roleMiddleware = require('../middleware/roleMiddleware');
    authorize = roleMiddleware.authorize;
    requirePermission = roleMiddleware.requirePermission;
    checkOwnership = roleMiddleware.checkOwnership;
  });

  test('authorize blocks unauthenticated requests (no req.user)', () => {
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    authorize('admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('authorize blocks wrong role', () => {
    const req = { user: { _id: '123', role: 'tenant' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    authorize('admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('authorize allows matching role', () => {
    const req = { user: { _id: '123', role: 'admin' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    authorize('admin')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('authorize allows multiple roles', () => {
    const req = { user: { _id: '123', role: 'landlord' } };
    const next = jest.fn();
    authorize('admin', 'landlord')(req, { status: jest.fn().mockReturnThis(), json: jest.fn() }, next);
    expect(next).toHaveBeenCalled();
  });

  test('checkOwnership bypasses for admin role', () => {
    const req = { user: { _id: '123', role: 'admin' }, params: {} };
    const next = jest.fn();
    checkOwnership('userId')(req, {}, next);
    expect(next).toHaveBeenCalled();
  });

  test('requirePermission blocks missing permission', () => {
    const req = { user: { _id: '123', role: 'tenant' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    requirePermission('manage:system')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('Validation Middleware', () => {
  let validate;

  beforeAll(() => {
    const validationMiddleware = require('../middleware/validationMiddleware');
    validate = validationMiddleware.validate;
  });

  test('validate passes through when no validation errors', () => {
    validate({}, {}, jest.fn());
  });
});
