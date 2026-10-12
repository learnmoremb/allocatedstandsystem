const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    stand: { type: mongoose.Schema.Types.ObjectId, ref: 'Stand', required: true },
    motivation: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'withdrawn'], default: 'pending' },
    reviewNote: String,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  { timestamps: true }
);

// A user cannot have two open applications for the same stand
applicationSchema.index(
  { applicant: 1, stand: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

module.exports = mongoose.model('Application', applicationSchema);
