const router = require('express').Router();
const User = require('../models/User');
const { protect, authorize, staffOnly } = require('../middleware/auth');
const { asyncHandler, httpError } = require('../utils/helpers');

router.use(protect);

// Staff can look up users (e.g. to allocate directly); only admin sees staff accounts
router.get('/', staffOnly, asyncHandler(async (req, res) => {
  const filter = {};
  if (req.user.role !== 'admin') filter.role = 'user';
  else if (req.query.role) filter.role = req.query.role;
  if (req.query.q) {
    const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ fullName: rx }, { email: rx }, { nationalId: rx }];
  }
  res.json(await User.find(filter).sort({ createdAt: -1 }).limit(500));
}));

router.post('/', authorize('admin'), asyncHandler(async (req, res) => {
  const { fullName, email, password, role, nationalId, phone, address } = req.body;
  if (!fullName || !email || !password) throw httpError(400, 'Full name, email and password are required');
  const user = await User.create({ fullName, email, password, role, nationalId: nationalId || undefined, phone, address, mustChangePassword: true });
  res.status(201).json(user);
}));

router.patch('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw httpError(404, 'User not found');
  if (String(user._id) === String(req.user._id) && (req.body.role || req.body.isActive === false)) {
    throw httpError(400, 'You cannot change your own role or disable yourself');
  }
  for (const k of ['fullName', 'role', 'isActive', 'phone', 'address']) if (req.body[k] !== undefined) user[k] = req.body[k];
  if (req.body.nationalId !== undefined) user.nationalId = req.body.nationalId || undefined;
  if (req.body.password) {
    user.password = req.body.password;
    user.mustChangePassword = true;
  }
  await user.save();
  res.json(user);
}));

module.exports = router;
