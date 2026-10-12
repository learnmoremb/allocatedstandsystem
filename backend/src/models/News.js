const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    category: {
      type: String,
      enum: ['land_open', 'development', 'payment', 'general'],
      default: 'general',
    },
    area: { type: String, trim: true }, // optional: the area this update affects
    stands: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Stand' }],
    pinned: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('News', newsSchema);
