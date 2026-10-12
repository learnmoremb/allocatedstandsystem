const router = require('express').Router();
const Application = require('../models/Application');
const Stand = require('../models/Stand');
const Allocation = require('../models/Allocation');
const { protect, authorize, staffOnly } = require('../middleware/auth');
const { asyncHandler, httpError, notify } = require('../utils/helpers');
const { allocateStand, findSimilarHolders } = require('../services/allocationService');

router.use(protect);

router.post('/', authorize('user'), asyncHandler(async (req, res) => {
  const stand = await Stand.findById(req.body.standId);
  if (!stand) throw httpError(404, 'Stand not found');
  if (stand.status !== 'available') throw httpError(409, 'This stand is no longer open for allocation');
  const limit = Number(process.env.MAX_ACTIVE_STANDS_PER_USER || 1);
  if ((await Allocation.countDocuments({ user: req.user._id, holdsStand: true })) >= limit) {
    throw httpError(409, `You already hold the maximum of ${limit} stand(s)`);
  }
  if (await Application.exists({ applicant: req.user._id, stand: stand._id, status: 'pending' })) {
    throw httpError(409, 'You already have a pending application for this stand');
  }
  const app = await Application.create({ applicant: req.user._id, stand: stand._id, motivation: req.body.motivation });
  res.status(201).json(app);
}));

router.get('/mine', asyncHandler(async (req, res) => {
  res.json(await Application.find({ applicant: req.user._id }).populate('stand').sort({ createdAt: -1 }));
}));

router.get('/', staffOnly, asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const apps = await Application.find(filter)
    .populate('applicant', 'fullName email nationalId phone')
    .populate('stand')
    .sort({ createdAt: -1 });
  // how many people are competing for each stand
  const counts = await Application.aggregate([{ $match: { status: 'pending' } }, { $group: { _id: '$stand', n: { $sum: 1 } } }]);
  const byStand = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  res.json(apps.map((a) => ({ ...a.toObject(), competingApplications: byStand[String(a.stand?._id)] || 0 })));
}));

// Pre-check before approving: possible same-person duplicates
router.get('/:id/check', staffOnly, asyncHandler(async (req, res) => {
  const app = await Application.findById(req.params.id).populate('applicant');
  if (!app) throw httpError(404, 'Application not found');
  res.json({ similarHolders: await findSimilarHolders(app.applicant) });
}));

router.patch('/:id/approve', staffOnly, asyncHandler(async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) throw httpError(404, 'Application not found');
  if (app.status !== 'pending') throw httpError(400, `Application is already ${app.status}`);
  const allocation = await allocateStand({
    userId: app.applicant, standId: app.stand, staffId: req.user._id, applicationId: app._id, override: !!req.body.override,
  });
  app.status = 'approved';
  app.reviewNote = req.body.note;
  app.reviewedBy = req.user._id;
  app.reviewedAt = new Date();
  await app.save();
  res.json({ application: app, allocation });
}));

router.patch('/:id/reject', staffOnly, asyncHandler(async (req, res) => {
  const app = await Application.findOneAndUpdate(
    { _id: req.params.id, status: 'pending' },
    { status: 'rejected', reviewNote: req.body.note, reviewedBy: req.user._id, reviewedAt: new Date() },
    { returnDocument: 'after' }
  ).populate('stand');
  if (!app) throw httpError(400, 'Application not found or already processed');
  await notify(app.applicant, 'Application rejected', `Your application for stand ${app.stand?.standNumber} was rejected. ${req.body.note || ''}`, '/user/applications');
  res.json(app);
}));

router.patch('/:id/withdraw', authorize('user'), asyncHandler(async (req, res) => {
  const app = await Application.findOneAndUpdate(
    { _id: req.params.id, applicant: req.user._id, status: 'pending' },
    { status: 'withdrawn' },
    { returnDocument: 'after' }
  );
  if (!app) throw httpError(400, 'Application not found or can no longer be withdrawn');
  res.json(app);
}));

module.exports = router;
