/* ══════════════════════════════════════════════════════════════
   SHARED COMPONENTS — Injects Navbar, CTA, Footer from one source.
   Production pages include this script BEFORE cms-loader.js.
   Data is stored under localStorage key: sedco_cms_shared
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Skip if on an editor page — those have their own inline markup */
  const path = window.location.pathname.toLowerCase();
  const fname = path.split('/').pop() || 'index.html';
  if (fname.includes('_for_edit')) return;
  if (fname.includes('admin')) return;

  const SUPABASE_URL = 'https://nnwcwqasmdpbvotfepvy.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_llEtCRU2fkmNycPY4HwJ5w_XqnkQFQf';
  const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  /* ─── Default shared data ─── */
  const DEFAULTS = {
    navbar: {
      logoSrc: 'assets/Logo.gif',
      logoText: 'Elsewedy <span style="color:#E32636;">SEDCO</span>',
      links: [
        { text: 'Home', href: 'index.html' },
        { text: 'About', href: 'about.html' },
        { text: 'Solutions', href: 'solutions.html' },
        { text: 'Marketplace', href: 'marketplace.html' }
      ],
      ctaText: 'Contact Us',
      ctaHref: 'contact.html'
    },
    cta: {
      title: 'Ready to <span>Transform</span> Your Operations?',
      text: 'Partner with us for innovative petroleum and electrical solutions that drive efficiency, safety, and sustainable growth.',
      btn1Text: 'Get Started',
      btn1Href: 'contact.html',
      btn1Bg: '',
      btn1Color: '',
      btn2Text: 'View Solutions',
      btn2Href: 'solutions.html',
      btn2Bg: '',
      btn2Color: ''
    },
    footer: {
      logoSrc: 'assets/Logo.gif',
      icon1: 'map-pin',
      icon2: 'phone',
      icon3: 'mail',
      brandText: 'Leading provider of integrated petroleum and electrical services across the MENA region.',
      servicesHeading: 'Services',
      serviceLinks: [
        { text: 'Petroleum Services', href: 'solutions.html' },
        { text: 'Electrical Systems', href: 'solutions.html' },
        { text: 'Instrumentation', href: 'solutions.html' },
        { text: 'Marketplace', href: 'marketplace.html' }
      ],
      companyHeading: 'Company',
      companyLinks: [
        { text: 'About Us', href: 'about.html' },
        { text: 'Contact', href: 'contact.html' }
      ],
      contactHeading: 'Contact',
      address: 'Cairo, Egypt',
      phone: '+20 2 2345 6789',
      email: 'info@elsewedysedco.com',
      copyright: '© 2024 Elsewedy SEDCO. All rights reserved.',
      privacyText: 'Privacy Policy',
      privacyHref: '#',
      termsText: 'Terms of Service',
      termsHref: '#'
    }
  };

  /* ─── Load saved shared data ─── */
  function cloneDefaults() {
    return {
      navbar: {
        ...DEFAULTS.navbar,
        links: DEFAULTS.navbar.links.map(link => ({ ...link }))
      },
      cta: { ...DEFAULTS.cta },
      footer: {
        ...DEFAULTS.footer,
        serviceLinks: DEFAULTS.footer.serviceLinks.map(link => ({ ...link })),
        companyLinks: DEFAULTS.footer.companyLinks.map(link => ({ ...link }))
      }
    };
  }

  function mergeSharedData(saved) {
    const data = cloneDefaults();
    if (!saved) return data;

    if (saved.navbar) {
      data.navbar = {
        ...data.navbar,
        ...saved.navbar,
        links: Array.isArray(saved.navbar.links)
          ? saved.navbar.links.map((link, index) => ({ ...(data.navbar.links[index] || {}), ...link }))
          : data.navbar.links
      };
    }
    if (saved.cta) data.cta = { ...data.cta, ...saved.cta };
    if (saved.footer) {
      data.footer = {
        ...data.footer,
        ...saved.footer,
        serviceLinks: Array.isArray(saved.footer.serviceLinks)
          ? saved.footer.serviceLinks.map((link, index) => ({ ...(data.footer.serviceLinks[index] || {}), ...link }))
          : data.footer.serviceLinks,
        companyLinks: Array.isArray(saved.footer.companyLinks)
          ? saved.footer.companyLinks.map((link, index) => ({ ...(data.footer.companyLinks[index] || {}), ...link }))
          : data.footer.companyLinks
      };
    }

    return data;
  }

  function applyLink(link, target) {
    if (!link || !target) return;
    if (link.text !== undefined) target.text = link.text;
    if (link.href !== undefined) target.href = link.href;
  }

  function buttonStyle(bg, color, extra) {
    const rules = [];
    if (extra) rules.push(extra);
    if (bg) rules.push(`background:${bg} !important`);
    if (color) rules.push(`color:${color} !important`);
    return rules.length ? ` style="${rules.join(';')};"` : '';
  }

  function transformEditorPayload(saved) {
    const data = mergeSharedData(saved);
    const fields = saved.fields || {};
    const buttons = saved.buttons || {};
    const links = saved.links || {};
    const images = saved.images || {};
    const icons = saved.icons || {};

    const fieldMap = {
      'shared.cta.title': ['cta', 'title'],
      'shared.cta.text': ['cta', 'text'],
      'shared.footer.brandText': ['footer', 'brandText'],
      'shared.footer.servicesHeading': ['footer', 'servicesHeading'],
      'shared.footer.companyHeading': ['footer', 'companyHeading'],
      'shared.footer.contactHeading': ['footer', 'contactHeading'],
      'shared.footer.address': ['footer', 'address'],
      'shared.footer.phone': ['footer', 'phone'],
      'shared.footer.email': ['footer', 'email'],
      'shared.footer.copyright': ['footer', 'copyright']
    };

    Object.keys(fieldMap).forEach(key => {
      if (fields[key] === undefined) return;
      const [section, prop] = fieldMap[key];
      data[section][prop] = fields[key];
    });

    if (images['shared.logo']) {
      data.navbar.logoSrc = images['shared.logo'];
      data.footer.logoSrc = images['shared.logo'];
    }

    ['home', 'about', 'solutions', 'marketplace'].forEach((name, index) => {
      applyLink(links[`shared.nav.${name}`] || links[`shared.mob.${name}`], data.navbar.links[index]);
    });

    const navCta = buttons['shared.nav.cta'] || buttons['shared.mob.cta'];
    if (navCta && navCta.text !== undefined) data.navbar.ctaText = navCta.text;

    if (icons['shared.footer.icon1']) data.footer.icon1 = icons['shared.footer.icon1'];
    if (icons['shared.footer.icon2']) data.footer.icon2 = icons['shared.footer.icon2'];
    if (icons['shared.footer.icon3']) data.footer.icon3 = icons['shared.footer.icon3'];

    const ctaBtn1 = buttons['shared.cta.btn1'];
    if (ctaBtn1) {
      if (ctaBtn1.text !== undefined) data.cta.btn1Text = ctaBtn1.text;
      if (ctaBtn1.bg) data.cta.btn1Bg = ctaBtn1.bg;
      if (ctaBtn1.color) data.cta.btn1Color = ctaBtn1.color;
    }
    const ctaBtn2 = buttons['shared.cta.btn2'];
    if (ctaBtn2) {
      if (ctaBtn2.text !== undefined) data.cta.btn2Text = ctaBtn2.text;
      if (ctaBtn2.bg) data.cta.btn2Bg = ctaBtn2.bg;
      if (ctaBtn2.color) data.cta.btn2Color = ctaBtn2.color;
    }

    for (let i = 0; i < 4; i += 1) applyLink(links[`shared.footer.link${i + 1}`], data.footer.serviceLinks[i]);
    for (let i = 0; i < 2; i += 1) applyLink(links[`shared.footer.link${i + 5}`], data.footer.companyLinks[i]);

    const privacy = links['shared.footer.privacy'];
    if (privacy) {
      if (privacy.text !== undefined) data.footer.privacyText = privacy.text;
      if (privacy.href !== undefined) data.footer.privacyHref = privacy.href;
    }
    const terms = links['shared.footer.terms'];
    if (terms) {
      if (terms.text !== undefined) data.footer.termsText = terms.text;
      if (terms.href !== undefined) data.footer.termsHref = terms.href;
    }

    return data;
  }

  async function getSharedData() {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('cms_pages')
          .select('payload')
          .eq('page_key', 'shared')
          .maybeSingle();
        const saved = data && data.payload;
        if (!error && saved && saved._editor) {
          return (saved.fields || saved.links || saved.buttons) ? transformEditorPayload(saved) : mergeSharedData(saved);
        }
        if (error) console.warn('CMS Shared: Could not load from Supabase, trying legacy JSON', error);
      } catch (e) {
        console.warn('CMS Shared: Could not load from Supabase, trying legacy JSON', e);
      }
    }

    try {
      const resp = await fetch('cms-data/shared.json', { cache: 'no-store' });
      if (resp.ok) {
        const saved = await resp.json();
        if (saved && saved._editor) {
          return (saved.fields || saved.links || saved.buttons) ? transformEditorPayload(saved) : mergeSharedData(saved);
        }
      }
    } catch (e) {
      console.warn('CMS Shared: Could not load saved data from server, trying localStorage', e);
    }
    try {
      const raw = localStorage.getItem('sedco_cms_shared');
      if (!raw) return DEFAULTS;
      const saved = JSON.parse(raw);
      if (!saved || !saved._editor) return DEFAULTS;
      return (saved.fields || saved.links || saved.buttons) ? transformEditorPayload(saved) : mergeSharedData(saved);
    } catch (e) { return DEFAULTS; }
  }

  /* ─── Detect active page for nav highlighting ─── */
  function getActivePage() {
    if (fname === '' || fname === 'index.html') return 'index.html';
    if (fname.includes('about')) return 'about.html';
    if (fname.includes('solution')) return 'solutions.html';
    if (fname.includes('marketplace')) return 'marketplace.html';
    if (fname.includes('contact')) return 'contact.html';
    return '';
  }

  /* ─── Generate Navbar HTML ─── */
  function renderNavbar(data) {
    const active = getActivePage();
    const linksHtml = data.links.map((l, i) =>
      `<a href="${l.href}" ${l.href === active ? 'class="active"' : ''} data-cms-link="nav.link${i+1}">${l.text}<span class="underline"></span></a>`
    ).join('\n        ');

    const mobileLinksHtml = data.links.map((l, i) =>
      `<a href="${l.href}" data-cms-link="mob.nav.link${i+1}">${l.text}</a>`
    ).join('\n      ');

    return `<nav class="navbar">
    <div class="section-container nav-inner">
      <a href="index.html" class="nav-logo">
        <div class="logo-bg">
          <img src="${data.logoSrc}" alt="Elsewedy SEDCO">
        </div>
      </a>
      <div class="nav-links">
        ${linksHtml}
        <a href="${data.ctaHref}" class="nav-cta ${active === 'contact.html' ? 'active' : ''}" data-cms-btn="nav.cta">${data.ctaText}</a>
      </div>
      <button class="mobile-toggle" aria-label="Toggle menu">
        <span></span><span></span><span></span>
      </button>
    </div>
    <div class="mobile-menu section-container">
      ${mobileLinksHtml}
      <a href="${data.ctaHref}" class="mobile-cta" data-cms-btn="mob.nav.cta">${data.ctaText}</a>
    </div>
  </nav>`;
  }

  /* ─── Generate CTA Section HTML ─── */
  function renderCTA(data) {
    return `<div class="footer-cta reveal">
        <h2 data-cms-field="shared.cta.title">${data.title}</h2>
        <p data-cms-field="shared.cta.text">${data.text}</p>
        <div class="footer-cta-buttons">
          <a href="${data.btn1Href}" class="btn-primary footer-btn" data-cms-btn="shared.cta.btn1"${buttonStyle(data.btn1Bg, data.btn1Color)}>${data.btn1Text} <i data-lucide="arrow-right" style="width:16px;height:16px;"></i></a>
          <a href="${data.btn2Href}" class="btn-outline" data-cms-btn="shared.cta.btn2"${buttonStyle(data.btn2Bg, data.btn2Color, 'border-color:rgba(255,255,255,0.15)')}>${data.btn2Text}</a>
        </div>
      </div>`;
  }

  /* ─── Generate Footer HTML ─── */
  function renderFooter(data, ctaData) {
    const serviceLinksHtml = data.serviceLinks.map((l, i) =>
      `<li><a href="${l.href}" data-cms-link="footer.link${i+1}">${l.text}</a></li>`
    ).join('\n            ');

    const companyLinksHtml = data.companyLinks.map((l, i) =>
      `<li><a href="${l.href}" data-cms-link="footer.link${i+5}">${l.text}</a></li>`
    ).join('\n            ');

    return `<footer class="site-footer" id="shared-footer">
    <div class="footer-accent-top"></div>
    <div class="section-container" style="padding-top:64px;padding-bottom:48px;">
      ${renderCTA(ctaData)}
      <div class="footer-divider" style="margin-top:48px;"></div>
      <div class="footer-grid">
        <div class="footer-brand">
          <a href="index.html" class="nav-logo" style="display:inline-block; text-decoration:none;">
            <div class="logo-bg">
              <img src="${data.logoSrc}" alt="Elsewedy SEDCO">
            </div>
          </a>
          <p style="margin-top:12px;" data-cms-field="footer.brandText">${data.brandText}</p>
        </div>
        <div class="footer-section">
          <h4 data-cms-field="footer.servicesHeading">${data.servicesHeading}</h4>
          <ul>
            ${serviceLinksHtml}
          </ul>
        </div>
        <div class="footer-section">
          <h4 data-cms-field="footer.companyHeading">${data.companyHeading}</h4>
          <ul>
            ${companyLinksHtml}
          </ul>
        </div>
        <div class="footer-section footer-contact">
          <h4 data-cms-field="footer.contactHeading">${data.contactHeading}</h4>
          <ul>
            <li><i data-lucide="${data.icon1}" style="width:16px;height:16px;" data-cms-icon="shared.footer.icon1"></i><span data-cms-field="footer.address">${data.address}</span></li>
            <li><i data-lucide="${data.icon2}" style="width:16px;height:16px;" data-cms-icon="shared.footer.icon2"></i><span data-cms-field="footer.phone">${data.phone}</span></li>
            <li><i data-lucide="${data.icon3}" style="width:16px;height:16px;" data-cms-icon="shared.footer.icon3"></i><span data-cms-field="footer.email">${data.email}</span></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p data-cms-field="footer.copyright">${data.copyright}</p>
        <div class="footer-bottom-links">
          <a href="${data.privacyHref}" data-cms-link="footer.privacy">${data.privacyText}</a>
          <a href="${data.termsHref}" data-cms-link="footer.terms">${data.termsText}</a>
        </div>
      </div>
    </div>
  </footer>`;
  }

  /* ─── Inject into page ─── */
  async function inject() {
    const data = await getSharedData();

    /* Replace navbar placeholder */
    const navPlaceholder = document.getElementById('shared-navbar');
    if (navPlaceholder) {
      navPlaceholder.outerHTML = renderNavbar(data.navbar);
    }

    /* Replace footer placeholder */
    const footerPlaceholder = document.getElementById('shared-footer');
    if (footerPlaceholder) {
      footerPlaceholder.outerHTML = renderFooter(data.footer, data.cta);
    }

    window.SHARED_COMPONENTS_INJECTED = true;
    document.dispatchEvent(new CustomEvent('shared-components-injected'));
  }

  /* Run on DOM ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      inject().catch(err => console.error("Shared components inject error:", err));
    });
  } else {
    inject().catch(err => console.error("Shared components inject error:", err));
  }

  /* Expose for external use */
  window.SEDCO_SHARED_DEFAULTS = DEFAULTS;
})();
