// ─── Shared showToast (used by auth modal; script.js also defines it on index page) ───
if (typeof window.showToast === 'undefined') {
  window.showToast = function (message, variant) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = message;
    t.classList.add('show');
    t.classList.toggle('toast-error', variant === 'error');
    setTimeout(() => t.classList.remove('show'), 3500);
  };
}

// ─── State ───────────────────────────────────────────────────────────────────
let _authIsSignUp = false;

// ─── Open / Close ─────────────────────────────────────────────────────────────
function openAuthModal() {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  modal.classList.add('open');
  setTimeout(() => document.getElementById('authEmail')?.focus(), 120);
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  modal.classList.remove('open');
  const err = document.getElementById('authError');
  if (err) err.textContent = '';
}

// Close on backdrop click
document.addEventListener('DOMContentLoaded', function () {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeAuthModal();
    });
  }
});

// Close on Escape
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    const modal = document.getElementById('authModal');
    if (modal && modal.classList.contains('open')) closeAuthModal();
  }
});

// ─── Mode switching (Sign In ↔ Sign Up) ──────────────────────────────────────
function _applyAuthMode(isSignUp) {
  const title    = document.getElementById('authModalTitle');
  const submit   = document.getElementById('authSubmit');
  const toggleTx = document.getElementById('authToggleText');
  const toggleBt = document.getElementById('authToggleBtn');
  const strength = document.getElementById('strengthContainer');
  const nameField = document.getElementById('nameField');

  if (title)    title.textContent    = isSignUp ? 'Create Account'        : 'Welcome Back';
  if (submit)   submit.textContent   = isSignUp ? 'Create Account'        : 'Sign In';
  if (toggleTx) toggleTx.textContent = isSignUp ? 'Already have an account?' : "Don't have an account?";
  if (toggleBt) toggleBt.textContent = isSignUp ? 'Sign In'              : 'Sign Up';
  if (strength) strength.style.display = isSignUp ? 'block' : 'none';
  if (nameField) nameField.style.display = isSignUp ? 'block' : 'none';

  const passInput = document.getElementById('authPassword');
  if (passInput) passInput.autocomplete = isSignUp ? 'new-password' : 'current-password';

  const err = document.getElementById('authError');
  if (err) err.textContent = '';
}

function toggleAuthMode() {
  _authIsSignUp = !_authIsSignUp;
  _applyAuthMode(_authIsSignUp);
}

// ─── Email validation ─────────────────────────────────────────────────────────
function _isValidEmail(email) {
  // Requires local@domain.tld format — must have at least one dot in domain
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// ─── Password strength ────────────────────────────────────────────────────────
function _getStrength(pw) {
  let score = 0;
  if (pw.length >= 8)               score++;
  if (pw.length >= 12)              score++;
  if (/[A-Z]/.test(pw))            score++;
  if (/[0-9]/.test(pw))            score++;
  if (/[^A-Za-z0-9]/.test(pw))    score++;

  if (score <= 1) return { label: 'Weak',        color: '#ef4444', pct: '20%' };
  if (score === 2) return { label: 'Fair',        color: '#f97316', pct: '40%' };
  if (score === 3) return { label: 'Good',        color: '#eab308', pct: '65%' };
  if (score === 4) return { label: 'Strong',      color: '#22c55e', pct: '85%' };
  return              { label: 'Very Strong', color: '#16a34a', pct: '100%' };
}

function _updateStrength(pw) {
  const bar   = document.getElementById('strengthBar');
  const label = document.getElementById('strengthLabel');
  if (!bar || !label) return;

  if (!pw) {
    bar.style.width = '0%';
    label.textContent = '';
    return;
  }
  const s = _getStrength(pw);
  bar.style.width      = s.pct;
  bar.style.background = s.color;
  label.textContent    = s.label;
  label.style.color    = s.color;
}

document.addEventListener('DOMContentLoaded', function () {
  const passInput = document.getElementById('authPassword');
  if (passInput) {
    passInput.addEventListener('input', function () {
      if (_authIsSignUp) _updateStrength(this.value);
    });
  }
});

// ─── Password visibility toggle ───────────────────────────────────────────────
function togglePasswordVisibility() {
  const input = document.getElementById('authPassword');
  const btn   = document.querySelector('.password-toggle');
  if (!input) return;
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';
  if (btn) btn.textContent = isText ? '👁' : '🙈';
}

// ─── Submit button loading state ──────────────────────────────────────────────
function _setLoading(loading) {
  const btn = document.getElementById('authSubmit');
  if (!btn) return;
  btn.disabled    = loading;
  btn.textContent = loading
    ? (_authIsSignUp ? 'Creating account…' : 'Signing in…')
    : (_authIsSignUp ? 'Create Account'    : 'Sign In');
}

// ─── Main submit handler ──────────────────────────────────────────────────────
async function handleAuthSubmit() {
  const emailInput = document.getElementById('authEmail');
  const passInput  = document.getElementById('authPassword');
  const nameInput  = document.getElementById('authName');
  const errEl      = document.getElementById('authError');

  const email       = (emailInput?.value || '').trim();
  const password    = passInput?.value || '';
  const displayName = (nameInput?.value || '').trim();

  if (errEl) errEl.textContent = '';

  // ── Validate email
  if (!email) {
    if (errEl) errEl.textContent = 'Please enter your email address.';
    emailInput?.focus();
    return;
  }
  if (!_isValidEmail(email)) {
    if (errEl) errEl.textContent = 'Please enter a valid email address (e.g. you@example.com).';
    emailInput?.focus();
    return;
  }

  // ── Validate password
  if (!password) {
    if (errEl) errEl.textContent = 'Please enter your password.';
    passInput?.focus();
    return;
  }
  if (_authIsSignUp && password.length < 8) {
    if (errEl) errEl.textContent = 'Password must be at least 8 characters.';
    passInput?.focus();
    return;
  }

  // Guard: if auth functions aren't available (Supabase failed to load), bail early
  if (typeof signUp !== 'function' || typeof signIn !== 'function') {
    if (errEl) errEl.textContent = 'Auth service failed to load. Please refresh the page.';
    return;
  }

  _setLoading(true);

  try {
    const result = _authIsSignUp
      ? await signUp(email, password, displayName || undefined)
      : await signIn(email, password);

    if (result.success) {
      if (_authIsSignUp) {
        // Send welcome email (best-effort, failure is silent)
        fetch('/api/send-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        }).catch(() => {});

        if (result.session) {
          // Email confirmation is OFF — user is immediately signed in
          closeAuthModal();
          updateAuthUI();
          window.location.href = '/onboarding';
        } else {
          // Email confirmation is ON — show check-your-email screen
          closeAuthModal();
          _showCheckEmailOverlay(email);
        }
      } else {
        closeAuthModal();
        updateAuthUI();
        showSuccessPopup('Signed in successfully! 👋', '✅');
      }
    } else {
      if (errEl) errEl.textContent = result.error || 'Authentication failed. Please try again.';
    }
  } catch (err) {
    console.error('Auth error:', err);
    if (errEl) errEl.textContent = 'An unexpected error occurred. Please try again.';
  } finally {
    _setLoading(false);
  }
}

// ─── Centered success popup ───────────────────────────────────────────────────
function showSuccessPopup(message, icon) {
  icon = icon || '✅';
  let popup = document.getElementById('_successPopup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = '_successPopup';
    popup.className = 'success-popup';
    popup.innerHTML = '<div class="success-popup-icon"></div><div class="success-popup-text"></div>';
    document.body.appendChild(popup);
  }
  clearTimeout(popup._timer);
  popup.querySelector('.success-popup-icon').textContent = icon;
  popup.querySelector('.success-popup-text').textContent = message;
  popup.classList.add('show');
  popup._timer = setTimeout(function () { popup.classList.remove('show'); }, 2800);
}

// ─── Auth UI (navbar button + greeting) ──────────────────────────────────────
async function updateAuthUI() {
  try {
    const session = await checkAuth();
    const btn      = document.getElementById('authBtn');
    const greeting = document.getElementById('authGreeting');
    const profileBtn = document.getElementById('profileBtn');

    if (session) {
      // Greeting
      const name = session.user?.user_metadata?.full_name
        || session.user?.email?.split('@')[0]
        || 'there';
      if (greeting) {
        greeting.textContent = `Hi, ${name}! 👋`;
        greeting.style.display = 'inline';
      }
      // Hide the separate profile link — authBtn takes over
      if (profileBtn) profileBtn.style.display = 'none';

      // Auth button → Profile (or Sign Out on /profile page)
      if (btn) {
        const onProfile = window.location.pathname === '/profile';
        if (onProfile) {
          btn.textContent = 'Sign Out';
          btn.onclick = async function () {
            await signOut();
            window.location.href = '/';
          };
        } else {
          btn.textContent = '👤 Profile';
          btn.onclick = function () { window.location.href = '/profile'; };
        }
      }
    } else {
      if (greeting) greeting.style.display = 'none';
      if (profileBtn) profileBtn.style.display = 'none';
      if (btn) {
        btn.textContent = 'Sign In';
        btn.onclick = openAuthModal;
      }
    }
  } catch (err) {
    console.error('updateAuthUI error:', err);
    // Ensure button is always clickable even if session check fails
    const btn = document.getElementById('authBtn');
    if (btn && !btn.onclick) btn.onclick = openAuthModal;
  }
}

// ─── Enter key on inputs ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  ['authEmail', 'authPassword'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handleAuthSubmit();
    });
  });
});

// ─── Check-your-email full-page overlay (shown after successful sign-up) ──────
function _showCheckEmailOverlay(email) {
  let overlay = document.getElementById('_checkEmailOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = '_checkEmailOverlay';
    document.body.appendChild(overlay);
  }
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:9999',
    'background:var(--bg,#0b0f18)',
    'display:flex;flex-direction:column;align-items:center;justify-content:center',
    'padding:2rem;text-align:center;animation:_cefadeIn .3s ease'
  ].join(';');

  overlay.innerHTML = `
    <style>
      @keyframes _cefadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
      @keyframes _cepulse{0%,100%{opacity:1}50%{opacity:.3}}
    </style>
    <div style="font-size:4rem;margin-bottom:1.25rem;">📧</div>
    <h2 style="font-size:1.75rem;margin:0 0 .65rem;color:var(--fg,#f1f5f9);">Check your inbox</h2>
    <p style="color:var(--fg-muted,#94a3b8);margin:0 0 .4rem;font-size:1rem;max-width:380px;line-height:1.55;">
      We sent a confirmation link to<br>
      <strong style="color:var(--fg,#f1f5f9);">${email}</strong>
    </p>
    <p style="color:var(--fg-muted,#94a3b8);font-size:.88rem;margin:.9rem 0 2rem;max-width:340px;line-height:1.5;">
      Click the link to verify your account. You'll be taken straight into your personalised taste setup.
    </p>
    <div style="display:flex;align-items:center;gap:.55rem;color:var(--fg-muted,#94a3b8);font-size:.82rem;">
      <span style="width:9px;height:9px;background:var(--accent,#6366f1);border-radius:50%;display:inline-block;animation:_cepulse 1.5s infinite;"></span>
      Waiting for confirmation…
    </div>
    <button onclick="document.getElementById('_checkEmailOverlay').remove();openAuthModal();"
      style="margin-top:2.5rem;background:none;border:none;color:var(--fg-muted,#94a3b8);font-size:.82rem;cursor:pointer;text-decoration:underline;">
      Wrong email? Go back
    </button>
  `;
}

// ─── Initialise ───────────────────────────────────────────────────────────────
_applyAuthMode(false);  // start in Sign In mode
updateAuthUI();
