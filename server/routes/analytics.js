// server/routes/analytics.js
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const db      = require('../db');

function requireAdmin(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Helper — hash IP for privacy
function hashIP(ip) {
  return crypto.createHash('sha256').update(ip + (process.env.ADMIN_SECRET || 'salt')).digest('hex');
}

// ── POST /api/analytics/track ─────────────────
// Called by the frontend on every page load
router.post('/track', async (req, res) => {
  const { page } = req.body;
  if (!page) return res.status(400).json({ error: 'page required' });

  const ip       = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '';
  const ipHash   = hashIP(ip.trim());
  const referrer = req.headers.referer || '';
  const ua       = req.headers['user-agent'] || '';
  const today    = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    // Insert raw page view
    await db.execute(
      'INSERT INTO page_views (page, referrer, user_agent, ip_hash) VALUES (?, ?, ?, ?)',
      [page, referrer.slice(0, 500), ua.slice(0, 500), ipHash]
    );

    // Upsert daily stats
    await db.execute(
      `INSERT INTO daily_stats (stat_date, views, visitors) VALUES (?, 1, 1)
       ON DUPLICATE KEY UPDATE
         views    = views + 1,
         visitors = visitors + (
           SELECT IF(
             (SELECT COUNT(*) FROM page_views
              WHERE ip_hash = ? AND DATE(visited_at) = ?) > 1, 0, 1
           )
         )`,
      [today, ipHash, today]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Analytics track error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/analytics/summary — admin ────────
router.get('/summary', requireAdmin, async (req, res) => {
  try {
    const [[totals]] = await db.execute(
      `SELECT COUNT(*) AS total_views,
              COUNT(DISTINCT ip_hash) AS unique_visitors
       FROM page_views`
    );

    const [byPage] = await db.execute(
      `SELECT page, COUNT(*) AS views
       FROM page_views
       GROUP BY page
       ORDER BY views DESC`
    );

    const [last30] = await db.execute(
      `SELECT stat_date, views, visitors
       FROM daily_stats
       WHERE stat_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       ORDER BY stat_date ASC`
    );

    const [[unread]] = await db.execute(
      'SELECT COUNT(*) AS count FROM messages WHERE is_read = 0'
    );

    res.json({ totals, byPage, last30, unreadMessages: unread.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
