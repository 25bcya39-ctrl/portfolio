/* =============================================
   Len Portfolio — Frontend Script
   Connects to Node.js + MySQL backend
   ============================================= */

const API = ''; // Empty = same origin. Change to 'http://localhost:3000' for dev

/* ── Utility ──────────────────────────────── */
function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

/* ── Year in footer ───────────────────────── */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ── Smooth nav + active state ────────────── */
$$('nav a').forEach(anchor => {
  anchor.addEventListener('click', e => {
    e.preventDefault();
    const id = anchor.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;

    window.scrollTo({ top: target.offsetTop - 90, behavior: 'smooth' });
    $$('nav a').forEach(a => a.classList.remove('active'));
    anchor.classList.add('active');
  });
});

// Update active nav on scroll
const sections = $$('section[id]');
const navLinks  = $$('nav a[href^="#"]');

const io = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(a => a.classList.remove('active'));
      const link = navLinks.find(a => a.getAttribute('href') === '#' + entry.target.id);
      if (link) link.classList.add('active');
    }
  });
}, { rootMargin: '-40% 0px -55% 0px' });

sections.forEach(s => io.observe(s));

/* ── Scroll reveal ────────────────────────── */
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 60);
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

$$('.reveal').forEach(el => revealObserver.observe(el));

/* ── Analytics — track page view ─────────── */
async function trackPageView() {
  try {
    await fetch(`${API}/api/analytics/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: window.location.pathname || '/' }),
    });
  } catch (_) {
    // Silent fail — analytics are non-critical
  }
}

trackPageView();

/* ── Blog — load articles ─────────────────── */
const blogGrid  = document.getElementById('blog-grid');
const modal     = document.getElementById('article-modal');
const modalClose = document.getElementById('modal-close');

async function loadBlog() {
  try {
    const res  = await fetch(`${API}/api/blog`);
    if (!res.ok) throw new Error('Failed to load');
    const articles = await res.json();

    if (!articles.length) {
      blogGrid.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem">No articles yet. Check back soon!</p>';
      return;
    }

    blogGrid.innerHTML = articles.map(a => `
      <div class="blog-card reveal" data-slug="${a.slug}" role="button" tabindex="0">
        <p class="blog-card-date">${formatDate(a.created_at)}</p>
        <h3>${escHtml(a.title)}</h3>
        <p>${escHtml(a.excerpt || '')}</p>
        <span class="blog-card-link">Read article</span>
      </div>
    `).join('');

    // Re-observe new reveal elements
    $$('.blog-card.reveal').forEach(el => revealObserver.observe(el));

    // Click handler
    $$('.blog-card[data-slug]').forEach(card => {
      card.addEventListener('click', () => openArticle(card.dataset.slug));
      card.addEventListener('keydown', e => { if (e.key === 'Enter') openArticle(card.dataset.slug); });
    });

  } catch (err) {
    blogGrid.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem">Could not load articles right now.</p>';
  }
}

async function openArticle(slug) {
  document.getElementById('modal-title').textContent   = 'Loading…';
  document.getElementById('modal-meta').textContent    = '';
  document.getElementById('modal-content').innerHTML   = '<p style="color:var(--text-muted)">Fetching article…</p>';
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  try {
    const res  = await fetch(`${API}/api/blog/${slug}`);
    if (!res.ok) throw new Error('Not found');
    const a    = await res.json();

    document.getElementById('modal-title').textContent  = a.title;
    document.getElementById('modal-meta').textContent   = formatDate(a.created_at);
    document.getElementById('modal-content').innerHTML  = a.content;
  } catch (_) {
    document.getElementById('modal-content').innerHTML = '<p style="color:var(--text-muted)">Could not load article.</p>';
  }
}

function closeModal() {
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

loadBlog();

/* ── Contact form ─────────────────────────── */
const form       = document.getElementById('contact-form');
const submitBtn  = document.getElementById('submit-btn');
const formStatus = document.getElementById('form-status');

const validators = {
  name:    v => v.trim().length >= 2,
  email:   v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
  subject: v => v.trim().length >= 3,
  message: v => v.trim().length >= 10,
};

function validateField(name) {
  const input = document.getElementById(name);
  const error = document.getElementById(`${name}-error`);
  const valid = validators[name](input.value);
  input.classList.toggle('error', !valid);
  error?.classList.toggle('visible', !valid);
  return valid;
}

// Live validation on blur
['name','email','subject','message'].forEach(n => {
  document.getElementById(n)?.addEventListener('blur', () => validateField(n));
});

form.addEventListener('submit', async e => {
  e.preventDefault();

  const fields = ['name','email','subject','message'];
  const valid  = fields.map(validateField).every(Boolean);
  if (!valid) return;

  submitBtn.disabled    = true;
  submitBtn.textContent = 'Sending…';
  formStatus.className  = 'form-status';
  formStatus.style.display = 'none';

  const body = Object.fromEntries(fields.map(f => [
    f === 'message' ? 'message' : f,
    document.getElementById(f).value,
  ]));
  // Fix: use 'message' key to match backend's 'body' expectation via express-validator alias
  const payload = {
    name:    body.name,
    email:   body.email,
    subject: body.subject,
    message: body.message,
  };

  try {
    const res  = await fetch(`${API}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (res.ok) {
      formStatus.textContent = data.message || "Message sent! I'll be in touch soon.";
      formStatus.className   = 'form-status success';
      formStatus.style.display = 'block';
      form.reset();
    } else {
      throw new Error(data.error || 'Something went wrong.');
    }
  } catch (err) {
    formStatus.textContent = err.message || 'Failed to send. Please try emailing me directly.';
    formStatus.className   = 'form-status error-msg';
    formStatus.style.display = 'block';
  } finally {
    submitBtn.disabled    = false;
    submitBtn.innerHTML   = '<i class="fas fa-paper-plane"></i> Send Message';
  }
});

/* ── Helpers ──────────────────────────────── */
function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
