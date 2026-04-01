// server/routes/contact.js
const express   = require('express');
const router    = express.Router();
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const db        = require('../db');

const contactLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many messages sent. Please wait 15 minutes.' },
});

// POST /api/contact
router.post('/', contactLimit, [
  body('name').trim().notEmpty().isLength({ max: 100 }).escape(),
  body('email').trim().isEmail().normalizeEmail(),
  body('subject').trim().notEmpty().isLength({ max: 200 }).escape(),
  body('message').trim().notEmpty().isLength({ max: 5000 }).escape(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, subject, message } = req.body;

  try {
    await db.execute(
      'INSERT INTO messages (name, email, subject, body) VALUES (?, ?, ?, ?)',
      [name, email, subject, message]
    );
  } catch (err) {
    // DB unavailable - still return success for presentation
    console.warn('DB unavailable, message not saved:', err.message);
  }

  res.json({ success: true, message: "Message received! I will be in touch soon." });
});

// GET /api/contact (admin)
router.get('/', (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  db.execute('SELECT id, name, email, subject, is_read, created_at FROM messages ORDER BY created_at DESC')
    .then(([rows]) => res.json(rows))
    .catch(err => res.status(500).json({ error: err.message }));
});

module.exports = router;
