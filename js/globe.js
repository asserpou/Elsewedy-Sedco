import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ═══════════════════════════════════════════════════════
   GLOBE CONFIGURATION
   ═══════════════════════════════════════════════════════ */
const GLOBE_RADIUS = 5;

/* ───────────────────────────────────────────────────────
   LOCATION DATA — loaded dynamically from localStorage
   (managed by Admin Panel → Globe Manager)
   Falls back to globe-data.js defaults if available,
   otherwise uses an inline fallback.
   ─────────────────────────────────────────────────────── */
function loadLocations() {
  /* 1. Try localStorage (written by Admin Panel) */
  try {
    const raw = localStorage.getItem('sedco_cms_globe');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) { /* continue to fallback */ }

  /* 2. Try window.GLOBE_DATA (from globe-data.js if loaded) */
  if (window.GLOBE_DATA && typeof window.GLOBE_DATA.get === 'function') {
    return window.GLOBE_DATA.get();
  }

  /* 3. Inline fallback (same as original hardcoded data) */
  return [
    { name: "Egypt (HQ)", lat: 30.0444, lng: 31.2357, type: "hq" },
    { name: "10th of Ramadan", lat: 30.30, lng: 31.75, type: "production" },
    { name: "Saudi Arabia", lat: 24.71, lng: 46.68, type: "production" },
    { name: "UAE", lat: 25.20, lng: 55.27, type: "production" },
    { name: "Turkey", lat: 41.01, lng: 28.98, type: "production" },
    { name: "Germany", lat: 52.52, lng: 13.41, type: "production" },
    { name: "Ethiopia", lat: 9.03, lng: 38.75, type: "production" },
    { name: "Algeria", lat: 36.75, lng: 3.06, type: "production" },
    { name: "Zambia", lat: -15.39, lng: 28.32, type: "production" },
    { name: "Morocco", lat: 33.57, lng: -7.59, type: "operation" },
    { name: "Kuwait", lat: 29.38, lng: 47.98, type: "operation" },
    { name: "Qatar", lat: 25.29, lng: 51.53, type: "operation" },
    { name: "Bahrain", lat: 26.07, lng: 50.56, type: "operation" },
    { name: "Iraq", lat: 33.32, lng: 44.37, type: "operation" },
    { name: "Jordan", lat: 31.95, lng: 35.93, type: "operation" },
    { name: "Kenya", lat: -1.29, lng: 36.82, type: "operation" },
    { name: "Nigeria", lat: 6.52, lng: 3.38, type: "operation" },
    { name: "Sudan", lat: 15.50, lng: 32.56, type: "operation" },
    { name: "Pakistan", lat: 24.86, lng: 67.00, type: "operation" },
    { name: "UK", lat: 51.51, lng: -0.13, type: "export" },
    { name: "Spain", lat: 40.42, lng: -3.70, type: "export" },
    { name: "Italy", lat: 41.90, lng: 12.50, type: "export" },
    { name: "Greece", lat: 37.98, lng: 23.73, type: "export" },
    { name: "India", lat: 19.08, lng: 72.88, type: "export" },
    { name: "China", lat: 39.90, lng: 116.41, type: "export" },
    { name: "Indonesia", lat: -6.21, lng: 106.85, type: "export" },
    { name: "Australia", lat: -33.87, lng: 151.21, type: "export" },
    { name: "South Africa", lat: -26.20, lng: 28.05, type: "export" },
    { name: "Tanzania", lat: -6.79, lng: 39.21, type: "export" },
    { name: "Libya", lat: 32.90, lng: 13.18, type: "export" },
    { name: "Oman", lat: 23.59, lng: 58.38, type: "export" },
    { name: "Ghana", lat: 5.60, lng: -0.19, type: "export" },
    { name: "Senegal", lat: 14.72, lng: -17.47, type: "export" },
    { name: "Cameroon", lat: 3.85, lng: 11.50, type: "export" },
    { name: "Mozambique", lat: -25.97, lng: 32.57, type: "export" },
    { name: "Uganda", lat: 0.35, lng: 32.58, type: "export" },
    { name: "Congo", lat: -4.44, lng: 15.27, type: "export" },
    { name: "Yemen", lat: 15.37, lng: 44.19, type: "export" },
    { name: "Tunisia", lat: 36.81, lng: 10.18, type: "export" },
    { name: "USA", lat: 40.71, lng: -74.00, type: "export" },
    { name: "Brazil", lat: -23.55, lng: -46.63, type: "export" },
    { name: "Russia", lat: 55.75, lng: 37.61, type: "export" },
    { name: "Japan", lat: 35.67, lng: 139.65, type: "export" },
    { name: "France", lat: 48.85, lng: 2.35, type: "export" },
    { name: "Mexico", lat: 19.43, lng: -99.13, type: "export" },
    { name: "South Korea", lat: 37.56, lng: 126.97, type: "export" },
  ];
}

const locations = loadLocations();

/* ───────────────────────────────────────────────────────
   WAYPOINT TEXTURE GENERATOR
   ─────────────────────────────────────────────────────── */
function create3DPin(colorHex, sizeMultiplier) {
  const group = new THREE.Group();

  // Scale down overall size to make them look elegant
  const s = sizeMultiplier * 0.9;
  const headRadius = s * 1.5;
  const coneHeight = s * 3.5;
  const coneRadius = s * 0.7;

  const mat = new THREE.MeshPhongMaterial({
    color: colorHex,
    shininess: 90,
    specular: 0x555555
  });

  const whiteMat = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    shininess: 100,
    specular: 0xffffff
  });

  // 1. Cone (Shaft extending from Z=0 to -coneHeight)
  const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 16);
  const cone = new THREE.Mesh(coneGeo, mat);
  cone.rotation.x = Math.PI / 2;      // Point apex precisely to +Z axis
  cone.position.z = -coneHeight / 2;  // Shift apex to Z=0 surface
  group.add(cone);

  // 2. Head (Sphere at the top of the cone)
  const headGeo = new THREE.SphereGeometry(headRadius, 16, 16);
  const head = new THREE.Mesh(headGeo, mat);
  head.position.z = -coneHeight;
  group.add(head);

  // 3. Inner White Dot
  const dotGeo = new THREE.SphereGeometry(headRadius * 0.5, 16, 16);
  const dot = new THREE.Mesh(dotGeo, whiteMat);
  // Place dot just outside the top face to be visible
  dot.position.z = -coneHeight - (headRadius * 0.6);
  group.add(dot);

  return group;
}

/* ───────────────────────────────────────────────────────
   HELPERS
   ─────────────────────────────────────────────────────── */
function markerColor(type) {
  switch (type) {
    case 'hq': return 0xFFD700;
    case 'production': return 0xcc1b1b;
    case 'operation': return 0x4A90D9;
    default: return 0x999999;
  }
}

function markerSize(type) {
  switch (type) {
    case 'hq': return 0.13;
    case 'production': return 0.09;
    case 'operation': return 0.07;
    default: return 0.05;
  }
}

function latLngToVec3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/* ═══════════════════════════════════════════════════════
   INTERACTIVE GLOBE CLASS
   ═══════════════════════════════════════════════════════ */
class InteractiveGlobe {
  constructor(id) {
    this.container = document.getElementById(id);
    if (!this.container) return;

    this.pulseRings = [];
    this.clock = new THREE.Clock();
    this.isVisible = false;

    this._initTooltip();
    this._initEngine();
    this._buildGlobe();
    this._buildAtmosphere();
    this._buildGraticule();
    this._buildMarkers();
    this._buildStars();
    this._observeVisibility();
    this._onResize();
    this._loop();
  }

  _initTooltip() {
    this.tooltip = document.createElement('div');
    Object.assign(this.tooltip.style, {
      position: 'absolute',
      background: 'rgba(20, 20, 20, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      color: '#fff',
      padding: '12px 16px',
      fontFamily: 'Inter, sans-serif',
      fontSize: '14px',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 0.2s, transform 0.1s',
      transform: 'translate(-50%, -120%)',
      zIndex: '1000',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      minWidth: '200px'
    });
    // Ensure the container can hold absolute elements
    if (getComputedStyle(this.container).position === 'static') {
      this.container.style.position = 'relative';
    }
    this.container.appendChild(this.tooltip);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-2, -2); // Default off-screen
    this.hoveredPin = null;

    const updateMousePos = (e) => {
      const rect = this.container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      this.mouse.x = (x / rect.width) * 2 - 1;
      this.mouse.y = -(y / rect.height) * 2 + 1;
      
      this.tooltipX = x;
      this.tooltipY = y;
    };

    this.container.addEventListener('mousemove', (e) => {
      updateMousePos(e);
    });

    this.container.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        updateMousePos(e.touches[0]);
      }
    }, { passive: true });
    
    this.container.addEventListener('mouseleave', () => {
      this.mouse.x = -2;
      this.mouse.y = -2;
    });
  }

  /* ── Renderer / Camera / Controls ── */
  _initEngine() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    // Position camera to look at Africa/Middle East initially (Lat: 15, Lng: 20).
    // The third number (18) is the initial Zoom Distance. Increase it to zoom out more, decrease it to zoom in.
    const initCamPos = latLngToVec3(15, 20, 16);
    this.camera.position.copy(initCamPos);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, {
      enableDamping: true,
      dampingFactor: 0.05,
      enableZoom: true,
      enablePan: false,
      autoRotate: true,
      autoRotateSpeed: 0.4,
      rotateSpeed: 0.5,
      minPolarAngle: Math.PI * 0.2,
      maxPolarAngle: Math.PI * 0.8,
      minDistance: 10.0, // Prevent zooming too close to the globe
      maxDistance: 22.0, // Prevent zooming too far out
    });

    // Lighting — bright enough to reveal the earth texture, with a warm reddish tint
    this.scene.add(new THREE.AmbientLight(0xffecec, 2.0));

    const dir = new THREE.DirectionalLight(0xffcccc, 1.2);
    dir.position.set(5, 3, 5);
    this.scene.add(dir);

    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-4, -1, -3);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0x8B1A1A, 0.35);
    rim.position.set(-5, -2, -5);
    this.scene.add(rim);
  }

  /* ── Textured earth sphere — shows continents & oceans ── */
  _buildGlobe() {
    const geo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const loader = new THREE.TextureLoader();

    // Dark earth texture — shows country outlines, continents, oceans
    const earthTex = loader.load(
      'https://unpkg.com/three-globe/example/img/earth-dark.jpg',
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        this.globe.material.needsUpdate = true;
      }
    );

    // Bump / topology map for 3D terrain relief
    const bumpTex = loader.load(
      'https://unpkg.com/three-globe/example/img/earth-topology.png'
    );

    const mat = new THREE.MeshPhongMaterial({
      map: earthTex,
      bumpMap: bumpTex,
      bumpScale: 0.8,
      shininess: 12,
      specular: new THREE.Color(0x331111),
      color: new THREE.Color(0xffd5d5), // 🔴 Reddish tint added here
    });

    this.globe = new THREE.Mesh(geo, mat);
    this.scene.add(this.globe);
  }

  /* ── Atmospheric Fresnel glow (red‑tinted to match brand) ── */
  _buildAtmosphere() {
    const vs = `
      varying vec3 vNormal;
      void main(){
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`;
    const fs = `
      varying vec3 vNormal;
      void main(){
        float i = pow(0.6 - dot(vNormal, vec3(0,0,1)), 2.0);
        gl_FragColor = vec4(0.85, 0.1, 0.1, 0.85) * i;
      }`;

    const geo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.18, 64, 64);
    const mat = new THREE.ShaderMaterial({
      vertexShader: vs,
      fragmentShader: fs,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    this.scene.add(new THREE.Mesh(geo, mat));
  }

  /* ── Subtle latitude / longitude grid overlay ── */
  _buildGraticule() {
    const mat = new THREE.LineBasicMaterial({
      color: 0x444444,
      transparent: true,
      opacity: 0.12,
    });
    const R = GLOBE_RADIUS + 0.008;

    // Latitude lines every 30°
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts = [];
      for (let lng = 0; lng <= 360; lng += 2)
        pts.push(latLngToVec3(lat, lng, R));
      this.scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts), mat));
    }
    // Longitude lines every 30°
    for (let lng = 0; lng < 360; lng += 30) {
      const pts = [];
      for (let lat = -90; lat <= 90; lat += 2)
        pts.push(latLngToVec3(lat, lng, R));
      this.scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts), mat));
    }
  }

  /* ── Location markers + pulse rings ── */
  _buildMarkers() {
    const group = new THREE.Group();

    locations.forEach(loc => {
      const pos = latLngToVec3(loc.lat, loc.lng, GLOBE_RADIUS + 0.02);
      const color = markerColor(loc.type);
      const size = markerSize(loc.type);

      const normal = pos.clone().normalize();

      // 3D Physical Pin
      const pin = create3DPin(color, size);
      pin.position.copy(pos).add(normal.clone().multiplyScalar(0.01)); // Barely above surface
      pin.lookAt(0, 0, 0); // Point the Z-axis inwards toward Earth center

      // Add userData to child meshes for raycasting
      pin.traverse((child) => {
        if (child.isMesh) {
          child.userData = { ...loc };
        }
      });
      if (!this.interactablePins) this.interactablePins = [];
      this.interactablePins.push(pin);

      group.add(pin);

      // Soft outer glow for important markers - Additive blending for real glow
      if (loc.type === 'hq' || loc.type === 'production') {
        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(size * 2.8, 16, 16),
          new THREE.MeshBasicMaterial({
            color, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false
          })
        );
        glow.position.copy(pos).add(normal.clone().multiplyScalar(-0.02));
        group.add(glow);
      }

      // Animated pulse ring
      if (loc.type !== 'export') {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(size * 1.8, size * 2.5, 48),
          new THREE.MeshBasicMaterial({
            color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
          })
        );
        ring.position.copy(pos).add(normal.clone().multiplyScalar(0.005));
        ring.lookAt(0, 0, 0);
        group.add(ring);
        this.pulseRings.push({
          mesh: ring,
          speed: 0.8 + Math.random() * 0.6,
          phase: Math.random() * Math.PI * 2,
        });
      }
    });

    this.scene.add(group);
  }

  /* ── Background star field ── */
  _buildStars() {
    const N = 600;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 25 + Math.random() * 55;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(geo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.35 })
    );
    this.scene.add(this.stars);
  }

  /* ── Pause rendering when section is off‑screen ── */
  _observeVisibility() {
    new IntersectionObserver(([e]) => { this.isVisible = e.isIntersecting; },
      { threshold: 0.05 }
    ).observe(this.container);
  }

  /* ── Responsive resize ── */
  _onResize() {
    new ResizeObserver(() => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (!w || !h) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    }).observe(this.container);
  }

  /* ── Render loop ── */
  _loop() {
    requestAnimationFrame(() => this._loop());
    if (!this.isVisible) return;

    const t = this.clock.getElapsedTime();
    this.controls.update();

    // Animate pulse rings
    for (const r of this.pulseRings) {
      const s = 1 + 0.55 * Math.sin(t * r.speed + r.phase);
      r.mesh.scale.setScalar(s);
      r.mesh.material.opacity = 0.5 * Math.max(0, 1 - (s - 1) / 0.55);
    }

    // Slowly drift star field
    if (this.stars) this.stars.rotation.y = t * 0.008;

    // Raycast for hover interactions
    if (this.raycaster && this.interactablePins) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      
      const meshesToTest = [];
      this.interactablePins.forEach(p => p.traverse(c => { if (c.isMesh) meshesToTest.push(c); }));
      
      const intersects = this.raycaster.intersectObjects(meshesToTest);
      
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const data = hit.userData;
        
        if (data && data.name) {
          if (this.hoveredPin !== hit) {
            this.hoveredPin = hit;
            
            const typeLabels = {
              hq: "Headquarters",
              production: "Production Facility",
              operation: "Operation Center",
              export: "Export Market"
            };
            const typeLabel = typeLabels[data.type] || "Location";
            const country = data.country || '';
            const address = data.address || (data.name + ", Local Region");
            const desc = data.description || ("Major " + typeLabel.toLowerCase() + " handling distribution and services.");
            
            this.tooltip.innerHTML = `
              <div style="font-weight:bold; margin-bottom: 6px; color:#ffd700; font-size: 16px; border-bottom: 1px solid rgba(255,215,0,0.3); padding-bottom: 4px;">
                ${data.name}
              </div>
              <div style="font-size:13px; margin-bottom: 4px;">
                <span style="opacity:0.6;">Type:</span> <span style="color:#fff;">${typeLabel}</span>
              </div>
              ${country ? `
              <div style="font-size:13px; margin-bottom: 4px;">
                <span style="opacity:0.6;">Country:</span> <span style="color:#fff;">${country}</span>
              </div>` : ''}
              <div style="font-size:13px; margin-bottom: 6px;">
                <span style="opacity:0.6;">Address:</span> <span style="color:#fff;">${address}</span>
              </div>
              <div style="font-size:12px; opacity:0.8; margin-top:8px; border-top:1px solid rgba(255,255,255,0.15); padding-top:8px; line-height: 1.4;">
                ${desc}
              </div>
            `;
            this.tooltip.style.opacity = '1';
            this.container.style.cursor = 'pointer';
            this.controls.autoRotate = false; // Pause rotation on hover
            
            // Add a slight hover effect to the pin
            hit.parent.scale.setScalar(1.2);
          }
          // Adjust position so it follows the mouse dynamically
          this.tooltip.style.left = this.tooltipX + 'px';
          this.tooltip.style.top = this.tooltipY + 'px';
        }
      } else {
        if (this.hoveredPin) {
          // Reset previous hover scale
          if (this.hoveredPin.parent) {
            this.hoveredPin.parent.scale.setScalar(1.0);
          }
          this.hoveredPin = null;
          this.tooltip.style.opacity = '0';
          this.container.style.cursor = 'grab';
          this.controls.autoRotate = true; // Resume rotation
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}

/* ═══════════════════════════════════════════════════════
   INITIALISE
   ═══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  requestAnimationFrame(() => new InteractiveGlobe('globe-container'));
});
