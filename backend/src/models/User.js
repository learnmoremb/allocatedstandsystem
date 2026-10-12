const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['admin', 'council', 'user'];

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    nationalId: { type: String, trim: true, uppercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    role: { type: String, enum: ROLES, default: 'user' },
    isActive: { type: Boolean, default: true },
    // set when an admin creates the account or resets its password
    mustChangePassword: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One account per national ID (sparse so staff accounts may omit it)
userSchema.index({ nationalId: 1 }, { unique: true, sparse: true });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
