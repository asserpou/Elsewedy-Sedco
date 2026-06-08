/* ══════════════════════════════════════════════════════════════
   GLOBE DATA — Centralized, editable location data for the 3D globe.
   
   The Admin Panel writes to localStorage key: sedco_cms_globe
   globe.js reads from this module at runtime.
   ══════════════════════════════════════════════════════════════ */

const DEFAULT_GLOBE_LOCATIONS = [
  // ── Headquarters ──
  { id: 'loc_hq_egypt', name: "Egypt (HQ)", lat: 30.0444, lng: 31.2357, type: "hq" },

  // ── Production Facilities ──
  { id: 'loc_prod_ramadan', name: "10th of Ramadan", lat: 30.30, lng: 31.75, type: "production" },
  { id: 'loc_prod_sa', name: "Saudi Arabia", lat: 24.71, lng: 46.68, type: "production" },
  { id: 'loc_prod_uae', name: "UAE", lat: 25.20, lng: 55.27, type: "production" },
  { id: 'loc_prod_turkey', name: "Turkey", lat: 41.01, lng: 28.98, type: "production" },
  { id: 'loc_prod_germany', name: "Germany", lat: 52.52, lng: 13.41, type: "production" },
  { id: 'loc_prod_ethiopia', name: "Ethiopia", lat: 9.03, lng: 38.75, type: "production" },
  { id: 'loc_prod_algeria', name: "Algeria", lat: 36.75, lng: 3.06, type: "production" },
  { id: 'loc_prod_zambia', name: "Zambia", lat: -15.39, lng: 28.32, type: "production" },

  // ── Operation Countries ──
  { id: 'loc_ops_morocco', name: "Morocco", lat: 33.57, lng: -7.59, type: "operation" },
  { id: 'loc_ops_kuwait', name: "Kuwait", lat: 29.38, lng: 47.98, type: "operation" },
  { id: 'loc_ops_qatar', name: "Qatar", lat: 25.29, lng: 51.53, type: "operation" },
  { id: 'loc_ops_bahrain', name: "Bahrain", lat: 26.07, lng: 50.56, type: "operation" },
  { id: 'loc_ops_iraq', name: "Iraq", lat: 33.32, lng: 44.37, type: "operation" },
  { id: 'loc_ops_jordan', name: "Jordan", lat: 31.95, lng: 35.93, type: "operation" },
  { id: 'loc_ops_kenya', name: "Kenya", lat: -1.29, lng: 36.82, type: "operation" },
  { id: 'loc_ops_nigeria', name: "Nigeria", lat: 6.52, lng: 3.38, type: "operation" },
  { id: 'loc_ops_sudan', name: "Sudan", lat: 15.50, lng: 32.56, type: "operation" },
  { id: 'loc_ops_pakistan', name: "Pakistan", lat: 24.86, lng: 67.00, type: "operation" },

  // ── Export Countries ──
  { id: 'loc_exp_uk', name: "UK", lat: 51.51, lng: -0.13, type: "export" },
  { id: 'loc_exp_spain', name: "Spain", lat: 40.42, lng: -3.70, type: "export" },
  { id: 'loc_exp_italy', name: "Italy", lat: 41.90, lng: 12.50, type: "export" },
  { id: 'loc_exp_greece', name: "Greece", lat: 37.98, lng: 23.73, type: "export" },
  { id: 'loc_exp_india', name: "India", lat: 19.08, lng: 72.88, type: "export" },
  { id: 'loc_exp_china', name: "China", lat: 39.90, lng: 116.41, type: "export" },
  { id: 'loc_exp_indonesia', name: "Indonesia", lat: -6.21, lng: 106.85, type: "export" },
  { id: 'loc_exp_australia', name: "Australia", lat: -33.87, lng: 151.21, type: "export" },
  { id: 'loc_exp_south_africa', name: "South Africa", lat: -26.20, lng: 28.05, type: "export" },
  { id: 'loc_exp_tanzania', name: "Tanzania", lat: -6.79, lng: 39.21, type: "export" },
  { id: 'loc_exp_libya', name: "Libya", lat: 32.90, lng: 13.18, type: "export" },
  { id: 'loc_exp_oman', name: "Oman", lat: 23.59, lng: 58.38, type: "export" },
  { id: 'loc_exp_ghana', name: "Ghana", lat: 5.60, lng: -0.19, type: "export" },
  { id: 'loc_exp_senegal', name: "Senegal", lat: 14.72, lng: -17.47, type: "export" },
  { id: 'loc_exp_cameroon', name: "Cameroon", lat: 3.85, lng: 11.50, type: "export" },
  { id: 'loc_exp_mozambique', name: "Mozambique", lat: -25.97, lng: 32.57, type: "export" },
  { id: 'loc_exp_uganda', name: "Uganda", lat: 0.35, lng: 32.58, type: "export" },
  { id: 'loc_exp_congo', name: "Congo", lat: -4.44, lng: 15.27, type: "export" },
  { id: 'loc_exp_yemen', name: "Yemen", lat: 15.37, lng: 44.19, type: "export" },
  { id: 'loc_exp_tunisia', name: "Tunisia", lat: 36.81, lng: 10.18, type: "export" },
  { id: 'loc_exp_usa', name: "USA", lat: 40.71, lng: -74.00, type: "export" },
  { id: 'loc_exp_brazil', name: "Brazil", lat: -23.55, lng: -46.63, type: "export" },
  { id: 'loc_exp_russia', name: "Russia", lat: 55.75, lng: 37.61, type: "export" },
  { id: 'loc_exp_japan', name: "Japan", lat: 35.67, lng: 139.65, type: "export" },
  { id: 'loc_exp_france', name: "France", lat: 48.85, lng: 2.35, type: "export" },
  { id: 'loc_exp_mexico', name: "Mexico", lat: 19.43, lng: -99.13, type: "export" },
  { id: 'loc_exp_south_korea', name: "South Korea", lat: 37.56, lng: 126.97, type: "export" },
];

/* ─── Get editable locations (falls back to defaults) ─── */
function getGlobeLocations() {
  try {
    const raw = localStorage.getItem('sedco_cms_globe');
    if (!raw) return DEFAULT_GLOBE_LOCATIONS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return DEFAULT_GLOBE_LOCATIONS;
  } catch (e) {
    return DEFAULT_GLOBE_LOCATIONS;
  }
}

/* ─── Save locations ─── */
function saveGlobeLocations(locations) {
  localStorage.setItem('sedco_cms_globe', JSON.stringify(locations));
}

/* Expose globally for both globe.js (ES module) and admin.js */
window.GLOBE_DATA = {
  defaults: DEFAULT_GLOBE_LOCATIONS,
  get: getGlobeLocations,
  save: saveGlobeLocations
};
