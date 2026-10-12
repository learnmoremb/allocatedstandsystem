const router = require('express').Router();
const News = require('../models/News');
const { protect, staffOnly } = require('../middleware/auth');
const { asyncHandler, httpError } = require('../utils/helpers');

router.use(protect);

router.get('/', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.area) filter.area = req.query.area;
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  res.json(await News.find(filter).populate('createdBy', 'fullName role').sort({ pinned: -1, createdAt: -1 }).limit(limit));
}));

router.post('/', staffOnly, asyncHandler(async (req, res) => {
  const { title, body, category, area, pinned } = req.body;
  res.status(201).json(await News.create({ title, body, category, area: area || undefined, pinned, createdBy: req.user._id }));
}));

router.put('/:id', staffOnly, asyncHandler(async (req, res) => {
  const { title, body, category, area, pinned } = req.body;
  const news = await News.findByIdAndUpdate(req.params.id, { title, body, category, area: area || undefined, pinned }, { returnDocument: 'after', runValidators: true });
  if (!news) throw httpError(404, 'News item not found');
  res.json(news);
}));

router.delete('/:id', staffOnly, asyncHandler(async (req, res) => {
  if (!(await News.findByIdAndDelete(req.params.id))) throw httpError(404, 'News item not found');
  res.json({ message: 'Deleted' });
}));

module.exports = router;
