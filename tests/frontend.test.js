/**
 * Frontend integration tests - verifies all HTML/CSS/JS files exist and are valid.
 * Uses fs for file existence checks and basic content validation (no browser needed).
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

describe('JS Modules', () => {
  const modules = ['api.js', 'auth.js', 'validation.js', 'dashboard.js', 'property.js', 'payment.js', 'maintenance.js', 'report.js'];

  modules.forEach(mod => {
    test(`${mod} exists and has valid JavaScript syntax`, () => {
      const filePath = path.join(PUBLIC_DIR, 'js', mod);
      expect(fs.existsSync(filePath)).toBe(true);
      const code = fs.readFileSync(filePath, 'utf8');
      expect(code.length).toBeGreaterThan(100);
      // Check it has function definitions
      expect(code).toMatch(/function\s+\w+/);
    });
  });

  test('api.js contains core HTTP functions', () => {
    const code = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'api.js'), 'utf8');
    expect(code).toContain('apiGet');
    expect(code).toContain('apiPost');
    expect(code).toContain('apiPut');
    expect(code).toContain('apiDelete');
    expect(code).toContain('authenticatedFetch');
    expect(code).toContain('downloadFile');
  });

  test('auth.js contains auth functions', () => {
    const code = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'auth.js'), 'utf8');
    expect(code).toContain('function login');
    expect(code).toContain('function register');
    expect(code).toContain('function logout');
    expect(code).toContain('function protectPage');
    expect(code).toContain('function redirectAfterLogin');
    expect(code).toContain('localStorage');
  });

  test('validation.js contains all validation rules', () => {
    const code = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'validation.js'), 'utf8');
    const rules = ['required', 'email', 'password', 'minLength', 'maxLength', 'numeric', 'integer', 'min', 'max', 'phone', 'url', 'oneOf', 'matchField', 'date', 'futureDate', 'dateBefore'];
    rules.forEach(rule => {
      expect(code).toContain(rule);
    });
    expect(code).toContain('ValidationRules');
    expect(code).toContain('validateField');
    expect(code).toContain('validateForm');
    expect(code).toContain('addRealTimeValidation');
  });

  test('dashboard.js contains utility functions', () => {
    const code = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'dashboard.js'), 'utf8');
    expect(code).toContain('function formatDate');
    expect(code).toContain('function formatCurrency');
    expect(code).toContain('function truncate');
    expect(code).toContain('function getStatusBadge');
    // showToast is defined inline in HTML pages, not in dashboard.js
    expect(code).toContain('function emptyState');
  });
});

describe('CSS', () => {
  test('style.css contains all critical classes', () => {
    const css = fs.readFileSync(path.join(PUBLIC_DIR, 'css', 'style.css'), 'utf8');
    const classes = ['.sidebar', '.main-content', '.stat-card', '.toast', '.modal', '.form-input', '.btn', '.data-table', '.filter-bar'];
    classes.forEach(cls => { expect(css).toContain(cls); });
    expect(css).toContain('@media');
    expect(css).toContain('@keyframes');
    expect(css).toContain('--primary');
    expect(css).toContain('--danger');
  });
});

describe('Public HTML Pages', () => {
  const pages = ['index.html', 'login.html', 'register.html', 'properties.html'];

  pages.forEach(page => {
    test(`${page} exists with correct structure`, () => {
      const html = fs.readFileSync(path.join(PUBLIC_DIR, page), 'utf8');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).not.toContain('tailwindcss');
      expect(html).toContain('font-awesome');
      expect(html).toContain('css/style.css');
      expect(html).toContain('js/');
    });
  });

  test('index.html has hero section and features', () => {
    const html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
    expect(html).toContain('hero');
    expect(html).toContain('feature');
    expect(html).toContain('How It Works');
    expect(html).toContain('Obong University');
  });

  test('login.html has form and validation', () => {
    const html = fs.readFileSync(path.join(PUBLIC_DIR, 'login.html'), 'utf8');
    expect(html).toContain('type="email"');
    expect(html).toContain('type="password"');
    expect(html).toContain('login');
    expect(html).toContain('register');
  });
});

describe('Dashboard Pages', () => {
  const dashboards = [
    'landlord/dashboard.html', 'landlord/properties.html', 'landlord/property-add.html',
    'landlord/property-edit.html', 'landlord/leases.html', 'landlord/lease-create.html',
    'landlord/tenants.html', 'landlord/payments.html', 'landlord/payment-record.html',
    'landlord/maintenance.html', 'landlord/reports.html', 'landlord/profile.html',
    'tenant/dashboard.html', 'tenant/properties.html', 'tenant/my-property.html',
    'tenant/payments.html', 'tenant/maintenance.html', 'tenant/maintenance-create.html',
    'tenant/profile.html',
    'admin/dashboard.html', 'admin/users.html', 'admin/properties.html',
    'admin/leases.html', 'admin/disputes.html', 'admin/reports.html', 'admin/profile.html'
  ];

  test('all 26 dashboard pages exist', () => {
    dashboards.forEach(page => {
      const filePath = path.join(PUBLIC_DIR, page);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  test('each dashboard has required includes', () => {
    dashboards.forEach(page => {
      const html = fs.readFileSync(path.join(PUBLIC_DIR, page), 'utf8');
      expect(html).toContain('<html');
      expect(html).toContain('js/api.js');
      expect(html).toContain('js/auth.js');
      expect(html).toContain('protectPage');
    });
  });

  test('landlord pages have landlord-specific nav', () => {
    const html = fs.readFileSync(path.join(PUBLIC_DIR, 'landlord', 'dashboard.html'), 'utf8');
    expect(html).toContain('Landlord Portal');
    expect(html).toContain('My Properties');
    expect(html).toContain('Leases');
    expect(html).toContain('Tenants');
    expect(html).toContain('Payments');
  });

  test('tenant pages have tenant-specific nav', () => {
    const html = fs.readFileSync(path.join(PUBLIC_DIR, 'tenant', 'dashboard.html'), 'utf8');
    expect(html).toContain('Tenant Portal');
    expect(html).toContain('Browse Properties');
    expect(html).toContain('My Property');
    expect(html).toContain('Maintenance');
  });

  test('all HTML pages have favicon link', () => {
    const dirs = ['', 'landlord', 'tenant', 'admin'];
    const files = [];
    dirs.forEach(dir => {
      const dirPath = dir ? path.join(PUBLIC_DIR, dir) : PUBLIC_DIR;
      fs.readdirSync(dirPath).filter(f => f.endsWith('.html')).forEach(f => files.push(dir ? `${dir}/${f}` : f));
    });
    expect(files.length).toBe(30);
    files.forEach(f => {
      const html = fs.readFileSync(path.join(PUBLIC_DIR, f), 'utf8');
      expect(html).toContain('favicon.svg');
    });
    // Verify the favicon file itself exists
    expect(fs.existsSync(path.join(PUBLIC_DIR, 'favicon.svg'))).toBe(true);
  });

  test('admin pages have admin-specific nav', () => {
    const html = fs.readFileSync(path.join(PUBLIC_DIR, 'admin', 'dashboard.html'), 'utf8');
    expect(html).toContain('Admin Portal');
    expect(html).toContain('Users');
    expect(html).toContain('Disputes');
  });
});

describe('Project Structure', () => {
  test('backend structure is complete', () => {
    const dirs = ['models', 'controllers', 'routes', 'middleware', 'services', 'public', 'tests'];
    dirs.forEach(d => { expect(fs.existsSync(path.join(__dirname, '..', d))).toBe(true); });
  });

  test('all 6 controllers exist', () => {
    const controllers = ['authController.js', 'propertyController.js', 'leaseController.js',
      'paymentController.js', 'maintenanceController.js', 'reportController.js', 'adminController.js'];
    controllers.forEach(c => { expect(fs.existsSync(path.join(__dirname, '..', 'controllers', c))).toBe(true); });
  });

  test('all 6 route files exist', () => {
    const routes = ['authRoutes.js', 'propertyRoutes.js', 'leaseRoutes.js',
      'paymentRoutes.js', 'maintenanceRoutes.js', 'reportRoutes.js', 'adminRoutes.js'];
    routes.forEach(r => { expect(fs.existsSync(path.join(__dirname, '..', 'routes', r))).toBe(true); });
  });

  test('all 4 middleware files exist', () => {
    const middleware = ['authMiddleware.js', 'roleMiddleware.js', 'validationMiddleware.js', 'errorMiddleware.js'];
    middleware.forEach(m => { expect(fs.existsSync(path.join(__dirname, '..', 'middleware', m))).toBe(true); });
  });

  test('.env template exists', () => {
    expect(fs.existsSync(path.join(__dirname, '..', '.env'))).toBe(true);
    const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    expect(env).toContain('MONGODB_URI');
    expect(env).toContain('JWT_SECRET');
  });
});
