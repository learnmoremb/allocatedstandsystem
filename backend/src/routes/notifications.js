const router = require('express').Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');

router.use(protect);

router.get('/', asyncHandler(async (req, res) => {
  res.json(await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50));
}));

router.patch('/read-all', asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ message: 'ok' });
}));

router.patch('/:id/read', asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true });
  res.json({ message: 'ok' });
}));

module.exports = router;
