const router = require('express').Router();
const Allocation = require('../models/Allocation');
const Payment = require('../models/Payment');
const Infrastructure = require('../models/Infrastructure');
const { STAGES } = require('../models/Allocation');
const { protect, staffOnly } = require('../middleware/auth');
const { asyncHandler, httpError, notify } = require('../utils/helpers');
const { allocateStand, cancelAllocation } = require('../services/allocationService');

router.use(protect);

const STAGE_LABEL = {
  awaiting_deposit: 'Awaiting deposit',
  deposit_paid: 'Deposit paid',
  installments: 'Paying instalments',
  fully_paid: 'Fully paid',
  title_processing: 'Title deed processing',
  completed: 'Completed',
};

router.get('/mine', asyncHandler(async (req, res) => {
  res.json(await Allocation.find({ user: req.user._id }).populate('stand').sort({ createdAt: -1 }));
}));

router.get('/', staffOnly, asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.stage) filter.stage = req.query.stage;
  res.json(await Allocation.find(filter).populate('user', 'fullName email nationalId phone').populate('stand').sort({ createdAt: -1 }));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const allocation = await Allocation.findById(req.params.id)
    .populate('user', 'fullName email nationalId phone address')
    .populate('stand')
    .populate('stageHistory.changedBy', 'fullName role');
  if (!allocation) throw httpError(404, 'Allocation not found');
  if (req.user.role === 'user' && String(allocation.user._id) !== String(req.user._id)) throw httpError(403, 'Not your allocation');
  const payments = await Payment.find({ allocation: allocation._id }).populate('reviewedBy', 'fullName').sort({ paymentDate: -1 });
  const infrastructure = await Infrastructure.find({ area: allocation.stand?.area }).sort({ expectedCompletion: 1 });
  res.json({ allocation, payments, infrastructure });
}));

// Direct allocation by council (without an application)
router.post('/', staffOnly, asyncHandler(async (req, res) => {
  const { userId, standId, override } = req.body;
  res.status(201).json(await allocateStand({ userId, standId, staffId: req.user._id, override: !!override }));
}));

// Council moves the allocation to a stage (e.g. title processing / completed)
router.patch('/:id/stage', staffOnly, asyncHandler(async (req, res) => {
  const { stage, note } = req.body;
  if (!STAGES.includes(stage)) throw httpError(400, 'Invalid stage');
  const allocation = await Allocation.findById(req.params.id).populate('stand');
  if (!allocation) throw httpError(404, 'Allocation not found');
  if (allocation.status === 'cancelled') throw httpError(400, 'Allocation is cancelled');
  if (['title_processing', 'completed'].includes(stage) && allocation.amountPaid < allocation.totalAmount) {
    throw httpError(400, 'The stand must be fully paid before moving to this stage');
  }
  allocation.stage = stage;
  allocation.status = stage === 'completed' ? 'completed' : 'active';
  allocation.stageHistory.push({ stage, note, changedBy: req.user._id });
  await allocation.save();
  await notify(allocation.user, `Stand ${allocation.stand.standNumber}: ${STAGE_LABEL[stage]}`, note || `Your allocation is now at stage: ${STAGE_LABEL[stage]}.`, `/user/allocations/${allocation._id}`);
  res.json(allocation);
}));

router.patch('/:id/cancel', staffOnly, asyncHandler(async (req, res) => {
  const allocation = await Allocation.findById(req.params.id);
  if (!allocation) throw httpError(404, 'Allocation not found');
  if (allocation.status !== 'active') throw httpError(400, `Allocation is already ${allocation.status}`);
  await cancelAllocation(allocation, req.user._id, req.body.reason);
  res.json(allocation);
}));

module.exports = router;
module.exports.STAGE_LABEL = STAGE_LABEL;
