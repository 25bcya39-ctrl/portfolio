// server/index.js — Main Express server
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const rateLimit  = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global rate limit — 120 req / 1 min
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── API Routes ────────────────────────────────
app.use('/api/contact',   require('./routes/contact'));
app.use('/api/blog',      require('./routes/blog'));
app.use('/api/analytics', require('./routes/analytics'));

// ── Health check ──────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── SPA fallback — serve index.html ───────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Error handler ─────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀  Server running on http://localhost:${PORT}`);
  console.log(`📦  Environment: ${process.env.NODE_ENV || 'development'}`);
});
