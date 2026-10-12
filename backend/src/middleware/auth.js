const jwt = require('jsonwebtoken');
const User = require('../models/User');

// The only endpoints usable while a password change is pending
const PASSWORD_CHANGE_ALLOWED = ['GET /api/auth/me', 'PUT /api/auth/me/password'];

async function protect(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) return res.status(401).json({ message: 'Account not found or disabled' });
    req.user = user;
    if (user.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.includes(`${req.method} ${req.originalUrl.split('?')[0]}`)) {
      return res.status(403).json({ message: 'You must change your password before continuing', code: 'PASSWORD_CHANGE_REQUIRED' });
    }
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

/** authorize('admin', 'council') */
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'You do not have access to this resource' });
    next();
  };
}

const staffOnly = authorize('admin', 'council');

module.exports = { protect, authorize, staffOnly };
