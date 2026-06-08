document.addEventListener('DOMContentLoaded', async function() {
  const SUPABASE_URL = "https://nnwcwqasmdpbvotfepvy.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_llEtCRU2fkmNycPY4HwJ5w_XqnkQFQf";
  const EMAILJS_SERVICE_ID = "service_9nqipee";
  const EMAILJS_TEMPLATE_ID = "template_k6f69oi";
  const EMAILJS_PUBLIC_KEY = "yoAeDj-u6EPuFZyRj";
  const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  const authWrapper = document.getElementById('authWrapper');

  if (!supabase) {
    console.error("Supabase client not initialized.");
    if (authWrapper) {
      authWrapper.innerHTML = `
        <div style="text-align:center;">
          <h3 style="font-size:24px;margin-bottom:8px;color:#E32636;">Connection Error</h3>
          <p style="color:var(--brand-gray-medium);">Failed to connect to the database. Please check your internet connection and refresh the page.</p>
        </div>
      `;
    }
    return;
  }

  const state = {
    user: null,
    role: null, // 'admin', 'store_manager', 'order_manager', 'message_manager'
    currentView: 'dashboard'
  };

  const UI = {
    authWrapper: document.getElementById('authWrapper'),
    app: document.getElementById('adminApp'),
    nav: document.getElementById('sidebarNav'),
    content: document.getElementById('contentArea'),
    pageTitle: document.getElementById('pageTitle'),
    currentUserEmail: document.getElementById('currentUserEmail'),
    currentUserRole: document.getElementById('currentUserRole'),
    logoutBtn: document.getElementById('logoutBtn'),
    modals: document.getElementById('modalsContainer')
  };

  async function logAction(action, entityType, entityId, description, metadata = {}) {
    if (!state.user) return;
    try {
      await supabase.from('admin_logs').insert([{
        user_id: state.user.id,
        user_email: state.user.email,
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        description,
        metadata
      }]);
    } catch (e) { console.warn('Log failed:', e); }
  }

  function fmtDate(d) {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) + ' ' + dt.toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'});
  }

  function openMailClient(to, subject, body) {
    const mailto = 'mailto:' + encodeURIComponent(to) +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
    window.location.href = mailto;
  }

  function describeEmailError(err) {
    const message = err && err.message ? err.message : String(err || 'Unknown error');
    if (/failed to send a request/i.test(message)) {
      return message + '\n\nThis usually means the Supabase Edge Function "send-email" is not deployed, is blocked by CORS/network, or the Supabase project cannot be reached from this browser.';
    }
    return message;
  }

  function formatRole(role) {
    if (!role) return 'N/A';
    return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  function showLoginForm() {
    UI.authWrapper.innerHTML = `
      <div class="admin-login-card">
        <div class="admin-login-logo">
          <span style="font-family:'Outfit',sans-serif;font-weight:800;color:var(--brand-dark);font-size:24px;letter-spacing:-0.02em;line-height:1;">Elsewedy <span style="color:#E32636;">SEDCO</span></span>
          <svg width="150" height="10" viewBox="0 0 185 20" style="margin-top:2px;">
            <path d="M0,5 Q92.5,25 185,5" fill="none" stroke="#E32636" stroke-width="6" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="admin-login-title">Admin Portal</div>
        <div class="admin-login-subtitle">Sign in to manage products, pages, orders, and inquiries.</div>
        
        <div id="loginError" class="admin-login-error" style="display:none;"></div>
        
        <form id="adminLoginForm">
          <div class="admin-login-group">
            <label for="loginEmail">Email Address</label>
            <input type="email" id="loginEmail" placeholder="admin@domain.com" required>
          </div>
          <div class="admin-login-group">
            <label for="loginPassword">Password</label>
            <input type="password" id="loginPassword" placeholder="••••••••" required>
          </div>
          
          <div id="admin-turnstile-container" style="display: flex; justify-content: center; margin: 15px 0;"></div>
          
          <button type="submit" id="loginSubmitBtn" class="admin-login-btn">Sign In</button>
        </form>
      </div>
    `;
    
    let captchaToken = '';
    let retries = 0;
    
    function renderCaptcha() {
      const errDiv = document.getElementById('loginError');
      if (typeof turnstile !== 'undefined' && typeof turnstile.render === 'function') {
        try {
          turnstile.render('#admin-turnstile-container', {
            sitekey: '0x4AAAAAADChdcuQwHP5S8Ia',
            theme: 'light',
            callback: function(token) {
              captchaToken = token;
              if (errDiv && errDiv.textContent.includes('CAPTCHA')) {
                errDiv.style.display = 'none';
              }
            }
          });
        } catch(e) {
          console.error("Turnstile render error:", e);
          if (errDiv) {
            errDiv.textContent = 'Error rendering CAPTCHA. Please refresh the page.';
            errDiv.style.display = 'block';
          }
        }
      } else {
        retries++;
        if (retries > 30) { // 3 seconds
          if (errDiv) {
            errDiv.textContent = 'Cloudflare Turnstile CAPTCHA failed to load. Please check your internet connection or disable ad blockers, then refresh.';
            errDiv.style.display = 'block';
          }
        } else {
          setTimeout(renderCaptcha, 100);
        }
      }
    }
    
    renderCaptcha();
    
    document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const errDiv = document.getElementById('loginError');
      
      if (!captchaToken && typeof turnstile !== 'undefined') {
        errDiv.textContent = 'Please complete the Captcha.';
        errDiv.style.display = 'block';
        return;
      }
      
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const btn = document.getElementById('loginSubmitBtn');
      
      btn.disabled = true;
      btn.textContent = 'Signing in...';
      errDiv.style.display = 'none';
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          captchaToken: captchaToken
        }
      });
      
      if (error) {
        errDiv.textContent = error.message;
        errDiv.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Sign In';
        if (typeof turnstile !== 'undefined') turnstile.reset();
        captchaToken = '';
      } else {
        init();
      }
    });
  }

  function showUnauthorizedState(email) {
    UI.authWrapper.innerHTML = `
      <div class="admin-login-card" style="text-align: center;">
        <div class="admin-login-logo">
          <span style="font-family:'Outfit',sans-serif;font-weight:800;color:var(--brand-dark);font-size:24px;letter-spacing:-0.02em;line-height:1;">Elsewedy <span style="color:#E32636;">SEDCO</span></span>
          <svg width="150" height="10" viewBox="0 0 185 20" style="margin-top:2px;">
            <path d="M0,5 Q92.5,25 185,5" fill="none" stroke="#E32636" stroke-width="6" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="admin-login-title" style="color:#E32636; margin-top: 1rem;">Access Denied</div>
        <div class="admin-login-subtitle" style="margin-bottom: 1.5rem;">
          The account <strong>${email}</strong> is not authorized to access the Admin Portal.
        </div>
        <button id="unauthLogoutBtn" class="admin-login-btn">Sign Out & Try Another</button>
      </div>
    `;
    document.getElementById('unauthLogoutBtn').addEventListener('click', async () => {
      await supabase.auth.signOut();
      init();
    });
  }

  async function init() {
    UI.authWrapper.style.display = 'flex';
    UI.authWrapper.innerHTML = `
      <div class="loader-spinner"></div>
      <p>Verifying access...</p>
    `;
    UI.app.style.display = 'none';

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        showLoginForm();
        return;
      }

      state.user = session.user;

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', state.user.id)
        .single();

      if (roleError || !roleData || !roleData.role) {
        showUnauthorizedState(state.user.email);
        return;
      }

      state.role = roleData.role;

      // Initialize UI values
      UI.currentUserEmail.textContent = state.user.email;
      UI.currentUserRole.textContent = formatRole(state.role);

      // Hide auth overlay and show admin app
      UI.authWrapper.style.display = 'none';
      UI.app.style.display = 'flex';

      // Setup navigation and pre-load all page configs from server to localStorage
      setupNavigation();
      CMS_KEYS.forEach(key => {
        const pageKey = key.replace('sedco_cms_', '');
        fetch(`http://localhost:3000/api/load-visual?page=${pageKey}`)
          .then(res => {
            if (res.ok) return res.json();
          })
          .then(data => {
            if (data && data._editor) {
              localStorage.setItem(key, JSON.stringify(data));
            }
          })
          .catch(err => console.warn(`Could not preload ${pageKey} data`, err));
      });
      loadView(state.currentView);

      // Log successful login session
      await logAction('login', 'session', null, `Admin logged in: ${state.user.email}`);

    } catch (err) {
      console.error("Init failed:", err);
      showLoginForm();
    }
  }

  // 2. Navigation Setup based on Role
  const navItems = {
    admin: [
      { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
      { id: 'page-editor', label: 'Page Editor', icon: 'edit-3' },
      { id: 'globe', label: 'Globe Manager', icon: 'globe' },
      { id: 'history', label: 'Save History', icon: 'history' },
      { id: 'users', label: 'Users & Roles', icon: 'users' },
      { id: 'logs', label: 'System Logs', icon: 'file-text' }
    ],
    store_manager: [
      { id: 'products', label: 'Products', icon: 'shopping-bag' }
    ],
    message_manager: [
      { id: 'messages', label: 'Messages', icon: 'mail' }
    ]
  };

  function setupNavigation() {
    let items = [];
    if (state.role === 'admin') {
      // Admin gets everything
      items = [
        ...navItems.admin,
        ...navItems.store_manager,
        ...navItems.message_manager
      ];
    } else {
      items = navItems[state.role] || [];
      if (items.length > 0) {
        state.currentView = items[0].id;
      } else {
        UI.content.innerHTML = `<div class="metric-card"><p>No permissions assigned to your role.</p></div>`;
        return;
      }
    }

    UI.nav.innerHTML = items.map(item => `
      <button class="nav-item ${item.id === state.currentView ? 'active' : ''}" data-view="${item.id}">
        <i data-lucide="${item.icon}"></i> ${item.label}
      </button>
    `).join('');
    
    if (window.lucide) window.lucide.createIcons();

    UI.nav.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.getAttribute('data-view');
        UI.nav.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        loadView(view);
      });
    });
  }

  // 3. View Routing
  async function loadView(viewId) {
    state.currentView = viewId;
    UI.content.innerHTML = '<div class="loader-spinner" style="margin: 40px auto;"></div>';
    
    const views = {
      dashboard: renderDashboard,
      'page-editor': renderPageEditor,
      globe: renderGlobeManager,
      history: renderHistory,
      users: renderUsers,
      logs: renderLogs,
      products: renderProducts,
      orders: renderOrders,
      messages: renderMessages
    };

    if (views[viewId]) {
      const { title, html, afterRender } = await views[viewId]();
      UI.pageTitle.textContent = title;
      UI.content.innerHTML = html;
      if (window.lucide) window.lucide.createIcons();
      if (afterRender) afterRender();
    }
  }

  // --- Dynamic Modal Helper ---
  function openModal(title, bodyHtml, options = {}) {
    // Remove any existing dynamic modal
    const existing = document.getElementById('dynamicModal');
    if (existing) existing.remove();

    const contentClass = options.contentClass ? ` ${options.contentClass}` : '';
    const bodyClass = options.bodyClass ? ` ${options.bodyClass}` : '';

    const overlay = document.createElement('div');
    overlay.id = 'dynamicModal';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-content${contentClass}">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="close-modal" onclick="document.getElementById('dynamicModal').remove()">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body${bodyClass}">
          ${bodyHtml}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    // Animate in
    requestAnimationFrame(() => overlay.classList.add('active'));
    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    if (window.lucide) window.lucide.createIcons();
  }

  // --- VIEWS ---

  // Dashboard View (Admin)
  async function renderDashboard() {
    const today = new Date();
    today.setHours(0,0,0,0);
    const todayStr = today.toISOString();

    const [prodRes, msgsRes, repliedRes, recentMsgsRes] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('contacts').select('*', { count: 'exact', head: true }).gte('created_at', todayStr),
      supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('replied', true),
      supabase.from('contacts').select('*').order('created_at', { ascending: false }).limit(5)
    ]);

    const metrics = {
      products: prodRes.count || 0,
      messagesToday: msgsRes.count || 0,
      replied: repliedRes.count || 0
    };

    const recentMsgs = recentMsgsRes.data || [];

    const html = `
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-card-header">
            Total Products <div class="metric-card-icon"><i data-lucide="package"></i></div>
          </div>
          <div class="metric-card-value">${metrics.products}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card-header">
            Messages Today <div class="metric-card-icon"><i data-lucide="mail"></i></div>
          </div>
          <div class="metric-card-value">${metrics.messagesToday}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card-header">
            Messages Replied <div class="metric-card-icon"><i data-lucide="check-circle"></i></div>
          </div>
          <div class="metric-card-value">${metrics.replied}</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr; gap: 1.5rem; margin-bottom: 2rem;">

        <div class="data-table-container" style="margin-bottom:0;">
          <div class="data-table-header" style="padding:1rem 1.5rem;">
            <h3 style="font-size:16px;">Recent Inquiries</h3>
          </div>
          <table class="data-table">
            <thead><tr><th>Sender</th><th>Status</th></tr></thead>
            <tbody>
              ${recentMsgs.length === 0 ? '<tr><td colspan="2" style="text-align:center;font-size:13px;">No recent inquiries</td></tr>' : ''}
              ${recentMsgs.map(m => `
                <tr>
                  <td style="font-size:13px;font-weight:500;">${m.name}<br><span style="color:var(--admin-text-muted);font-weight:400;">${new Date(m.created_at).toLocaleDateString()}</span></td>
                  <td><span class="status-badge ${m.replied ? 'status-confirmed' : 'status-pending'}">${m.replied ? 'Replied' : 'Pending'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

      </div>

      
    `;

    return {
      title: 'Admin Dashboard',
      html,
      afterRender: () => {
        const ctx = document.getElementById('purchasingChart').getContext('2d');
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{
              label: 'Sales ($)',
              data: [12000, 19000, 15000, 22000],
              borderColor: '#8B1A1A',
              backgroundColor: 'rgba(139, 26, 26, 0.1)',
              borderWidth: 3,
              tension: 0.4,
              fill: true
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, grid: { color: '#E5E7EB' } },
              x: { grid: { display: false } }
            }
          }
        });
      }
    };
  }

  // Logs View (Admin) — Full Implementation
  let logsPage = 0;
  const LOGS_PER_PAGE = 20;
  let logsSearchQ = '';
  let logsFilterEntity = '';
  let logsFilterAction = '';

  async function renderLogs() {
    const from = logsPage * LOGS_PER_PAGE;
    const to = from + LOGS_PER_PAGE - 1;

    let query = supabase.from('admin_logs').select('*', { count: 'exact' });
    if (logsFilterEntity) query = query.eq('entity_type', logsFilterEntity);
    if (logsFilterAction) query = query.eq('action', logsFilterAction);
    if (logsSearchQ) query = query.or(`description.ilike.%${logsSearchQ}%,user_email.ilike.%${logsSearchQ}%,entity_id.ilike.%${logsSearchQ}%`);
    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data: logs, count, error } = await query;
    const items = logs || [];
    const totalPages = Math.ceil((count || 0) / LOGS_PER_PAGE);

    const actionIcons = { create:'plus-circle', update:'edit', delete:'trash-2', confirm:'check-circle', reject:'x-circle', reply:'mail', assign_role:'user-check', login:'log-in', logout:'log-out' };

    const tableRows = items.length === 0
      ? `<tr><td colspan="6"><div class="logs-empty-state"><i data-lucide="inbox" style="width:48px;height:48px;"></i><p>No logs found${logsSearchQ || logsFilterEntity || logsFilterAction ? ' matching your filters' : ''}</p></div></td></tr>`
      : items.map(l => {
        const icon = actionIcons[l.action] || 'activity';
        return `<tr onclick="window.viewLogDetail('${l.id}')">
          <td class="log-time">${fmtDate(l.created_at)}</td>
          <td class="log-user" title="${l.user_email}">${l.user_email}</td>
          <td><span class="log-action-badge log-action-${l.action}"><i data-lucide="${icon}" style="width:12px;height:12px;"></i>${l.action}</span></td>
          <td><span class="log-entity-badge">${l.entity_type}</span></td>
          <td>${l.entity_id ? '<span class="log-entity-id" title="'+l.entity_id+'">' + l.entity_id.substring(0,8) + '…</span>' : '<span style="color:#ccc;">—</span>'}</td>
          <td class="log-desc" title="${(l.description||'').replace(/"/g,'&quot;')}">${l.description || ''}</td>
        </tr>`;
      }).join('');

    const html = `
      <div class="logs-filters">
        <div class="logs-search-wrap">
          <i data-lucide="search"></i>
          <input type="text" class="logs-search" id="logsSearch" placeholder="Search by description, email, or ID…" value="${logsSearchQ}" />
        </div>
        <select class="logs-select" id="logsEntityFilter">
          <option value="">All Types</option>
          <option value="product" ${logsFilterEntity==='product'?'selected':''}>Product</option>
          <option value="order" ${logsFilterEntity==='order'?'selected':''}>Order</option>
          <option value="message" ${logsFilterEntity==='message'?'selected':''}>Message</option>
          <option value="user_role" ${logsFilterEntity==='user_role'?'selected':''}>User Role</option>
          <option value="session" ${logsFilterEntity==='session'?'selected':''}>Session</option>
        </select>
        <select class="logs-select" id="logsActionFilter">
          <option value="">All Actions</option>
          <option value="create" ${logsFilterAction==='create'?'selected':''}>Create</option>
          <option value="update" ${logsFilterAction==='update'?'selected':''}>Update</option>
          <option value="delete" ${logsFilterAction==='delete'?'selected':''}>Delete</option>
          <option value="confirm" ${logsFilterAction==='confirm'?'selected':''}>Confirm</option>
          <option value="reject" ${logsFilterAction==='reject'?'selected':''}>Reject</option>
          <option value="reply" ${logsFilterAction==='reply'?'selected':''}>Reply</option>
          <option value="assign_role" ${logsFilterAction==='assign_role'?'selected':''}>Assign Role</option>
          <option value="login" ${logsFilterAction==='login'?'selected':''}>Login</option>
          <option value="logout" ${logsFilterAction==='logout'?'selected':''}>Logout</option>
        </select>
      </div>
      <div class="logs-stats">
        <span class="logs-stat-chip">Total: <strong>${count || 0}</strong></span>
        <span class="logs-stat-chip">Page: <strong>${logsPage + 1} / ${totalPages || 1}</strong></span>
      </div>
      <div class="data-table-container" style="margin-bottom:0;">
        <table class="data-table logs-table">
          <thead><tr>
            <th>Time</th><th>User</th><th>Action</th><th>Type</th><th>Entity ID</th><th>Description</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        ${totalPages > 1 ? `<div class="logs-pagination">
          <button id="logsPrev" ${logsPage===0?'disabled':''}>← Previous</button>
          <span class="page-info">Page ${logsPage+1} of ${totalPages}</span>
          <button id="logsNext" ${logsPage>=totalPages-1?'disabled':''}>Next →</button>
        </div>` : ''}
      </div>
    `;

    return {
      title: 'System Logs',
      html,
      afterRender: () => {
        let debounce;
        document.getElementById('logsSearch').addEventListener('input', (e) => {
          clearTimeout(debounce);
          debounce = setTimeout(() => { logsSearchQ = e.target.value.trim(); logsPage = 0; loadView('logs'); }, 400);
        });
        document.getElementById('logsEntityFilter').addEventListener('change', (e) => { logsFilterEntity = e.target.value; logsPage = 0; loadView('logs'); });
        document.getElementById('logsActionFilter').addEventListener('change', (e) => { logsFilterAction = e.target.value; logsPage = 0; loadView('logs'); });
        const prevBtn = document.getElementById('logsPrev');
        const nextBtn = document.getElementById('logsNext');
        if (prevBtn) prevBtn.addEventListener('click', () => { logsPage--; loadView('logs'); });
        if (nextBtn) nextBtn.addEventListener('click', () => { logsPage++; loadView('logs'); });
      }
    };
  }

  // Log Detail Modal
  window.viewLogDetail = async (id) => {
    const { data: log } = await supabase.from('admin_logs').select('*').eq('id', id).single();
    if (!log) return;
    const metaStr = log.metadata && Object.keys(log.metadata).length > 0 ? JSON.stringify(log.metadata, null, 2) : 'No extra data';
    openModal('Log Details', `
      <div class="log-detail-grid">
        <div class="log-detail-row">
          <span class="log-detail-label">Log ID</span>
          <div class="log-detail-id-row">
            <span class="log-detail-value" style="font-family:monospace;font-size:13px;">${log.id}</span>
            <button class="log-copy-btn" onclick="navigator.clipboard.writeText('${log.id}');this.textContent='Copied ✓';this.classList.add('copied');setTimeout(()=>{this.textContent='Copy';this.classList.remove('copied');},2000)">Copy</button>
          </div>
        </div>
        <div class="log-detail-row">
          <span class="log-detail-label">Timestamp</span>
          <span class="log-detail-value">${fmtDate(log.created_at)}</span>
        </div>
        <div class="log-detail-row">
          <span class="log-detail-label">User</span>
          <span class="log-detail-value">${log.user_email}</span>
        </div>
        <div class="log-detail-row">
          <span class="log-detail-label">Action</span>
          <span class="log-action-badge log-action-${log.action}">${log.action}</span>
        </div>
        <div class="log-detail-row">
          <span class="log-detail-label">Entity Type</span>
          <span class="log-entity-badge">${log.entity_type}</span>
        </div>
        <div class="log-detail-row">
          <span class="log-detail-label">Entity ID</span>
          <div class="log-detail-id-row">
            <span class="log-detail-value" style="font-family:monospace;font-size:13px;">${log.entity_id || '—'}</span>
            ${log.entity_id ? `<button class="log-copy-btn" onclick="navigator.clipboard.writeText('${log.entity_id}');this.textContent='Copied ✓';this.classList.add('copied');setTimeout(()=>{this.textContent='Copy';this.classList.remove('copied');},2000)">Copy</button>` : ''}
          </div>
        </div>
        <div class="log-detail-row">
          <span class="log-detail-label">Description</span>
          <span class="log-detail-value">${log.description}</span>
        </div>
        <div class="log-detail-row">
          <span class="log-detail-label">Metadata</span>
          <div class="log-detail-metadata">${metaStr}</div>
        </div>
      </div>
      <div class="modal-footer" style="margin-top:1.5rem;"><button type="button" class="action-btn btn-small-outline" onclick="document.getElementById('dynamicModal').remove()">Close</button></div>
    `);
  };

  // Users View (Admin)
  async function renderUsers() {
    const { data: roles } = await supabase.from('user_roles').select('*').order('created_at', { ascending: false });
    
    // We will show User ID for now since we can't join auth.users without a view, 
    // but the assignment will be strictly via email.
    const usersList = roles || [];

    const html = `
      <div class="data-table-container">
        <div class="data-table-header">
          <h3>Manage Users & Roles</h3>
          <button class="action-btn btn-small-primary" onclick="window.openUserModal()">
            <i data-lucide="plus" style="width:14px;height:14px;display:inline-block;vertical-align:middle;"></i> Assign User Role
          </button>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            ${usersList.length === 0 ? '<tr><td colspan="2" style="text-align:center;">No users found</td></tr>' : ''}
            ${usersList.map(u => `
              <tr>
                <td><span style="font-family:monospace;font-size:12px;">${u.user_id}</span></td>
                <td><span class="role-badge" style="background:var(--brand-gray-light);color:var(--brand-dark);">${formatRole(u.role)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    return { title: 'User Management', html };
  }

  // Products View (Store Manager)
  async function renderProducts() {
    const { data: products } = await supabase.from('products').select('*').order('created_at', {ascending: false});
    const items = products || [];

    const html = `
      <div class="data-table-container">
        <div class="data-table-header">
          <h3>Product Catalog</h3>
          <button class="action-btn btn-small-primary" onclick="window.openProductModal()">
            <i data-lucide="plus" style="width:14px;height:14px;display:inline-block;vertical-align:middle;"></i> Add Product
          </button>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>Price</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${items.length === 0 ? '<tr><td colspan="5" style="text-align:center;">No products found</td></tr>' : ''}
            ${items.map(p => `
              <tr>
                <td><img src="${p.image_url || 'https://via.placeholder.com/40'}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;"></td>
                <td style="font-weight:500;">${p.title || p.name}</td>
                <td>$${p.price || '0.00'}</td>
                <td><span class="status-badge status-confirmed">Active</span></td>
                <td style="display:flex;gap:8px;">
                  <button class="action-btn btn-small-outline" onclick="window.openProductModal('${p.id}')">Edit</button>
                  <button class="action-btn btn-small-danger" onclick="window.deleteProduct('${p.id}')">Remove</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    return { title: 'Store Management', html };
  }

  // Orders View (Order Manager)
  async function renderOrders() {
    const { data: orders } = await supabase.from('product_orders').select('*').order('created_at', {ascending: false});
    const items = orders || [];

    const html = `
      <div class="data-table-container">
        <div class="data-table-header">
          <h3>Customer Orders</h3>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${items.length === 0 ? '<tr><td colspan="6" style="text-align:center;">No orders found</td></tr>' : ''}
            ${items.map(o => {
              const orderItems = o.items || (o.variant ? [{ title: o.variant, quantity: o.quantity }] : []);
              const itemsCount = orderItems.length;
              const previewItem = itemsCount > 0 ? orderItems[0].title : 'Unknown Item';
              const itemsText = itemsCount > 1 ? previewItem + ' + ' + (itemsCount - 1) + ' more' : previewItem;
              return `
              <tr>
                <td style="font-weight:500;">${o.id.substring(0,8)}</td>
                <td>${new Date(o.created_at).toLocaleDateString()}</td>
                <td>
                  <div style="font-size:13px; font-weight:600;">${o.customer_name || 'N/A'}</div>
                  <div style="font-size:12px; color:var(--admin-text-muted);">${o.customer_email || ''}</div>
                </td>
                <td style="font-size:13px; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${itemsText}">${itemsText}</td>
                <td><span class="status-badge status-${o.status || 'pending'}">${o.status || 'Pending'}</span></td>
                <td style="display:flex;gap:4px;flex-wrap:wrap;">
                  <button class="action-btn btn-small-outline" onclick="window.viewOrder('${o.id}')">View</button>
                  ${(!o.status || o.status === 'pending') ? `
                    <button class="action-btn btn-small-primary" onclick="window.confirmOrder('${o.id}')">Confirm</button>
                    <button class="action-btn btn-small-danger" onclick="window.openRejectModal('${o.id}')">Reject</button>
                  ` : `<span style="color:var(--admin-text-muted);font-size:12px;display:flex;align-items:center;">Processed</span>`}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    return { title: 'Order Management', html };
  }

  // Messages View (Message Manager)
  async function renderMessages() {
    const { data: messages } = await supabase.from('contacts').select('*').order('created_at', {ascending: false});
    const items = messages || [];

    const html = `
      <div class="data-table-container">
        <div class="data-table-header">
          <h3>Customer Inquiries</h3>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Email</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${items.length === 0 ? '<tr><td colspan="6" style="text-align:center;">No messages found</td></tr>' : ''}
            ${items.map(m => `
              <tr>
                <td>${new Date(m.created_at).toLocaleDateString()}</td>
                <td>${m.name}</td>
                <td>${m.email}</td>
                <td>${m.subject || 'General Inquiry'}</td>
                <td><span class="status-badge ${m.replied ? 'status-confirmed' : 'status-pending'}">${m.replied ? 'Replied' : 'Pending'}</span></td>
                <td>
                  <button class="action-btn btn-small-primary" onclick="window.openReplyModal('${m.id}', '${m.email}')">Reply</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    return { title: 'Message Management', html };
  }


  // --- GLOBAL MODAL FUNCTIONS ---

  function openModal(title, contentHtml) {
    UI.modals.innerHTML = `
      <div class="modal-overlay active" id="dynamicModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>${title}</h3>
            <button class="close-modal" onclick="document.getElementById('dynamicModal').remove()"><i data-lucide="x"></i></button>
          </div>
          <div class="modal-body">
            ${contentHtml}
          </div>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  window.openUserModal = () => {
    openModal('Assign User Role', `
      <form id="userRoleForm">
        <div class="form-group">
          <label>User Email Address</label>
          <input type="email" class="form-control" name="email" required placeholder="admin@domain.com">
          <p style="font-size:12px;color:var(--admin-text-muted);margin-top:4px;">User must already have an account.</p>
        </div>
        <div class="form-group">
          <label>Role</label>
          <select class="form-control" name="role">
            <option value="admin">Admin</option>
            <option value="store_manager">Store Manager</option>
            <option value="message_manager">Message Manager</option>
          </select>
        </div>
        <div id="roleError" style="color:#E32636;font-size:13px;margin-bottom:10px;display:none;"></div>
        <div class="modal-footer">
          <button type="button" class="action-btn btn-small-outline" onclick="document.getElementById('dynamicModal').remove()">Cancel</button>
          <button type="submit" id="saveRoleBtn" class="action-btn btn-small-primary">Save Role</button>
        </div>
      </form>
    `);

    document.getElementById('userRoleForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const email = fd.get('email');
      const role = fd.get('role');
      const btn = document.getElementById('saveRoleBtn');
      const errBox = document.getElementById('roleError');
      
      btn.disabled = true;
      btn.textContent = 'Saving...';
      errBox.style.display = 'none';

      const { error } = await supabase.rpc('assign_role_by_email', { user_email: email, assigned_role: role });
      
      if (error) {
        errBox.textContent = error.message;
        errBox.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Save Role';
      } else {
        alert('Role assigned successfully to ' + email);
        document.getElementById('dynamicModal').remove();
        loadView('users');
      }
    });
  };

  window.openProductModal = async (id = null) => {
    let p = {};
    if (id) {
      const { data } = await supabase.from('products').select('*').eq('id', id).single();
      if (data) p = data;
    }
    
    // Safely extract and parse extra images (handles arrays and stringified JSON)
    let extraImagesArray = [];
    if (p.images) {
      if (Array.isArray(p.images)) {
        extraImagesArray = p.images;
      } else if (typeof p.images === 'string') {
        try {
          extraImagesArray = JSON.parse(p.images);
        } catch (e) {
          console.warn("Failed to parse extra images", e);
        }
      }
    }

    // Safely extract and parse specs/details
    let specsObj = {};
    const specsSource = p.specs || p.details;
    if (specsSource) {
      if (typeof specsSource === 'object') {
        specsObj = specsSource;
      } else if (typeof specsSource === 'string') {
        try {
          specsObj = JSON.parse(specsSource);
        } catch (e) {
          // Attempt line-by-line parsing if it's formatted as standard plaintext lines
          const parsed = {};
          specsSource.split('\n').forEach(line => {
            const idx = line.indexOf(':');
            if (idx > -1) {
              const k = line.substring(0, idx).trim();
              const v = line.substring(idx + 1).trim();
              if (k && v) parsed[k] = v;
            }
          });
          specsObj = parsed;
        }
      }
    }

    openModal(id ? 'Edit Product' : 'Add Product', `
      <form id="productForm">
        <div class="form-group">
          <label>Product Name</label>
          <input type="text" class="form-control" name="title" value="${p.title || ''}" required>
        </div>
        <div class="form-group">
          <label>Category / Tag</label>
          <input type="text" class="form-control" name="category" value="${p.category || ''}" placeholder="e.g. Hazardous Area Lighting">
        </div>
        <div class="form-group">
          <label>Price</label>
          <input type="text" class="form-control" name="price" value="${p.price || ''}" placeholder="e.g. USD 1,280 - 1,540">
        </div>
        
        <div class="form-group">
          <label>Main Image Upload</label>
          <div style="border: 2px dashed var(--admin-border); padding: 1.5rem; text-align: center; border-radius: 8px; cursor: pointer; background: var(--brand-off-white);" id="imgDropZone">
            <i data-lucide="upload-cloud" style="color:var(--brand-gray-medium); margin-bottom:8px;"></i>
            <p style="font-size:14px; margin:0; color:var(--admin-text-main);">Click or Drag & Drop Main Image</p>
            <input type="file" id="imgInput" style="display:none;" accept="image/*">
            <input type="hidden" name="image_url" id="imgUrlHidden" value="${p.image_url || ''}">
          </div>
          <div id="imgPreview" style="margin-top:10px; font-size:12px; color:green; font-weight:600;">${p.image_url ? 'Current Image Loaded' : ''}</div>
        </div>

        <div class="form-group">
          <label>Extra Product Images</label>
          <div style="border: 2px dashed var(--admin-border); padding: 1.5rem; text-align: center; border-radius: 8px; cursor: pointer; background: var(--brand-off-white);" id="extraImgDropZone">
            <i data-lucide="images" style="color:var(--brand-gray-medium); margin-bottom:8px;"></i>
            <p style="font-size:14px; margin:0; color:var(--admin-text-main);">Click or Drag & Drop Extra Images</p>
            <input type="file" id="extraImgInput" style="display:none;" accept="image/*" multiple>
          </div>
          <div id="extraImgContainer" style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
            ${extraImagesArray.map(img => `<img src="${img}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid #ddd;" data-url="${img}">`).join('')}
          </div>
          <div id="extraImgPreview" style="margin-top:10px; font-size:12px; color:green; font-weight:600;"></div>
        </div>

        <div class="form-group">
          <label>Summary / Short Description</label>
          <textarea class="form-control" name="summary" rows="2">${p.summary || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Technical Specs (One per line, format: Key: Value)</label>
          <textarea class="form-control" name="specs" rows="4" placeholder="e.g.\nMaterial: Aluminum\nVoltage: 220V\nWarranty: 5 Years">${
            Object.entries(specsObj).map(([k,v]) => `${k}: ${v}`).join('\n')
          }</textarea>
        </div>
        <div id="prodError" style="color:#E32636;font-size:13px;margin-bottom:10px;display:none;"></div>
        <div class="modal-footer">
          <button type="button" class="action-btn btn-small-outline" onclick="document.getElementById('dynamicModal').remove()">Cancel</button>
          <button type="submit" id="saveProdBtn" class="action-btn btn-small-primary">Save Product</button>
        </div>
      </form>
    `);
    
    // Main Image Upload Logic
    const dropZone = document.getElementById('imgDropZone');
    const imgInput = document.getElementById('imgInput');
    const imgPreview = document.getElementById('imgPreview');
    const imgUrlHidden = document.getElementById('imgUrlHidden');

    dropZone.addEventListener('click', () => imgInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--brand-red)'; });
    dropZone.addEventListener('dragleave', () => dropZone.style.borderColor = 'var(--admin-border)');
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault(); dropZone.style.borderColor = 'var(--admin-border)';
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0], imgPreview, imgUrlHidden, false);
    });
    imgInput.addEventListener('change', (e) => {
      if (e.target.files.length) handleFile(e.target.files[0], imgPreview, imgUrlHidden, false);
    });

    // Extra Images Upload Logic
    const extraDropZone = document.getElementById('extraImgDropZone');
    const extraImgInput = document.getElementById('extraImgInput');
    const extraImgPreview = document.getElementById('extraImgPreview');
    const extraImgContainer = document.getElementById('extraImgContainer');

    extraDropZone.addEventListener('click', () => extraImgInput.click());
    extraDropZone.addEventListener('dragover', (e) => { e.preventDefault(); extraDropZone.style.borderColor = 'var(--brand-red)'; });
    extraDropZone.addEventListener('dragleave', () => extraDropZone.style.borderColor = 'var(--admin-border)');
    extraDropZone.addEventListener('drop', (e) => {
      e.preventDefault(); extraDropZone.style.borderColor = 'var(--admin-border)';
      if (e.dataTransfer.files.length) Array.from(e.dataTransfer.files).forEach(f => handleFile(f, extraImgPreview, null, true));
    });
    extraImgInput.addEventListener('change', (e) => {
      if (e.target.files.length) Array.from(e.target.files).forEach(f => handleFile(f, extraImgPreview, null, true));
    });

    async function handleFile(file, previewEl, hiddenEl, isExtra) {
      previewEl.textContent = 'Uploading: ' + file.name + '...';
      previewEl.style.color = '#f39c12';
      const fileExt = file.name.split('.').pop();
      const fileName = Math.random().toString(36).substring(2) + Date.now() + '.' + fileExt;
      
      const { data, error } = await supabase.storage.from('product-images').upload(fileName, file);
      if (error) {
        previewEl.style.color = '#E32636';
        previewEl.textContent = 'Upload failed: ' + error.message;
      } else {
        const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
        previewEl.style.color = 'green';
        previewEl.textContent = 'Image uploaded successfully!';
        
        if (isExtra) {
          const imgEl = document.createElement('img');
          imgEl.src = publicUrlData.publicUrl;
          imgEl.dataset.url = publicUrlData.publicUrl;
          imgEl.style.cssText = 'width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid #ddd;cursor:pointer;';
          imgEl.title = "Click to remove";
          imgEl.onclick = () => imgEl.remove();
          extraImgContainer.appendChild(imgEl);
        } else {
          hiddenEl.value = publicUrlData.publicUrl;
        }
      }
    }

    document.getElementById('productForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('saveProdBtn');
      const errBox = document.getElementById('prodError');
      btn.disabled = true; btn.textContent = 'Saving...'; errBox.style.display = 'none';

      // Collect extra images
      const extraImages = Array.from(document.getElementById('extraImgContainer').querySelectorAll('img')).map(img => img.dataset.url);

      const fd = new FormData(e.target);
      
      // Parse specs
      const specsRaw = fd.get('specs') || '';
      const parsedSpecsObj = {};
      specsRaw.split('\n').forEach(line => {
        const idx = line.indexOf(':');
        if (idx > -1) {
          const k = line.substring(0, idx).trim();
          const v = line.substring(idx + 1).trim();
          if (k && v) parsedSpecsObj[k] = v;
        }
      });

      const payload = {
        title: fd.get('title'),
        price: fd.get('price'),
        category: fd.get('category'),
        summary: fd.get('summary'),
        image_url: fd.get('image_url'),
        images: extraImages,
        specs: parsedSpecsObj,
        details: parsedSpecsObj
      };

      let reqError;
      let resultId = id;
      if (id) {
        const { error } = await supabase.from('products').update(payload).eq('id', id);
        reqError = error;
      } else {
        const { data: inserted, error } = await supabase.from('products').insert([payload]).select('id').single();
        reqError = error;
        if (inserted) resultId = inserted.id;
      }

      if (reqError) {
        errBox.textContent = reqError.message;
        errBox.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Save Product';
      } else {
        await logAction(id ? 'update' : 'create', 'product', resultId, `${id ? 'Updated' : 'Created'} product: ${payload.title}`, { title: payload.title, price: payload.price, category: payload.category });
        document.getElementById('dynamicModal').remove();
        loadView('products');
      }
    });
  };

  window.deleteProduct = async (id) => {
    if(confirm('Are you sure you want to remove this product?')) {
      const { data: prod } = await supabase.from('products').select('title').eq('id', id).single();
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) alert('Failed to delete: ' + error.message);
      else {
        await logAction('delete', 'product', id, `Deleted product: ${prod?.title || id}`, { title: prod?.title });
        loadView('products');
      }
    }
  };

  window.viewOrder = async (id) => {
    const { data: order } = await supabase.from('product_orders').select('*').eq('id', id).single();
    if (!order) return alert('Order not found.');

    const orderItems = order.items || (order.variant ? [{ title: order.variant, quantity: order.quantity, price: 'N/A' }] : []);
    
    let itemsHtml = orderItems.map(item => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0; border-bottom: 1px solid var(--admin-border);">
        <div style="display:flex; align-items:center; gap:12px;">
          ${item.image ? `<img src="${item.image}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;">` : ''}
          <div>
            <div style="font-size:13px; font-weight:600; color:var(--admin-text-main);">${item.title || item.variant}</div>
            <div style="font-size:12px; color:var(--admin-text-muted);">Qty: ${item.quantity || 1}</div>
          </div>
        </div>
        <div style="font-size:13px; font-weight:600; color:var(--admin-text-main);">${item.price || ''}</div>
      </div>
    `).join('');

    openModal('Order Details', `
      <div style="margin-bottom: 1rem;">
        <h4 style="margin:0 0 4px 0; color:var(--admin-text-main);">Customer</h4>
        <p style="margin:0; font-size:14px; color:var(--admin-text-muted);">${order.customer_name} (${order.customer_email})</p>
      </div>
      <div style="margin-bottom: 1rem;">
        <h4 style="margin:0 0 4px 0; color:var(--admin-text-main);">Shipping Address</h4>
        <p style="margin:0; font-size:14px; color:var(--admin-text-muted);">${order.address}, ${order.city} ${order.zip_code}</p>
      </div>
      <div style="margin-bottom: 1rem;">
        <h4 style="margin:0 0 8px 0; color:var(--admin-text-main);">Order Items</h4>
        <div style="background:var(--brand-off-white); border-radius:8px; padding:0 12px;">
          ${itemsHtml || '<p style="padding:12px 0; margin:0; font-size:13px; color:var(--admin-text-muted);">No items details.</p>'}
        </div>
      </div>
      <div style="margin-bottom: 1rem;">
        <h4 style="margin:0 0 4px 0; color:var(--admin-text-main);">Status</h4>
        <span class="status-badge status-${order.status || 'pending'}">${order.status || 'Pending'}</span>
        ${order.rejection_reason ? `<p style="margin-top:8px;font-size:13px;color:#E32636;">Reason: ${order.rejection_reason}</p>` : ''}
      </div>
      <div class="modal-footer">
        <button type="button" class="action-btn btn-small-outline" onclick="document.getElementById('dynamicModal').remove()">Close</button>
      </div>
    `);
  };

  window.confirmOrder = async (id) => {
    if(confirm('Confirm this order? An automated confirmation email will be sent to the customer.')) {
      const { data: order } = await supabase.from('product_orders').select('*').eq('id', id).single();
      const { error } = await supabase.from('product_orders').update({ status: 'confirmed' }).eq('id', id);
      if (error) {
        alert('Failed to confirm order: ' + error.message);
      } else {
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              to: order.customer_email,
              subject: 'Order Confirmed - Elsewedy SEDCO',
              html: `<p>Dear ${order.customer_name},</p><p>Your order (ID: ${order.id.substring(0,8)}) has been successfully confirmed and is now being processed.</p><p>Thank you for choosing Elsewedy SEDCO.</p>`
            }
          });
          alert('Order confirmed and email sent successfully!');
        } catch (err) {
          console.error('Email send error:', err);
          alert('Order confirmed, but the automated email failed to send (Is the Edge Function deployed?).');
        }
        await logAction('confirm', 'order', id, `Confirmed order for ${order.customer_name}`, { customer: order.customer_name, email: order.customer_email });
        loadView('orders');
      }
    }
  };

  window.openRejectModal = (id) => {
    openModal('Reject Order', `
      <form id="rejectForm">
        <p style="font-size:14px;color:var(--admin-text-muted);margin-bottom:1rem;">Please provide a reason for rejecting this order. An automated email will be sent to the customer.</p>
        <div class="form-group">
          <label>Reason for Rejection</label>
          <textarea class="form-control" name="reason" rows="3" required></textarea>
        </div>
        <div class="modal-footer">
          <button type="button" class="action-btn btn-small-outline" onclick="document.getElementById('dynamicModal').remove()">Cancel</button>
          <button type="submit" id="rejectBtn" class="action-btn btn-small-danger">Reject Order</button>
        </div>
      </form>
    `);

    document.getElementById('rejectForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('rejectBtn');
      btn.disabled = true; btn.textContent = 'Processing...';

      const reason = new FormData(e.target).get('reason');
      const { data: order } = await supabase.from('product_orders').select('*').eq('id', id).single();
      const { error } = await supabase.from('product_orders').update({ status: 'rejected', rejection_reason: reason }).eq('id', id);
      
      if (error) {
        alert('Failed to reject order: ' + error.message);
        btn.disabled = false; btn.textContent = 'Reject Order';
      } else {
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              to: order.customer_email,
              subject: 'Order Update - Elsewedy SEDCO',
              html: `<p>Dear ${order.customer_name},</p><p>Unfortunately, your order (ID: ${order.id.substring(0,8)}) could not be processed at this time.</p><p><strong>Reason:</strong> ${reason}</p><p>Please contact support for more details.</p>`
            }
          });
          alert('Order rejected and email sent successfully!');
        } catch (err) {
          console.error('Email send error:', err);
          alert('Order rejected, but the automated email failed to send (Is the Edge Function deployed?).');
        }
        document.getElementById('dynamicModal').remove();
        await logAction('reject', 'order', id, `Rejected order for ${order.customer_name} — Reason: ${reason}`, { customer: order.customer_name, reason });
        loadView('orders');
      }
    });
  };

  window.openReplyModal = async (id, email) => {
    const { data: contact } = await supabase.from('contacts').select('*').eq('id', id).single();
    if (!contact) return alert('Message not found.');

    openModal('View & Reply to Message', `
      <div style="margin-bottom:1rem; padding:1rem; background:var(--brand-off-white); border-radius:8px;">
        <h4 style="margin:0 0 8px 0; font-size:14px;">Original Message from ${contact.name}</h4>
        <p style="margin:0; font-size:13px; color:var(--admin-text-muted); white-space:pre-wrap;">${contact.message || 'No message content.'}</p>
      </div>
      <form id="replyForm">
        <div class="form-group">
          <label>To</label>
          <input type="text" class="form-control" value="${email}" readonly disabled>
        </div>
        <div class="form-group">
          <label>Reply Message</label>
          <textarea class="form-control" name="reply_message" rows="5" required></textarea>
        </div>
        <div class="modal-footer">
          <button type="button" class="action-btn btn-small-outline" onclick="document.getElementById('dynamicModal').remove()">Cancel</button>
          <button type="submit" id="sendReplyBtn" class="action-btn btn-small-primary">Send Email</button>
        </div>
      </form>
    `);

    document.getElementById('replyForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('sendReplyBtn');
      btn.disabled = true; btn.textContent = 'Sending...';

      const replyText = new FormData(e.target).get('reply_message');
      const subject = 'Re: ' + (contact.subject || 'Your Inquiry to Elsewedy SEDCO');
      if (!window.emailjs || typeof window.emailjs.send !== 'function') {
        alert('EmailJS is not loaded. Please check your internet connection and refresh the admin page.');
        btn.disabled = false; btn.textContent = 'Send Email';
        return;
      }
      
      try {
        await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          to_email: email,
          to_name: contact.name || 'Customer',
          subject: subject,
          reply_message: replyText,
          original_message: contact.message || ''
        }, {
          publicKey: EMAILJS_PUBLIC_KEY
        });

        const { error } = await supabase.from('contacts').update({ replied: true, reply_message: replyText }).eq('id', id);
        if (error) throw error;

        alert("Reply sent successfully directly to the user's email address!");
        await logAction('reply', 'message', id, `Replied to message from ${contact.name} (${email})`, { contact_name: contact.name, contact_email: email, subject: contact.subject });
        document.getElementById('dynamicModal').remove();
        loadView('messages');
      } catch (err) {
        console.error('Failed to send email via EmailJS:', err);
        alert('Failed to send email with EmailJS. Check your EmailJS service/template settings. Error: ' + (err.text || err.message || String(err)));
        btn.disabled = false; btn.textContent = 'Send Email';
      }
    });
  };

  // ═══════════════════════════════════════════════════════════
  //  PAGE EDITOR VIEW
  // ═══════════════════════════════════════════════════════════

  const PAGE_FILES = {
    home:        { html: 'index.html', css: ['css/home.css'], js: [] },
    about:       { html: 'about.html', css: ['css/about.css'], js: [] },
    solutions:   { html: 'solutions.html', css: ['css/solutions.css'], js: ['js/solutions.js'] },
    contact:     { html: 'contact.html', css: ['css/contact.css'], js: ['js/contact.js'] },
    marketplace: { html: 'marketplace.html', css: ['css/marketplace.css'], js: ['js/marketplace.js'] },
    shared:      { html: 'shared_for_edit.html', css: ['css/navbar.css', 'css/footer.css'], js: [] }
  };

  async function renderPageEditor() {
    const pages = [
      { id: 'shared', label: 'Shared Layout', desc: 'Navbar, CTA & Footer', file: 'shared_for_edit.html', icon: 'layout', color: '#8B5CF6', preview: 'index.html' },
      { id: 'home', label: 'Home Page', desc: 'Hero, About, Categories', file: 'index_for_edit.html', icon: 'home', color: '#E32636', preview: 'index.html' },
      { id: 'about', label: 'About Page', desc: 'Story, Globe, Purpose', file: 'about_for_edit.html', icon: 'info', color: '#0EA5E9', preview: 'about.html' },
      { id: 'solutions', label: 'Solutions Page', desc: 'Services & Capabilities', file: 'solutions_for_edit.html', icon: 'wrench', color: '#F59E0B', preview: 'solutions.html' },
      { id: 'contact', label: 'Contact Page', desc: 'Form & Contact Info', file: 'contact_for_edit.html', icon: 'mail', color: '#10B981', preview: 'contact.html' },
      { id: 'marketplace', label: 'Marketplace', desc: 'Products & Equipment', file: 'marketplace_for_edit.html', icon: 'shopping-bag', color: '#F97316', preview: 'marketplace.html' }
    ];

    const html = `
      <div id="pe-container">
        <div id="pe-selector" class="pe-selector">
          <div class="pe-selector-header">
            <h3 style="margin:0;font-size:18px;">Page Editor</h3>
            <p style="margin:4px 0 0;font-size:13px;color:var(--admin-text-muted);">Select a page to open its visual editor, preview it, or edit source code.</p>
          </div>
          <div class="pe-cards">
            ${pages.map(p => `
              <div class="pe-card-row">
                <div class="pe-card-main">
                  <div class="pe-card-icon" style="background:${p.color}15;color:${p.color};">
                    <i data-lucide="${p.icon}"></i>
                  </div>
                  <div class="pe-card-info">
                    <span class="pe-card-title">${p.label}</span>
                    <span class="pe-card-desc">${p.desc}</span>
                  </div>
                </div>
                <div class="pe-card-actions">
                  ${p.id === 'about' ? `
                    <button class="action-btn btn-small-outline pe-action-btn" data-action="certs" data-pageid="${p.id}" data-label="${p.label}" title="Manage Certificates">
                      <i data-lucide="award" style="width:13px;height:13px;"></i> Certs
                    </button>
                  ` : ''}
                  <button class="action-btn btn-small-primary pe-action-btn" data-action="edit" data-page="${p.file}" data-label="${p.label}" title="Open Visual Editor">
                    <i data-lucide="edit-3" style="width:13px;height:13px;"></i> Edit
                  </button>
                  <button class="action-btn btn-small-outline pe-action-btn" data-action="preview" data-page="${p.preview}" title="Fullscreen Preview">
                    <i data-lucide="maximize-2" style="width:13px;height:13px;"></i> Preview
                  </button>
                  <button class="action-btn btn-small-outline pe-action-btn" data-action="code" data-pageid="${p.id}" data-label="${p.label}" title="Edit Source Code">
                    <i data-lucide="code" style="width:13px;height:13px;"></i> Code
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        <div id="pe-editor" class="pe-editor" style="display:none;">
          <div class="pe-editor-toolbar">
            <button class="action-btn btn-small-outline" id="pe-back-btn">
              <i data-lucide="arrow-left" style="width:14px;height:14px;"></i> Back to Pages
            </button>
            <span id="pe-current-label" style="font-weight:600;font-size:15px;"></span>
            <div style="display:flex;gap:8px;">
              <button class="action-btn btn-small-outline" id="pe-fullscreen-btn" title="Toggle Fullscreen">
                <i data-lucide="maximize-2" style="width:14px;height:14px;"></i>
              </button>
              <button class="action-btn btn-small-primary" onclick="document.getElementById('pe-iframe').contentWindow.location.reload()">
                <i data-lucide="refresh-cw" style="width:14px;height:14px;"></i> Reload
              </button>
            </div>
          </div>
          <iframe id="pe-iframe" class="pe-iframe"></iframe>
        </div>
        <div id="pe-code-editor" style="display:none;"></div>
      </div>
    `;

    return {
      title: 'Page Editor',
      html,
      afterRender: () => {
        document.querySelectorAll('.pe-action-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if (action === 'edit') {
              const file = btn.dataset.page;
              const label = btn.dataset.label;
              document.getElementById('pe-selector').style.display = 'none';
              document.getElementById('pe-editor').style.display = 'flex';
              document.getElementById('pe-code-editor').style.display = 'none';
              document.getElementById('pe-current-label').textContent = 'Editing: ' + label;
              document.getElementById('pe-iframe').src = file;
            } else if (action === 'preview') {
              window.open(btn.dataset.page, '_blank');
            } else if (action === 'code') {
              openCodeEditor(btn.dataset.pageid, btn.dataset.label);
            } else if (action === 'certs') {
              window.openCertificatesManager();
            }
          });
        });
        document.getElementById('pe-back-btn').addEventListener('click', () => {
          if (document.fullscreenElement === document.getElementById('pe-editor') && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          }
          document.getElementById('pe-editor').classList.remove('pe-fullscreen');
          document.getElementById('pe-editor').style.display = 'none';
          document.getElementById('pe-selector').style.display = 'block';
          document.getElementById('pe-iframe').src = '';
        });
        /* Fullscreen toggle */
        const fsbtn = document.getElementById('pe-fullscreen-btn');
        if (fsbtn) {
          fsbtn.addEventListener('click', async () => {
            await toggleManagedFullscreen(document.getElementById('pe-editor'), 'pe-fullscreen');
          });
        }
      }
    };
  }


  // ═══════════════════════════════════════════════════════════
  //  SOURCE CODE EDITOR
  // ═══════════════════════════════════════════════════════════
  let codeEditorState = { pageId: null, files: {}, activeTab: 'html', modified: {} };

  function codeStorageKey(pageId, fileType, index) {
    return `sedco_code_${pageId}_${fileType}${index !== undefined ? '_' + index : ''}`;
  }

  function buildEditorBundle(files) {
    return files.map(f => `/* === ${f.path} === */\n${f.content}`).join('\n\n');
  }

  function splitEditorBundle(value, files) {
    if (!files || files.length === 0) return [];
    const markerRegex = /\/\* === (.+?) === \*\/\r?\n?/g;
    const matches = [...value.matchAll(markerRegex)];

    if (!matches.length) {
      return files.map((file, index) => ({
        ...file,
        content: index === 0 ? value : file.content
      }));
    }

    return files.map((file, index) => {
      const match = matches[index];
      if (!match) return file;

      const contentStart = match.index + match[0].length;
      const contentEnd = index + 1 < matches.length ? matches[index + 1].index : value.length;
      let content = value.slice(contentStart, contentEnd);
      content = content.replace(/^\r?\n/, '').replace(/\s+$/, '');
      return { ...file, content };
    });
  }

  async function toggleManagedFullscreen(element, className) {
    if (!element) return;

    const isActive = element.classList.contains(className) || document.fullscreenElement === element;
    document.getElementById('pe-editor')?.classList.remove('pe-fullscreen');
    document.getElementById('ce-container')?.classList.remove('ce-fullscreen');

    if (isActive) {
      if (document.fullscreenElement === element && document.exitFullscreen) {
        try { await document.exitFullscreen(); } catch (e) {}
      }
      return;
    }

    element.classList.add(className);
    if (element.requestFullscreen) {
      try {
        await element.requestFullscreen();
      } catch (e) {
        // Fall back to CSS-only fullscreen when browser fullscreen is blocked.
      }
    }
  }

  function cleanupManagedFullscreen() {
    if (document.fullscreenElement) return;
    document.getElementById('pe-editor')?.classList.remove('pe-fullscreen');
    document.getElementById('ce-container')?.classList.remove('ce-fullscreen');
  }

  if (!window.__sedcoAdminFullscreenBound) {
    window.__sedcoAdminFullscreenBound = true;
    document.addEventListener('fullscreenchange', cleanupManagedFullscreen);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      cleanupManagedFullscreen();
      const previewPanel = document.getElementById('ce-preview-panel');
      if (previewPanel && previewPanel.style.display !== 'none') {
        previewPanel.style.display = 'none';
      }
    });
  }

  async function fetchFileContent(filePath) {
    try {
      const resp = await fetch(filePath, { cache: 'no-store' });
      if (!resp.ok) return '/* Could not load: ' + filePath + ' */';
      return await resp.text();
    } catch(e) { return '/* Error loading: ' + filePath + ' */'; }
  }

  async function openCodeEditor(pageId, pageLabel) {
    const pf = PAGE_FILES[pageId];
    if (!pf) return alert('No file mapping for page: ' + pageId);

    document.getElementById('pe-selector').style.display = 'none';
    document.getElementById('pe-editor').style.display = 'none';
    const container = document.getElementById('pe-code-editor');
    container.style.display = 'flex';
    container.innerHTML = '<div class="loader-spinner" style="margin:40px auto;"></div>';

    codeEditorState = { pageId, files: {}, activeTab: 'html', modified: {} };

    // Load files directly from disk first
    const htmlContent = await fetchFileContent(pf.html);
    codeEditorState.files.html = { path: pf.html, content: htmlContent };

    const cssFiles = [];
    for (let i = 0; i < (pf.css || []).length; i++) {
      const content = await fetchFileContent(pf.css[i]);
      cssFiles.push({ path: pf.css[i], content });
    }
    codeEditorState.files.css = cssFiles;

    const jsFiles = [];
    for (let i = 0; i < (pf.js || []).length; i++) {
      const content = await fetchFileContent(pf.js[i]);
      jsFiles.push({ path: pf.js[i], content });
    }
    codeEditorState.files.js = jsFiles;

    renderCodeEditorUI(container, pageLabel);
  }

  function renderCodeEditorUI(container, pageLabel) {
    const st = codeEditorState;
    const tabs = ['html'];
    if (st.files.css && st.files.css.length > 0) tabs.push('css');
    if (st.files.js && st.files.js.length > 0) tabs.push('js');

    container.innerHTML = `
      <div class="ce-container" id="ce-container">
        <div class="ce-toolbar">
          <div style="display:flex;align-items:center;gap:12px;">
            <button class="action-btn btn-small-outline" id="ce-back-btn">
              <i data-lucide="arrow-left" style="width:14px;height:14px;"></i> Back
            </button>
            <span style="font-weight:600;font-size:14px;">Code: ${pageLabel}</span>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="action-btn btn-small-outline" id="ce-preview-btn" title="Preview">
              <i data-lucide="eye" style="width:14px;height:14px;"></i> Preview
            </button>
            <button class="action-btn btn-small-outline" id="ce-fullscreen-btn" title="Toggle Fullscreen">
              <i data-lucide="maximize-2" style="width:14px;height:14px;"></i>
            </button>
            <button class="action-btn btn-small-primary" id="ce-save-btn">
              <i data-lucide="save" style="width:14px;height:14px;"></i> Save
            </button>
          </div>
        </div>
        <div class="ce-tabs">
          ${tabs.map(t => {
            let label = t.toUpperCase();
            if (t === 'html') label = st.files.html.path;
            else if (t === 'css') label = st.files.css.map(f => f.path).join(', ');
            else if (t === 'js') label = st.files.js.map(f => f.path).join(', ');
            return `<button class="ce-tab ${t === st.activeTab ? 'active' : ''}" data-tab="${t}">${t.toUpperCase()} <span class="ce-tab-path">${label}</span></button>`;
          }).join('')}
        </div>
        <div class="ce-editor-area">
          <div class="ce-line-numbers" id="ce-line-numbers"></div>
          <textarea class="ce-textarea" id="ce-textarea" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"></textarea>
        </div>
        <div class="ce-statusbar">
          <span id="ce-status">Ready</span>
          <span id="ce-cursor">Ln 1, Col 1</span>
        </div>
      </div>
      <div class="ce-preview-panel" id="ce-preview-panel" style="display:none;">
        <div class="ce-preview-header">
          <span style="font-weight:600;font-size:13px;">Live Preview</span>
          <button class="action-btn btn-small-outline" id="ce-preview-close" style="padding:4px 8px;">Close</button>
        </div>
        <iframe id="ce-preview-iframe" class="ce-preview-iframe"></iframe>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    const textarea = document.getElementById('ce-textarea');
    const lineNums = document.getElementById('ce-line-numbers');

    function updateLineNumbers() {
      const lines = textarea.value.split('\n').length;
      lineNums.innerHTML = Array.from({length: lines}, (_, i) => `<div>${i + 1}</div>`).join('');
    }

    function loadTabContent(tabName) {
      st.activeTab = tabName;
      document.querySelectorAll('.ce-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
      if (tabName === 'html') {
        textarea.value = st.files.html.content;
      } else if (tabName === 'css') {
        textarea.value = buildEditorBundle(st.files.css);
      } else if (tabName === 'js') {
        textarea.value = buildEditorBundle(st.files.js);
      }
      updateLineNumbers();
    }

    loadTabContent(st.activeTab);

    textarea.addEventListener('input', () => {
      updateLineNumbers();
      st.modified[st.activeTab] = true;
      document.getElementById('ce-status').textContent = 'Modified';
    });

    textarea.addEventListener('scroll', () => { lineNums.scrollTop = textarea.scrollTop; });

    textarea.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        textarea.dispatchEvent(new Event('input'));
      }
    });

    /* Update cursor position */
    ['click', 'keyup'].forEach(evt => {
      textarea.addEventListener(evt, () => {
        const val = textarea.value.substring(0, textarea.selectionStart);
        const ln = val.split('\n').length;
        const col = val.split('\n').pop().length + 1;
        document.getElementById('ce-cursor').textContent = `Ln ${ln}, Col ${col}`;
      });
    });

    // Tab switching
    document.querySelectorAll('.ce-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        saveCurrentTabToState();
        loadTabContent(tab.dataset.tab);
      });
    });

    function saveCurrentTabToState() {
      const v = textarea.value;
      if (st.activeTab === 'html') {
        st.files.html.content = v;
      } else if (st.activeTab === 'css') {
        st.files.css = splitEditorBundle(v, st.files.css);
      } else if (st.activeTab === 'js') {
        st.files.js = splitEditorBundle(v, st.files.js);
      }
    }

    // Back button
    document.getElementById('ce-back-btn').addEventListener('click', () => {
      if (document.fullscreenElement === document.getElementById('ce-container') && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      document.getElementById('ce-preview-panel').style.display = 'none';
      document.getElementById('ce-container').classList.remove('ce-fullscreen');
      container.style.display = 'none';
      document.getElementById('pe-selector').style.display = 'block';
    });

    // Fullscreen toggle
    document.getElementById('ce-fullscreen-btn').addEventListener('click', async () => {
      await toggleManagedFullscreen(document.getElementById('ce-container'), 'ce-fullscreen');
    });

    // Preview
    document.getElementById('ce-preview-btn').addEventListener('click', () => {
      saveCurrentTabToState();
      const panel = document.getElementById('ce-preview-panel');
      const iframe = document.getElementById('ce-preview-iframe');
      panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
      if (panel.style.display !== 'none') {
        iframe.srcdoc = st.files.html.content;
      }
    });

    document.getElementById('ce-preview-close').addEventListener('click', () => {
      document.getElementById('ce-preview-panel').style.display = 'none';
    });

    // Save
    document.getElementById('ce-save-btn').addEventListener('click', async () => {
      saveCurrentTabToState();
      
      const filesToSave = [
        { filePath: st.files.html.path, content: st.files.html.content }
      ];
      if (st.files.css) {
        st.files.css.forEach(f => filesToSave.push({ filePath: f.path, content: f.content }));
      }
      if (st.files.js) {
        st.files.js.forEach(f => filesToSave.push({ filePath: f.path, content: f.content }));
      }

      document.getElementById('ce-status').textContent = 'Saving to disk...';

      let successCount = 0;
      let failCount = 0;
      let lastError = '';

      for (const file of filesToSave) {
        try {
          const res = await fetch('http://localhost:3000/api/save-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: file.filePath, content: file.content })
          });
          if (res.ok) {
            successCount++;
          } else {
            failCount++;
            const errData = await res.json();
            lastError = errData.error || 'Server error';
          }
        } catch (e) {
          failCount++;
          lastError = e.message;
        }
      }

      // Keep localStorage and history as backup cache
      localStorage.setItem(codeStorageKey(st.pageId, 'html'), st.files.html.content);
      st.files.css.forEach((f, i) => localStorage.setItem(codeStorageKey(st.pageId, 'css', i), f.content));
      st.files.js.forEach((f, i) => localStorage.setItem(codeStorageKey(st.pageId, 'js', i), f.content));

      try {
        const histKey = 'sedco_cms_save_history';
        const hist = JSON.parse(localStorage.getItem(histKey) || '[]');
        hist.unshift({
          id: 'sh_' + Date.now(),
          page: st.pageId,
          pageName: document.querySelector('.ce-toolbar span[style]')?.textContent?.replace('Code: ', '') || st.pageId,
          timestamp: new Date().toISOString(),
          type: 'code',
          snapshot: { html: st.files.html.content }
        });
        if (hist.length > 100) hist.length = 100;
        localStorage.setItem(histKey, JSON.stringify(hist));
      } catch(e) {}

      st.modified = {};
      if (failCount === 0) {
        document.getElementById('ce-status').textContent = 'Saved to disk ✓';
        alert('All code changes successfully saved directly to workspace files!');
      } else {
        document.getElementById('ce-status').textContent = 'Saved locally only';
        alert(`Saved locally. Failed to write ${failCount} files to disk (Server offline). Error: ${lastError}`);
      }
      setTimeout(() => { document.getElementById('ce-status').textContent = 'Ready'; }, 3000);
    });
  }

  function downloadModifiedFiles() {
    const st = codeEditorState;
    const files = [];
    files.push({ name: st.files.html.path, content: st.files.html.content });
    st.files.css.forEach(f => files.push({ name: f.path, content: f.content }));
    st.files.js.forEach(f => files.push({ name: f.path, content: f.content }));
    files.forEach(f => {
      const blob = new Blob([f.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name.split('/').pop();
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  GLOBE MANAGER VIEW
  // ═══════════════════════════════════════════════════════════
  function getGlobeLocations() {
    try {
      const raw = localStorage.getItem('sedco_cms_globe');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch(e) {}
    // Return defaults
    return [
      { id: 'loc_hq_egypt', name: 'Egypt (HQ)', lat: 30.0444, lng: 31.2357, type: 'hq' },
      { id: 'loc_prod_ramadan', name: '10th of Ramadan', lat: 30.30, lng: 31.75, type: 'production' },
      { id: 'loc_prod_sa', name: 'Saudi Arabia', lat: 24.71, lng: 46.68, type: 'production' },
      { id: 'loc_prod_uae', name: 'UAE', lat: 25.20, lng: 55.27, type: 'production' },
      { id: 'loc_prod_turkey', name: 'Turkey', lat: 41.01, lng: 28.98, type: 'production' },
      { id: 'loc_prod_germany', name: 'Germany', lat: 52.52, lng: 13.41, type: 'production' },
      { id: 'loc_prod_ethiopia', name: 'Ethiopia', lat: 9.03, lng: 38.75, type: 'production' },
      { id: 'loc_prod_algeria', name: 'Algeria', lat: 36.75, lng: 3.06, type: 'production' },
      { id: 'loc_prod_zambia', name: 'Zambia', lat: -15.39, lng: 28.32, type: 'production' },
      { id: 'loc_ops_morocco', name: 'Morocco', lat: 33.57, lng: -7.59, type: 'operation' },
      { id: 'loc_ops_kuwait', name: 'Kuwait', lat: 29.38, lng: 47.98, type: 'operation' },
      { id: 'loc_ops_qatar', name: 'Qatar', lat: 25.29, lng: 51.53, type: 'operation' },
      { id: 'loc_ops_bahrain', name: 'Bahrain', lat: 26.07, lng: 50.56, type: 'operation' },
      { id: 'loc_ops_iraq', name: 'Iraq', lat: 33.32, lng: 44.37, type: 'operation' },
      { id: 'loc_ops_jordan', name: 'Jordan', lat: 31.95, lng: 35.93, type: 'operation' },
      { id: 'loc_ops_kenya', name: 'Kenya', lat: -1.29, lng: 36.82, type: 'operation' },
      { id: 'loc_ops_nigeria', name: 'Nigeria', lat: 6.52, lng: 3.38, type: 'operation' },
      { id: 'loc_ops_sudan', name: 'Sudan', lat: 15.50, lng: 32.56, type: 'operation' },
      { id: 'loc_ops_pakistan', name: 'Pakistan', lat: 24.86, lng: 67.00, type: 'operation' },
      { id: 'loc_exp_uk', name: 'UK', lat: 51.51, lng: -0.13, type: 'export' },
      { id: 'loc_exp_spain', name: 'Spain', lat: 40.42, lng: -3.70, type: 'export' },
      { id: 'loc_exp_italy', name: 'Italy', lat: 41.90, lng: 12.50, type: 'export' },
      { id: 'loc_exp_india', name: 'India', lat: 19.08, lng: 72.88, type: 'export' },
      { id: 'loc_exp_usa', name: 'USA', lat: 40.71, lng: -74.00, type: 'export' },
      { id: 'loc_exp_brazil', name: 'Brazil', lat: -23.55, lng: -46.63, type: 'export' },
      { id: 'loc_exp_france', name: 'France', lat: 48.85, lng: 2.35, type: 'export' },
      { id: 'loc_exp_japan', name: 'Japan', lat: 35.67, lng: 139.65, type: 'export' },
    ];
  }

  function saveGlobeLocations(locations) {
    localStorage.setItem('sedco_cms_globe', JSON.stringify(locations));
  }

  function globeTypeLabel(type) {
    const labels = { hq: 'Headquarters', production: 'Production', operation: 'Operations', export: 'Export' };
    return labels[type] || type;
  }
  function globeTypeBadge(type) {
    const colors = { hq: '#FFD700', production: '#cc1b1b', operation: '#4A90D9', export: '#999999' };
    return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${colors[type] || '#666'}22;color:${colors[type] || '#666'};">${globeTypeLabel(type)}</span>`;
  }

  async function renderGlobeManager() {
    const locations = getGlobeLocations();
    const counts = { hq: 0, production: 0, operation: 0, export: 0 };
    locations.forEach(l => { if (counts[l.type] !== undefined) counts[l.type]++; });

    const html = `
      <div class="metrics-grid" style="margin-bottom:1.5rem;">
        <div class="metric-card">
          <div class="metric-card-header">Headquarters <div class="metric-card-icon" style="background:#FFD70022;color:#FFD700;"><i data-lucide="map-pin"></i></div></div>
          <div class="metric-card-value">${counts.hq}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card-header">Production <div class="metric-card-icon" style="background:#cc1b1b22;color:#cc1b1b;"><i data-lucide="factory"></i></div></div>
          <div class="metric-card-value">${counts.production}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card-header">Operations <div class="metric-card-icon" style="background:#4A90D922;color:#4A90D9;"><i data-lucide="building-2"></i></div></div>
          <div class="metric-card-value">${counts.operation}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card-header">Export <div class="metric-card-icon" style="background:#99999922;color:#999999;"><i data-lucide="truck"></i></div></div>
          <div class="metric-card-value">${counts.export}</div>
        </div>
      </div>

      <div class="data-table-container">
        <div class="data-table-header">
          <h3>Globe Locations (${locations.length})</h3>
          <button class="action-btn btn-small-primary" id="addLocationBtn">
            <i data-lucide="plus" style="width:14px;height:14px;display:inline-block;vertical-align:middle;"></i> Add Location
          </button>
        </div>
        <table class="data-table">
          <thead>
            <tr><th>Name</th><th>Latitude</th><th>Longitude</th><th>Type</th><th>Actions</th></tr>
          </thead>
          <tbody>
            ${locations.length === 0 ? '<tr><td colspan="5" style="text-align:center;">No locations configured</td></tr>' : ''}
            ${locations.map((loc, i) => `
              <tr>
                <td style="font-weight:500;">${loc.name}</td>
                <td style="font-family:monospace;font-size:13px;">${loc.lat}</td>
                <td style="font-family:monospace;font-size:13px;">${loc.lng}</td>
                <td>${globeTypeBadge(loc.type)}</td>
                <td style="display:flex;gap:6px;">
                  <button class="action-btn btn-small-outline" onclick="window._editLocation(${i})">Edit</button>
                  <button class="action-btn btn-small-danger" onclick="window._deleteLocation(${i})">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    return {
      title: 'Globe Manager',
      html,
      afterRender: () => {
        document.getElementById('addLocationBtn').addEventListener('click', () => window._openLocationModal());
      }
    };
  }

  // ─── COUNTRY DATA for Globe combobox ───
  const COUNTRY_LIST = [
    {name:'Afghanistan',lat:34.53,lng:69.17},{name:'Algeria',lat:36.75,lng:3.06},{name:'Argentina',lat:-34.60,lng:-58.38},
    {name:'Australia',lat:-33.87,lng:151.21},{name:'Bahrain',lat:26.07,lng:50.56},{name:'Brazil',lat:-23.55,lng:-46.63},
    {name:'Canada',lat:45.42,lng:-75.70},{name:'China',lat:39.90,lng:116.41},{name:'Egypt',lat:30.04,lng:31.24},
    {name:'Ethiopia',lat:9.03,lng:38.75},{name:'France',lat:48.85,lng:2.35},{name:'Germany',lat:52.52,lng:13.41},
    {name:'India',lat:28.61,lng:77.21},{name:'Indonesia',lat:-6.21,lng:106.85},{name:'Iraq',lat:33.32,lng:44.37},
    {name:'Italy',lat:41.90,lng:12.50},{name:'Japan',lat:35.67,lng:139.65},{name:'Jordan',lat:31.95,lng:35.93},
    {name:'Kenya',lat:-1.29,lng:36.82},{name:'Kuwait',lat:29.38,lng:47.98},{name:'Malaysia',lat:3.14,lng:101.69},
    {name:'Mexico',lat:19.43,lng:-99.13},{name:'Morocco',lat:33.57,lng:-7.59},{name:'Netherlands',lat:52.37,lng:4.90},
    {name:'Nigeria',lat:6.52,lng:3.38},{name:'Norway',lat:59.91,lng:10.75},{name:'Oman',lat:23.59,lng:58.38},
    {name:'Pakistan',lat:33.69,lng:73.04},{name:'Qatar',lat:25.29,lng:51.53},{name:'Russia',lat:55.75,lng:37.62},
    {name:'Saudi Arabia',lat:24.71,lng:46.68},{name:'Singapore',lat:1.35,lng:103.82},{name:'South Africa',lat:-26.20,lng:28.05},
    {name:'South Korea',lat:37.56,lng:126.98},{name:'Spain',lat:40.42,lng:-3.70},{name:'Sudan',lat:15.50,lng:32.56},
    {name:'Sweden',lat:59.33,lng:18.07},{name:'Switzerland',lat:46.95,lng:7.45},{name:'Thailand',lat:13.76,lng:100.50},
    {name:'Turkey',lat:41.01,lng:28.98},{name:'UAE',lat:25.20,lng:55.27},{name:'UK',lat:51.51,lng:-0.13},
    {name:'USA',lat:40.71,lng:-74.00},{name:'Zambia',lat:-15.39,lng:28.32},{name:'Zimbabwe',lat:-17.83,lng:31.05},
    {name:'10th of Ramadan',lat:30.30,lng:31.75},{name:'Egypt (HQ)',lat:30.04,lng:31.24}
  ];

  function buildCountryCombobox(currentName) {
    return `<div class="combobox-wrap" id="country-combobox">
        <input type="text" class="form-control combobox-input" id="loc-name-input" value="${currentName}" placeholder="Type to search countries..." autocomplete="off" />
        <div class="combobox-dropdown" id="country-dropdown"></div>
      </div>`;
  }

  function initCountryCombobox() {
    const input = document.getElementById('loc-name-input');
    const dropdown = document.getElementById('country-dropdown');
    const latInput = document.querySelector('input[name="lat"]');
    const lngInput = document.querySelector('input[name="lng"]');
    if (!input || !dropdown) return;
    let highlightIdx = -1, filtered = [];
    function render(items) {
      filtered = items; highlightIdx = -1;
      if (!items.length) { dropdown.style.display = 'none'; return; }
      dropdown.innerHTML = items.slice(0, 20).map((c, i) =>
        `<div class="combobox-item" data-idx="${i}">${c.name} <span style="font-size:11px;color:var(--admin-text-muted);margin-left:auto;">${c.lat.toFixed(2)}, ${c.lng.toFixed(2)}</span></div>`
      ).join('');
      dropdown.style.display = 'block';
    }
    function selectItem(idx) {
      if (idx < 0 || idx >= filtered.length) return;
      const c = filtered[idx];
      input.value = c.name;
      if (latInput) latInput.value = c.lat;
      if (lngInput) lngInput.value = c.lng;
      dropdown.style.display = 'none';
    }
    input.addEventListener('input', () => { const q = input.value.toLowerCase().trim(); if (!q) { dropdown.style.display='none'; return; } render(COUNTRY_LIST.filter(c => c.name.toLowerCase().includes(q))); });
    input.addEventListener('focus', () => { const q = input.value.toLowerCase().trim(); if (q) render(COUNTRY_LIST.filter(c => c.name.toLowerCase().includes(q))); });
    input.addEventListener('keydown', e => {
      const items = dropdown.querySelectorAll('.combobox-item');
      if (e.key === 'ArrowDown') { e.preventDefault(); highlightIdx = Math.min(highlightIdx + 1, items.length - 1); items.forEach((el, i) => el.classList.toggle('highlighted', i === highlightIdx)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); highlightIdx = Math.max(highlightIdx - 1, 0); items.forEach((el, i) => el.classList.toggle('highlighted', i === highlightIdx)); }
      else if (e.key === 'Enter' && highlightIdx >= 0) { e.preventDefault(); selectItem(highlightIdx); }
      else if (e.key === 'Escape') { dropdown.style.display = 'none'; }
    });
    dropdown.addEventListener('click', e => { const item = e.target.closest('.combobox-item'); if (item) selectItem(parseInt(item.dataset.idx)); });
    document.addEventListener('click', e => { if (!e.target.closest('#country-combobox')) dropdown.style.display = 'none'; });
  }

  window._openLocationModal = (editIndex = null) => {
    const locations = getGlobeLocations();
    const loc = editIndex !== null ? locations[editIndex] : { name: '', lat: '', lng: '', type: 'export' };
    const isEdit = editIndex !== null;

    openModal(isEdit ? 'Edit Location' : 'Add Location', `
      <form id="locationForm">
        <div class="form-group">
          <label>Location Name</label>
          ${buildCountryCombobox(loc.name)}
        </div>
        <div class="form-group">
          <label>Country</label>
          <input type="text" class="form-control" name="country" value="${loc.country || ''}" placeholder="e.g. Egypt">
        </div>
        <div class="form-group">
          <label>Address</label>
          <input type="text" class="form-control" name="address" value="${loc.address || ''}" placeholder="e.g. Cairo, 5th Settlement">
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea class="form-control" name="description" rows="2" placeholder="Description of this location...">${loc.description || ''}</textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
          <div class="form-group">
            <label>Latitude</label>
            <input type="number" step="any" class="form-control" name="lat" value="${loc.lat}" required placeholder="e.g. 52.52">
          </div>
          <div class="form-group">
            <label>Longitude</label>
            <input type="number" step="any" class="form-control" name="lng" value="${loc.lng}" required placeholder="e.g. 13.41">
          </div>
        </div>
        <div class="form-group">
          <label>Type</label>
          <select class="form-control" name="type">
            <option value="hq" ${loc.type==='hq'?'selected':''}>Headquarters</option>
            <option value="production" ${loc.type==='production'?'selected':''}>Production Facility</option>
            <option value="operation" ${loc.type==='operation'?'selected':''}>Operations</option>
            <option value="export" ${loc.type==='export'?'selected':''}>Export</option>
          </select>
        </div>
        <div class="modal-footer">
          <button type="button" class="action-btn btn-small-outline" onclick="document.getElementById('dynamicModal').remove()">Cancel</button>
          <button type="submit" class="action-btn btn-small-primary">${isEdit ? 'Update' : 'Add'} Location</button>
        </div>
      </form>
    `, { contentClass: 'modal-wide', bodyClass: 'modal-body-visible' });

    setTimeout(() => initCountryCombobox(), 50);

    document.getElementById('locationForm').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
            const entry = {
        id: isEdit ? (loc.id || 'loc_' + Date.now()) : 'loc_' + Date.now(),
        name: document.getElementById('loc-name-input').value.trim(),
        country: (fd.get('country') || '').trim(),
        address: (fd.get('address') || '').trim(),
        description: (fd.get('description') || '').trim(),
        lat: parseFloat(fd.get('lat')),
        lng: parseFloat(fd.get('lng')),
        type: fd.get('type')
      };
      const locs = getGlobeLocations();
      if (isEdit) locs[editIndex] = entry;
      else locs.push(entry);
      saveGlobeLocations(locs);
      document.getElementById('dynamicModal').remove();
      loadView('globe');
    });
  };

  window._editLocation = (i) => window._openLocationModal(i);

  window._deleteLocation = (i) => {
    if (!confirm('Delete this location?')) return;
    const locs = getGlobeLocations();
    locs.splice(i, 1);
    saveGlobeLocations(locs);
    loadView('globe');
  };


  // ═══════════════════════════════════════════════════════════
  //  VERSION HISTORY VIEW
  // ═══════════════════════════════════════════════════════════
  const HISTORY_KEY = 'sedco_cms_history';
  const AUTO_HISTORY_KEY = 'sedco_cms_save_history';
  const CMS_KEYS = ['sedco_cms_home', 'sedco_cms_about', 'sedco_cms_solutions', 'sedco_cms_contact', 'sedco_cms_shared', 'sedco_cms_marketplace'];

  function getHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function saveHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function createSnapshot() {
    const snapshot = {};
    CMS_KEYS.forEach(key => {
      const raw = localStorage.getItem(key);
      if (raw) snapshot[key] = raw;
    });
    // Also save globe data
    const globeRaw = localStorage.getItem('sedco_cms_globe');
    if (globeRaw) snapshot['sedco_cms_globe'] = globeRaw;
    return snapshot;
  }

  function restoreSnapshot(snapshot) {
    // Clear existing CMS data
    CMS_KEYS.forEach(key => localStorage.removeItem(key));
    localStorage.removeItem('sedco_cms_globe');
    // Restore from snapshot
    Object.keys(snapshot).forEach(key => {
      localStorage.setItem(key, snapshot[key]);
    });
  }

  window._saveVersion = () => {
    openModal('Save Version', `
      <form id="saveVersionForm">
        <div class="form-group">
          <label>Version Name / Title</label>
          <input type="text" class="form-control" name="title" required placeholder="e.g. Updated hero section">
        </div>
        <div class="form-group">
          <label>Description of Changes</label>
          <textarea class="form-control" name="description" rows="3" placeholder="What was changed in this version?"></textarea>
        </div>
        <div style="padding:12px;background:var(--brand-gray-light);border-radius:8px;margin-bottom:1rem;">
          <p style="margin:0;font-size:13px;color:var(--admin-text-muted);"><i data-lucide="info" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> This will save a snapshot of ALL editable content: pages, shared layout, and globe locations.</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="action-btn btn-small-outline" onclick="document.getElementById('dynamicModal').remove()">Cancel</button>
          <button type="submit" class="action-btn btn-small-primary">Save Version</button>
        </div>
      </form>
    `);
    if (window.lucide) window.lucide.createIcons();

    document.getElementById('saveVersionForm').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const history = getHistory();
      history.unshift({
        id: 'v_' + Date.now(),
        title: fd.get('title'),
        description: fd.get('description') || '',
        timestamp: new Date().toISOString(),
        snapshot: createSnapshot()
      });
      // Keep max 50 versions
      if (history.length > 50) history.length = 50;
      saveHistory(history);
      document.getElementById('dynamicModal').remove();
      loadView('history');
    });
  };

  window._restoreVersion = (id) => {
    if (!confirm('Restore this version? This will overwrite ALL current editable content (pages, shared layout, globe). Your current state will be lost unless you save it first.')) return;
    const history = getHistory();
    const version = history.find(v => v.id === id);
    if (!version) return alert('Version not found.');
    restoreSnapshot(version.snapshot);
    
    // Sync restored pages back to the server persistent JSON files on disk
    const promises = [];
    Object.keys(version.snapshot).forEach(key => {
      if (key.startsWith('sedco_cms_')) {
        const pageKey = key.replace('sedco_cms_', '');
        try {
          const payload = JSON.parse(version.snapshot[key]);
          promises.push(
            fetch('http://localhost:3000/api/save-visual', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pageKey, payload })
            })
          );
        } catch(e) {}
      }
    });

    Promise.all(promises)
      .then(() => {
        alert('Version "' + version.title + '" has been successfully restored to disk and browser cache.');
        loadView('history');
      })
      .catch(err => {
        console.error('Failed to sync restored version to disk:', err);
        alert('Version "' + version.title + '" has been restored to browser cache, but could not sync completely to disk.');
        loadView('history');
      });
  };

  window._deleteVersion = (id) => {
    if (!confirm('Delete this saved version permanently?')) return;
    const history = getHistory().filter(v => v.id !== id);
    saveHistory(history);
    loadView('history');
  };

  async function renderHistory() {
    const manualHistory = getHistory();
    const autoHistory = (function() {
      try { return JSON.parse(localStorage.getItem(AUTO_HISTORY_KEY) || '[]'); } catch(e) { return []; }
    })();

    const combined = [
      ...manualHistory.map(v => ({ ...v, _source: 'manual' })),
      ...autoHistory.map(v => ({ ...v, _source: 'auto' }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const rows = combined.map(v => {
      const date = new Date(v.timestamp);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const pageName = v.pageName || v.title || v.page || 'All Pages';
      const saveType = v.type || 'snapshot';
      const typeBadge = saveType === 'visual'
        ? '<span class="status-badge" style="background:#DBEAFE;color:#1D4ED8;">Visual</span>'
        : saveType === 'code'
          ? '<span class="status-badge" style="background:#FEF3C7;color:#92400E;">Code</span>'
          : '<span class="status-badge" style="background:#D1FAE5;color:#065F46;">Snapshot</span>';
      const src = v._source === 'manual' ? 'Manual' : 'Auto';
      return '<tr>'
        + '<td style="font-weight:500;">' + pageName + '</td>'
        + '<td style="font-size:13px;">' + dateStr + '<br><span style="color:var(--admin-text-muted);">' + timeStr + '</span></td>'
        + '<td>' + typeBadge + '</td>'
        + '<td style="font-size:11px;color:var(--admin-text-muted);">' + src + '</td>'
        + '<td style="display:flex;gap:6px;">'
        + '<button class="action-btn btn-small-primary" onclick="window._restoreHistoryEntry(\'' + v.id + '\', \'' + v._source + '\')">Restore</button>'
        + '<button class="action-btn btn-small-danger" onclick="window._deleteHistoryEntry(\'' + v.id + '\', \'' + v._source + '\')">Delete</button>'
        + '</td></tr>';
    }).join('');

    const html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
        <div>
          <h3 style="margin:0;font-size:18px;">Save History</h3>
          <p style="margin:4px 0 0;font-size:13px;color:var(--admin-text-muted);">Automatic saves from visual/code editors, plus manual version snapshots.</p>
        </div>
        <button class="action-btn btn-small-primary" onclick="window._saveVersion()">
          <i data-lucide="save" style="width:14px;height:14px;display:inline-block;vertical-align:middle;"></i> Save Current Version
        </button>
      </div>
      ${combined.length === 0 ? '<div class="data-table-container" style="min-height:300px;display:flex;align-items:center;justify-content:center;"><div style="text-align:center;color:var(--admin-text-muted);"><i data-lucide="archive" style="width:48px;height:48px;margin-bottom:16px;opacity:0.4;"></i><p style="margin:0;font-size:15px;">No save history yet.</p></div></div>'
      : '<div class="data-table-container"><table class="data-table"><thead><tr><th>Page</th><th>Timestamp</th><th>Type</th><th>Source</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table></div>'}
    `;

    return { title: 'Save History', html };
  }

  window._restoreHistoryEntry = (id, source) => {
    if (source === 'manual') {
      window._restoreVersion(id);
    } else {
      const autoHist = (function() { try { return JSON.parse(localStorage.getItem(AUTO_HISTORY_KEY) || '[]'); } catch(e) { return []; } })();
      const entry = autoHist.find(v => v.id === id);
      if (!entry) return alert('Entry not found.');
      if (!confirm('Restore this auto-save for "' + (entry.pageName || entry.page) + '"?')) return;
      localStorage.setItem('sedco_cms_' + entry.page, JSON.stringify(entry.snapshot));
      
      // Save snapshot back to server JSON file on disk
      fetch('http://localhost:3000/api/save-visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageKey: entry.page, payload: entry.snapshot })
      })
      .then(res => res.json())
      .then(result => {
        alert('Restored successfully to disk! Refresh the page to see changes.');
        loadView('history');
      })
      .catch(err => {
        console.error('Failed to restore to server:', err);
        alert('Restored locally in browser (local server offline).');
        loadView('history');
      });
    }
  };

  window._deleteHistoryEntry = (id, source) => {
    if (!confirm('Delete this history entry?')) return;
    if (source === 'manual') {
      window._deleteVersion(id);
    } else {
      try {
        const hist = JSON.parse(localStorage.getItem(AUTO_HISTORY_KEY) || '[]').filter(v => v.id !== id);
        localStorage.setItem(AUTO_HISTORY_KEY, JSON.stringify(hist));
      } catch(e) {}
      loadView('history');
    }
  };


  // --- LOGOUT ---
  UI.logoutBtn.addEventListener('click', async () => {
    await logAction('logout', 'session', null, 'Admin logged out');
    await supabase.auth.signOut();
    window.location.href = 'index.html';
  });

  // ═══════════════════════════════════════════════════════════
  //  CERTIFICATE BADGES CRUD MANAGER (ABOUT PAGE)
  // ═══════════════════════════════════════════════════════════

  window.openCertificatesManager = async () => {
    // 1. Fetch current visual configuration for the about page
    let data = null;
    try {
      const resp = await fetch('http://localhost:3000/api/load-visual?page=about', { cache: 'no-store' });
      if (resp.ok) {
        data = await resp.json();
      }
    } catch (e) {
      console.warn("Failed to load certificates from server", e);
    }
    
    if (!data) {
      try {
        const raw = localStorage.getItem('sedco_cms_about');
        if (raw) data = JSON.parse(raw);
      } catch(e) {}
    }

    if (!data) data = {};
    if (!data.certificates) data.certificates = [];

    // Helper to render the table list inside the modal
    function renderCertsTable() {
      const listContainer = document.getElementById('certs-list-container');
      if (!listContainer) return;

      if (data.certificates.length === 0) {
        listContainer.innerHTML = `
          <div style="text-align:center; padding:30px 20px; color:var(--admin-text-muted);">
            No certificates found. Click "Add Certificate" to create one.
          </div>
        `;
        return;
      }

      listContainer.innerHTML = `
        <table class="data-table" style="width:100%; border-collapse:collapse; margin-top:10px;">
          <thead>
            <tr>
              <th style="text-align:left; padding:8px; border-bottom:1px solid var(--admin-border);">Preview</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid var(--admin-border);">Title / Text</th>
              <th style="text-align:right; padding:8px; border-bottom:1px solid var(--admin-border);">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${data.certificates.map((c, index) => `
              <tr style="border-bottom:1px solid rgba(0,0,0,0.05);">
                <td style="padding:8px; width:80px;">
                  <img src="${c.img || 'assets/images/placeholder-certificate.png'}" style="width:50px; height:35px; object-fit:contain; border-radius:4px; background:#f4f4f4; border:1px solid #ddd;">
                </td>
                <td style="padding:8px; font-weight:500; color:var(--admin-text-main);">${c.text}</td>
                <td style="padding:8px; text-align:right; width:150px;">
                  <button class="action-btn btn-small-outline" onclick="window.editCertificateInline(${index})" style="margin-right:4px;">Edit</button>
                  <button class="action-btn btn-small-danger" onclick="window.deleteCertificateInline(${index})">Remove</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    // Define modal buttons and setup
    openModal('Manage Certificates', `
      <div style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:13px; color:var(--admin-text-muted);">Add, edit, delete and upload certificate badge images.</span>
        <button class="action-btn btn-small-primary" id="add-cert-item-btn">
          <i data-lucide="plus" style="width:13px;height:13px;display:inline-block;vertical-align:middle;"></i> Add Certificate
        </button>
      </div>
      <div id="certs-list-container" style="max-height:400px; overflow-y:auto; border:1px solid var(--admin-border); border-radius:8px; padding:10px; background:#fff;"></div>
      <div class="modal-footer" style="margin-top:20px; border-top:1px solid var(--admin-border); padding-top:15px; display:flex; justify-content:flex-end; gap:8px;">
        <button type="button" class="action-btn btn-small-outline" onclick="document.getElementById('dynamicModal').remove()">Close</button>
        <button type="button" class="action-btn btn-small-primary" id="save-certs-to-disk-btn">Save Changes</button>
      </div>
    `);

    if (window.lucide) window.lucide.createIcons();
    renderCertsTable();

    // Add Cert Action
    document.getElementById('add-cert-item-btn').addEventListener('click', () => {
      window.openCertFormModal(null, (newCert) => {
        data.certificates.push(newCert);
        renderCertsTable();
      });
    });

    // Save changes to disk (visual payload for about)
    document.getElementById('save-certs-to-disk-btn').addEventListener('click', async () => {
      const btn = document.getElementById('save-certs-to-disk-btn');
      btn.disabled = true;
      btn.textContent = 'Saving...';

      // Keep existing payload structure and just update certificates
      const payload = {
        ...data,
        _editor: true,
        certificates: data.certificates,
        lastSaved: new Date().toISOString()
      };

      try {
        const resp = await fetch('http://localhost:3000/api/save-visual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageKey: 'about', payload })
        });
        if (resp.ok) {
          localStorage.setItem('sedco_cms_about', JSON.stringify(payload));
          alert('Certificates saved successfully!');
          document.getElementById('dynamicModal').remove();
        } else {
          const errData = await resp.json();
          alert('Failed to save certificates: ' + (errData.error || 'Server error'));
        }
      } catch (e) {
        // Fallback save to localStorage
        localStorage.setItem('sedco_cms_about', JSON.stringify(payload));
        alert('Saved to local storage only (persistent server offline).');
        document.getElementById('dynamicModal').remove();
      }
    });

    // Inline edit handler
    window.editCertificateInline = (index) => {
      const cert = data.certificates[index];
      window.openCertFormModal(cert, (updatedCert) => {
        data.certificates[index] = updatedCert;
        renderCertsTable();
      });
    };

    // Inline delete handler
    window.deleteCertificateInline = (index) => {
      if (confirm(`Remove certificate "${data.certificates[index].text}"?`)) {
        data.certificates.splice(index, 1);
        renderCertsTable();
      }
    };
  };

  // Helper to open Add/Edit form for a single Certificate
  window.openCertFormModal = (cert = null, callback) => {
    let imgData = cert ? (cert.img || '') : '';
    
    // Create an overlay modal for the form so it sits above the manager modal
    const subModal = document.createElement('div');
    subModal.id = 'certFormModal';
    subModal.className = 'modal-overlay active';
    subModal.style.zIndex = '11000'; // Make sure it is on top of the other modal
    subModal.innerHTML = `
      <div class="modal-content" style="max-width:400px; margin-top:80px;">
        <div class="modal-header">
          <h3>${cert ? 'Edit Certificate' : 'Add Certificate'}</h3>
          <button class="close-modal" id="close-cert-form-btn">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <form id="certItemForm">
            <div class="form-group" style="margin-bottom:15px;">
              <label style="display:block; font-weight:600; margin-bottom:5px; font-size:13px;">Certificate Name / Text</label>
              <input type="text" class="form-control" id="cert-text-input" value="${cert ? cert.text : ''}" required placeholder="e.g. ISO 9001:2015" style="width:100%; box-sizing:border-box;">
            </div>
            <div class="form-group" style="margin-bottom:15px;">
              <label style="display:block; font-weight:600; margin-bottom:5px; font-size:13px;">Certificate Image</label>
              <div style="border: 2px dashed var(--admin-border); padding: 20px; text-align: center; border-radius: 8px; cursor: pointer; background: var(--brand-off-white);" id="certImgDropZone">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 8px; color:var(--brand-gray-medium);"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                <p style="font-size:13px; margin:0; color:var(--admin-text-main);">Click or Drag & Drop Certificate Image</p>
                <input type="file" id="certImgInput" style="display:none;" accept="image/*">
              </div>
              <div id="certImgPreview" style="margin-top:10px; display:flex; align-items:center; gap:10px;">
                <img id="cert-img-prev-tag" src="${imgData || 'assets/images/placeholder-certificate.png'}" style="width:60px; height:45px; object-fit:contain; border:1px solid #ccc; border-radius:4px; background:#fff;">
                <span id="cert-img-status" style="font-size:12px; color:var(--admin-text-muted);">${imgData ? 'Image Loaded' : 'No image assigned'}</span>
              </div>
            </div>
            <div class="modal-footer" style="margin-top:20px; border-top:1px solid var(--admin-border); padding-top:15px; display:flex; justify-content:flex-end; gap:8px;">
              <button type="button" class="action-btn btn-small-outline" id="cancel-cert-form-btn">Cancel</button>
              <button type="submit" class="action-btn btn-small-primary">Apply</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(subModal);

    // Setup event listeners
    const closeForm = () => subModal.remove();
    document.getElementById('close-cert-form-btn').addEventListener('click', closeForm);
    document.getElementById('cancel-cert-form-btn').addEventListener('click', closeForm);
    
    const dropZone = document.getElementById('certImgDropZone');
    const fileInput = document.getElementById('certImgInput');
    const imgPrev = document.getElementById('cert-img-prev-tag');
    const imgStatus = document.getElementById('cert-img-status');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--brand-red)'; });
    dropZone.addEventListener('dragleave', () => dropZone.style.borderColor = 'var(--admin-border)');
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault(); dropZone.style.borderColor = 'var(--admin-border)';
      if (e.dataTransfer.files.length) handleCertFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) handleCertFile(e.target.files[0]);
    });

    function handleCertFile(file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
      }
      imgStatus.textContent = 'Loading image...';
      imgStatus.style.color = '#f39c12';

      const reader = new FileReader();
      reader.onload = (ev) => {
        imgData = ev.target.result;
        imgPrev.src = imgData;
        imgStatus.textContent = 'Image loaded!';
        imgStatus.style.color = 'green';
      };
      reader.readAsDataURL(file);
    }

    document.getElementById('certItemForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = document.getElementById('cert-text-input').value.trim();
      if (!text) return alert('Name is required');
      
      callback({
        text,
        img: imgData
      });
      closeForm();
    });
  };

  init();
});
