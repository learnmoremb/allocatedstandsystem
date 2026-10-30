const router = require('express').Router();
const { parse } = require('csv-parse/sync');
const Stand = require('../models/Stand');
const News = require('../models/News');
const Allocation = require('../models/Allocation');
const { protect, staffOnly } = require('../middleware/auth');
const { csvUpload } = require('../middleware/upload');
const { asyncHandler, httpError } = require('../utils/helpers');
const { suggestPrice, suggestPrices } = require('../services/pricingService');

router.use(protect);

router.get('/', asyncHandler(async (req, res) => {
  const filter = {};
  // General users only browse what is open for allocation
  if (req.user.role === 'user') filter.status = 'available';
  else if (req.query.status) filter.status = req.query.status;
  if (req.query.area) filter.area = req.query.area;
  if (req.query.landUse) filter.landUse = req.query.landUse;
  const query = Stand.find(filter).sort({ area: 1, standNumber: 1 });
  if (req.user.role !== 'user') query.populate('allocatedTo', 'fullName email nationalId');
  res.json(await query);
}));

router.get('/areas', asyncHandler(async (req, res) => {
  res.json((await Stand.distinct('area')).sort());
}));

// Suggested price from the ML model, based on area (location), size and land use
router.post('/suggest-price', staffOnly, asyncHandler(async (req, res) => {
  const { area, sizeSqm, landUse } = req.body;
  if (!area || !(Number(sizeSqm) > 0)) throw httpError(400, 'Area and size are required to suggest a price');
  res.json(await suggestPrice({ area, sizeSqm, landUse }));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const stand = await Stand.findById(req.params.id);
  if (!stand) throw httpError(404, 'Stand not found');
  res.json(stand);
}));

async function announce(stands, userId, title) {
  const areas = [...new Set(stands.map((s) => s.area))];
  const list = stands.map((s) => `• Stand ${s.standNumber}, ${s.area} — ${s.sizeSqm} m², ${s.landUse}, price ${s.price.toLocaleString()}`).join('\n');
  await News.create({
    title: title || `New stands open for allocation in ${areas.join(', ')}`,
    body: `The council has opened ${stands.length} stand(s) for allocation. Log in and submit your application.\n\n${list}`,
    category: 'land_open',
    area: areas.length === 1 ? areas[0] : undefined,
    stands: stands.map((s) => s._id),
    createdBy: userId,
  });
}

router.post('/', staffOnly, asyncHandler(async (req, res) => {
  const { announce: doAnnounce, ...data } = req.body;
  const stand = await Stand.create({ ...data, status: data.status || 'available', allocatedTo: null, createdBy: req.user._id });
  if (doAnnounce && stand.status === 'available') await announce([stand], req.user._id);
  res.status(201).json(stand);
}));

// Bulk import: standNumber,area,sizeSqm,landUse,price,depositPercent,description
// Rows with an empty price get the model's suggested price.
router.post('/import', staffOnly, csvUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw httpError(400, 'CSV file is required');
  const rows = parse(req.file.buffer, { columns: (h) => h.map((c) => c.trim()), skip_empty_lines: true, trim: true, bom: true });
  const created = [];
  const errors = [];
  let suggested = 0;
  const unpriced = rows.filter((r) => !r.price && r.area && Number(r.sizeSqm) > 0);
  if (unpriced.length) {
    try {
      (await suggestPrices(unpriced)).forEach((s, j) => { unpriced[j].price = s.suggestedPrice; });
      suggested = unpriced.length;
    } catch (e) {
      errors.push({ row: '-', message: `${unpriced.length} row(s) have no price and no suggestion could be made: ${e.message}` });
    }
  }
  for (const [i, r] of rows.entries()) {
    try {
      created.push(await Stand.create({
        standNumber: r.standNumber, area: r.area, sizeSqm: Number(r.sizeSqm), landUse: r.landUse || undefined,
        price: r.price === '' || r.price === undefined ? undefined : Number(r.price), depositPercent: r.depositPercent ? Number(r.depositPercent) : undefined,
        description: r.description, createdBy: req.user._id,
      }));
    } catch (e) {
      errors.push({ row: i + 2, message: e.code === 11000 ? `Stand ${r.standNumber} already exists in ${r.area}` : e.message });
    }
  }
  if (created.length && req.body.announce === 'true') await announce(created, req.user._id);
  res.json({ created: created.length, suggested, errors });
}));

router.post('/announce', staffOnly, asyncHandler(async (req, res) => {
  const stands = await Stand.find({ _id: { $in: req.body.standIds || [] }, status: 'available' });
  if (!stands.length) throw httpError(400, 'Select at least one available stand');
  await announce(stands, req.user._id, req.body.title);
  res.json({ message: 'Announcement posted to news' });
}));

router.put('/:id', staffOnly, asyncHandler(async (req, res) => {
  const stand = await Stand.findById(req.params.id);
  if (!stand) throw httpError(404, 'Stand not found');
  const { allocatedTo, status, ...rest } = req.body;
  // status of allocated stands is controlled by the allocation workflow
  if (status && status !== stand.status) {
    if (stand.status === 'allocated' || status === 'allocated') throw httpError(400, 'Allocated status is managed through allocations');
    stand.status = status;
  }
  if (stand.status === 'allocated' && rest.price !== undefined && Number(rest.price) !== stand.price) {
    throw httpError(400, 'Cannot change the price of an allocated stand');
  }
  Object.assign(stand, rest);
  await stand.save();
  res.json(stand);
}));

router.delete('/:id', staffOnly, asyncHandler(async (req, res) => {
  const stand = await Stand.findById(req.params.id);
  if (!stand) throw httpError(404, 'Stand not found');
  if (stand.status === 'allocated' || (await Allocation.exists({ stand: stand._id }))) {
    throw httpError(400, 'Stand has allocation history; withdraw it instead of deleting');
  }
  await stand.deleteOne();
  res.json({ message: 'Stand deleted' });
}));

module.exports = router;
