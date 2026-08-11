const { ApiError } = require('./errorHandler');

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function requireFields(fields) {
  return (req, res, next) => {
    const missing = fields.filter((field) => isBlank(req.body[field]));
    if (missing.length > 0) {
      return next(new ApiError(400, `Missing required field(s): ${missing.join(', ')}`));
    }
    next();
  };
}

function requireOneOf(field, allowedValues) {
  return (req, res, next) => {
    const value = req.body[field];
    if (!allowedValues.includes(value)) {
      return next(
        new ApiError(400, `Invalid ${field}: ${JSON.stringify(value)} (must be one of ${allowedValues.join(', ')})`),
      );
    }
    next();
  };
}

module.exports = { requireFields, requireOneOf };
