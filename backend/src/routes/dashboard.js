const router = require('express').Router();
const User = require('../models/User');
const Stand = require('../models/Stand');
const Application = require('../models/Application');
const Allocation = require('../models/Allocation');
const Payment = require('../models/Payment');
const News = require('../models/News');
const Infrastructure = require('../models/Infrastructure');
const Notification = require('../models/Notification');
const { protect, staffOnly } = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');

router.use(protect);

const tally = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));

router.get('/staff', staffOnly, asyncHandler(async (req, res) => {
  const [stands, stages, users, pendingApps, pendingPays, money, recentPayments] = await Promise.all([
    Stand.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Allocation.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: '$stage', n: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
    Application.countDocuments({ status: 'pending' }),
    Payment.countDocuments({ status: 'pending' }),
    Allocation.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$totalAmount' }, paid: { $sum: '$amountPaid' } } }]),
    Payment.find({ status: 'pending' }).populate('user', 'fullName').sort({ createdAt: -1 }).limit(5),
  ]);
  res.json({
    stands: tally(stands),
    stages: tally(stages),
    users: tally(users),
    pendingApplications: pendingApps,
    pendingPayments: pendingPays,
    totalValue: money[0]?.total || 0,
    totalCollected: money[0]?.paid || 0,
    recentPayments,
  });
}));

router.get('/user', asyncHandler(async (req, res) => {
  const allocations = await Allocation.find({ user: req.user._id, status: { $ne: 'cancelled' } }).populate('stand');
  const areas = [...new Set(allocations.map((a) => a.stand?.area).filter(Boolean))];
  const [applications, pendingPayments, news, infrastructure, notifications] = await Promise.all([
    Application.find({ applicant: req.user._id }).populate('stand', 'standNumber area').sort({ createdAt: -1 }).limit(5),
    Payment.countDocuments({ user: req.user._id, status: 'pending' }),
    // news that affects the user's areas, plus general/land news
    News.find({ $or: [{ area: { $in: areas } }, { area: { $in: [null, ''] } }, { category: 'land_open' }] }).sort({ pinned: -1, createdAt: -1 }).limit(5),
    Infrastructure.find({ area: { $in: areas } }).sort({ expectedCompletion: 1 }),
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(8),
  ]);
  res.json({ allocations, applications, pendingPayments, news, infrastructure, notifications, areas });
}));

module.exports = router;
