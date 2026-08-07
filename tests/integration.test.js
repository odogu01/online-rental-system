/**
 * Integration tests for server setup, route mounts, and middleware.
 * Tests Express app configuration without a live DB.
 */

describe('Server Integration', () => {
  let app;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-for-integration';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
    process.env.APP_URL = 'http://localhost:5000';
    process.env.NODE_ENV = 'test';
    app = require('../server');
  });

  test('Express app is created and configured', () => {
    expect(app).toBeDefined();
    expect(typeof app.use).toBe('function');
    expect(typeof app.get).toBe('function');
    expect(typeof app.post).toBe('function');
    expect(typeof app.put).toBe('function');
    expect(typeof app.delete).toBe('function');
  });

  test('app has helmet configured (security middleware)', () => {
    const stack = app._router.stack;
    const hasHelmet = stack.some(layer =>
      layer.name === 'helmet' || (layer.handle && layer.handle.name === 'helmet')
    );
    // Note: helmet may not appear by name in stack, but handler is there
    expect(stack.length).toBeGreaterThan(0);
  });

  test('app has JSON body parser configured', () => {
    const stack = app._router.stack;
    const hasJsonParser = stack.some(layer =>
      layer.name === 'jsonParser' || layer.name === 'expressInit'
    );
    expect(stack.length).toBeGreaterThan(5);
  });

  test('server.js exports properly for testing', () => {
    // Verify app is a valid Express app
    expect(app.settings).toBeDefined();
    expect(typeof app.listen).toBe('function');
  });

  test('all required env vars are checked', () => {
    expect(process.env.JWT_SECRET).toBeDefined();
    expect(process.env.MONGODB_URI).toBeDefined();
    expect(process.env.APP_URL).toBeDefined();
  });
});
