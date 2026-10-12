/* Seeds demo data. Usage: npm run seed  (WARNING: clears the database) */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Stand = require('./models/Stand');
const News = require('./models/News');
const Infrastructure = require('./models/Infrastructure');
const Allocation = require('./models/Allocation');
const Application = require('./models/Application');
const Payment = require('./models/Payment');
const Notification = require('./models/Notification');
const DuplicateReport = require('./models/DuplicateReport');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([User, Stand, Allocation, Application].map((m) => m.syncIndexes()));

  const admin = await User.create({ fullName: 'System Administrator', email: 'admin@council.gov', password: 'admin123', role: 'admin' });
  const council = await User.create({ fullName: 'Rudo Chikwanha', email: 'council@council.gov', password: 'council123', role: 'council', phone: '0242700000' });
  const tendai = await User.create({ fullName: 'Tendai Moyo', email: 'tendai@example.com', password: 'user123', nationalId: '63-123456A78', phone: '0771234567', address: '12 Samora Machel Ave' });
  const chipo = await User.create({ fullName: 'Chipo Ndlovu', email: 'chipo@example.com', password: 'user123', nationalId: '08-765432B21', phone: '0782223344' });
  await User.create({ fullName: 'Farai Dube', email: 'farai@example.com', password: 'user123', nationalId: '45-998877C12', phone: '0715556677' });

  const mk = (standNumber, area, sizeSqm, price, landUse = 'residential') => ({ standNumber, area, sizeSqm, price, landUse, depositPercent: 10, createdBy: council._id });
  const stands = await Stand.insertMany([
    mk('101', 'Hatfield Extension', 400, 12000), mk('102', 'Hatfield Extension', 450, 13500), mk('103', 'Hatfield Extension', 500, 15000),
    mk('104', 'Hatfield Extension', 800, 30000, 'commercial'), mk('201', 'Westgate Phase 2', 300, 9000), mk('202', 'Westgate Phase 2', 300, 9000),
    mk('203', 'Westgate Phase 2', 350, 10500), mk('204', 'Westgate Phase 2', 1000, 25000, 'institutional'),
  ]);

  // Tendai already holds stand 101 and has paid the deposit
  stands[0].status = 'allocated';
  stands[0].allocatedTo = tendai._id;
  await stands[0].save();
  const app = await Application.create({ applicant: tendai._id, stand: stands[0]._id, status: 'approved', reviewedBy: council._id, reviewedAt: new Date() });
  const alloc = await Allocation.create({
    allocationNumber: 'ALC-2026-DEMO1', user: tendai._id, stand: stands[0]._id, application: app._id,
    totalAmount: 12000, depositAmount: 1200, amountPaid: 3200, stage: 'installments', allocatedBy: council._id, allocatedAt: new Date('2026-07-01'),
    stageHistory: [
      { stage: 'awaiting_deposit', note: 'Stand allocated', changedBy: council._id, at: new Date('2026-07-01') },
      { stage: 'deposit_paid', note: 'Payment of 1200.00 approved', changedBy: council._id, at: new Date('2026-07-10') },
      { stage: 'installments', note: 'Payment of 2000.00 approved', changedBy: council._id, at: new Date('2026-08-10') },
    ],
  });
  await Payment.insertMany([
    { allocation: alloc._id, user: tendai._id, amount: 1200, method: 'bank_transfer', reference: 'CBZ-0001', paymentDate: new Date('2026-07-08'), status: 'approved', reviewedBy: council._id, reviewedAt: new Date('2026-07-10') },
    { allocation: alloc._id, user: tendai._id, amount: 2000, method: 'mobile_money', reference: 'EC-77821', paymentDate: new Date('2026-08-08'), status: 'approved', reviewedBy: council._id, reviewedAt: new Date('2026-08-10') },
  ]);
  await Application.create({ applicant: chipo._id, stand: stands[4]._id, motivation: 'First-time home builder, employed locally.' });

  await News.insertMany([
    { title: 'New stands open for allocation in Westgate Phase 2', body: 'The council has opened residential and institutional stands in Westgate Phase 2. Log in to apply.', category: 'land_open', area: 'Westgate Phase 2', stands: stands.slice(4).map((s) => s._id), pinned: true, createdBy: council._id },
    { title: 'Payment reminder', body: 'All stand holders are reminded that monthly instalments are due by the 10th. Upload your receipt after paying.', category: 'payment', createdBy: council._id },
  ]);
  await Infrastructure.insertMany([
    { title: 'Tarred access roads', type: 'roads', area: 'Hatfield Extension', status: 'in_progress', progress: 45, startDate: new Date('2026-06-01'), expectedCompletion: new Date('2027-02-28'), description: 'Construction of 4.2 km of tarred roads with storm drains.', createdBy: council._id },
    { title: 'Water reticulation', type: 'water', area: 'Hatfield Extension', status: 'planned', progress: 0, expectedCompletion: new Date('2027-06-30'), description: 'Bulk water supply and household connections.', createdBy: council._id },
    { title: 'Electrification', type: 'electricity', area: 'Westgate Phase 2', status: 'planned', progress: 0, expectedCompletion: new Date('2027-09-30'), createdBy: council._id },
  ]);
  await News.create({ title: 'New development: Tarred access roads (Hatfield Extension)', body: 'Construction of 4.2 km of tarred roads with storm drains is underway. Progress: 45%.', category: 'development', area: 'Hatfield Extension', createdBy: council._id });
  await Notification.create({ user: tendai._id, title: 'Payment approved', message: 'Your payment of 2000.00 was approved. Outstanding balance: 8800.00.', link: `/user/allocations/${alloc._id}` });

  console.log('Seeded. Logins:\n  admin@council.gov / admin123\n  council@council.gov / council123\n  tendai@example.com / user123\n  chipo@example.com / user123\n  farai@example.com / user123');
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
