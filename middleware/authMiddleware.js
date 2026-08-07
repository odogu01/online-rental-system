const jwt = require('jsonwebtoken');
const User = require('../models/User');

const BLACKLIST_CLEANUP_INTERVAL = 3600000;

class TokenBlacklist {
  constructor() {
    this.blacklist = new Set();
    this.startCleanup();
  }

  add(token) {
    this.blacklist.add(token);
  }

  has(token) {
    return this.blacklist.has(token);
  }

  startCleanup() {
    setInterval(() => {
      if (this.blacklist.size > 0) {
        this.blacklist.clear();
      }
    }, BLACKLIST_CLEANUP_INTERVAL);
  }
}

const tokenBlacklist = new TokenBlacklist();

const extractToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    return req.headers.authorization.split(' ')[1];
  }
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  return null;
};

const protect = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No authentication token provided.'
      });
    }

    if (tokenBlacklist.has(token)) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked. Please login again.'
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not defined in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Internal server error. Authentication configuration missing.'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Authentication token has expired. Please login again.',
          expiredAt: jwtError.expiredAt
        });
      }
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid authentication token.'
        });
      }
      if (jwtError.name === 'NotBeforeError') {
        return res.status(401).json({
          success: false,
          message: 'Token is not yet active.'
        });
      }
      throw jwtError;
    }

    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account associated with this token no longer exists.'
      });
    }

    if (!user.isActive && user.isActive !== undefined) {
      return res.status(401).json({
        success: false,
        message: 'User account has been deactivated.'
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Authentication service error. Please try again.'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (user) {
          req.user = user;
          req.token = token;
        }
      } catch (e) {
        // Token invalid or expired - continue without auth
      }
    }
    next();
  } catch (error) {
    next();
  }
};

const logout = (req, res) => {
  const token = extractToken(req);
  if (token) {
    tokenBlacklist.add(token);
  }
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};

module.exports = { protect, optionalAuth, logout };
