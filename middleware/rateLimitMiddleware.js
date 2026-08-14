const requests = new Map();

const pruneExpired = (now) => {
  for (const [ip, entry] of requests) {
    if (entry.resetAt <= now) {
      requests.delete(ip);
    }
  }
};

const createRateLimiter = ({ windowMs, max, message }) => {
  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';

    if (requests.size > 10000) {
      pruneExpired(now);
    }

    const current = requests.get(ip);
    if (!current || current.resetAt <= now) {
      if (current) requests.delete(ip);
      requests.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;

    if (current.count > max) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      return res.status(429).json({
        success: false,
        message
      }).set('Retry-After', String(retryAfter));
    }

    next();
  };
};

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many attempts. Please try again later.'
});

const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'Too many requests. Please slow down.'
});

module.exports = { createRateLimiter, authLimiter, apiLimiter };