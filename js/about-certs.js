(function() {
  'use strict';

  function openCertificateLightbox(imgSrc, title) {
    let lightbox = document.getElementById('cert-lightbox');
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.id = 'cert-lightbox';
      lightbox.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(13, 13, 13, 0.85);
        backdrop-filter: blur(10px);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
      `;
      lightbox.innerHTML = `
        <button type="button" id="cert-lightbox-close" style="
          position: absolute;
          top: 24px;
          right: 24px;
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.7);
          font-size: 32px;
          cursor: pointer;
          transition: color 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
        " aria-label="Close lightbox">&times;</button>
        <div id="cert-lightbox-content" style="
          display: flex;
          flex-direction: column;
          align-items: center;
          max-width: 90%;
          max-height: 85vh;
          transform: scale(0.95);
          transition: transform 0.3s ease;
        ">
          <img id="cert-lightbox-img" src="" alt="Certificate" style="
            max-width: 100%;
            max-height: 75vh;
            object-fit: contain;
            border-radius: 12px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.1);
            background: #222;
          ">
          <h3 id="cert-lightbox-title" style="
            color: white;
            margin-top: 20px;
            font-family: 'Outfit', sans-serif;
            font-size: 1.25rem;
            font-weight: 600;
            text-align: center;
            letter-spacing: -0.01em;
          "></h3>
        </div>
      `;
      document.body.appendChild(lightbox);

      // Close handlers
      const closeBtn = lightbox.querySelector('#cert-lightbox-close');
      const closeLightbox = () => {
        lightbox.style.opacity = '0';
        lightbox.querySelector('#cert-lightbox-content').style.transform = 'scale(0.95)';
        setTimeout(() => {
          lightbox.style.display = 'none';
          document.body.style.overflow = '';
        }, 300);
      };
      
      closeBtn.addEventListener('click', closeLightbox);
      lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.id === 'cert-lightbox-content') {
          closeLightbox();
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.style.display === 'flex') {
          closeLightbox();
        }
      });
    }

    const imgEl = document.getElementById('cert-lightbox-img');
    const titleEl = document.getElementById('cert-lightbox-title');
    
    // Set fallback image if needed
    imgEl.src = imgSrc || 'assets/images/placeholder-certificate.png';
    titleEl.textContent = title;

    // Show
    lightbox.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Trigger animation
    requestAnimationFrame(() => {
      lightbox.style.opacity = '1';
      lightbox.querySelector('#cert-lightbox-content').style.transform = 'scale(1)';
    });
  }

  // Bind to body click for all certificate badge classes
  document.body.addEventListener('click', function(e) {
    const badge = e.target.closest('.cert-badge');
    if (badge) {
      e.preventDefault();
      const imgSrc = badge.getAttribute('data-cert-image') || '';
      const title = badge.textContent.trim();
      openCertificateLightbox(imgSrc, title);
    }
  });

})();
