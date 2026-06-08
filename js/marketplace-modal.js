// Part 1: Supabase init, product fetching, scroll reveals, filters
(function(){
const SUPABASE_URL = "https://nnwcwqasmdpbvotfepvy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_llEtCRU2fkmNycPY4HwJ5w_XqnkQFQf";
window._supa = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
window.allProducts = [];
window._visibleCount = 8;
const ITEMS_PER_PAGE = 8;

window._renderProducts = function() {
    const productGrid = document.querySelector('.products-grid');
    if (!productGrid) return;
    productGrid.innerHTML = '';
    const productsToRender = window.allProducts.slice(0, window._visibleCount);
    if (productsToRender.length === 0) {
        productGrid.innerHTML = '<div style="grid-column:1/-1;padding:40px 0;text-align:center;color:#666;">No products found.</div>';
        return;
    }

    var cmsCardsById = {};
    var cmsCards = [];
    if (window.CMS_LOADED_DATA && Array.isArray(window.CMS_LOADED_DATA.cards)) {
        cmsCards = window.CMS_LOADED_DATA.cards;
    } else if (Array.isArray(window.CMS_CARDS)) {
        cmsCards = window.CMS_CARDS;
    }
    cmsCards.forEach(function(c) {
        if (c && c.id) cmsCardsById[c.id] = c;
    });

    productsToRender.forEach(function(p, i) {
        var delay = (i % 4) * 0.05;
        var cardId = p.id || p.product_id || p.slug || '';
        var cmsCard = cardId ? cmsCardsById[cardId] : null;
        var title = cmsCard ? cmsCard.title : p.title;
        var summary = cmsCard ? cmsCard.desc : (p.summary || '');
        var category = cmsCard ? cmsCard.tag : (p.category || 'Product');
        var image = cmsCard ? cmsCard.img : (p.image_url || './assets/product-placeholder.png');

        var safeTitle = title ? title.replace(/"/g, '&quot;') : '';
        var safeSummary = summary ? summary.replace(/"/g, '&quot;') : '';
        var card = document.createElement('div');
        card.className = 'product-card reveal';
        card.setAttribute('data-delay', delay);
        if (cardId) card.setAttribute('data-card-id', cardId);
        card.setAttribute('data-tag', category);
        card.setAttribute('data-title', safeTitle);
        card.setAttribute('data-spec', safeSummary);
        card.innerHTML = '<div class="card-image"><img src="' + image + '" alt="' + safeTitle + '"><div class="overlay"></div><span class="tag-badge">' + category + '</span></div><div class="card-content"><h3>' + title + '</h3><p class="spec">' + summary + '</p><span class="card-link">View Details <i data-lucide="arrow-right" style="width:12px;height:12px;"></i></span></div><div class="bottom-accent"></div>';
        productGrid.appendChild(card);
    });
    if (window.lucide) window.lucide.createIcons();
    if (window._visibleCount < window.allProducts.length) {
        var btnC = document.createElement('div');
        btnC.style.cssText = 'grid-column:1/-1;display:flex;justify-content:center;margin-top:32px;';
        btnC.innerHTML = '<button id="showMoreBtn" style="background:var(--brand-red);color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-weight:bold;">Show More Products</button>';
        productGrid.appendChild(btnC);
        document.getElementById('showMoreBtn').addEventListener('click', function() { window._visibleCount += ITEMS_PER_PAGE; window._renderProducts(); });
    }
    if (typeof window.applyCurrentFilters === 'function') window.applyCurrentFilters();
    if (typeof window.reObserveCards === 'function') window.reObserveCards();
};

document.addEventListener('DOMContentLoaded', async function() {
    var productGrid = document.querySelector('.products-grid');
    const isEditMode = document.body.classList.contains('edit-mode');
    
    // Bypass Supabase fetch in Edit Mode to prevent card manager destruction
    if (productGrid && window._supa && !isEditMode) {
        productGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:80px 0;"><span>Loading Products Portfolio...</span></div>';
        var result = await window._supa.from('products').select('*');
        if (result.error) {
            productGrid.innerHTML = '<div style="grid-column:1/-1;padding:40px 0;text-align:center;color:#e74c3c;">Failed to load products.</div>';
        } else if (result.data && result.data.length > 0) {
            window.allProducts = result.data;
            window._renderProducts();
        } else {
            productGrid.innerHTML = '<div style="grid-column:1/-1;padding:40px 0;text-align:center;color:#666;">No products found.</div>';
        }
    }

    // Scroll Reveal
    var revealObs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var d = entry.target.dataset.delay ? parseFloat(entry.target.dataset.delay) * 1000 : 0;
                setTimeout(function() { entry.target.classList.add('visible'); entry.target.style.opacity='1'; entry.target.style.transform='translateY(0)'; }, d);
                revealObs.unobserve(entry.target);
            }
        });
    }, {threshold:0.12});

    var badgeObs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var badge = entry.target.querySelector('.tag-badge');
                if (badge) badge.style.animationPlayState = 'running';
                badgeObs.unobserve(entry.target);
            }
        });
    }, {threshold:0.2});

    document.querySelectorAll('.scroll-reveal,.scroll-reveal-fade,.scroll-reveal-up,.product-card').forEach(function(el){ revealObs.observe(el); });

    window.applyCurrentFilters = function() {
        var activeBtn = document.querySelector('.tag-btn.active');
        var filter = activeBtn ? activeBtn.getAttribute('data-tag') : 'All';
        var searchInput = document.getElementById('product-search');
        var query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        document.querySelectorAll('.product-card').forEach(function(card) {
            var cat = card.getAttribute('data-tag') || '';
            var title = (card.getAttribute('data-title') || '').toLowerCase();
            var text = (card.getAttribute('data-spec') || '').toLowerCase();
            card.style.display = ((filter === 'All' || cat === filter) && (title.includes(query) || text.includes(query))) ? 'flex' : 'none';
        });
    };

    window.reObserveCards = function() {
        document.querySelectorAll('.product-card').forEach(function(card) {
            revealObs.observe(card);
            var badge = card.querySelector('.tag-badge');
            if (badge) badge.style.animationPlayState = 'paused';
            badgeObs.observe(card);
        });
    };

    document.querySelectorAll('.tag-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tag-btn').forEach(function(b){ b.classList.remove('active'); });
            btn.classList.add('active');
            if (window.applyCurrentFilters) window.applyCurrentFilters();
        });
    });

    var searchInput = document.getElementById('product-search');
    if (searchInput) searchInput.addEventListener('input', function() { if (window.applyCurrentFilters) window.applyCurrentFilters(); });
    if (window.reObserveCards) window.reObserveCards();
});
})();

// Part 2: Specs data, modal UI, reviews, tabs, cart integration
(function(){
var specsData = {
    'Wellhead Assembly': { category:'Petroleum', summary:'API 6A certified wellhead assembly, pressure ratings up to 15,000 PSI.', price:'USD 15,000 - 25,000', details:{'Certification':'API 6A','Pressure Rating':'Up to 15,000 PSI','Material':'Forged Steel','Service':'H2S & Standard'}, images:['assets/images/product-explosion-proof.png'] },
    'Power Transformer': { category:'Electrical', summary:'High-efficiency distribution power transformers, 10-100 MVA range.', price:'USD 45,000 - 85,000', details:{'Capacity':'10 - 100 MVA','Cooling':'ONAN / ONAF','Standard':'IEC 60076','Voltage':'Up to 220kV'}, images:['assets/images/product-cable-tray.png'] },
    'SCADA Controller': { category:'Instrumentation', summary:'Industrial-grade SCADA controller units with remote monitoring capability.', price:'USD 2,500 - 4,800', details:{'Processor':'Dual Core 1.2GHz','Protocols':'Modbus / DNP3 / OPC UA','I/O Capacity':'Up to 1024 points','Operating Temp':'-40C to 70C'}, images:['assets/images/product-junction-box.png'] },
    'Fire & Gas Detection System': { category:'Safety', summary:'SIL-2 rated detection systems for hazardous environments.', price:'USD 5,000 - 9,500', details:{'Safety Rating':'SIL-2 / IEC 61508','Gases Detected':'Methane, H2S, CO2','Response Time':'< 5 seconds','Enclosure':'NEMA 4X / IP66'}, images:['assets/images/product-lightning.png'] },
    'Downhole Tools': { category:'Petroleum', summary:'Premium drilling and completion downhole tools for demanding conditions.', price:'USD 8,000 - 12,000', details:{'Application':'Drilling / Completion','Max Temp':'200C','Max Pressure':'20,000 PSI','Material':'Superalloy'}, images:['assets/images/product-cable-joints.png'] },
    'Switchgear Panel': { category:'Electrical', summary:'Medium voltage switchgear panels, IEC 62271 compliant.', price:'USD 12,000 - 18,500', details:{'Standard':'IEC 62271-200','Rated Voltage':'12kV / 24kV','Rated Current':'630A - 2500A','Short Circuit':'Up to 31.5kA'}, images:['assets/images/product-earthing.png'] },
    'Pressure Transmitter': { category:'Instrumentation', summary:'High-accuracy pressure transmitters for process control.', price:'USD 450 - 850', details:{'Accuracy':'0.075% of span','Output':'4-20mA / HART','Pressure Range':'0 - 600 bar','Diaphragm':'Hastelloy C / 316L SS'}, images:['assets/images/product-cable-glands.png'] },
    'PPE Equipment Kit': { category:'Safety', summary:'Complete personal protective equipment sets, OSHA compliant.', price:'USD 120 - 250', details:{'Standards':'OSHA / ANSI','Components':'Helmet, Goggles, Gloves, Boots','Material':'Flame-retardant / Kevlar','Sizes':'S / M / L / XL'}, images:['assets/images/solution-compliance.png'] }
};
var defaultSpecs = { category:'Industrial Product', stars:4.5, reviews:14, summary:'Premium-grade industrial component for demanding applications.', price:'USD 45 - 120', buy:'MOQ 20 pcs · Standard delivery', details:{'Quality':'Premium-grade','Support':'Standard service','Delivery':'5-10 business days','Warranty':'1 year'}, pros:['Robust build','Trusted quality'], cons:['May require specialist fitting','Higher cost than standard'], images:['./assets/product-placeholder.png'] };

var modal = document.createElement('div');
modal.className = 'market-specs-modal';
modal.innerHTML = '<div class="market-specs-backdrop"></div><div class="market-specs-panel border-glow"><button type="button" class="market-specs-close" aria-label="Close"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button><div class="market-specs-layout"><div class="market-specs-gallery"><div class="market-specs-main-img-wrapper"><img class="market-specs-main-img" src="" alt="Product" loading="lazy"></div><div class="market-specs-thumbnails"></div></div><div class="market-specs-content-wrapper"><div class="market-specs-header"><div class="market-specs-badges"><span class="market-specs-chip"></span></div><h2 class="market-specs-title"></h2></div><div class="market-specs-tabs-container"><div class="market-specs-tabs"><button type="button" class="market-specs-tab active" data-target="tab-overview">Overview</button><button type="button" class="market-specs-tab" data-target="tab-specs">Technical Specs</button></div><div class="market-specs-tab-content active" id="tab-overview"><p class="market-specs-copy"></p></div><div class="market-specs-tab-content" id="tab-specs"><div id="market-specs-variants-container" style="display:none;margin-bottom:1.5rem;"><h4 style="margin-bottom:0.75rem;font-weight:700;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--brand-gray-medium);">Select Variant</h4><div class="market-specs-variants flex gap-3 flex-wrap"></div></div><div class="market-specs-grid"></div></div></div><div class="market-specs-footer"><div class="market-specs-price-box"><span class="market-specs-price-label">Price Range</span><div class="market-specs-price"></div></div></div></div></div></div>';
document.body.appendChild(modal);

var activeProductSpecs = defaultSpecs;
var activeProductTitle = 'Product';
var activeCardId = null;

var tabs = modal.querySelectorAll('.market-specs-tab');
var tabContents = modal.querySelectorAll('.market-specs-tab-content');

function saveModalToCard() {
    if (!activeCardId || !window.CMS_CARDS) return;
    var card = window.CMS_CARDS.find(function(c) { return c.id === activeCardId; });
    if (!card) return;

    var newTitle = modal.querySelector('.market-specs-title').textContent.trim();
    var newTag = modal.querySelector('.market-specs-chip').textContent.trim();
    var newSummary = modal.querySelector('.market-specs-copy').textContent.trim();
    var newPrice = modal.querySelector('.market-specs-price').textContent.trim();

    // Rebuild specs details
    var newDetails = {};
    modal.querySelectorAll('.market-specs-cell').forEach(function(cell) {
        var keyEl = cell.querySelector('.spec-key') || cell.querySelector('strong');
        var valEl = cell.querySelector('.spec-val') || cell.querySelector('span');
        if (keyEl && valEl) {
            var k = keyEl.textContent.trim();
            var v = valEl.textContent.trim();
            if (k) newDetails[k] = v;
        }
    });

    // Update editor card state
    card.title = newTitle;
    card.tag = newTag;
    card.desc = newSummary;
    if (!card.specs) card.specs = {};
    card.specs.category = newTag;
    card.specs.summary = newSummary;
    card.specs.price = newPrice;
    card.specs.details = newDetails;

    // Refresh view and mark dirty
    if (typeof window.CMS_RENDER_CARDS === 'function') {
        window.CMS_RENDER_CARDS();
    }
    if (typeof window.CMS_MARK_DIRTY === 'function') {
        window.CMS_MARK_DIRTY();
    }
}

function openModal(productTitle, cardId) {
    activeCardId = null;
    var productSpecs = Object.assign({}, defaultSpecs);
    
    // 1. Resolve custom CMS configuration (either in editor mode or loader mode)
    var cmsCard = null;
    var cmsCards = [];
    if (Array.isArray(window.CMS_CARDS)) {
        cmsCards = window.CMS_CARDS;
    } else if (window.CMS_LOADED_DATA && Array.isArray(window.CMS_LOADED_DATA.cards)) {
        cmsCards = window.CMS_LOADED_DATA.cards;
    }
    if (cardId) cmsCard = cmsCards.find(function(c) { return c && c.id === cardId; }) || null;
    if (!cmsCard) cmsCard = cmsCards.find(function(c) { return c && c.title === productTitle; }) || null;

    if (cmsCard) {
        activeCardId = cmsCard.id;
        if (cmsCard.specs) {
            productSpecs = Object.assign({}, defaultSpecs, cmsCard.specs);
        } else {
            // Load preset specs mapping if available
            var preset = specsData[cmsCard.title] || specsData[productTitle];
            if (preset) {
                productSpecs = Object.assign({}, defaultSpecs, preset);
            }
        }
        if (cmsCard.img) {
            productSpecs.images = [cmsCard.img];
        }
    } else if (specsData[productTitle]) {
        productSpecs = Object.assign({}, specsData[productTitle]);
    }

    // 2. Fall back to database specifications if not matched in visual editor cards
    if (!cmsCard && window.allProducts) {
        var dbProduct = window.allProducts.find(function(p){ return p.title === productTitle; });
        if (dbProduct) {
            var safeParse = function(val, fb) { if (!val) return fb; if (typeof val === 'string') { try { return JSON.parse(val); } catch(e) { return fb; } } return val; };
            productSpecs.category = dbProduct.category || productSpecs.category;
            productSpecs.summary = dbProduct.summary || productSpecs.summary;
            productSpecs.price = dbProduct.price_range || dbProduct.price || productSpecs.price;
            productSpecs.buy = dbProduct.min_order || dbProduct.buy_info || productSpecs.buy;
            var dbSpecs = dbProduct.specs || dbProduct.details;
            var parsedSpecs = safeParse(dbSpecs, null);
            if (parsedSpecs && typeof parsedSpecs === 'object' && Object.keys(parsedSpecs).length > 0) {
                productSpecs.details = parsedSpecs;
            } else if (dbSpecs && typeof dbSpecs === 'string' && dbSpecs.trim().length > 0) {
                var parsed = {};
                dbSpecs.split('\n').forEach(function(line) {
                    var idx = line.indexOf(':');
                    if (idx > -1) {
                        var k = line.substring(0, idx).trim();
                        var v = line.substring(idx + 1).trim();
                        if (k && v) parsed[k] = v;
                    }
                });
                if (Object.keys(parsed).length > 0) {
                    productSpecs.details = parsed;
                } else {
                    productSpecs.details = { 'Specifications': dbSpecs };
                }
            } else if (dbProduct.specs || dbProduct.details) {
                productSpecs.details = {};
            }
            productSpecs.variants = safeParse(dbProduct.variants, productSpecs.variants || []);
            productSpecs.id = dbProduct.id;
            var dbImages = safeParse(dbProduct.images, null);
            if (dbImages && Array.isArray(dbImages) && dbImages.length > 0) productSpecs.images = dbImages;
            else if (dbProduct.image_url) productSpecs.images = [dbProduct.image_url];
        }
    }

    const isEditMode = document.body.classList.contains('edit-mode');
    
    // Set editable text values and contenteditable states
    const titleEl = modal.querySelector('.market-specs-title');
    titleEl.textContent = productTitle;
    titleEl.contentEditable = isEditMode ? "true" : "false";
    if (isEditMode) {
        titleEl.style.border = '1px dashed rgba(255,255,255,0.3)';
        titleEl.style.padding = '4px';
        titleEl.style.borderRadius = '4px';
    } else {
        titleEl.style.border = '';
        titleEl.style.padding = '';
    }

    const chipEl = modal.querySelector('.market-specs-chip');
    chipEl.textContent = productSpecs.category;
    chipEl.contentEditable = isEditMode ? "true" : "false";
    if (isEditMode) {
        chipEl.style.border = '1px dashed rgba(255,255,255,0.3)';
        chipEl.style.padding = '2px 6px';
        chipEl.style.borderRadius = '4px';
        chipEl.style.display = 'inline-block';
    } else {
        chipEl.style.border = '';
        chipEl.style.padding = '';
        chipEl.style.display = '';
    }

    const copyEl = modal.querySelector('.market-specs-copy');
    copyEl.textContent = productSpecs.summary;
    copyEl.contentEditable = isEditMode ? "true" : "false";
    if (isEditMode) {
        copyEl.style.border = '1px dashed rgba(255,255,255,0.3)';
        copyEl.style.padding = '6px';
        copyEl.style.borderRadius = '4px';
    } else {
        copyEl.style.border = '';
        copyEl.style.padding = '';
    }

    const priceEl = modal.querySelector('.market-specs-price');
    priceEl.textContent = productSpecs.price;
    priceEl.contentEditable = isEditMode ? "true" : "false";
    if (isEditMode) {
        priceEl.style.border = '1px dashed rgba(255,255,255,0.3)';
        priceEl.style.padding = '4px 8px';
        priceEl.style.borderRadius = '4px';
        priceEl.style.display = 'inline-block';
    } else {
        priceEl.style.border = '';
        priceEl.style.padding = '';
        priceEl.style.display = '';
    }

    // Render Specs Grid Details
    var grid = modal.querySelector('.market-specs-grid'); 
    grid.innerHTML = '';
    Object.entries(productSpecs.details || {}).forEach(function(entry) {
        var cell = document.createElement('div'); 
        cell.className = 'market-specs-cell';
        if (isEditMode) {
            cell.style.position = 'relative';
            cell.style.paddingRight = '32px';
            cell.innerHTML = '<strong contenteditable="true" class="spec-key" style="border:1px dashed rgba(255,255,255,0.15);padding:1px 3px;border-radius:2px;display:inline-block;min-width:40px;">' + entry[0] + '</strong><span contenteditable="true" class="spec-val" style="border:1px dashed rgba(255,255,255,0.15);padding:1px 3px;border-radius:2px;display:inline-block;min-width:60px;">' + entry[1] + '</span><button class="spec-delete-btn" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(220,38,38,0.9);color:white;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Delete row">✕</button>';
            cell.querySelector('.spec-delete-btn').onclick = function(e) {
                e.stopPropagation();
                cell.remove();
                saveModalToCard();
            };
        } else {
            cell.innerHTML = '<strong>' + entry[0] + '</strong><span>' + entry[1] + '</span>';
        }
        grid.appendChild(cell);
    });

    // Add row button in edit mode
    var specsTabContent = modal.querySelector('#tab-specs');
    var oldAddBtn = specsTabContent.querySelector('.add-spec-row-btn');
    if (oldAddBtn) oldAddBtn.remove();

    if (isEditMode) {
        var addBtn = document.createElement('button');
        addBtn.className = 'add-spec-row-btn';
        addBtn.style.cssText = 'margin-top:16px;background:#34495e;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:12px;display:inline-block;';
        addBtn.textContent = '＋ Add Spec Row';
        addBtn.onclick = function() {
            var cell = document.createElement('div');
            cell.className = 'market-specs-cell';
            cell.style.position = 'relative';
            cell.style.paddingRight = '32px';
            cell.innerHTML = '<strong contenteditable="true" class="spec-key" style="border:1px dashed rgba(255,255,255,0.15);padding:1px 3px;border-radius:2px;display:inline-block;min-width:40px;">Key</strong><span contenteditable="true" class="spec-val" style="border:1px dashed rgba(255,255,255,0.15);padding:1px 3px;border-radius:2px;display:inline-block;min-width:60px;">Value</span><button class="spec-delete-btn" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(220,38,38,0.9);color:white;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>';
            cell.querySelector('.spec-delete-btn').onclick = function(e) {
                e.stopPropagation();
                cell.remove();
                saveModalToCard();
            };
            
            cell.querySelectorAll('[contenteditable]').forEach(function(el) {
                el.addEventListener('input', saveModalToCard);
                el.addEventListener('blur', saveModalToCard);
            });
            
            grid.appendChild(cell);
            saveModalToCard();
        };
        specsTabContent.appendChild(addBtn);
    }

    // Attach listener for editable events
    if (isEditMode) {
        const fields = [titleEl, chipEl, copyEl, priceEl];
        fields.forEach(function(el) {
            if (el.dataset.modalBound !== '1') {
                el.dataset.modalBound = '1';
                el.addEventListener('input', saveModalToCard);
                el.addEventListener('blur', saveModalToCard);
            }
        });

        grid.querySelectorAll('[contenteditable]').forEach(function(el) {
            if (el.dataset.modalBound !== '1') {
                el.dataset.modalBound = '1';
                el.addEventListener('input', saveModalToCard);
                el.addEventListener('blur', saveModalToCard);
            }
        });
    }

    // Render product image gallery
    var mainImg = modal.querySelector('.market-specs-main-img');
    var thumbsC = modal.querySelector('.market-specs-thumbnails'); thumbsC.innerHTML = '';
    if (productSpecs.images && productSpecs.images.length > 0) {
        mainImg.src = productSpecs.images[0]; mainImg.alt = productTitle;
        productSpecs.images.forEach(function(src, index) {
            var thumb = document.createElement('img');
            thumb.className = 'market-specs-thumb w-20 h-20 object-cover rounded-xl border-2 border-transparent cursor-pointer opacity-70 transition-all hover:opacity-100 hover:scale-105';
            if (index === 0) { thumb.classList.add('active'); thumb.style.borderColor = '#c0392b'; thumb.style.opacity = '1'; }
            thumb.src = src; thumb.alt = 'Thumbnail ' + (index + 1);
            thumb.addEventListener('click', function() {
                mainImg.style.opacity = 0; setTimeout(function(){ mainImg.src = src; mainImg.style.opacity = 1; }, 200);
                modal.querySelectorAll('.market-specs-thumbnails img').forEach(function(img){ img.classList.remove('active'); img.style.borderColor = 'transparent'; img.style.opacity = '0.7'; });
                thumb.classList.add('active'); thumb.style.borderColor = '#c0392b'; thumb.style.opacity = '1';
            });
            thumbsC.appendChild(thumb);
        });
    }

    // Variants
    var variantsC = modal.querySelector('#market-specs-variants-container');
    var variantsL = modal.querySelector('.market-specs-variants'); variantsL.innerHTML = '';
    if (productSpecs.variants && productSpecs.variants.length > 0) {
        variantsC.style.display = 'block';
        productSpecs.variants.forEach(function(v, i) {
            var btn = document.createElement('button'); btn.type = 'button';
            btn.className = 'px-4 py-2 text-sm font-semibold rounded-lg border-2 transition-all ' + (i === 0 ? 'border-[#E32636] text-[#E32636] bg-[#E32636]/5' : 'border-gray-200 text-[#1a1a1a] hover:border-[#E32636]/50 hover:bg-gray-50');
            btn.textContent = v.name || v;
            btn.onclick = function() {
                variantsL.querySelectorAll('button').forEach(function(b){ b.className = 'px-4 py-2 text-sm font-semibold rounded-lg border-2 border-gray-200 text-[#1a1a1a] transition-all hover:border-[#E32636]/50 hover:bg-gray-50'; });
                btn.className = 'px-4 py-2 text-sm font-semibold rounded-lg border-2 border-[#E32636] text-[#E32636] bg-[#E32636]/5 transition-all';
                if (v.price) modal.querySelector('.market-specs-price').textContent = v.price;
            };
            variantsL.appendChild(btn);
        });
    } else { variantsC.style.display = 'none'; }

    activeProductSpecs = productSpecs;
    activeProductTitle = productTitle;

    tabs.forEach(function(t){ t.classList.remove('active'); });
    tabContents.forEach(function(c){ c.classList.remove('active'); c.style.display = 'none'; });
    tabs[0].classList.add('active'); tabContents[0].classList.add('active'); tabContents[0].style.display = 'block'; tabContents[0].style.opacity = 1;
    modal.querySelector('.market-specs-footer').style.display = '';

    tabs.forEach(function(tab) {
        tab.onclick = function() {
            tabs.forEach(function(t){ t.classList.remove('active'); });
            tabContents.forEach(function(c){ c.classList.remove('active'); c.style.display = 'none'; c.style.opacity = 0; });
            tab.classList.add('active');
            var target = modal.querySelector('#' + tab.dataset.target);
            target.classList.add('active'); target.style.display = 'block';
            setTimeout(function(){ target.style.opacity = 1; }, 10);
        };
    });

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    modal.classList.add('open');
}

function closeModal() { modal.classList.remove('open'); document.body.style.overflow = ''; document.body.style.touchAction = ''; }
modal.querySelector('.market-specs-close').addEventListener('click', closeModal);
modal.addEventListener('click', function(event) { if (event.target === modal || event.target.classList.contains('market-specs-backdrop')) closeModal(); });
document.addEventListener('keydown', function(event) { if (event.key === 'Escape' && modal.classList.contains('open')) closeModal(); });

document.body.addEventListener('click', function(event) {
    var card = event.target.closest('.product-card');
    if (card) {
        // Restrict card clicking in Visual Editor mode to the View Details link only
        var isEditMode = document.body.classList.contains('edit-mode');
        if (isEditMode) {
            var cardLink = event.target.closest('.card-link');
            if (!cardLink) return;
        }
        event.preventDefault();
        var title = card.getAttribute('data-title') || (card.querySelector('h3') ? card.querySelector('h3').textContent.trim() : 'Product');
        openModal(title, card.getAttribute('data-card-id') || '');
    }
});
})();
