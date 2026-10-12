const mongoose = require('mongoose');

// Payment stages a stand moves through after allocation
const STAGES = ['awaiting_deposit', 'deposit_paid', 'installments', 'fully_paid', 'title_processing', 'completed'];

const stageHistorySchema = new mongoose.Schema(
  {
    stage: { type: String, enum: STAGES },
    note: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const allocationSchema = new mongoose.Schema(
  {
    allocationNumber: { type: String, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    stand: { type: mongoose.Schema.Types.ObjectId, ref: 'Stand', required: true },
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
    totalAmount: { type: Number, required: true, min: 0 },
    depositAmount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    stage: { type: String, enum: STAGES, default: 'awaiting_deposit' },
    stageHistory: [stageHistorySchema],
    status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
    // true while the allocation holds the stand; used by the unique index below
    holdsStand: { type: Boolean, default: true },
    allocatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    allocatedAt: { type: Date, default: Date.now },
    cancelReason: String,
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// DOUBLE-BOOKING GUARD: at most one allocation may hold a given stand.
allocationSchema.index({ stand: 1 }, { unique: true, partialFilterExpression: { holdsStand: true } });

allocationSchema.virtual('balance').get(function () {
  return Math.max(0, (this.totalAmount || 0) - (this.amountPaid || 0));
});

allocationSchema.virtual('percentPaid').get(function () {
  if (!this.totalAmount) return 100;
  return Math.min(100, Math.round((this.amountPaid / this.totalAmount) * 100));
});

/** Derive the payment stage from the amount paid (never moves a stand backwards past title stages). */
allocationSchema.methods.computeStage = function () {
  if (['title_processing', 'completed'].includes(this.stage)) return this.stage;
  if (this.amountPaid >= this.totalAmount) return 'fully_paid';
  if (this.amountPaid > this.depositAmount) return 'installments';
  if (this.amountPaid >= this.depositAmount && this.depositAmount > 0) return 'deposit_paid';
  return 'awaiting_deposit';
};

module.exports = mongoose.model('Allocation', allocationSchema);
module.exports.STAGES = STAGES;
