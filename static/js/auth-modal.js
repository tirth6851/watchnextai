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

  _setLoading(true);

  try {
    const result = _authIsSignUp
      ? await signUp(email, password, displayName || undefined)
      : await signIn(email, password);

    if (result.success) {
      closeAuthModal();
      updateAuthUI();

      if (_authIsSignUp) {
        window.showToast('Welcome to the family! 🎬 Check your email to confirm your account.');
        // Send welcome email (best-effort, failure is silent)
        fetch('/api/send-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        }).catch(() => {});
      } else {
        window.showToast('Welcome back! 👋');
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
      if (profileBtn) profileBtn.style.display = 'inline-flex';

      // Auth button → Sign Out
      if (btn) {
        btn.textContent = 'Sign Out';
        btn.onclick = async function () {
          await signOut();
          updateAuthUI();
          window.showToast('Signed out successfully.');
        };
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

// ─── Initialise ───────────────────────────────────────────────────────────────
_applyAuthMode(false);  // start in Sign In mode
updateAuthUI();
