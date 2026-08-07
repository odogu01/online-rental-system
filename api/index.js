/**
 * Vercel serverless entry point.
 * Vercel calls this exported function for every HTTP request.
 * MongoDB connects lazily (cached by Mongoose) to survive warm starts.
 */
const mongoose = require('mongoose');
const app = require('../server');

module.exports = async function handler(req, res) {
  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
      });
    }
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Database connection failed. Check MONGODB_URI in Vercel env vars.',
    });
  }

  // Delegate to the Express app
  return app(req, res);
};
