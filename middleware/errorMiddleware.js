const fs = require('fs');
const path = require('path');

const errorLogger = (err, req) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection?.remoteAddress,
    userId: req.user?._id || 'unauthenticated',
    errorName: err.name,
    errorMessage: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  };

  const logDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logDir)) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch (e) {
      // Silently fail if logs directory can't be created
    }
  }

  const logFile = path.join(logDir, `errors-${new Date().toISOString().split('T')[0]}.log`);
  try {
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  } catch (e) {
    // Silently fail if log can't be written
  }

  return logEntry;
};

class AppError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorMiddleware = (err, req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.error('\n--- ERROR ---');
    console.error('Name:', err.name);
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    console.error('--------------\n');
  }

  let statusCode = err.statusCode || 500;
  let response = {
    success: false,
    message: err.message || 'Internal Server Error'
  };

  if (err.name === 'ValidationError') {
    statusCode = 400;
    response.message = 'Validation Error';
    response.errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
      kind: e.kind
    }));
  }

  else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    response.message = `Duplicate value error`;
    response.field = field;
    response.detail = `A record with ${field} '${value}' already exists`;
  }

  else if (err.name === 'CastError') {
    statusCode = 400;
    response.message = 'Invalid data format';
    response.field = err.path;
    response.detail = `'${err.value}' is not a valid ${err.kind}`;
  }

  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    response.message = 'Invalid authentication token';
  }

  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    response.message = 'Authentication token has expired';
  }

  else if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      response.message = 'File too large';
      response.detail = 'Maximum file size is 5MB';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      response.message = 'Unexpected file field';
    } else {
      response.message = `Upload error: ${err.message}`;
    }
  }

  else if (err.name === 'StrictModeError') {
    statusCode = 400;
    response.message = 'Invalid field in request';
    response.detail = `Field '${err.path}' is not in the schema`;
  }

  else if (err.code === 'ENOENT' || err.code === 'EACCES') {
    statusCode = 500;
    response.message = 'File system error';
    if (process.env.NODE_ENV === 'development') {
      response.detail = err.message;
    }
  }

  else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    response.message = 'Invalid JSON in request body';
  }

  if (!err.isOperational) {
    errorLogger(err, req);

    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
      response.message = 'An unexpected error occurred. Please try again later.';
      delete response.stack;
    }
  }

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = errorMiddleware;
module.exports.AppError = AppError;
module.exports.asyncHandler = asyncHandler;
