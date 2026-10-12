const mongoose = require('mongoose');

const infrastructureSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['roads', 'water', 'sewer', 'electricity', 'drainage', 'school', 'clinic', 'other'],
      default: 'other',
    },
    area: { type: String, required: true, trim: true },
    description: String,
    status: { type: String, enum: ['planned', 'in_progress', 'completed', 'on_hold'], default: 'planned' },
    startDate: Date,
    expectedCompletion: Date,
    progress: { type: Number, min: 0, max: 100, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Infrastructure', infrastructureSchema);
