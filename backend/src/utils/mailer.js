const nodemailer = require('nodemailer');

/**
 * SMTP transport configured from .env. When SMTP_HOST is not set (e.g. local
 * development) emails are written to the console instead of being sent.
 */
let transporter;
function getTransporter() {
  if (transporter) return transporter;
  transporter = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : nodemailer.createTransport({ jsonTransport: true });
  return transporter;
}

const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n) => (n ?? 0).toLocaleString('en-US', { style: 'currency', currency: process.env.CURRENCY || 'USD' });

/** Send an email; never throws, so a mail failure cannot break the request that triggered it. */
async function sendMail({ to, subject, text, html }) {
  if (!to) return;
  try {
    const info = await getTransporter().sendMail({
      from: process.env.MAIL_FROM || 'Council Stand Allocation <no-reply@council.local>',
      to,
      subject,
      text,
      html,
    });
    if (!process.env.SMTP_HOST) console.log(`[mail:dev] to=${to} subject="${subject}" (set SMTP_HOST to send real email)`);
    return info;
  } catch (e) {
    console.error(`[mail] failed to send "${subject}" to ${to}: ${e.message}`);
  }
}

const STAGE_LABEL = {
  awaiting_deposit: 'Awaiting deposit',
  deposit_paid: 'Deposit paid',
  installments: 'Paying instalments',
  fully_paid: 'Fully paid',
  title_processing: 'Title deed processing',
  completed: 'Completed',
};

const appUrl = (path) => `${process.env.CLIENT_URL || 'http://localhost:4200'}${path}`;
const fmtDate = (d) => new Date(d).toISOString().slice(0, 10);

/** Shared layout: builds matching text + HTML bodies from a headline, a details table and a closing line. */
function layout({ user, title, headline, rows, closing, link, linkLabel, tone = '#0f6e56' }) {
  const text = [
    `Dear ${user.fullName},`, '', headline, '',
    ...rows.map(([k, v]) => `${k}: ${v}`), '',
    closing, `${linkLabel}: ${link}`,
  ].join('\n');

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1c2733">
    <div style="background:${tone};color:#fff;padding:16px 20px;border-radius:8px 8px 0 0"><strong>Stand Allocation — ${escape(title)}</strong></div>
    <div style="border:1px solid #e3e8ee;border-top:none;padding:20px;border-radius:0 0 8px 8px">
      <p>Dear ${escape(user.fullName)},</p>
      <p style="font-size:16px"><strong>${escape(headline)}</strong></p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${rows.map(([k, v]) => `<tr><td style="padding:6px 0;color:#687684">${escape(k)}</td><td style="padding:6px 0;text-align:right"><strong>${escape(v)}</strong></td></tr>`).join('')}
      </table>
      <p>${escape(closing)}</p>
      <p><a href="${escape(link)}" style="background:${tone};color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">${escape(linkLabel)}</a></p>
    </div>
  </div>`;
  return { text, html };
}

function paymentApprovedEmail({ user, payment, allocation }) {
  const stand = allocation.stand;
  const fullyPaid = allocation.balance <= 0;
  const rows = [
    ['Stand', `${stand.standNumber}, ${stand.area}`],
    ['Allocation no.', allocation.allocationNumber],
    ['Amount approved', money(payment.amount)],
    ['Payment reference', payment.reference || '—'],
    ['Payment date', fmtDate(payment.paymentDate)],
    ['Total paid to date', money(allocation.amountPaid)],
    ['Outstanding balance', money(allocation.balance)],
    ['Current stage', STAGE_LABEL[allocation.stage] || allocation.stage],
  ];
  if (payment.reviewNote) rows.push(['Council note', payment.reviewNote]);
  return {
    to: user.email,
    subject: fullyPaid ? `Stand ${stand.standNumber} fully paid` : `Payment of ${money(payment.amount)} approved — Stand ${stand.standNumber}`,
    ...layout({
      user,
      title: 'Payment approved',
      headline: fullyPaid
        ? `Congratulations! Stand ${stand.standNumber} is now fully paid.`
        : `Your payment of ${money(payment.amount)} has been verified and approved.`,
      rows,
      closing: fullyPaid ? 'The council will contact you about title deed processing.' : 'Please continue to upload a receipt for each payment you make.',
      link: appUrl(`/user/allocations/${allocation._id}`),
      linkLabel: 'View my allocation',
    }),
  };
}

function paymentRejectedEmail({ user, payment, allocation }) {
  const stand = allocation.stand;
  return {
    to: user.email,
    subject: `Payment of ${money(payment.amount)} not approved — Stand ${stand.standNumber}`,
    ...layout({
      user,
      title: 'Payment not approved',
      tone: '#b3261e',
      headline: `The council could not approve your payment of ${money(payment.amount)}.`,
      rows: [
        ['Reason', payment.reviewNote || 'Not specified'],
        ['Stand', `${stand.standNumber}, ${stand.area}`],
        ['Allocation no.', allocation.allocationNumber],
        ['Amount submitted', money(payment.amount)],
        ['Payment reference', payment.reference || '—'],
        ['Payment date', fmtDate(payment.paymentDate)],
        ['Outstanding balance', money(allocation.balance)],
      ],
      closing: 'This amount has not been credited to your stand. Please check the reason above and submit a corrected receipt, or contact the council offices.',
      link: appUrl(`/user/allocations/${allocation._id}`),
      linkLabel: 'Resubmit receipt',
    }),
  };
}

function standAllocatedEmail({ user, allocation, stand }) {
  return {
    to: user.email,
    subject: `Stand ${stand.standNumber}, ${stand.area} has been allocated to you`,
    ...layout({
      user,
      title: 'Stand allocated',
      headline: `Stand ${stand.standNumber} in ${stand.area} has been allocated to you.`,
      rows: [
        ['Allocation no.', allocation.allocationNumber],
        ['Stand', `${stand.standNumber}, ${stand.area}`],
        ['Size', `${stand.sizeSqm} m²`],
        ['Land use', stand.landUse],
        ['Stand price', money(allocation.totalAmount)],
        [`Deposit due (${stand.depositPercent}%)`, money(allocation.depositAmount)],
        ['Allocation date', fmtDate(allocation.allocatedAt)],
      ],
      closing: 'Pay your deposit at the council offices or bank, then log in and upload the receipt as proof of payment. You can track every stage of your allocation online.',
      link: appUrl(`/user/allocations/${allocation._id}`),
      linkLabel: 'View my allocation',
    }),
  };
}

module.exports = { sendMail, paymentApprovedEmail, paymentRejectedEmail, standAllocatedEmail };
