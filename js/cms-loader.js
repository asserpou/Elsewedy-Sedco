/* ============================================
   CMS Loader — Reads from localStorage and
   applies saved content to ALL production pages.
   
   Storage keys:
     sedco_cms_home     → index.html
     sedco_cms_about    → about.html
     sedco_cms_solutions → solutions.html
     sedco_cms_contact  → contact.html
     sedco_cms_marketplace → marketplace.html
   ============================================ */
(function () {
  'use strict';

  /* Detect page */
  const path = window.location.pathname.toLowerCase();
  const fname = path.split('/').pop() || 'index.html';
  let pageKey = 'home';
  if (fname.includes('about'))    pageKey = 'about';
  else if (fname.includes('solution')) pageKey = 'solutions';
  else if (fname.includes('contact'))  pageKey = 'contact';
  else if (fname.includes('marketplace')) pageKey = 'marketplace';

  /* Skip if we're on an editor page */
  if (fname.includes('_for_edit')) return;

  const STORAGE_KEY = 'sedco_cms_' + pageKey;
  const SUPABASE_URL = 'https://nnwcwqasmdpbvotfepvy.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_llEtCRU2fkmNycPY4HwJ5w_XqnkQFQf';
  const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  // 1. Get cached data synchronously
  let cachedData = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d._editor) cachedData = d;
    }
  } catch (e) {}

  function adjustLink(url) {
    if (!url) return '';
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal) return url;
    if (!url.includes(':') && !url.startsWith('#') && !url.includes('.')) {
      const cleaned = url.startsWith('/') ? url.substring(1) : url;
      if (['about', 'solutions', 'contact', 'marketplace', 'index', 'admin'].includes(cleaned)) {
        return cleaned + '.html';
      }
    }
    return url;
  }

  function getButtonTextContainer(el) {
    return Array.from(el.children).find(child => {
      if (!['SPAN', 'LABEL', 'DIV'].includes(child.tagName)) return false;
      if (child.querySelector('svg, i[data-lucide]')) return false;
      return child.textContent.trim().length > 0;
    }) || null;
  }

  function setButtonLabel(el, text, iconFirst) {
    const textContainer = getButtonTextContainer(el);
    if (textContainer) {
      textContainer.textContent = text;
      Array.from(el.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) node.remove();
      });
      return;
    }

    const childEls = Array.from(el.children).map(c => c.cloneNode(true));
    el.textContent = '';
    if (iconFirst && childEls.length) {
      childEls.forEach(c => el.appendChild(c));
      el.appendChild(document.createTextNode(' ' + text));
    } else {
      el.appendChild(document.createTextNode(text + (childEls.length ? ' ' : '')));
      childEls.forEach(c => el.appendChild(c));
    }
  }

  function revealPage() {
    const gate = document.getElementById('cms-loading-gate');
    if (gate && gate.parentNode) {
      gate.parentNode.removeChild(gate);
    }
  }

  function applyData(data) {
    if (!data) return;
    window.CMS_LOADED_DATA = data;

    /* ── Text fields ── */
    if (data.fields) {
      Object.keys(data.fields).forEach(key => {
        const el = document.querySelector('[data-cms-field="' + key + '"]');
        if (el) el.innerHTML = data.fields[key];
      });
    }

    /* ── Buttons ── */
    if (data.buttons) {
      Object.keys(data.buttons).forEach(key => {
        const el = document.querySelector('[data-cms-btn="' + key + '"]');
        if (!el) return;
        const b = data.buttons[key];
        if (b.text !== undefined) {
          setButtonLabel(el, b.text, b._iconFirst);
        }
        if (b.bg) el.style.setProperty('background', b.bg, 'important');
        if (b.color) el.style.setProperty('color', b.color, 'important');
      });
    }

    /* ── Links ── */
    if (data.links) {
      Object.keys(data.links).forEach(key => {
        const el = document.querySelector('[data-cms-link="' + key + '"]');
        if (!el) return;
        const l = data.links[key];
        if (l.text) { const u = el.querySelector('.underline'); el.textContent = l.text; if (u) el.appendChild(u); }
        if (l.href) el.href = adjustLink(l.href);
      });
    }

    /* ── Images ── */
    if (data.images) {
      Object.keys(data.images).forEach(key => {
        if (!data.images[key]) return;
        const w = document.querySelector('[data-cms-image="' + key + '"]');
        if (w) { const img = w.querySelector('img'); if (img) img.src = data.images[key]; }
      });
    }

    /* ── Icons ── */
    if (data.icons) {
      Object.keys(data.icons).forEach(key => {
        let el = document.querySelector('[data-cms-icon="' + key + '"]');
        if (el) {
          el.setAttribute('data-lucide', data.icons[key]);
          return;
        }
        let container = document.querySelector('[data-cms-icon-key="' + key + '"]');
        if (container) {
          const oldSvg = container.querySelector('svg');
          const oldI = container.querySelector('i[data-lucide]');
          if (oldSvg) oldSvg.remove();
          if (oldI) oldI.remove();
          const newI = document.createElement('i');
          newI.setAttribute('data-lucide', data.icons[key]);
          newI.style.width = container.dataset.cmsIconSize || '20px';
          newI.style.height = container.dataset.cmsIconSize || '20px';
          container.insertBefore(newI, container.firstChild);
        }
      });
      try { setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 100); } catch(e) {}
    }

    /* ── CSS tokens ── */
    if (data.styles) {
      Object.keys(data.styles).forEach(t => {
        document.documentElement.style.setProperty(t, data.styles[t]);
      });
    }

    /* ── Cards (home page) ── */
    if (data.cards && Array.isArray(data.cards) && pageKey === 'home') {
      const grid = document.querySelector('.categories-grid');
      if (grid) {
        grid.innerHTML = data.cards.map((c, i) => {
          const title = c.title || '';
          const desc = c.desc || '';
          const img = c.img || 'assets/images/solution-turnkey.png';
          const num = c.num || String(i + 1).padStart(2, '0');

          return '<div class="category-card reveal" data-delay="' + (i * 0.1).toFixed(1) + '">' +
            '<div class="card-image" data-cms-image="cat.' + c.id + '.image">' +
              '<img src="' + img + '" alt="' + title + '">' +
              '<div class="overlay"></div>' +
              '<div class="card-number"><span>' + num + '</span></div>' +
            '</div>' +
            '<div class="card-content">' +
              '<h3 data-cms-field="cat.' + c.id + '.title">' + title + '</h3>' +
              '<p class="card-desc" data-cms-field="cat.' + c.id + '.desc">' + desc + '</p>' +
            '</div>' +
          '</div>';
        }).join('');

        if (data.fields) {
          Object.keys(data.fields).forEach(key => {
            if (key.startsWith('cat.')) {
              const el = grid.querySelector('[data-cms-field="' + key + '"]');
              if (el) el.innerHTML = data.fields[key];
            }
          });
        }
        try { setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 150); } catch(e) {}
      }
    }

    /* ── Marketplace cards ── */
    if (data.cards && Array.isArray(data.cards) && pageKey === 'marketplace') {
      const grid = document.querySelector('.products-grid');
      if (grid) {
        const cardsById = {};
        data.cards.forEach(c => { if (c && c.id) cardsById[c.id] = c; });

        grid.querySelectorAll('.product-card[data-card-id]').forEach(card => {
          const cmsCard = cardsById[card.dataset.cardId];
          if (!cmsCard) return;

          if (cmsCard.tag) card.setAttribute('data-tag', cmsCard.tag);
          if (cmsCard.title) card.setAttribute('data-title', cmsCard.title);
          if (cmsCard.desc) card.setAttribute('data-spec', cmsCard.desc);

          const img = card.querySelector('.card-image img');
          if (img && cmsCard.img) img.src = cmsCard.img;

          const badge = card.querySelector('.tag-badge');
          if (badge && cmsCard.tag) badge.textContent = cmsCard.tag;

          const titleEl = card.querySelector('h3');
          if (titleEl && cmsCard.title) titleEl.textContent = cmsCard.title;

          const specEl = card.querySelector('.spec');
          if (specEl && cmsCard.desc) specEl.textContent = cmsCard.desc;
        });

        try {
          setTimeout(() => {
            if (window.lucide) lucide.createIcons();
            var searchInput = document.getElementById('product-search');
            if (searchInput) { searchInput.dispatchEvent(new Event('input')); }
          }, 150);
        } catch(e) {}
      }
    }

    /* ── Certificates (about page) ── */
    if (data.certificates && Array.isArray(data.certificates) && pageKey === 'about') {
      const container = document.getElementById('about-certs-container');
      if (container) {
        container.innerHTML = data.certificates.map((c, i) => {
          const delay = ((i + 1) * 0.1).toFixed(1);
          return `<span class="cert-badge reveal scale-up visible" data-delay="${delay}" data-cert-image="${c.img || ''}" style="opacity: 1; transform: scale(1); cursor: pointer;">${c.text}</span>`;
        }).join('\n');
      }
    }
  }

  async function loadDataAndSync() {
    let freshData = null;
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('cms_pages')
          .select('payload')
          .eq('page_key', pageKey)
          .maybeSingle();
        if (!error && data && data.payload && data.payload._editor) freshData = data.payload;
      } catch (e) {}
    }

    if (!freshData) {
      try {
        const resp = await fetch(`cms-data/${pageKey}.json`, { cache: 'no-store' });
        if (resp.ok) {
          const d = await resp.json();
          if (d && d._editor) freshData = d;
        }
      } catch (e) {}
    }

    if (freshData) {
      // Apply the fresh data to update UI if anything changed
      applyData(freshData);
      // Cache it for the next instant load
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(freshData));
      } catch (e) {}
    }
    
    // Always guarantee page is visible
    revealPage();
  }

  function handleDOMReady() {
    // 1. If we have cached data, apply it immediately to prevent flashes
    if (cachedData) {
      applyData(cachedData);
      revealPage();
    } else {
      // Short fallback: if there is no cache, wait a tiny bit or reveal
      setTimeout(revealPage, 500);
    }

    // 2. Fetch fresh content in background, update DOM dynamically, and update cache
    const hasNavbar = document.getElementById('shared-navbar');
    const hasFooter = document.getElementById('shared-footer');
    if ((hasNavbar || hasFooter) && !window.SHARED_COMPONENTS_INJECTED) {
      document.addEventListener('shared-components-injected', () => {
        loadDataAndSync().catch(() => {});
      });
    } else {
      loadDataAndSync().catch(() => {});
    }
  }

  /* Run on DOM ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleDOMReady);
  } else {
    handleDOMReady();
  }
})();
