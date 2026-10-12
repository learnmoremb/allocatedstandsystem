const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const Payment = require('../models/Payment');
const Allocation = require('../models/Allocation');
const { protect, authorize, staffOnly } = require('../middleware/auth');
const { receiptUpload, RECEIPT_DIR } = require('../middleware/upload');
const User = require('../models/User');
const { asyncHandler, httpError, notify } = require('../utils/helpers');
const { sendMail, paymentApprovedEmail, paymentRejectedEmail } = require('../utils/mailer');

router.use(protect);

const removeUpload = (file) => file && fs.promises.unlink(file.path).catch(() => {});

// User submits proof of payment (receipt is required)
router.post('/', authorize('user'), receiptUpload.single('receipt'), asyncHandler(async (req, res) => {
  try {
    const { allocationId, amount, method, reference, paymentDate } = req.body;
    if (!req.file) throw httpError(400, 'Please attach the receipt as proof of payment');
    const allocation = await Allocation.findOne({ _id: allocationId, user: req.user._id });
    if (!allocation) throw httpError(404, 'Allocation not found');
    if (allocation.status !== 'active') throw httpError(400, `This allocation is ${allocation.status}`);
    const amt = Number(amount);
    if (!(amt > 0)) throw httpError(400, 'Amount must be greater than zero');
    const pending = await Payment.aggregate([{ $match: { allocation: allocation._id, status: 'pending' } }, { $group: { _id: null, s: { $sum: '$amount' } } }]);
    const outstanding = allocation.totalAmount - allocation.amountPaid - (pending[0]?.s || 0);
    if (amt > outstanding + 0.001) throw httpError(400, `Amount exceeds the outstanding balance (${outstanding.toFixed(2)}) including payments awaiting approval`);
    if (reference && (await Payment.exists({ reference, status: { $ne: 'rejected' } }))) {
      throw httpError(409, 'A payment with this reference number has already been submitted');
    }
    const payment = await Payment.create({
      allocation: allocation._id,
      user: req.user._id,
      amount: amt,
      method,
      reference,
      paymentDate: paymentDate || new Date(),
      receipt: { fileName: req.file.filename, originalName: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size },
    });
    res.status(201).json(payment);
  } catch (e) {
    await removeUpload(req.file);
    throw e;
  }
}));

router.get('/mine', asyncHandler(async (req, res) => {
  res.json(await Payment.find({ user: req.user._id })
    .populate({ path: 'allocation', select: 'allocationNumber stand', populate: { path: 'stand', select: 'standNumber area' } })
    .sort({ createdAt: -1 }));
}));

router.get('/', staffOnly, asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  res.json(await Payment.find(filter)
    .populate('user', 'fullName email nationalId')
    .populate({ path: 'allocation', select: 'allocationNumber stand totalAmount amountPaid stage', populate: { path: 'stand', select: 'standNumber area' } })
    .populate('reviewedBy', 'fullName')
    .sort({ createdAt: -1 }));
}));

// Receipts are served only to the owner and staff
router.get('/:id/receipt', asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment?.receipt?.fileName) throw httpError(404, 'Receipt not found');
  if (req.user.role === 'user' && String(payment.user) !== String(req.user._id)) throw httpError(403, 'Not allowed');
  const file = path.join(RECEIPT_DIR, path.basename(payment.receipt.fileName));
  if (!fs.existsSync(file)) throw httpError(404, 'Receipt file missing');
  res.setHeader('Content-Type', payment.receipt.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(payment.receipt.originalName)}"`);
  fs.createReadStream(file).pipe(res);
}));

router.patch('/:id/approve', staffOnly, asyncHandler(async (req, res) => {
  // atomic pending -> approved so a payment can never be counted twice
  const payment = await Payment.findOneAndUpdate(
    { _id: req.params.id, status: 'pending' },
    { status: 'approved', reviewNote: req.body.note, reviewedBy: req.user._id, reviewedAt: new Date() },
    { returnDocument: 'after' }
  );
  if (!payment) throw httpError(400, 'Payment not found or already reviewed');

  const allocation = await Allocation.findByIdAndUpdate(payment.allocation, { $inc: { amountPaid: payment.amount } }, { returnDocument: 'after' }).populate('stand');
  const next = allocation.computeStage();
  if (next !== allocation.stage) {
    allocation.stage = next;
    allocation.stageHistory.push({ stage: next, note: `Payment of ${payment.amount.toFixed(2)} approved`, changedBy: req.user._id });
    await allocation.save();
  }
  const msg = allocation.balance > 0
    ? `Your payment of ${payment.amount.toFixed(2)} was approved. Outstanding balance: ${allocation.balance.toFixed(2)}.`
    : `Your payment of ${payment.amount.toFixed(2)} was approved. Stand ${allocation.stand.standNumber} is now fully paid!`;
  await notify(payment.user, 'Payment approved', msg, `/user/allocations/${allocation._id}`);

  // email is sent in the background so the officer is not kept waiting on SMTP
  const payer = await User.findById(payment.user);
  if (payer?.email) sendMail(paymentApprovedEmail({ user: payer, payment, allocation }));
  res.json({ payment, allocation });
}));

router.patch('/:id/reject', staffOnly, asyncHandler(async (req, res) => {
  if (!req.body.note) throw httpError(400, 'Please give a reason for rejecting the payment');
  const payment = await Payment.findOneAndUpdate(
    { _id: req.params.id, status: 'pending' },
    { status: 'rejected', reviewNote: req.body.note, reviewedBy: req.user._id, reviewedAt: new Date() },
    { returnDocument: 'after' }
  );
  if (!payment) throw httpError(400, 'Payment not found or already reviewed');
  await notify(payment.user, 'Payment rejected', `Your payment of ${payment.amount.toFixed(2)} was rejected: ${req.body.note}`, `/user/allocations/${payment.allocation}`);

  const [payer, allocation] = await Promise.all([User.findById(payment.user), Allocation.findById(payment.allocation).populate('stand')]);
  if (payer?.email && allocation) sendMail(paymentRejectedEmail({ user: payer, payment, allocation }));
  res.json(payment);
}));

module.exports = router;
