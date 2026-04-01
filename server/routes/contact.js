// server/routes/contact.js
const express   = require('express');
const router    = express.Router();
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const db        = require('../db');

// ── Rate limit (5 messages / 15 min per IP) ──
const rateLimit = require('express-rate-limit');
const contactLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many messages sent. Please wait 15 minutes.' },
});

// ── Nodemailer transporter ────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── POST /api/contact ─────────────────────────
router.post(
  '/',
  contactLimit,
  [
    body('name').trim().notEmpty().isLength({ max: 100 }).escape(),
    body('email').trim().isEmail().normalizeEmail(),
    body('subject').trim().notEmpty().isLength({ max: 200 }).escape(),
    body('message').trim().notEmpty().isLength({ max: 5000 }).escape(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, subject, message } = req.body;

    try {
      // 1. Save to database
      await db.execute(
        'INSERT INTO messages (name, email, subject, body) VALUES (?, ?, ?, ?)',
        [name, email, subject, message]
      );

      // 2. Send email notification (non-blocking — don't fail if SMTP not configured)
      if (process.env.SMTP_USER && process.env.NOTIFY_EMAIL) {
        transporter.sendMail({
          from:    `"Portfolio Contact" <${process.env.SMTP_USER}>`,
          to:      process.env.NOTIFY_EMAIL,
          subject: `[Portfolio] New message: ${subject}`,
          html: `
            <h2>New message from ${name}</h2>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <hr/>
            <p>${message.replace(/\n/g, '<br>')}</p>
          `,
        }).catch(err => console.warn('Email send failed:', err.message));
      }

      res.json({ success: true, message: "Message received! I'll be in touch soon." });
    } catch (err) {
      console.error('Contact error:', err);
      res.status(500).json({ error: 'Server error. Please try again later.' });
    }
  }
);

// ── GET /api/contact — admin: list messages ───
router.get('/', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name, email, subject, is_read, created_at FROM messages ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/contact/:id/read ───────────────
router.patch('/:id/read', requireAdmin, async (req, res) => {
  await db.execute('UPDATE messages SET is_read = 1 WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// ── Admin auth middleware ─────────────────────
function requireAdmin(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = router;
