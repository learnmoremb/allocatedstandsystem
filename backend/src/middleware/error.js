module.exports = function errorHandler(err, req, res, next) {
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {}).join(', ');
    const messages = {
      email: 'An account with this email already exists',
      nationalId: 'An account with this national ID already exists',
      'area, standNumber': 'A stand with this number already exists in this area',
    };
    return res.status(409).json({ message: messages[field] || `Duplicate value for ${field}`, field });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join('; ') });
  }
  if (err.name === 'CastError') return res.status(400).json({ message: `Invalid ${err.path}` });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'File is too large' });

  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    message: status === 500 ? 'Server error' : err.message,
    ...(err.code && typeof err.code === 'string' ? { code: err.code } : {}),
    ...(err.details ? { details: err.details } : {}),
  });
};
