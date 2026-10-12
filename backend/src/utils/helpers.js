const Notification = require('../models/Notification');

/** Wrap async route handlers so rejections reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const httpError = (status, message) => Object.assign(new Error(message), { status });

async function notify(userId, title, message, link) {
  try {
    await Notification.create({ user: userId, title, message, link });
  } catch (e) {
    console.error('notify failed', e.message);
  }
}

module.exports = { asyncHandler, httpError, notify };
