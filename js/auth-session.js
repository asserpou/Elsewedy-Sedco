document.addEventListener('DOMContentLoaded', async function() {
    const navAuthBtn = document.getElementById('navAuthBtn');
    if (!navAuthBtn) return;

    const SUPABASE_URL = "https://nnwcwqasmdpbvotfepvy.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_llEtCRU2fkmNycPY4HwJ5w_XqnkQFQf";
    const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

    if (supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && session.user) {
            const userName = session.user.user_metadata?.full_name || 'My Account';
            const userEmail = session.user.email;
            
            const { data: roleData } = await supabaseClient
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id)
                .single();
            const isAdmin = roleData && roleData.role === 'admin';

            navAuthBtn.innerHTML = 'My Account <svg style="display:inline;margin-left:4px;vertical-align:middle;margin-top:-2px;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
            navAuthBtn.href = '#';

            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.display = 'inline-block';
            
            navAuthBtn.parentNode.insertBefore(wrapper, navAuthBtn);
            wrapper.appendChild(navAuthBtn);

            const dropdown = document.createElement('div');
            dropdown.style.cssText = 'position:absolute; top:100%; right:0; margin-top:16px; background:#fff; border-radius:12px; box-shadow:0 10px 40px rgba(0,0,0,0.12); width:240px; padding:16px; opacity:0; visibility:hidden; transition:all 0.2s cubic-bezier(0.16, 1, 0.3, 1); border:1px solid #f1f1f1; z-index:1000; transform:translateY(10px); cursor:default;';
            
            const adminButtonHtml = isAdmin ? `
                <a href="admin.html" style="text-decoration:none; display:flex; justify-content:center; align-items:center; gap:8px; width:100%; background:#f9fafb; color:#1a1a1a; border:1px solid #f1f1f1; padding:10px; border-radius:8px; font-weight:700; cursor:pointer; font-size:14px; transition:all 0.2s; margin-bottom:8px; font-family:'Inter', sans-serif;" onmouseover="this.style.background='#f3f4f6';this.style.borderColor='#e5e7eb'" onmouseout="this.style.background='#f9fafb';this.style.borderColor='#f1f1f1'">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                    Admin Dashboard
                </a>
            ` : '';

            dropdown.innerHTML = `
                <div style="border-bottom:1px solid #f1f1f1; padding-bottom:12px; margin-bottom:12px; text-align:left;">
                    <p style="font-weight:700; color:#1a1a1a; margin:0; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-family:'Outfit', sans-serif;">${userName}</p>
                    <p style="color:#666; margin:4px 0 0 0; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-family:'Inter', sans-serif;">${userEmail}</p>
                </div>
                ${adminButtonHtml}
                <button id="navLogoutBtn" style="width:100%; background:#f9fafb; color:#E32636; border:1px solid #f1f1f1; padding:10px; border-radius:8px; font-weight:700; cursor:pointer; font-size:14px; transition:all 0.2s; display:flex; justify-content:center; align-items:center; gap:8px; font-family:'Inter', sans-serif;" onmouseover="this.style.background='#fee2e2';this.style.borderColor='#fca5a5'" onmouseout="this.style.background='#f9fafb';this.style.borderColor='#f1f1f1'">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Sign Out
                </button>
            `;
            wrapper.appendChild(dropdown);

            navAuthBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const isOpen = dropdown.style.opacity === '1';
                dropdown.style.opacity = isOpen ? '0' : '1';
                dropdown.style.visibility = isOpen ? 'hidden' : 'visible';
                dropdown.style.transform = isOpen ? 'translateY(10px)' : 'translateY(0)';
            });

            document.addEventListener('click', (e) => {
                if (!wrapper.contains(e.target)) {
                    dropdown.style.opacity = '0';
                    dropdown.style.visibility = 'hidden';
                    dropdown.style.transform = 'translateY(10px)';
                }
            });

            dropdown.querySelector('#navLogoutBtn').addEventListener('click', async () => {
                await supabaseClient.auth.signOut();
                window.location.reload();
            });
        }
    }
});
