document.addEventListener('DOMContentLoaded', async function() {
    const SUPABASE_URL = "https://nnwcwqasmdpbvotfepvy.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_llEtCRU2fkmNycPY4HwJ5w_XqnkQFQf";
    const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

    let currentMode = 'login';
    let pendingEmail = '';

    const authForms = document.getElementById('authForms');
    const verificationStep = document.getElementById('verificationStep');
    const loggedInState = document.getElementById('loggedInState');
    const loggedInEmail = document.getElementById('loggedInEmail');

    const authForm = document.getElementById('authForm');
    const nameField = document.getElementById('nameField');
    const confirmPasswordField = document.getElementById('confirmPasswordField');
    const submitBtn = document.getElementById('submitBtn');
    
    const errorMsg = document.getElementById('errorMsg');
    const successMsg = document.getElementById('successMsg');

    const verifyBtn = document.getElementById('verifyBtn');
    const otpCode = document.getElementById('otpCode');
    const logoutBtn = document.getElementById('logoutBtn');

    function showError(msg) {
        errorMsg.textContent = msg;
        errorMsg.classList.remove('hidden');
        successMsg.classList.add('hidden');
    }

    function showSuccess(msg) {
        successMsg.textContent = msg;
        successMsg.classList.remove('hidden');
        errorMsg.classList.add('hidden');
    }

    window.switchTab = function(mode) {
        currentMode = mode;
        errorMsg.classList.add('hidden');
        successMsg.classList.add('hidden');

        if (mode === 'signup') {
            document.getElementById('tabSignup').classList.add('active');
            document.getElementById('tabLogin').classList.remove('active');
            nameField.style.display = 'block';
            if (confirmPasswordField) confirmPasswordField.style.display = 'block';
            submitBtn.textContent = 'Create Account';
            document.getElementById('fullName').required = true;
            const cpInput = document.getElementById('confirmPassword');
            if (cpInput) cpInput.required = true;
        } else {
            document.getElementById('tabLogin').classList.add('active');
            document.getElementById('tabSignup').classList.remove('active');
            nameField.style.display = 'none';
            if (confirmPasswordField) confirmPasswordField.style.display = 'none';
            submitBtn.textContent = 'Log In';
            document.getElementById('fullName').required = false;
            const cpInput = document.getElementById('confirmPassword');
            if (cpInput) cpInput.required = false;
        }
        
        if (typeof turnstile !== 'undefined') {
            turnstile.reset();
        }
    };

    async function checkSession() {
        if (!supabaseClient) return;
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && session.user) {
            authForms.style.display = 'none';
            verificationStep.style.display = 'none';
            loggedInState.style.display = 'flex';
            loggedInEmail.textContent = session.user.email;
            
            // Check redirect
            function isSafeRedirect(url) {
                if (!url) return false;
                if (url.startsWith('//')) return false;
                if (url.startsWith('/') || /^[a-zA-Z0-9_.-]+\.html/.test(url)) {
                    if (!url.includes(':') && !url.includes('\\')) {
                        return true;
                    }
                }
                try {
                    const parsed = new URL(url, window.location.origin);
                    return parsed.hostname === window.location.hostname || parsed.hostname === 'elsewedysedco.netlify.app';
                } catch (e) {
                    return false;
                }
            }

            const urlParams = new URLSearchParams(window.location.search);
            const redirect = urlParams.get('redirect');
            if (redirect && isSafeRedirect(redirect)) {
                window.location.href = redirect;
            } else if (redirect) {
                console.warn('Blocked open redirect to:', redirect);
                window.location.href = 'index.html';
            }
        }
    }

    checkSession();

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(authForm);
        const email = formData.get('email');
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        const fullName = formData.get('fullName');
        const captchaToken = formData.get('cf-turnstile-response') || (typeof turnstile !== 'undefined' ? turnstile.getResponse() : '');

        if (currentMode === 'signup' && password !== confirmPassword) {
            showError('Passwords do not match.');
            return;
        }

        if (!captchaToken) {
            showError('Please complete the Captcha.');
            return;
        }

        submitBtn.disabled = true;
        const origText = submitBtn.textContent;
        submitBtn.textContent = 'Processing...';
        errorMsg.classList.add('hidden');

        try {
            if (currentMode === 'signup') {
                const { error } = await supabaseClient.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: { full_name: fullName },
                        captchaToken: captchaToken
                    }
                });
                
                if (error) throw error;
                
                pendingEmail = email;
                authForms.style.display = 'none';
                verificationStep.style.display = 'flex';

            } else {
                const { error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password,
                    options: {
                        captchaToken: captchaToken
                    }
                });

                if (error) throw error;
                
                await checkSession();
            }
        } catch (err) {
            showError(err.message || 'Authentication failed.');
            if (typeof turnstile !== 'undefined') turnstile.reset();
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = origText;
        }
    });

    verifyBtn.addEventListener('click', async () => {
        const code = otpCode.value.trim();
        if (!code || code.length !== 8) {
            showError('Please enter the 8-digit code.');
            return;
        }

        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';
        errorMsg.classList.add('hidden');

        try {
            const { data: { session }, error } = await supabaseClient.auth.verifyOtp({
                email: pendingEmail,
                token: code,
                type: 'signup'
            });

            if (error) throw error;
            
            await checkSession();
            
        } catch (err) {
            showError(err.message || 'Invalid code.');
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify Account';
        }
    });

    logoutBtn.addEventListener('click', async () => {
        logoutBtn.disabled = true;
        await supabaseClient.auth.signOut();
        window.location.reload();
    });
});
