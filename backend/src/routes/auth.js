const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { asyncHandler, httpError } = require('../utils/helpers');

const sign = (user) => jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '1d' });

// Public self-registration always creates a general user
router.post('/register', asyncHandler(async (req, res) => {
  const { fullName, email, password, nationalId, phone, address } = req.body;
  if (!fullName || !email || !password || !nationalId) throw httpError(400, 'Full name, email, national ID and password are required');
  if (password.length < 6) throw httpError(400, 'Password must be at least 6 characters');
  const user = await User.create({ fullName, email, password, nationalId, phone, address, role: 'user' });
  res.status(201).json({ token: sign(user), user });
}));

// One login for every role; the client routes to the right dashboard by role
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw httpError(400, 'Email and password are required');
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) throw httpError(401, 'Invalid email or password');
  if (!user.isActive) throw httpError(403, 'Your account has been disabled. Contact the council.');
  res.json({ token: sign(user), user });
}));

router.get('/me', protect, (req, res) => res.json(req.user));

router.put('/me', protect, asyncHandler(async (req, res) => {
  const { fullName, phone, address } = req.body;
  Object.assign(req.user, { ...(fullName && { fullName }), ...(phone !== undefined && { phone }), ...(address !== undefined && { address }) });
  await req.user.save();
  res.json(req.user);
}));

router.put('/me/password', protect, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword || ''))) throw httpError(400, 'Current password is incorrect');
  if (!newPassword || newPassword.length < 6) throw httpError(400, 'New password must be at least 6 characters');
  if (newPassword === currentPassword) throw httpError(400, 'New password must be different from the current one');
  user.password = newPassword;
  user.mustChangePassword = false;
  await user.save();
  res.json({ message: 'Password updated', user });
}));

module.exports = router;
