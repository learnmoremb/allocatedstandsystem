const mongoose = require('mongoose');

const findingSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['double_allocation', 'same_person_multiple_stands', 'duplicate_record', 'conflict_with_system'],
    },
    severity: { type: String, enum: ['high', 'medium', 'low'] },
    score: Number, // 0..1 match confidence
    standKey: String,
    reason: String,
    records: [mongoose.Schema.Types.Mixed], // the linked records (CSV rows / system rows)
  },
  { _id: false }
);

const duplicateReportSchema = new mongoose.Schema(
  {
    source: { type: String, enum: ['csv', 'system'], default: 'csv' },
    fileName: String,
    totalRecords: Number,
    findings: [findingSchema],
    summary: {
      doubleAllocations: { type: Number, default: 0 },
      samePersonMultipleStands: { type: Number, default: 0 },
      duplicateRecords: { type: Number, default: 0 },
      conflictsWithSystem: { type: Number, default: 0 },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DuplicateReport', duplicateReportSchema);
