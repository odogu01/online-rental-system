const { validationResult, body, query, param } = require('express-validator');
const path = require('path');

const ALLOWED_IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value !== undefined ? sanitizeValue(err.value) : undefined,
      location: err.location || 'body'
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed. Please check your input.',
      errors: formattedErrors,
      errorCount: formattedErrors.length
    });
  }
  next();
};

const sanitizeValue = (value) => {
  if (typeof value === 'string') {
    const sanitized = value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .trim();
    return sanitized.length < value.length ? '(sanitized)' : value;
  }
  return value;
};

const commonValidators = {
  objectId: (field) =>
    body(field)
      .isMongoId()
      .withMessage(`'${field}' must be a valid ID`),

  email: (field = 'email') =>
    body(field)
      .isEmail()
      .normalizeEmail()
      .withMessage('A valid email address is required'),

  password: (field = 'password', min = 8) =>
    body(field)
      .isLength({ min })
      .withMessage(`Password must be at least ${min} characters`)
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and number'),

  notEmpty: (field) =>
    body(field)
      .trim()
      .notEmpty()
      .withMessage(`'${field}' is required`),

  numeric: (field, { min, max } = {}) => {
    let validator = body(field).isNumeric().withMessage(`'${field}' must be a number`);
    if (min !== undefined) validator = validator.isFloat({ min }).withMessage(`'${field}' minimum is ${min}`);
    if (max !== undefined) validator = validator.isFloat({ max }).withMessage(`'${field}' maximum is ${max}`);
    return validator;
  },

  integer: (field, { min, max } = {}) => {
    let validator = body(field).isInt({ min, max }).withMessage(`'${field}' must be a whole number`);
    if (min !== undefined) validator = validator.isInt({ min }).withMessage(`'${field}' minimum is ${min}`);
    if (max !== undefined) validator = validator.isInt({ max }).withMessage(`'${field}' maximum is ${max}`);
    return validator;
  },

  date: (field) =>
    body(field)
      .isISO8601()
      .withMessage(`'${field}' must be a valid date (ISO 8601 format)`),

  boolean: (field) =>
    body(field)
      .isBoolean()
      .withMessage(`'${field}' must be true or false`),

  url: (field) =>
    body(field)
      .isURL()
      .withMessage(`'${field}' must be a valid URL`),

  stringLength: (field, { min, max } = {}) => {
    let validator = body(field).isString().trim();
    if (min !== undefined) validator = validator.isLength({ min }).withMessage(`'${field}' must be at least ${min} characters`);
    if (max !== undefined) validator = validator.isLength({ max }).withMessage(`'${field}' must not exceed ${max} characters`);
    return validator;
  },

  phone: (field = 'phoneNumber') =>
    body(field)
      .optional()
      .matches(/^\+?[\d\s\-()]{7,20}$/)
      .withMessage('Please provide a valid phone number'),

  enum: (field, values) =>
    body(field)
      .isIn(values)
      .withMessage(`'${field}' must be one of: ${values.join(', ')}`),

  imageFile: (field = 'image') =>
    body(field)
      .custom((value, { req }) => {
        if (!req.file) return true;
        const ext = path.extname(req.file.originalname).toLowerCase();
        if (!ALLOWED_IMAGE_TYPES.includes(ext)) {
          throw new Error(`Only ${ALLOWED_IMAGE_TYPES.join(', ')} files are allowed`);
        }
        if (req.file.size > MAX_IMAGE_SIZE) {
          throw new Error(`File size must not exceed ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
        }
        return true;
      })
};

const SCRIPT_TAG_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const JAVASCRIPT_URI_RE = /\s*:\s*javascript\s*:/gi;
const EVENT_HANDLER_RE = /\son\w+\s*=\s*["']?[^"'>]*["']?/gi;
const EVENT_HANDLER_ATTR_RE = /^on\w+$/i;

const sanitizeString = (value) => {
  return String(value)
    .replace(SCRIPT_TAG_RE, '')
    .replace(/javascript\s*:/gi, '')
    .replace(EVENT_HANDLER_RE, '')
    .trim();
};

const sanitizeNode = (node) => {
  if (typeof node === 'string') {
    return sanitizeString(node);
  }
  if (Array.isArray(node)) {
    return node.map(item => sanitizeNode(item));
  }
  if (node && typeof node === 'object') {
    const result = {};
    for (const key of Object.keys(node)) {
      if (EVENT_HANDLER_ATTR_RE.test(key)) {
        continue;
      }
      result[key] = sanitizeNode(node[key]);
    }
    return result;
  }
  return node;
};

const sanitizeBody = (req, res, next) => {
  if (req.body && (typeof req.body === 'object')) {
    req.body = sanitizeNode(req.body);
  }
  next();
};

module.exports = {
  validate,
  sanitizeBody,
  commonValidators,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE
};
