require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');

const app = express();
app.use(cors({ origin: (process.env.CORS_ORIGINS || process.env.CLIENT_URL || 'http://localhost:4200').split(',').map((o) => o.trim()) }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/stands', require('./routes/stands'));
app.use('/api/news', require('./routes/news'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/allocations', require('./routes/allocations'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/infrastructure', require('./routes/infrastructure'));
app.use('/api/duplicates', require('./routes/duplicates'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.use('/api', (req, res) => res.status(404).json({ message: 'Endpoint not found' }));
app.use(errorHandler);

/** On a fresh database, create the first admin from ADMIN_EMAIL / ADMIN_PASSWORD (must change it at first login). */
async function ensureAdmin() {
  const User = require('./models/User');
  if (await User.exists({ role: 'admin' })) return;
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.warn('No admin account exists. Set ADMIN_EMAIL and ADMIN_PASSWORD to create one on startup.');
    return;
  }
  await User.create({ fullName: 'System Administrator', email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'admin', mustChangePassword: true });
  console.log(`Created initial admin account ${ADMIN_EMAIL} (password change required at first login)`);
}

const PORT = process.env.PORT || 5000;
connectDB()
  .then(async () => {
    // make sure the double-booking unique indexes exist before serving
    await Promise.all(['Allocation', 'Stand', 'Application', 'User'].map((m) => require(`./models/${m}`).syncIndexes()));
    await ensureAdmin();
    const server = app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
    for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
  })
  .catch((e) => {
    console.error('Failed to start:', e.message);
    process.exit(1);
  });
