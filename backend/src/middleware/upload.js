const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const RECEIPT_DIR = path.join(__dirname, '..', '..', 'uploads', 'receipts');
const RECEIPT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const receiptUpload = multer({
  storage: multer.diskStorage({
    destination: RECEIPT_DIR,
    filename: (req, file, cb) =>
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    RECEIPT_TYPES.includes(file.mimetype)
      ? cb(null, true)
      : cb(Object.assign(new Error('Receipt must be a PDF, JPG, PNG or WEBP file'), { status: 400 })),
});

// CSV files are kept in memory only; they are parsed and discarded
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    /\.csv$/i.test(file.originalname)
      ? cb(null, true)
      : cb(Object.assign(new Error('Please upload a .csv file'), { status: 400 })),
});

module.exports = { receiptUpload, csvUpload, RECEIPT_DIR };
