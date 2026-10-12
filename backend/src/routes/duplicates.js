const router = require('express').Router();
const { parse } = require('csv-parse/sync');
const DuplicateReport = require('../models/DuplicateReport');
const Allocation = require('../models/Allocation');
const { protect, staffOnly } = require('../middleware/auth');
const { csvUpload } = require('../middleware/upload');
const { asyncHandler, httpError } = require('../utils/helpers');
const { detectDuplicates } = require('../utils/recordLinkage');

router.use(protect, staffOnly);

const TEMPLATE = 'standNumber,area,fullName,nationalId,phone,allocationDate\n' +
  '101,Hatfield Extension,Tendai Moyo,63-123456A78,0771234567,2024-01-15\n';

// Accept common header spellings
const ALIASES = {
  standNumber: ['standnumber', 'stand', 'standno', 'stand_no', 'stand_number', 'plot', 'plotnumber'],
  area: ['area', 'suburb', 'township', 'location'],
  fullName: ['fullname', 'name', 'full_name', 'holder', 'holdername', 'allocatee', 'beneficiary'],
  firstName: ['firstname', 'first_name', 'forename'],
  surname: ['surname', 'lastname', 'last_name'],
  nationalId: ['nationalid', 'national_id', 'idnumber', 'id_number', 'id', 'nid'],
  phone: ['phone', 'phonenumber', 'cell', 'mobile', 'contact'],
  allocationDate: ['allocationdate', 'allocation_date', 'date', 'dateallocated'],
};
const canonical = (h) => {
  const k = h.toLowerCase().replace(/[\s.-]/g, '');
  return Object.keys(ALIASES).find((c) => ALIASES[c].includes(k)) || h;
};

async function systemRecords() {
  const allocs = await Allocation.find({ holdsStand: true }).populate('user', 'fullName nationalId phone').populate('stand', 'standNumber area');
  return allocs.filter((a) => a.user && a.stand).map((a) => ({
    standNumber: a.stand.standNumber, area: a.stand.area, fullName: a.user.fullName,
    nationalId: a.user.nationalId, phone: a.user.phone, allocationDate: a.allocatedAt?.toISOString().slice(0, 10),
    row: a.allocationNumber,
  }));
}

router.get('/template', (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="allocations-template.csv"');
  res.send(TEMPLATE);
});

router.post('/csv', csvUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw httpError(400, 'CSV file is required');
  let rows;
  try {
    rows = parse(req.file.buffer, { columns: (h) => h.map((c) => canonical(c.trim())), skip_empty_lines: true, trim: true, bom: true, relax_column_count: true });
  } catch (e) {
    throw httpError(400, `Could not read CSV: ${e.message}`);
  }
  if (!rows.length) throw httpError(400, 'The CSV file has no records');
  if (!('standNumber' in rows[0])) throw httpError(400, 'CSV must contain a stand number column (e.g. "standNumber")');
  const records = rows.map((r, i) => ({ ...r, row: i + 2 })); // +2: header line and 1-based
  const compare = req.body.compareWithSystem !== 'false';
  const result = detectDuplicates(records, compare ? await systemRecords() : []);
  const report = await DuplicateReport.create({ source: 'csv', fileName: req.file.originalname, ...result, createdBy: req.user._id });
  res.status(201).json(report);
}));

// Run record linkage over allocations already stored in the system
router.post('/scan-system', asyncHandler(async (req, res) => {
  const records = (await systemRecords()).map((r) => ({ ...r, source: 'system' }));
  const result = detectDuplicates(records);
  const report = await DuplicateReport.create({ source: 'system', fileName: 'System allocations', ...result, createdBy: req.user._id });
  res.status(201).json(report);
}));

router.get('/', asyncHandler(async (req, res) => {
  res.json(await DuplicateReport.find().select('-findings').populate('createdBy', 'fullName').sort({ createdAt: -1 }).limit(50));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const report = await DuplicateReport.findById(req.params.id).populate('createdBy', 'fullName');
  if (!report) throw httpError(404, 'Report not found');
  res.json(report);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await DuplicateReport.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
}));

module.exports = router;
