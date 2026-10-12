const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    allocation: { type: mongoose.Schema.Types.ObjectId, ref: 'Allocation', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, enum: ['bank_transfer', 'cash', 'mobile_money', 'card', 'other'], default: 'bank_transfer' },
    reference: { type: String, trim: true },
    paymentDate: { type: Date, required: true },
    receipt: {
      fileName: String,
      originalName: String,
      mimeType: String,
      size: Number,
    },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewNote: String,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
