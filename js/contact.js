document.addEventListener('DOMContentLoaded', function() {
  const SUPABASE_URL = "https://nnwcwqasmdpbvotfepvy.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_llEtCRU2fkmNycPY4HwJ5w_XqnkQFQf";

  const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  var form = document.getElementById('contact-form');
  var successMsg = document.querySelector('.success-msg');
  var submitBtn = document.getElementById('submitBtn');
  var submitBtnText = document.getElementById('submitBtnText');

  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const originalText = submitBtnText ? submitBtnText.textContent.trim() : "Send Message";
      
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.7";
      }
      if (submitBtnText) {
        submitBtnText.textContent = "Sending...";
      }

      const formData = new FormData(form);
      const captchaToken = formData.get('cf-turnstile-response') || (typeof turnstile !== 'undefined' ? turnstile.getResponse() : '');
      if (!captchaToken) {
          alert('Please complete the Captcha verification.');
          if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = "1"; }
          if (submitBtnText) submitBtnText.textContent = originalText;
          return;
      }

      const email = formData.get("email");
      const data = {
          name: formData.get("name"),
          email: email,
          company: formData.get("company") || null,
          phone: formData.get("phone") || null,
          subject: formData.get("subject"),
          message: formData.get("message")
      };

      try {
        if (supabaseClient) {
          const { error: otpError } = await supabaseClient.auth.signInWithOtp({ 
              email,
              options: {
                  captchaToken: captchaToken
              }
          });
          if (otpError) throw otpError;

          const modal = document.getElementById('contactOtpModal');
          const card = document.getElementById('contactOtpCard');
          modal.style.display = 'flex';
          setTimeout(() => { modal.style.opacity = '1'; card.style.transform = 'scale(1)'; }, 10);

          document.getElementById('contactOtpCancel').onclick = () => {
            modal.style.opacity = '0';
            card.style.transform = 'scale(0.95)';
            setTimeout(() => { modal.style.display = 'none'; }, 300);
            if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = "1"; }
            if (submitBtnText) submitBtnText.textContent = originalText;
          };

          document.getElementById('contactOtpVerify').onclick = async () => {
            const token = document.getElementById('contactOtpInput').value.trim();
            const errEl = document.getElementById('contactOtpError');
            if (token.length !== 8) {
                errEl.textContent = 'Please enter an 8-digit code';
                errEl.style.display = 'block';
                return;
            }
            errEl.style.display = 'none';
            const verifyBtn = document.getElementById('contactOtpVerify');
            verifyBtn.textContent = 'Verifying...';
            verifyBtn.disabled = true;

            const { error: verifyError } = await supabaseClient.auth.verifyOtp({ email, token, type: 'email' });
            if (verifyError) {
                errEl.textContent = verifyError.message;
                errEl.style.display = 'block';
                verifyBtn.textContent = 'Verify & Send';
                verifyBtn.disabled = false;
                return;
            }

            const { error } = await supabaseClient.from('contacts').insert([data]);
            if (error) {
                errEl.textContent = error.message;
                errEl.style.display = 'block';
                verifyBtn.textContent = 'Verify & Send';
                verifyBtn.disabled = false;
                return;
            }

            modal.style.opacity = '0';
            card.style.transform = 'scale(0.95)';
            setTimeout(() => { modal.style.display = 'none'; }, 300);

            if (submitBtnText) submitBtnText.textContent = "Message Sent ✓";
            if (submitBtn) submitBtn.style.backgroundColor = "#2ecc71";
            successMsg.classList.add('show');
            form.reset();
            if (typeof turnstile !== 'undefined') turnstile.reset();
            
            await supabaseClient.auth.signOut();
          };
          
          return;
        }

        if (submitBtnText) submitBtnText.textContent = "Message Sent ✓";
        if (submitBtn) submitBtn.style.backgroundColor = "#2ecc71"; // Success color
        
        successMsg.classList.add('show');
        form.reset();

        setTimeout(function() {
          successMsg.classList.remove('show');
          if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.style.backgroundColor = "";
              submitBtn.style.opacity = "1";
          }
          if (submitBtnText) submitBtnText.textContent = originalText;
        }, 4000);

      } catch (err) {
        // Silent error handling to prevent details leakage
        if (submitBtnText) submitBtnText.textContent = "Error, try again!";
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = "1";
          submitBtn.style.backgroundColor = "#e74c3c";
        }

        setTimeout(() => {
          if (submitBtnText) submitBtnText.textContent = originalText;
          if (submitBtn) submitBtn.style.backgroundColor = "";
        }, 3000);
      }
    });
  }
});
