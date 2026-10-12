const Stand = require('../models/Stand');
const Allocation = require('../models/Allocation');
const Application = require('../models/Application');
const User = require('../models/User');
const { httpError, notify } = require('../utils/helpers');
const { personSimilarity, prepare } = require('../utils/recordLinkage');
const { sendMail, standAllocatedEmail } = require('../utils/mailer');

const maxStands = () => Number(process.env.MAX_ACTIVE_STANDS_PER_USER || 1);

/**
 * Look for existing stand holders (under other accounts) who look like the same
 * person as `user` - catches one person registering twice to get a second stand.
 */
async function findSimilarHolders(user) {
  const holders = await Allocation.find({ holdsStand: true, user: { $ne: user._id } })
    .populate('user', 'fullName nationalId phone email')
    .populate('stand', 'standNumber area');
  const me = prepare({ fullName: user.fullName, nationalId: user.nationalId, phone: user.phone }, 0);
  return holders
    .filter((a) => a.user)
    .map((a) => {
      const other = prepare({ fullName: a.user.fullName, nationalId: a.user.nationalId, phone: a.user.phone }, 1);
      const { score, reasons } = personSimilarity(me, other);
      return { score, reasons, allocation: a };
    })
    .filter((m) => m.score >= 0.8)
    .map((m) => ({
      score: Math.round(m.score * 100) / 100,
      reasons: m.reasons,
      holder: { fullName: m.allocation.user.fullName, email: m.allocation.user.email, nationalId: m.allocation.user.nationalId },
      stand: m.allocation.stand,
    }));
}

/**
 * Allocate a stand to a user. Double booking is prevented at two levels:
 *  1. an atomic conditional update that only succeeds while the stand is still free
 *  2. a partial unique index on Allocation.stand (holdsStand: true)
 */
async function allocateStand({ userId, standId, staffId, applicationId, override = false }) {
  const user = await User.findById(userId);
  if (!user || user.role !== 'user') throw httpError(400, 'Allocations can only be made to registered general users');

  const active = await Allocation.countDocuments({ user: userId, holdsStand: true });
  if (active >= maxStands()) {
    throw httpError(409, `${user.fullName} already holds ${active} stand(s); the limit is ${maxStands()} per person`);
  }

  if (!override) {
    const similar = await findSimilarHolders(user);
    if (similar.length) {
      const err = httpError(409, 'This applicant closely matches a person who already holds a stand');
      err.code = 'POSSIBLE_DUPLICATE_PERSON';
      err.details = similar;
      throw err;
    }
  }

  const stand = await Stand.findOneAndUpdate(
    { _id: standId, status: { $in: ['available', 'reserved'] }, allocatedTo: null },
    { $set: { status: 'allocated', allocatedTo: userId } },
    { returnDocument: 'after' }
  );
  if (!stand) {
    const exists = await Stand.exists({ _id: standId });
    throw httpError(exists ? 409 : 404, exists ? 'Double booking prevented: this stand is already allocated or not available' : 'Stand not found');
  }

  let allocation;
  try {
    const depositAmount = Math.round(stand.price * (stand.depositPercent / 100) * 100) / 100;
    allocation = await Allocation.create({
      allocationNumber: `ALC-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`,
      user: userId,
      stand: stand._id,
      application: applicationId,
      totalAmount: stand.price,
      depositAmount,
      allocatedBy: staffId,
      stageHistory: [{ stage: 'awaiting_deposit', note: 'Stand allocated', changedBy: staffId }],
    });
  } catch (e) {
    // roll back the stand if the allocation could not be stored
    await Stand.updateOne({ _id: stand._id }, { $set: { status: 'available', allocatedTo: null } });
    if (e.code === 11000) throw httpError(409, 'Double booking prevented: this stand already has an allocation');
    throw e;
  }

  // Any other pending applications for this stand are now unsuccessful
  const others = await Application.find({ stand: stand._id, status: 'pending', _id: { $ne: applicationId } });
  for (const app of others) {
    app.status = 'rejected';
    app.reviewNote = 'Stand has been allocated to another applicant';
    app.reviewedBy = staffId;
    app.reviewedAt = new Date();
    await app.save();
    await notify(app.applicant, 'Application unsuccessful', `Stand ${stand.standNumber} (${stand.area}) has been allocated to another applicant.`, '/user/applications');
  }

  await notify(
    userId,
    'Stand allocated',
    `Stand ${stand.standNumber} in ${stand.area} has been allocated to you. Deposit due: ${allocation.depositAmount.toFixed(2)}.`,
    `/user/allocations/${allocation._id}`
  );
  if (user.email) sendMail(standAllocatedEmail({ user, allocation, stand }));
  return allocation;
}

async function cancelAllocation(allocation, staffId, reason) {
  allocation.status = 'cancelled';
  allocation.holdsStand = false;
  allocation.cancelReason = reason;
  await allocation.save();
  await Stand.updateOne({ _id: allocation.stand }, { $set: { status: 'available', allocatedTo: null } });
  await notify(allocation.user, 'Allocation cancelled', reason || 'Your stand allocation has been cancelled.', `/user/allocations/${allocation._id}`);
}

module.exports = { allocateStand, cancelAllocation, findSimilarHolders };
