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

  async function loadData() {
    try {
      const resp = await fetch(`cms-data/${pageKey}.json`, { cache: 'no-store' });
      if (resp.ok) {
        const d = await resp.json();
        return (d && d._editor) ? d : null;
      }
    } catch (e) {
      console.warn('CMS Loader: Could not load saved data from server, trying localStorage', e);
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      return (d && d._editor) ? d : null;
    } catch (e) { return null; }
  }

  async function apply() {
    const data = await loadData();
    if (!data) return;
    window.CMS_LOADED_DATA = data;

    /* ── Text fields ── */
    if (data.fields) {
      Object.keys(data.fields).forEach(key => {
        /* Match by data-cms-field attribute (same as editor pages) */
        const el = document.querySelector('[data-cms-field="' + key + '"]');
        if (el) el.innerHTML = data.fields[key];
      });
    }

    /* ── Buttons ──
       The saved button data contains:
         text: the text-node-only content (no icon text)
         bg, color: inline style colors
         _iconFirst: whether the icon was before the text
    */
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
        if (l.href) el.href = l.href;
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

    /* ── Icons ──
       The editor saves icons keyed by data-cms-icon attribute values.
       On production pages, icons use <i data-lucide="X"> without data-cms-icon.
       On editor pages, <i data-cms-icon="key"> gets moved to parent as data-cms-icon-key.
       We try both selectors for maximum compatibility.
    */
    if (data.icons) {
      Object.keys(data.icons).forEach(key => {
        /* Try data-cms-icon first (production pages with the attribute) */
        let el = document.querySelector('[data-cms-icon="' + key + '"]');
        if (el) {
          el.setAttribute('data-lucide', data.icons[key]);
          return;
        }
        /* Try data-cms-icon-key (parent container, editor-style) */
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

    /* ── Cards (home page) ──
       CRITICAL FIX: Only replace the grid if the cards array has actually
       been modified (different length or content from default).
       When replacing, generate COMPLETE card HTML with data-cms-field
       attributes so text edits from the saved fields can be applied.
    */
    if (data.cards && Array.isArray(data.cards) && pageKey === 'home') {
      const grid = document.querySelector('.categories-grid');
      if (grid) {
        /* Build new card HTML — always reflect the full saved array */
        grid.innerHTML = data.cards.map((c, i) => {
          /* Use title/desc from the cards array (already has DOM edits synced by editor) */
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

        /* Now apply any per-card field overrides from data.fields */
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

    console.log('CMS: Applied "' + pageKey + '" data');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const hasNavbar = document.getElementById('shared-navbar');
    const hasFooter = document.getElementById('shared-footer');
    if ((hasNavbar || hasFooter) && !window.SHARED_COMPONENTS_INJECTED) {
      document.addEventListener('shared-components-injected', () => {
        apply().catch(err => console.error("CMS Loader apply error:", err));
      });
    } else {
      apply().catch(err => console.error("CMS Loader apply error:", err));
    }
  });
})();
