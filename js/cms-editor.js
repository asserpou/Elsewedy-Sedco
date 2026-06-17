/* ══════════════════════════════════════════════════════════════
   CMS EDITOR ENGINE — SHARED (used by all _for_edit pages)
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Immediately hide the page content to prevent info disclosure
  const hideStyle = document.createElement('style');
  hideStyle.innerHTML = 'html, body { display: none !important; }';
  document.documentElement.appendChild(hideStyle);

  const staticGatekeeper = document.getElementById('cms-gatekeeper');

  /* CONFIG — each page sets window.CMS_PAGE_KEY before loading this script */
  const PAGE_KEY = window.CMS_PAGE_KEY || 'home';
  const PAGE_NAME = window.CMS_PAGE_NAME || PAGE_KEY;
  const STORAGE_KEY = 'sedco_cms_' + PAGE_KEY;
  const CARD_TEMPLATE = window.CMS_CARD_TEMPLATE || 'default';
  const SUPABASE_URL = 'https://nnwcwqasmdpbvotfepvy.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_llEtCRU2fkmNycPY4HwJ5w_XqnkQFQf';
  const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  async function checkAccess() {
    // 1. Frame check
    if (window.self === window.top) {
      window.location.replace('admin.html');
      return;
    }
    try {
      if (window.parent.location.origin !== window.location.origin) {
        window.location.replace('admin.html');
        return;
      }
    } catch (e) {
      window.location.replace('admin.html');
      return;
    }

    // 2. Auth & Admin Role Check
    if (!supabaseClient) {
      window.location.replace('admin.html');
      return;
    }

    try {
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError || !session || !session.user) {
        window.location.replace('admin.html');
        return;
      }

      const { data: roleData, error: roleError } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (roleError || !roleData || roleData.role !== 'admin') {
        window.location.replace('admin.html');
        return;
      }

      // If all checks pass, show the page content
      if (hideStyle.parentNode) hideStyle.parentNode.removeChild(hideStyle);
      if (staticGatekeeper && staticGatekeeper.parentNode) {
        staticGatekeeper.parentNode.removeChild(staticGatekeeper);
      }
    } catch (e) {
      window.location.replace('admin.html');
    }
  }

  checkAccess();

  async function logAction(action, entityType, entityId, description, metadata = {}) {
    if (!supabaseClient) return;
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session || !session.user) return;
      await supabaseClient.from('admin_logs').insert([{
        user_id: session.user.id,
        user_email: session.user.email,
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        description,
        metadata
      }]);
    } catch (e) { console.warn('CMS Editor: Log failed:', e); }
  }

  /* DOM refs */
  const fileInput = document.getElementById('cms-file-input');
  const toast = document.getElementById('cms-toast');
  const saveStatus = document.getElementById('save-status');
  const richToolbar = document.getElementById('rich-toolbar');

  let currentEditEl = null;
  let currentImageKey = null;
  let currentBtnEl = null;
  let currentLinkEl = null;
  let currentIconEl = null;
  let selectedIconName = '';
  let imageDataMap = {};
  let iconDataMap = {};
  let certificatesData = [];

  async function loadCmsPage(pageKey) {
    let payload = null;
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('cms_pages')
          .select('payload')
          .eq('page_key', pageKey)
          .maybeSingle();
        if (!error && data && data.payload) payload = data.payload;
        if (error) console.warn('CMS Editor: Supabase load failed, trying legacy storage', error);
      } catch (e) {
        console.warn('CMS Editor: Supabase load failed, trying legacy storage', e);
      }
    }

    if (!payload) {
      try {
        const resp = await fetch(`cms-data/${pageKey}.json`, { cache: 'no-store' });
        if (resp.ok) payload = await resp.json();
      } catch (e) {
        console.warn('CMS Editor: Could not load legacy JSON, trying localStorage', e);
      }
    }

    if (!payload) {
      try {
        const raw = localStorage.getItem('sedco_cms_' + pageKey);
        if (raw) payload = JSON.parse(raw);
      } catch (e) {
        // ignore
      }
    }

    // Merge certificates if page is about and payload doesn't have them but local storage does
    if (pageKey === 'about' && payload) {
      if (!payload.certificates) {
        try {
          const raw = localStorage.getItem('sedco_cms_about');
          if (raw) {
            const localData = JSON.parse(raw);
            if (localData && localData.certificates) {
              payload.certificates = localData.certificates;
            }
          }
        } catch (e) {}
      }
    }

    return payload;
  }

  async function saveCmsPage(pageKey, payload) {
    // Save locally to disk if local server is running (do not await to prevent blocking)
    fetch('http://localhost:3000/api/save-visual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageKey, payload })
    }).catch(e => {
      console.warn('CMS Editor: Local server save-visual failed', e);
    });

    if (!supabaseClient) throw new Error('Supabase client is not available.');
    const { error } = await supabaseClient
      .from('cms_pages')
      .upsert({ page_key: pageKey, payload, updated_at: new Date().toISOString() }, { onConflict: 'page_key' });
    if (error) throw error;
  }

  async function resetCmsPage(pageKey) {
    if (!supabaseClient) throw new Error('Supabase client is not available.');
    const { error } = await supabaseClient.from('cms_pages').delete().eq('page_key', pageKey);
    if (error) throw error;
  }

  function getButtonTextContainer(el) {
    return Array.from(el.children).find(child => {
      if (!['SPAN', 'LABEL', 'DIV'].includes(child.tagName)) return false;
      if (child.querySelector('svg, i[data-lucide]')) return false;
      return child.textContent.trim().length > 0;
    }) || null;
  }

  function getButtonLabel(el) {
    const textContainer = getButtonTextContainer(el);
    if (textContainer) return textContainer.textContent.trim();

    let label = '';
    el.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) label += node.textContent;
    });
    return label.trim();
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

  /* ─────────────────────────────────────────
     CARD CONFIG (only for pages that have cards)
  ───────────────────────────────────────── */
  const categoriesGrid = document.getElementById('categories-grid');
  const DEFAULT_CARDS = window.CMS_DEFAULT_CARDS || [];
  let CARDS = JSON.parse(JSON.stringify(DEFAULT_CARDS));
  window.CMS_CARDS = CARDS;

  const IMG_UPLOAD_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;

  function buildCardHTML(card, index) {
    return `
    <div class="category-card reveal" data-delay="${(index * 0.1).toFixed(1)}" data-card-id="${card.id}" style="position:relative;">
      <button class="card-delete-btn" title="Delete this card" data-delete-card="${card.id}" aria-label="Delete card">✕</button>
      <div class="card-image" data-cms-image="cat.${card.id}.image" data-cms-tooltip="Click to replace">
        <img src="${card.img}" alt="${card.title}" id="img-card-${card.id}">
        <div class="overlay"></div>
        <div class="card-number"><span>${card.num}</span></div>
        <div class="cms-img-overlay">${IMG_UPLOAD_ICON}<span>Replace</span></div>
      </div>
      <div class="card-content">
        <h3 data-cms-field="cat.${card.id}.title" data-cms-tooltip="Dbl-click to edit">${card.title}</h3>
        <p class="card-desc" data-cms-field="cat.${card.id}.desc" data-cms-tooltip="Dbl-click to edit">${card.desc}</p>
      </div>
    </div>`;
  }

  /* Marketplace product card variant */
  function buildMarketplaceCardHTML(card, index) {
    const tag = card.tag || 'Petroleum';
    return `
    <div class="product-card reveal" data-delay="${(index * 0.05).toFixed(2)}" data-card-id="${card.id}" data-tag="${tag}" data-title="${card.title}" data-spec="${card.desc}" style="position:relative;">
      <button class="card-delete-btn" title="Delete this card" data-delete-card="${card.id}" aria-label="Delete card" style="position:absolute;top:8px;left:8px;z-index:10;background:rgba(220,38,38,0.9);color:white;border:none;border-radius:50%;width:24px;height:24px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
      <div class="card-image" data-cms-image="cat.${card.id}.image" data-cms-tooltip="Click to replace">
        <img src="${card.img}" alt="${card.title}" id="img-card-${card.id}">
        <div class="overlay"></div>
        <span class="tag-badge" data-cms-field="cat.${card.id}.tag" data-cms-tooltip="Dbl-click to edit tag">${tag}</span>
        <div class="cms-img-overlay">${IMG_UPLOAD_ICON}<span>Replace</span></div>
      </div>
      <div class="card-content">
        <h3 data-cms-field="cat.${card.id}.title" data-cms-tooltip="Dbl-click to edit">${card.title}</h3>
        <p class="spec" data-cms-field="cat.${card.id}.desc" data-cms-tooltip="Dbl-click to edit">${card.desc}</p>
        <span class="card-link">View Details <i data-lucide="arrow-right" style="width:12px;height:12px;"></i></span>
      </div>
    </div>`;
  }

  function renderCards() {
    if (!categoriesGrid) return;
    const builder = CARD_TEMPLATE === 'marketplace' ? buildMarketplaceCardHTML : buildCardHTML;
    categoriesGrid.innerHTML = CARDS.map((c, i) => builder(c, i)).join('');
    if (window.lucide) try { lucide.createIcons(); } catch(e) {}
    bindTextFields();
    bindImageFields();
    bindDeleteButtons();
    document.dispatchEvent(new CustomEvent('cms:cards-rendered', {
      detail: { pageKey: PAGE_KEY, template: CARD_TEMPLATE, count: CARDS.length }
    }));
  }

  function bindDeleteButtons() {
    document.querySelectorAll('[data-delete-card]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const cid = btn.dataset.deleteCard;
        if (!confirm(`Delete card "${cid}"? This cannot be undone unless you Reset.`)) return;
        CARDS = CARDS.filter(c => c.id !== cid);
        window.CMS_CARDS = CARDS;
        renderCards();
        markDirty();
        showToast('Card removed.', 'success');
      });
    });
  }


  /* ─────────────────────────────────────────
     LOAD & APPLY SAVED DATA
  ───────────────────────────────────────── */
  async function loadAndApply() {
    const data = await loadCmsPage(PAGE_KEY);

    if (!data || !data._editor) { renderCards(); return; }

    try {
      if (data.cards && Array.isArray(data.cards)) {
        CARDS = data.cards;
        if (PAGE_KEY === 'marketplace') {
          if (CARDS.length === 0) {
            CARDS = JSON.parse(JSON.stringify(DEFAULT_CARDS));
          } else if (CARDS.length > 1) {
            CARDS = [CARDS[0]];
          }
        }
        window.CMS_CARDS = CARDS;
      }
      renderCards();

      if (data.fields) {
        Object.keys(data.fields).forEach(key => {
          const el = document.querySelector(`[data-cms-field="${key}"]`);
          if (el) el.innerHTML = data.fields[key];
        });
      }

      if (data.images) {
        imageDataMap = { ...data.images };
        Object.keys(data.images).forEach(key => {
          const wrapper = document.querySelector(`[data-cms-image="${key}"]`);
          if (!wrapper) return;
          const img = wrapper.querySelector('img');
          if (img && data.images[key]) img.src = data.images[key];
        });
      }

      if (data.icons) {
        if (typeof iconDataMap !== 'undefined') Object.assign(iconDataMap, data.icons);
        Object.keys(data.icons).forEach(key => {
          /* Try data-cms-icon first (before bindIconFields), then data-cms-icon-key (after) */
          let container = document.querySelector(`[data-cms-icon-key="${key}"]`);
          if (!container) {
            const el = document.querySelector(`[data-cms-icon="${key}"]`);
            if (el) { el.setAttribute('data-lucide', data.icons[key]); return; }
            return;
          }
          /* Remove old icon and insert new one */
          const oldSvg = container.querySelector('svg');
          const oldI = container.querySelector('i[data-lucide]');
          if (oldSvg) oldSvg.remove();
          if (oldI) oldI.remove();
          const newI = document.createElement('i');
          newI.setAttribute('data-lucide', data.icons[key]);
          newI.style.width = container.dataset.cmsIconSize || '20px';
          newI.style.height = container.dataset.cmsIconSize || '20px';
          container.insertBefore(newI, container.firstChild);
        });
        try { if (window.lucide) lucide.createIcons(); } catch(e) {}
      }

      if (data.buttons) {
        Object.keys(data.buttons).forEach(key => {
          const el = document.querySelector(`[data-cms-btn="${key}"]`);
          if (!el) return;
          const b = data.buttons[key];
          if (b.text !== undefined) {
            setButtonLabel(el, b.text, b._iconFirst);
          }
          if (b.bg) {
            el.style.setProperty('background', b.bg, 'important');
            el.dataset.cmsBg = b.bg;
          }
          if (b.color) {
            el.style.setProperty('color', b.color, 'important');
            el.dataset.cmsColor = b.color;
          }
        });
      }

      if (data.links) {
        Object.keys(data.links).forEach(key => {
          const el = document.querySelector(`[data-cms-link="${key}"]`);
          if (!el) return;
          const l = data.links[key];
          if (l.text) el.textContent = l.text;
          if (l.href) el.href = l.href;
        });
      }

      if (data.styles) {
        Object.keys(data.styles).forEach(token => {
          document.documentElement.style.setProperty(token, data.styles[token]);
          const ctrl = document.querySelector(`[data-token="${token}"]`);
          if (ctrl) {
            ctrl.value = data.styles[token].replace('px', '');
            syncControlDisplay(ctrl);
          }
        });
      }

      if (data.certificates && Array.isArray(data.certificates) && PAGE_KEY === 'about') {
        certificatesData = data.certificates;
        const container = document.getElementById('about-certs-container');
        if (container) {
          container.innerHTML = data.certificates.map((c, i) => {
            const delay = ((i + 1) * 0.1).toFixed(1);
            return `<span class="cert-badge reveal scale-up visible" data-delay="${delay}" data-cert-image="${c.img || ''}" style="opacity: 1; transform: scale(1); cursor: pointer;">${c.text}</span>`;
          }).join('\n');
        }
      }

      if (saveStatus) { saveStatus.textContent = 'Loaded'; setTimeout(() => { saveStatus.textContent = 'Ready'; }, 1500); }
    } catch (e) {
      console.warn('CMS Editor: Could not apply loaded data', e);
      renderCards();
    }
  }


  /* ─────────────────────────────────────────
     SAVE ALL DATA
  ───────────────────────────────────────── */
  function saveAll() {
    exitEditing();
    closeBtnPopover();
    closeLinkPopover();

    /* ── Sync card DOM edits back into CARDS array ── */
    CARDS.forEach(card => {
      const titleEl = document.querySelector(`[data-cms-field="cat.${card.id}.title"]`);
      const descEl  = document.querySelector(`[data-cms-field="cat.${card.id}.desc"]`);
      const tagEl   = document.querySelector(`[data-cms-field="cat.${card.id}.tag"]`);
      if (titleEl) card.title = titleEl.textContent.trim();
      if (descEl)  card.desc  = descEl.textContent.trim();
      if (tagEl)   card.tag   = tagEl.textContent.trim();
      /* Also sync image if it was replaced */
      const imgKey = `cat.${card.id}.image`;
      if (imageDataMap[imgKey]) card.img = imageDataMap[imgKey];
    });

    const fields = {};
    document.querySelectorAll('[data-cms-field]').forEach(el => {
      fields[el.dataset.cmsField] = el.innerHTML;
    });
    const buttons = {};
    document.querySelectorAll('[data-cms-btn]').forEach(el => {
      const cs = el.style;
      let iconFirst = false;
      const firstChild = el.firstChild;
      if (firstChild && firstChild.nodeType === Node.ELEMENT_NODE) iconFirst = true;

      buttons[el.dataset.cmsBtn] = {
        text: getButtonLabel(el),
        bg: el.dataset.cmsBg || cs.background || cs.backgroundColor || '',
        color: el.dataset.cmsColor || cs.color || '',
        _iconFirst: iconFirst
      };
    });
    const links = {};
    document.querySelectorAll('[data-cms-link]').forEach(el => {
      links[el.dataset.cmsLink] = { text: el.textContent.trim(), href: el.getAttribute('href') || '' };
    });
    const styles = {};
    document.querySelectorAll('[data-token]').forEach(ctrl => {
      const val = document.documentElement.style.getPropertyValue(ctrl.dataset.token);
      if (val) styles[ctrl.dataset.token] = val;
    });

    const icons = (typeof iconDataMap !== 'undefined') ? { ...iconDataMap } : {};
    const payload = { _editor: true, fields, buttons, links, images: imageDataMap, icons, styles, cards: CARDS, lastSaved: new Date().toISOString() };
    if (PAGE_KEY === 'about') {
      payload.certificates = certificatesData;
    }

    // Send payload to Supabase so production visitors see the edited content.
    saveCmsPage(PAGE_KEY, payload)
    .then(() => {
      logAction('edit_page', 'cms_page', PAGE_KEY, `Updated visual editor layout for ${PAGE_NAME} page`, { page_key: PAGE_KEY });
      return { success: true };
    })
    .then(serverResult => {
      showToast('All changes saved to server!', 'success');
      if (saveStatus) { saveStatus.textContent = 'Saved ✓'; setTimeout(() => { saveStatus.textContent = 'Ready'; }, 3000); }
    })
    .catch(err => {
      logAction('edit_page_local', 'cms_page', PAGE_KEY, `Updated visual editor layout locally for ${PAGE_NAME} page (Supabase offline)`, { page_key: PAGE_KEY, error: err.message || err });
      console.warn('CMS Editor: Supabase save failed, saving to localStorage:', err);
      showToast('Saved locally only. Run the CMS SQL in Supabase.', 'warning');
      if (saveStatus) { saveStatus.textContent = 'Server save failed'; setTimeout(() => { saveStatus.textContent = 'Ready'; }, 3000); }
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

      /* ── Auto-save history entry ── */
      try {
        const histKey = 'sedco_cms_save_history';
        const hist = JSON.parse(localStorage.getItem(histKey) || '[]');
        hist.unshift({
          id: 'sh_' + Date.now(),
          page: PAGE_KEY,
          pageName: PAGE_NAME,
          timestamp: new Date().toISOString(),
          type: 'visual',
          snapshot: payload
        });
        if (hist.length > 100) hist.length = 100;
        localStorage.setItem(histKey, JSON.stringify(hist));
      } catch(hErr) { console.warn('Auto-history save failed', hErr); }

    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }


  /* ─────────────────────────────────────────
     RESET
  ───────────────────────────────────────── */
  function resetAll() {
    if (!confirm('Reset ALL content to original defaults? All saved changes will be erased.')) return;
    localStorage.removeItem(STORAGE_KEY);
    imageDataMap = {};
    CARDS = JSON.parse(JSON.stringify(DEFAULT_CARDS));
    window.CMS_CARDS = CARDS;
    document.querySelectorAll('[data-token]').forEach(ctrl => {
      document.documentElement.style.removeProperty(ctrl.dataset.token);
    });
    
    resetCmsPage(PAGE_KEY)
    .then(() => {
      showToast('Content reset. Reloading…', 'success');
      setTimeout(() => location.reload(), 800);
    })
    .catch(err => {
      console.warn('CMS Editor: Supabase reset failed, clearing local configurations:', err);
      showToast('Reset complete (local only). Reloading…', 'success');
      setTimeout(() => location.reload(), 800);
    });
  }

  function syncControlDisplay(ctrl) {
    if (!ctrl) return;
    const token = ctrl.dataset.token;
    const val = ctrl.value;
    const unit = ctrl.dataset.unit || '';
    
    if (ctrl.type === 'color') {
      const hexSpan = ctrl.closest('.sp-color-wrap')?.querySelector('.sp-color-hex');
      if (hexSpan) hexSpan.textContent = val;
      const swatch = ctrl.closest('.sp-color-swatch') || ctrl.parentElement;
      if (swatch && (swatch.classList.contains('sp-color-swatch') || swatch.id?.startsWith('swatch-') || swatch.style.background !== undefined)) {
        swatch.style.background = val;
      }
    } else if (ctrl.type === 'range') {
      const numInput = ctrl.closest('.sp-slider-wrap')?.querySelector('.sp-slider-num-input');
      if (numInput) numInput.value = val;
    }
  }

  function bindStylePanelControls() {
    document.querySelectorAll('#style-panel input[data-token]').forEach(ctrl => {
      if (ctrl.type === 'range') {
        const valSpan = ctrl.closest('.sp-slider-wrap')?.querySelector('.sp-slider-val');
        if (valSpan) {
          const numInput = document.createElement('input');
          numInput.type = 'number';
          numInput.className = 'sp-slider-num-input';
          numInput.min = ctrl.min || '0';
          numInput.max = ctrl.max || '100';
          numInput.value = ctrl.value;
          numInput.style.cssText = 'width: 55px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; padding: 2px 4px; font-size: 12px; text-align: center; margin-left: 8px;';
          
          valSpan.replaceWith(numInput);
          
          // Bidirectional sync
          ctrl.addEventListener('input', () => {
            numInput.value = ctrl.value;
          });
          
          numInput.addEventListener('input', () => {
            let val = parseInt(numInput.value);
            if (isNaN(val)) return;
            ctrl.value = val;
            const token = ctrl.dataset.token;
            const unit = ctrl.dataset.unit || '';
            document.documentElement.style.setProperty(token, val + unit);
            markDirty();
          });
        }
      }

      ctrl.addEventListener('input', () => {
        const token = ctrl.dataset.token;
        const unit = ctrl.dataset.unit || '';
        const val = ctrl.value + unit;
        document.documentElement.style.setProperty(token, val);
        syncControlDisplay(ctrl);
        markDirty();
      });
      // Initial sync from current styles
      const token = ctrl.dataset.token;
      const computedVal = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
      if (computedVal) {
        if (ctrl.type === 'color' && computedVal.startsWith('#')) {
          ctrl.value = computedVal;
        } else if (ctrl.type === 'range') {
          ctrl.value = parseInt(computedVal) || ctrl.value;
        }
        syncControlDisplay(ctrl);
      }
    });
  }

  function bindEditorToolbar() {
    // 1. Preview button
    const previewBtn = document.getElementById('btn-preview');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => {
        const previewUrl = window.CMS_PREVIEW_PAGE || 'index.html';
        window.open(previewUrl, '_blank');
      });
    }

    // 2. Style panel toggle button
    const styleBtn = document.getElementById('btn-style-panel');
    const stylePanel = document.getElementById('style-panel');
    if (styleBtn && stylePanel) {
      styleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = stylePanel.classList.toggle('open');
        styleBtn.classList.toggle('active', isOpen);
      });
      stylePanel.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      document.addEventListener('click', () => {
        stylePanel.classList.remove('open');
        styleBtn.classList.remove('active');
      });
    }

    // 3. Save button
    const saveBtn = document.getElementById('btn-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        saveAll();
      });
    }

    // 4. Reset button
    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetAll();
      });
    }
  }


  /* ─────────────────────────────────────────
     TEXT FIELD EDITING — with rich text toolbar
  ───────────────────────────────────────── */
  function bindTextFields() {
    document.querySelectorAll('[data-cms-field]').forEach(el => {
      if (el.dataset.cmsTextBound === '1') return;
      el.dataset.cmsTextBound = '1';
      /* Do NOT clone — cloneNode destroys loaded innerHTML and breaks references */
      el.addEventListener('dblclick', e => {
        e.preventDefault(); e.stopPropagation();
        enterEditing(el);
      });
      el.addEventListener('input', () => {
        syncMarketplaceCardMeta(el);
        markDirty();
      });
      el.addEventListener('blur', () => {
        syncMarketplaceCardMeta(el);
      });
    });
  }

  function syncMarketplaceCardMeta(el) {
    if (CARD_TEMPLATE !== 'marketplace' || !el?.dataset?.cmsField) return;
    const match = el.dataset.cmsField.match(/^cat\.(.+?)\.(title|desc|tag)$/);
    if (!match) return;
    const cardEl = el.closest('.product-card');
    if (!cardEl) return;
    const value = el.textContent.trim();
    if (match[2] === 'title') cardEl.setAttribute('data-title', value);
    if (match[2] === 'desc') cardEl.setAttribute('data-spec', value);
    if (match[2] === 'tag') cardEl.setAttribute('data-tag', value);
  }

  function enterEditing(el) {
    if (currentEditEl === el) return;
    exitEditing();
    currentEditEl = el;
    el.classList.add('cms-editing');
    el.contentEditable = 'true';
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    showRichToolbar(el);
  }

  function exitEditing() {
    if (!currentEditEl) return;
    currentEditEl.contentEditable = 'false';
    currentEditEl.classList.remove('cms-editing');
    currentEditEl = null;
    hideRichToolbar();
  }

  /* Rich text toolbar */
  function showRichToolbar(el) {
    if (!richToolbar) return;
    const rect = el.getBoundingClientRect();
    let top = rect.top - 50;
    let left = rect.left;
    if (top < 60) top = rect.bottom + 8;
    if (left + 300 > window.innerWidth) left = window.innerWidth - 310;
    richToolbar.style.top = Math.max(60, top) + 'px';
    richToolbar.style.left = Math.max(8, left) + 'px';
    richToolbar.classList.add('visible');
  }

  function hideRichToolbar() {
    if (richToolbar) richToolbar.classList.remove('visible');
  }

  if (richToolbar) {
    richToolbar.addEventListener('click', e => {
      const btn = e.target.closest('.rt-btn');
      if (!btn) return;
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      if (cmd && currentEditEl) { document.execCommand(cmd, false, null); currentEditEl.focus(); markDirty(); }
    });
  }

  const rtFontSize = document.getElementById('rt-font-size');
  if (rtFontSize) {
    rtFontSize.addEventListener('change', function () {
      if (!currentEditEl) return;
      if (this.value) { document.execCommand('fontSize', false, this.value); currentEditEl.focus(); markDirty(); }
      this.value = '';
    });
  }

  const rtTextColor = document.getElementById('rt-text-color');
  if (rtTextColor) {
    rtTextColor.addEventListener('input', function () {
      if (!currentEditEl) return;
      document.execCommand('foreColor', false, this.value);
      const bar = document.getElementById('rt-color-bar');
      if (bar) bar.style.background = this.value;
      currentEditEl.focus(); markDirty();
    });
  }

  const rtBgColor = document.getElementById('rt-bg-color');
  if (rtBgColor) {
    rtBgColor.addEventListener('input', function () {
      if (!currentEditEl) return;
      document.execCommand('hiliteColor', false, this.value);
      currentEditEl.focus(); markDirty();
    });
  }

  document.addEventListener('mousedown', e => {
    if (currentEditEl && !currentEditEl.contains(e.target) && (!richToolbar || !richToolbar.contains(e.target))) exitEditing();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { exitEditing(); closeBtnPopover(); closeLinkPopover(); }
  });


  /* ─────────────────────────────────────────
     IMAGE REPLACEMENT
  ───────────────────────────────────────── */
  function bindImageFields() {
    document.querySelectorAll('[data-cms-image]').forEach(wrapper => {
      if (wrapper.dataset.cmsImageBound === '1') return;
      wrapper.dataset.cmsImageBound = '1';
      wrapper.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        currentImageKey = wrapper.dataset.cmsImage;
        fileInput.click();
      });
      wrapper.style.cursor = 'pointer';
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file || !currentImageKey) return;
      const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      const ext = file.name.split('.').pop().toLowerCase();
      if (!allowedExts.includes(ext) || !allowedMimes.includes(file.type.toLowerCase())) {
        showToast('Please select a valid image file (JPG, JPEG, PNG, or WEBP)', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('Image size must be under 5MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = ev => {
        const base64 = ev.target.result;
        const wrapper = document.querySelector(`[data-cms-image="${currentImageKey}"]`);
        if (wrapper) { const img = wrapper.querySelector('img'); if (img) img.src = base64; }
        imageDataMap[currentImageKey] = base64;
        currentImageKey = null;
        markDirty();
      };
      reader.readAsDataURL(file);
      fileInput.value = '';
    });
  }


  /* ─────────────────────────────────────────
     BUTTON POPOVER
  ───────────────────────────────────────── */
  const btnPopover = document.getElementById('btn-popover');
  const bpopText = document.getElementById('bpop-text-input');
  const bpopBgColor = document.getElementById('bpop-bg-color');
  const bpopBgSwatch = document.getElementById('bpop-bg-swatch');
  const bpopTxColor = document.getElementById('bpop-text-color');
  const bpopTxSwatch = document.getElementById('bpop-text-swatch');

  function openBtnPopover(el, x, y) {
    currentBtnEl = el;
    const cs = window.getComputedStyle(el);
    bpopText.value = getButtonLabel(el);
    const bg = el.dataset.cmsBg || el.style.background || el.style.backgroundColor || rgbToHex(cs.backgroundColor) || '#E32636';
    const tx = el.dataset.cmsColor || el.style.color || rgbToHex(cs.color) || '#ffffff';
    bpopBgColor.value = isValidHex(bg) ? bg : '#E32636';
    bpopBgSwatch.style.background = bpopBgColor.value;
    bpopTxColor.value = isValidHex(tx) ? tx : '#ffffff';
    bpopTxSwatch.style.background = bpopTxColor.value;
    positionPopover(btnPopover, x, y);
    btnPopover.classList.add('open');
  }
  function closeBtnPopover() { if (btnPopover) { btnPopover.classList.remove('open'); currentBtnEl = null; } }

  if (bpopBgColor) bpopBgColor.addEventListener('input', () => { bpopBgSwatch.style.background = bpopBgColor.value; });
  if (bpopTxColor) bpopTxColor.addEventListener('input', () => { bpopTxSwatch.style.background = bpopTxColor.value; });

  const bpopCloseBtn = document.getElementById('bpop-close-btn');
  if (bpopCloseBtn) bpopCloseBtn.addEventListener('click', closeBtnPopover);

  const bpopApplyBtn = document.getElementById('bpop-apply-btn');
  if (bpopApplyBtn) {
    bpopApplyBtn.addEventListener('click', () => {
      if (!currentBtnEl) return;
      
      const newText = bpopText.value;
      const firstChild = currentBtnEl.firstChild;
      setButtonLabel(currentBtnEl, newText, firstChild && firstChild.nodeType === Node.ELEMENT_NODE);

      currentBtnEl.style.setProperty('background', bpopBgColor.value, 'important');
      currentBtnEl.style.setProperty('color', bpopTxColor.value, 'important');
      currentBtnEl.dataset.cmsBg = bpopBgColor.value;
      currentBtnEl.dataset.cmsColor = bpopTxColor.value;
      closeBtnPopover();
      markDirty();
      showToast('Button updated!', 'success');
    });
  }

  function bindBtnFields() {
    document.querySelectorAll('[data-cms-btn]').forEach(el => {
      if (el.dataset.cmsBtnBound === '1') return;
      el.dataset.cmsBtnBound = '1';
      el.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        openBtnPopover(el, e.clientX, e.clientY);
      });
    });
  }


  /* ─────────────────────────────────────────
     LINK POPOVER
  ───────────────────────────────────────── */
  const linkPopover = document.getElementById('link-popover');
  const lpopText = document.getElementById('lpop-text-input');
  const lpopHref = document.getElementById('lpop-href-input');

  function openLinkPopover(el, x, y) {
    currentLinkEl = el;
    lpopText.value = el.textContent.trim();
    lpopHref.value = el.getAttribute('href') || '';
    positionPopover(linkPopover, x, y);
    linkPopover.classList.add('open');
  }
  function closeLinkPopover() { if (linkPopover) { linkPopover.classList.remove('open'); currentLinkEl = null; } }

  const lpopCloseBtn = document.getElementById('lpop-close-btn');
  if (lpopCloseBtn) lpopCloseBtn.addEventListener('click', closeLinkPopover);

  const lpopApplyBtn = document.getElementById('lpop-apply-btn');
  if (lpopApplyBtn) {
    lpopApplyBtn.addEventListener('click', () => {
      if (!currentLinkEl) return;
      const underline = currentLinkEl.querySelector('.underline');
      currentLinkEl.textContent = lpopText.value;
      if (underline) currentLinkEl.appendChild(underline);
      currentLinkEl.href = lpopHref.value;
      closeLinkPopover();
      markDirty();
      showToast('Link updated!', 'success');
    });
  }

  function bindLinkFields() {
    document.querySelectorAll('[data-cms-link]').forEach(el => {
      if (el.dataset.cmsLinkBound === '1') return;
      el.dataset.cmsLinkBound = '1';
      el.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        openLinkPopover(el, e.clientX, e.clientY);
      });
    });
  }

  /* Close popovers when clicking outside */
  document.addEventListener('click', e => {
    if (btnPopover && btnPopover.classList.contains('open') && !btnPopover.contains(e.target) && !e.target.closest('[data-cms-btn]')) closeBtnPopover();
    if (linkPopover && linkPopover.classList.contains('open') && !linkPopover.contains(e.target) && !e.target.closest('[data-cms-link]')) closeLinkPopover();
  });


  /* ─────────────────────────────────────────
     ADD CARD MODAL (only if present)
  ───────────────────────────────────────── */
  const addCardModal = document.getElementById('add-card-modal');
  const addCardBtn = document.getElementById('add-card-btn');
  let selectedIcon = 'zap';

  if (addCardBtn && addCardModal) {
    let newCardImage = 'assets/images/solution-turnkey.png';
    const acmImgPreview = document.getElementById('acm-img-preview');
    const acmImgFile = document.getElementById('acm-img-file');

    if (acmImgPreview && acmImgFile) {
      acmImgPreview.addEventListener('click', () => acmImgFile.click());
      acmImgFile.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        const ext = file.name.split('.').pop().toLowerCase();
        if (!allowedExts.includes(ext) || !allowedMimes.includes(file.type.toLowerCase())) {
          showToast('Please select a valid image (JPG, JPEG, PNG, or WEBP)', 'error');
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          showToast('Image size must be under 5MB', 'error');
          return;
        }
        const reader = new FileReader();
        reader.onload = ev => {
          newCardImage = ev.target.result;
          acmImgPreview.innerHTML = '<img src="' + newCardImage + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" /><span style="position:absolute;bottom:4px;font-size:11px;color:rgba(255,255,255,0.7);">Click to change</span>';
        };
        reader.readAsDataURL(file);
      });
    }

    addCardBtn.addEventListener('click', () => {
      document.getElementById('acm-title').value = '';
      document.getElementById('acm-desc').value = '';
      newCardImage = 'assets/images/solution-turnkey.png';
      if (acmImgPreview) acmImgPreview.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:32px;height:32px;opacity:0.5;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><span>Click to upload image</span>';
      if (acmImgFile) acmImgFile.value = '';
      const defaultChip = document.querySelector('.acm-icon-chip.selected') || document.querySelector('.acm-icon-chip');
      selectedIcon = defaultChip?.dataset.icon || (CARD_TEMPLATE === 'marketplace' ? 'Petroleum' : 'zap');
      document.querySelectorAll('.acm-icon-chip').forEach(c => c.classList.toggle('selected', c.dataset.icon === selectedIcon));
      addCardModal.classList.add('open');
    });

    document.getElementById('acm-cancel').addEventListener('click', () => addCardModal.classList.remove('open'));
    addCardModal.addEventListener('click', e => { if (e.target === addCardModal) addCardModal.classList.remove('open'); });

    document.getElementById('acm-icon-row').addEventListener('click', e => {
      const chip = e.target.closest('.acm-icon-chip');
      if (!chip) return;
      selectedIcon = chip.dataset.icon;
      document.querySelectorAll('.acm-icon-chip').forEach(c => c.classList.toggle('selected', c === chip));
    });

    document.getElementById('acm-confirm').addEventListener('click', () => {
      const title = document.getElementById('acm-title').value.trim();
      const desc = document.getElementById('acm-desc').value.trim();
      if (!title || !desc) { showToast('Please fill in title and description.', 'error'); return; }
      const newId = 'card_' + Date.now();
      const newNum = String(CARDS.length + 1).padStart(2, '0');
      const newCard = CARD_TEMPLATE === 'marketplace'
        ? { id: newId, num: newNum, title, desc, img: newCardImage, tag: selectedIcon }
        : { id: newId, num: newNum, title, desc, img: newCardImage, icon: selectedIcon };
      CARDS.push(newCard);
      renderCards();
      markDirty();
      addCardModal.classList.remove('open');
      showToast('New card added!', 'success');
    });
  }


  /* ─────────────────────────────────────────
     ICON BINDING & PICKER
  ───────────────────────────────────────── */
  function bindIconFields() {
    document.querySelectorAll('[data-cms-icon]').forEach(el => {
      const parent = el.parentElement;
      const key = el.getAttribute('data-cms-icon');
      if (parent) {
        parent.setAttribute('data-cms-icon-key', key);
        parent.style.cursor = 'pointer';
        parent.title = 'Double-click to change icon';

        if (parent.dataset.cmsIconBound !== '1') {
          parent.dataset.cmsIconBound = '1';
          parent.addEventListener('dblclick', e => {
            e.preventDefault();
            e.stopPropagation();
            currentIconEl = parent;
            const svgEl = parent.querySelector('svg');
            const iEl = parent.querySelector('i[data-lucide]');
            selectedIconName = '';
            if (iEl) selectedIconName = iEl.getAttribute('data-lucide') || '';
            if (!selectedIconName && svgEl) {
              const cls = svgEl.className.baseVal || svgEl.getAttribute('class') || '';
              const match = cls.match(/lucide-([a-z0-9-]+)/);
              if (match) selectedIconName = match[1];
            }
            const picker = getIconPicker();
            picker.search.value = '';
            picker.renderIcons('');
            picker.modal.classList.add('open');
          });
        }
      }
    });
  }

  let iconPickerInstance = null;
  function getIconPicker() {
    if (iconPickerInstance) return iconPickerInstance;

    let modal = document.getElementById('icon-picker-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'icon-picker-modal';
      modal.innerHTML = `
        <div class="ipm-box">
          <h3>Select Icon</h3>
          <div class="ipm-subtitle">Double-click or select an icon to apply it.</div>
          <input type="text" class="ipm-search" id="ipm-search-input" placeholder="Search icons (e.g. shield, map-pin, phone)...">
          <div class="ipm-grid-wrap">
            <div class="ipm-grid" id="ipm-grid-container"></div>
          </div>
          <div class="ipm-actions">
            <button type="button" class="ipm-btn-cancel" id="ipm-cancel-btn">Cancel</button>
            <button type="button" class="ipm-btn-apply" id="ipm-apply-btn" style="display:none;">Apply</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const grid = document.getElementById('ipm-grid-container');
    const search = document.getElementById('ipm-search-input');
    const cancelBtn = document.getElementById('ipm-cancel-btn');

    cancelBtn.addEventListener('click', () => modal.classList.remove('open'));

    const allIcons = [
      'shield', 'shield-check', 'lightbulb', 'leaf', 'map-pin', 'phone', 'mail', 
      'zap', 'activity', 'award', 'bar-chart', 'bell', 'book', 'bookmark', 'box', 
      'briefcase', 'calendar', 'camera', 'check', 'check-circle', 'chevron-right', 
      'clock', 'cloud', 'code', 'cog', 'database', 'download', 'edit', 'eye', 
      'file', 'file-text', 'folder', 'globe', 'heart', 'home', 'image', 'info', 
      'key', 'link', 'lock', 'map', 'menu', 'message-square', 'monitor', 'music', 
      'package', 'paperclip', 'play', 'plus', 'printer', 'search', 'send', 
      'server', 'settings', 'share-2', 'shopping-bag', 'shopping-cart', 'star', 
      'tag', 'thumbs-up', 'trash', 'user', 'users', 'video', 'wifi', 'wrench',
      'building-2', 'play-circle'
    ];

    function renderIcons(query) {
      grid.innerHTML = '';
      const filtered = allIcons.filter(name => name.includes(query.toLowerCase()));
      filtered.forEach(name => {
        const item = document.createElement('div');
        item.className = 'ipm-icon-item' + (selectedIconName === name ? ' selected' : '');
        item.innerHTML = `<i data-lucide="${name}"></i><span>${name}</span>`;

        item.addEventListener('click', () => {
          grid.querySelectorAll('.ipm-icon-item').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
          applyIcon(name);
        });

        grid.appendChild(item);
      });
      if (window.lucide) {
        try { lucide.createIcons(); } catch(e) {}
      }
    }

    function applyIcon(name) {
      if (currentIconEl) {
        const iconKey = currentIconEl.getAttribute('data-cms-icon-key');
        if (iconKey) {
          iconDataMap[iconKey] = name;
        }

        const oldSvg = currentIconEl.querySelector('svg');
        const oldI = currentIconEl.querySelector('i[data-lucide]');
        if (oldSvg) oldSvg.remove();
        if (oldI) oldI.remove();

        const newI = document.createElement('i');
        newI.setAttribute('data-lucide', name);
        newI.style.width = currentIconEl.dataset.cmsIconSize || '20px';
        newI.style.height = currentIconEl.dataset.cmsIconSize || '20px';
        currentIconEl.insertBefore(newI, currentIconEl.firstChild);

        if (window.lucide) {
          try { lucide.createIcons(); } catch(e) {}
        }
        markDirty();
      }
      modal.classList.remove('open');
    }

    search.addEventListener('input', e => renderIcons(e.target.value));

    iconPickerInstance = {
      modal,
      search,
      renderIcons
    };

    return iconPickerInstance;
  }


  /* ─────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────── */
  function markDirty() {
    if (saveStatus) saveStatus.textContent = 'Unsaved changes';
  }

  function positionPopover(popEl, cx, cy) {
    const pw = popEl.offsetWidth || 280;
    const ph = popEl.offsetHeight || 200;
    let x = cx + 12;
    let y = cy + 12;
    if (x + pw > window.innerWidth - 16) x = cx - pw - 12;
    if (y + ph > window.innerHeight - 16) y = cy - ph - 12;
    popEl.style.left = Math.max(8, x) + 'px';
    popEl.style.top = Math.max(8, y) + 'px';
  }

  function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent') return null;
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]].map(v => parseInt(v).toString(16).padStart(2, '0')).join('');
  }

  function isValidHex(str) { return /^#[0-9a-fA-F]{3,8}$/.test(str); }

  let toastTimer = null;
  function showToast(msg, type) {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.className = 'show ' + (type || 'success');
    const icon = type === 'error'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    toast.innerHTML = icon + '<span>' + msg + '</span>';
    toastTimer = setTimeout(() => { toast.classList.remove('show'); }, 3000);
  }


  /* ─────────────────────────────────────────
     INIT — order matters!
  ───────────────────────────────────────── */
  function init() {
    /* Expose utilities globally for modal sync */
    window.CMS_RENDER_CARDS = renderCards;
    window.CMS_MARK_DIRTY = markDirty;

    /* 1. Transfer icon data from <i> to parent BEFORE lucide destroys <i> tags */
    bindIconFields();

    /* 2. NOW it's safe to render lucide icons (replaces <i> with <svg>) */
    try { if (window.lucide) lucide.createIcons(); } catch(e) {}

    /* 3. Load saved data (text, images, buttons, icons, etc) */
    loadAndApply();

    /* 4. Re-bind icon fields for any new icons created by loadAndApply (e.g. card icons) */
    bindIconFields();
    try { if (window.lucide) lucide.createIcons(); } catch(e) {}

    /* 5. Bind interactive editors for text, buttons, links, images */
    bindTextFields();
    bindBtnFields();
    bindLinkFields();
    bindImageFields();

    /* 5b. Bind top bar buttons and Style Panel controls */
    bindEditorToolbar();
    bindStylePanelControls();

    /* 6. Intercept all links and form submissions in the visual editor iframe to prevent navigation lockout */
    document.addEventListener('click', e => {
      const anchor = e.target.closest('a');
      if (anchor) {
        e.preventDefault();
      }
    }, { capture: true });

    document.addEventListener('submit', e => {
      e.preventDefault();
    }, { capture: true });

    console.log('CMS Editor initialized.',
      'Fields:', document.querySelectorAll('[data-cms-field]').length,
      'Icons:', document.querySelectorAll('[data-cms-icon-key]').length,
      'Buttons:', document.querySelectorAll('[data-cms-btn]').length
    );
  }

  /* Wait for lucide to be available (it loads with defer) */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    /* If DOM is already ready, wait a tick for deferred scripts */
    setTimeout(init, 50);
  }

})();
