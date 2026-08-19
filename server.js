require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const errorMiddleware = require('./middleware/errorMiddleware');
const { sanitizeBody } = require('./middleware/validationMiddleware');
const { authLimiter, apiLimiter } = require('./middleware/rateLimitMiddleware');
const { startScheduledJobs } = require('./services/jobScheduler');

const authRoutes = require('./routes/authRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const leaseRoutes = require('./routes/leaseRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const reportRoutes = require('./routes/reportRoutes');
const adminRoutes = require('./routes/adminRoutes');
const inquiryRoutes = require('./routes/inquiryRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

// Disable ETag generation. Express's default weak ETag makes browsers revalidate
// API GETs with If-None-Match, and Express then answers 304 Not Modified with an
// EMPTY body — which breaks response.json() on the client and leaves dashboards
// stuck on "Loading...". Without ETags, API responses carry no validators, so a
// 304 is impossible. (Static assets still revalidate via Last-Modified, which the
// browser handles transparently.)
app.disable('etag');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
    }
  }
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Sanitize request bodies to strip scripts / event handlers / javascript: URIs (XSS defense)
app.use('/api', sanitizeBody);

// Apply auth rate limiting on login/register and a general limit on all /api routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', apiLimiter);

// API responses carry sensitive/auth data — never let browsers cache them.
// Express's default ETag makes browsers revalidate API GETs and answer 304
// with an EMPTY body, which breaks response.json() on the client.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded images from wherever they're stored:
// local dev -> public/uploads, Vercel serverless -> OS temp dir (/tmp).
// (Uploaded files are NOT persisted on Vercel's ephemeral filesystem —
// for permanent storage use Vercel Blob or an object store.)
const { UPLOAD_PATH } = require('./middleware/uploadMiddleware');
app.use('/uploads', express.static(UPLOAD_PATH));

app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/leases', leaseRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Online Rental Property Management System API' });
});

app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

// Warn if the JWT secret is missing or looks like a placeholder
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('your_') || process.env.JWT_SECRET.length < 32) {
  console.warn('WARNING: JWT_SECRET is missing or looks like a placeholder — set a strong secret in production.');
}

// Only start the server when run directly (node server.js).
// On Vercel, api/index.js imports this app and handles requests instead.
if (require.main === module) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('Connected to MongoDB');
      try {
        startScheduledJobs();
      } catch (err) {
        console.error('Failed to start scheduled jobs:', err.message);
      }
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('MongoDB connection error:', err.message);
      process.exit(1);
    });
}

module.exports = app;
