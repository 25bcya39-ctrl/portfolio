// server/routes/blog.js
const express = require('express');
const router  = express.Router();
const { body, validationResult } = require('express-validator');
const db      = require('../db');

function requireAdmin(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Helper — build slug from title
function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ── GET /api/blog — list published articles ───
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, title, slug, excerpt, cover_url, created_at
       FROM articles
       WHERE published = 1
       ORDER BY created_at DESC
       LIMIT 20`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/blog/:slug — single article ──────
router.get('/:slug', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM articles WHERE slug = ? AND published = 1',
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'Article not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/blog — create article (admin) ───
router.post(
  '/',
  requireAdmin,
  [
    body('title').trim().notEmpty().isLength({ max: 255 }),
    body('content').trim().notEmpty(),
    body('excerpt').optional().trim().isLength({ max: 500 }),
    body('cover_url').optional().trim().isURL(),
    body('published').optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, content, excerpt, cover_url, published } = req.body;
    const slug = slugify(title);

    try {
      const [result] = await db.execute(
        `INSERT INTO articles (title, slug, excerpt, content, cover_url, published)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [title, slug, excerpt || null, content, cover_url || null, published ? 1 : 0]
      );
      res.status(201).json({ success: true, id: result.insertId, slug });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'An article with this title already exists.' });
      }
      res.status(500).json({ error: err.message });
    }
  }
);

// ── PUT /api/blog/:id — update article (admin) 
router.put('/:id', requireAdmin, async (req, res) => {
  const { title, content, excerpt, cover_url, published } = req.body;
  const slug = title ? slugify(title) : undefined;

  try {
    await db.execute(
      `UPDATE articles
       SET title = COALESCE(?, title),
           slug = COALESCE(?, slug),
           content = COALESCE(?, content),
           excerpt = COALESCE(?, excerpt),
           cover_url = COALESCE(?, cover_url),
           published = COALESCE(?, published)
       WHERE id = ?`,
      [title || null, slug || null, content || null, excerpt || null,
       cover_url || null, published !== undefined ? (published ? 1 : 0) : null,
       req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/blog/:id (admin) ──────────────
router.delete('/:id', requireAdmin, async (req, res) => {
  await db.execute('DELETE FROM articles WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
