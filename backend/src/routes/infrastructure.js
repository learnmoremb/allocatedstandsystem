const router = require('express').Router();
const Infrastructure = require('../models/Infrastructure');
const Allocation = require('../models/Allocation');
const News = require('../models/News');
const { protect, staffOnly } = require('../middleware/auth');
const { asyncHandler, httpError, notify } = require('../utils/helpers');

router.use(protect);

const STATUS_LABEL = { planned: 'Planned', in_progress: 'In progress', completed: 'Completed', on_hold: 'On hold' };

/** Every development is published to the news list, and stand holders in the area are notified. */
async function publishDevelopment(project, userId, isUpdate) {
  const when = project.expectedCompletion ? ` Expected completion: ${project.expectedCompletion.toISOString().slice(0, 10)}.` : '';
  await News.create({
    title: `${isUpdate ? 'Update' : 'New development'}: ${project.title} (${project.area})`,
    body: `${project.description || ''}\n\nType: ${project.type}. Status: ${STATUS_LABEL[project.status]}. Progress: ${project.progress}%.${when}`.trim(),
    category: 'development',
    area: project.area,
    createdBy: userId,
  });
  const holders = await Allocation.find({ holdsStand: true }).populate('stand', 'area');
  const users = [...new Set(holders.filter((a) => a.stand?.area === project.area).map((a) => String(a.user)))];
  await Promise.all(users.map((u) => notify(u, `Development in ${project.area}`, `${project.title}: ${STATUS_LABEL[project.status]}`, '/user/infrastructure')));
}

router.get('/', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.area) filter.area = req.query.area;
  // ?mine=true -> only areas where the user holds a stand
  if (req.query.mine === 'true') {
    const allocs = await Allocation.find({ user: req.user._id, status: { $ne: 'cancelled' } }).populate('stand', 'area');
    filter.area = { $in: allocs.map((a) => a.stand?.area).filter(Boolean) };
  }
  res.json(await Infrastructure.find(filter).sort({ area: 1, expectedCompletion: 1 }));
}));

router.post('/', staffOnly, asyncHandler(async (req, res) => {
  const project = await Infrastructure.create({ ...req.body, createdBy: req.user._id });
  await publishDevelopment(project, req.user._id, false);
  res.status(201).json(project);
}));

router.put('/:id', staffOnly, asyncHandler(async (req, res) => {
  const project = await Infrastructure.findById(req.params.id);
  if (!project) throw httpError(404, 'Project not found');
  const { createdBy, publish = true, ...rest } = req.body;
  Object.assign(project, rest);
  await project.save();
  if (publish) await publishDevelopment(project, req.user._id, true);
  res.json(project);
}));

router.delete('/:id', staffOnly, asyncHandler(async (req, res) => {
  if (!(await Infrastructure.findByIdAndDelete(req.params.id))) throw httpError(404, 'Project not found');
  res.json({ message: 'Deleted' });
}));

module.exports = router;
