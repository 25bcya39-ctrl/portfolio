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

function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

const FALLBACK_ARTICLES = [
  {
    id: 1,
    title: 'Getting Started with CSS Grid',
    slug: 'getting-started-css-grid',
    excerpt: 'A practical walkthrough of CSS Grid for building modern, responsive layouts without a framework.',
    cover_url: null,
    created_at: '2026-03-01T00:00:00.000Z'
  },
  {
    id: 2,
    title: 'Why I Switched from Bootstrap to Vanilla CSS',
    slug: 'vanilla-css-over-bootstrap',
    excerpt: 'Bootstrap is great, but knowing vanilla CSS makes you a better developer.',
    cover_url: null,
    created_at: '2026-02-15T00:00:00.000Z'
  },
  {
    id: 3,
    title: 'Designing for Mobile First',
    slug: 'designing-mobile-first',
    excerpt: 'Why starting with mobile in mind leads to cleaner, faster, and more accessible websites.',
    cover_url: null,
    created_at: '2026-01-20T00:00:00.000Z'
  }
];

const FALLBACK_CONTENT = {
  'getting-started-css-grid': '<p>CSS Grid changed the way I think about layout. Start by declaring <code>display: grid</code> on a container, then define your columns with <code>grid-template-columns</code>.</p><p>It gives you full control over both rows and columns simultaneously, making complex layouts simple and clean.</p>',
  'vanilla-css-over-bootstrap': '<p>For years, Bootstrap was my default. Every project started with a CDN link and a container div. But learning vanilla CSS made me understand the web platform deeply.</p><p>Now I write leaner, faster stylesheets with full control over every pixel.</p>',
  'designing-mobile-first': '<p>Mobile-first design means writing your base CSS for small screens and using media queries to enhance for larger ones. This results in faster load times and cleaner code.</p><p>It forces you to prioritize content and strip away anything unnecessary.</p>'
};

// GET /api/blog
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, title, slug, excerpt, cover_url, created_at FROM articles WHERE published = 1 ORDER BY created_at DESC LIMIT 20'
    );
    res.json(rows.length ? rows : FALLBACK_ARTICLES);
  } catch (err) {
    res.json(FALLBACK_ARTICLES);
  }
});

// GET /api/blog/:slug
router.get('/:slug', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM articles WHERE slug = ? AND published = 1',
      [req.params.slug]
    );
    if (rows.length) return res.json(rows[0]);
    const fallback = FALLBACK_ARTICLES.find(a => a.slug === req.params.slug);
    if (fallback) return res.json({ ...fallback, content: FALLBACK_CONTENT[fallback.slug] || '<p>Article content.</p>' });
    res.status(404).json({ error: 'Article not found' });
  } catch (err) {
    const fallback = FALLBACK_ARTICLES.find(a => a.slug === req.params.slug);
    if (fallback) return res.json({ ...fallback, content: FALLBACK_CONTENT[fallback.slug] || '<p>Article content.</p>' });
    res.status(404).json({ error: 'Article not found' });
  }
});

// POST /api/blog (admin)
router.post('/', requireAdmin, [
  body('title').trim().notEmpty(),
  body('content').trim().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { title, content, excerpt, cover_url, published } = req.body;
  const slug = slugify(title);
  try {
    const [result] = await db.execute(
      'INSERT INTO articles (title, slug, excerpt, content, cover_url, published) VALUES (?, ?, ?, ?, ?, ?)',
      [title, slug, excerpt || null, content, cover_url || null, published ? 1 : 0]
    );
    res.status(201).json({ success: true, id: result.insertId, slug });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
