-- ============================================
--  Len Lhouvum Portfolio — MySQL Schema
-- ============================================

CREATE DATABASE IF NOT EXISTS portfolio_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE portfolio_db;

-- ─── Contact / Inquiry Messages ─────────────
CREATE TABLE IF NOT EXISTS messages (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL,
  subject     VARCHAR(200) NOT NULL,
  body        TEXT NOT NULL,
  is_read     TINYINT(1) DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─── Blog Articles ───────────────────────────
CREATE TABLE IF NOT EXISTS articles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  slug        VARCHAR(255) NOT NULL UNIQUE,
  excerpt     TEXT,
  content     LONGTEXT NOT NULL,
  cover_url   VARCHAR(500),
  published   TINYINT(1) DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─── Analytics — Page Views ──────────────────
CREATE TABLE IF NOT EXISTS page_views (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  page        VARCHAR(100) NOT NULL,
  referrer    VARCHAR(500),
  user_agent  VARCHAR(500),
  ip_hash     VARCHAR(64),           -- SHA-256 hashed for privacy
  visited_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─── Analytics — Unique Visitors (daily) ─────
CREATE TABLE IF NOT EXISTS daily_stats (
  stat_date   DATE PRIMARY KEY,
  views       INT DEFAULT 0,
  visitors    INT DEFAULT 0
);

-- ─── Seed: sample blog articles ──────────────
INSERT INTO articles (title, slug, excerpt, content, cover_url, published) VALUES
(
  'Getting Started with CSS Grid',
  'getting-started-css-grid',
  'A practical walkthrough of CSS Grid for building modern, responsive layouts without a framework.',
  '<p>CSS Grid changed the way I think about layout. In this post, I''ll walk through the fundamentals...</p><p>Start by declaring <code>display: grid</code> on a container, then define your columns with <code>grid-template-columns</code>.</p>',
  NULL,
  1
),
(
  'Why I Switched from Bootstrap to Vanilla CSS',
  'vanilla-css-over-bootstrap',
  'Bootstrap is great, but knowing vanilla CSS makes you a better developer. Here''s my story.',
  '<p>For three years, Bootstrap was my default. Every project started with a CDN link and a container div...</p>',
  NULL,
  1
);
