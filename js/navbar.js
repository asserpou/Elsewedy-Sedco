document.addEventListener('DOMContentLoaded', function() {
  function initNavbar() {
    var navbar = document.querySelector('.navbar');
    var toggle = document.querySelector('.mobile-toggle');
    var mobileMenu = document.querySelector('.mobile-menu');
    var mobileLinks = document.querySelectorAll('.mobile-menu a');
    var currentPath = window.location.pathname.replace(/\/$/, '') || '/';

    // Avoid duplicate bindings
    if (navbar && navbar.dataset.navInitialized === '1') return;
    if (navbar) navbar.dataset.navInitialized = '1';

    var navLinks = document.querySelectorAll('.nav-links a:not(.nav-cta)');
    navLinks.forEach(function(link) {
      var href = link.getAttribute('href');
      if (!href) return;
      var linkPath = href.replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '') || '/';
      if (linkPath === currentPath || (currentPath === '/' && (href === 'index.html' || href === '/' || href === './'))) {
        link.classList.add('active');
      }
    });

    mobileLinks.forEach(function(link) {
      var href = link.getAttribute('href');
      if (!href) return;
      var linkPath = href.replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '') || '/';
      if (linkPath === currentPath || (currentPath === '/' && (href === 'index.html' || href === '/' || href === './'))) {
        link.classList.add('active');
      }
    });

    if (toggle && mobileMenu) {
      if (toggle.dataset.toggleBound !== '1') {
        toggle.dataset.toggleBound = '1';
        toggle.addEventListener('click', function() {
          toggle.classList.toggle('open');
          mobileMenu.classList.toggle('open');
        });
      }
    }

    mobileLinks.forEach(function(link) {
      if (link.dataset.clickBound !== '1') {
        link.dataset.clickBound = '1';
        link.addEventListener('click', function() {
          if (toggle) toggle.classList.remove('open');
          if (mobileMenu) mobileMenu.classList.remove('open');
        });
      }
    });
  }

  // Run on DOMContentLoaded in case navbar is inline
  initNavbar();

  // Run when shared components are injected
  document.addEventListener('shared-components-injected', initNavbar);

  // Scroll listener runs globally and queries the navbar dynamically
  window.addEventListener('scroll', function() {
    var navbar = document.querySelector('.navbar');
    if (!navbar) return;
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });
});
