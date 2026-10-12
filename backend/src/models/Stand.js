const mongoose = require('mongoose');

const STAND_STATUS = ['available', 'reserved', 'allocated', 'withdrawn'];

const standSchema = new mongoose.Schema(
  {
    standNumber: { type: String, required: true, trim: true, uppercase: true },
    area: { type: String, required: true, trim: true }, // suburb / township
    sizeSqm: { type: Number, required: true, min: 1 },
    landUse: { type: String, enum: ['residential', 'commercial', 'industrial', 'institutional'], default: 'residential' },
    price: { type: Number, required: true, min: 0 },
    depositPercent: { type: Number, default: 10, min: 0, max: 100 },
    description: String,
    status: { type: String, enum: STAND_STATUS, default: 'available' },
    allocatedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// A stand number is unique within an area
standSchema.index({ area: 1, standNumber: 1 }, { unique: true });

module.exports = mongoose.model('Stand', standSchema);
module.exports.STAND_STATUS = STAND_STATUS;
