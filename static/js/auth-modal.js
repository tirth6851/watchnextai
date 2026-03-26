// ─── Shared showToast ─────────────────────────────────────────────────────────
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

// ─── State ────────────────────────────────────────────────────────────────────
// modes: 'signin' | 'signup' | 'forgot' | 'otp' | 'set-password' | 'mfa'
let _authMode       = 'signin';
let _otpEmail       = '';   // email used in OTP / forgot flows
let _otpType        = '';   // 'signup' | 'recovery'
let _mfaFactorId    = '';
let _mfaChallengeId = '';

// ─── Open / Close ─────────────────────────────────────────────────────────────
function openAuthModal(mode) {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  _ensureExtraFields();
  _applyAuthMode(mode || 'signin');
  modal.classList.add('open');
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  modal.classList.remove('open');
  const err = document.getElementById('authError');
  if (err) err.textContent = '';
}

// Backdrop + Escape
document.addEventListener('DOMContentLoaded', function () {
  const modal = document.getElementById('authModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeAuthModal(); });
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    const m = document.getElementById('authModal');
    if (m?.classList.contains('open')) closeAuthModal();
  }
  // Enter key inside the modal
  if (e.key === 'Enter') {
    const m = document.getElementById('authModal');
    if (!m?.classList.contains('open')) return;
    const id = e.target?.id;
    if (['authEmail','authPassword','authOtp','authName'].includes(id)) handleAuthSubmit();
  }
});

// ─── Google sign-in handler ───────────────────────────────────────────────────
async function handleGoogleSignIn() {
  const btn   = document.getElementById('authGoogleBtn');
  const errEl = document.getElementById('authError');
  if (errEl) errEl.textContent = '';
  if (btn) { btn.disabled = true; btn.textContent = 'Redirecting…'; }
  const result = await signInWithGoogle();
  // On error (e.g. provider not enabled) restore the button
  if (!result.success) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = _googleBtnHTML;
    }
    const rawError = result.error || '';
    const friendlyError = (rawError.toLowerCase().includes('unsupported provider') || rawError.toLowerCase().includes('provider is not enabled'))
      ? 'Google sign-in is not yet enabled. Please use email & password instead.'
      : (rawError || 'Google sign-in failed. Please try again.');
    if (errEl) errEl.textContent = friendlyError;
  }
  // On success the browser navigates away — nothing more to do here
}

const _googleBtnHTML = `
  <svg width="18" height="18" viewBox="0 0 18 18" style="flex-shrink:0;" aria-hidden="true">
    <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6A7.8 7.8 0 0 0 17 9.17c0-.57-.05-1.1-.49-1.17z"/>
    <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
    <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"/>
    <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.31z"/>
  </svg>
  Continue with Google`;

// ─── Inject extra fields not in the HTML ─────────────────────────────────────
function _ensureExtraFields() {
  // Google sign-in button + divider
  if (!document.getElementById('authGoogleSection')) {
    const section = document.createElement('div');
    section.id = 'authGoogleSection';
    section.innerHTML = `
      <button id="authGoogleBtn" type="button" onclick="handleGoogleSignIn()"
        style="width:100%;display:flex;align-items:center;justify-content:center;gap:.6rem;
               padding:.65rem 1rem;border-radius:.7rem;border:1.5px solid var(--border);
               background:var(--card);color:var(--fg);font-size:.95rem;font-weight:600;
               cursor:pointer;transition:background .15s,box-shadow .15s;margin-bottom:.85rem;"
        onmouseover="this.style.background='var(--bg)';this.style.boxShadow='0 2px 8px rgba(0,0,0,.2)'"
        onmouseout="this.style.background='var(--card)';this.style.boxShadow='none'">
        ${_googleBtnHTML}
      </button>
      <div id="authDivider"
        style="display:flex;align-items:center;gap:.75rem;margin-bottom:.85rem;color:var(--fg-muted,#94a3b8);font-size:.8rem;">
        <div style="flex:1;height:1px;background:var(--border);"></div>
        <span>or continue with email</span>
        <div style="flex:1;height:1px;background:var(--border);"></div>
      </div>`;
    // Try to insert after the title; fall back to prepending inside the modal div
    const title  = document.getElementById('authModalTitle');
    const modal  = document.querySelector('#authModal .modal');
    if (title) {
      title.insertAdjacentElement('afterend', section);
    } else if (modal) {
      modal.insertBefore(section, modal.firstChild);
    }
  }

  // OTP code input
  if (!document.getElementById('authOtpField')) {
    const field = document.createElement('div');
    field.className = 'modal-field';
    field.id = 'authOtpField';
    field.style.display = 'none';
    field.innerHTML = `
      <label for="authOtp" id="authOtpLabel">Verification Code</label>
      <input type="text" id="authOtp" placeholder="00000000" maxlength="8"
             autocomplete="one-time-code" inputmode="numeric"
             style="letter-spacing:.3em;font-size:1.35rem;text-align:center;padding:.55rem;"
             oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,8);" />
      <p id="authOtpHint" style="font-size:.78rem;color:var(--fg-muted,#94a3b8);margin:.45rem 0 0;line-height:1.4;"></p>
    `;
    const sc = document.getElementById('strengthContainer');
    if (sc) sc.insertAdjacentElement('afterend', field);
  }
  // Terms & Conditions checkbox (signup only)
  if (!document.getElementById('authTcField')) {
    const tcField = document.createElement('div');
    tcField.id = 'authTcField';
    tcField.style.cssText = 'display:none;margin:.6rem 0 .4rem;font-size:.82rem;color:var(--fg-muted,#94a3b8);';
    tcField.innerHTML = `
      <label style="display:flex;align-items:flex-start;gap:.5rem;cursor:pointer;">
        <input type="checkbox" id="authTcCheck" style="margin-top:.15rem;accent-color:var(--accent,#6366f1);" />
        <span>I agree to the <a href="/terms" target="_blank" style="color:var(--accent,#6366f1);text-decoration:underline;">Terms &amp; Conditions</a> and <a href="/privacy" target="_blank" style="color:var(--accent,#6366f1);text-decoration:underline;">Privacy Policy</a></span>
      </label>`;
    const submitBtn = document.getElementById('authSubmit');
    if (submitBtn) submitBtn.insertAdjacentElement('beforebegin', tcField);
  }

  // Forgot password link
  if (!document.getElementById('authForgotLink')) {
    const link = document.createElement('button');
    link.type = 'button';
    link.id   = 'authForgotLink';
    link.textContent = 'Forgot password?';
    link.style.cssText = 'background:none;border:none;color:var(--fg-muted,#94a3b8);font-size:.8rem;cursor:pointer;text-decoration:underline;padding:.3rem 0 0;display:block;text-align:right;width:100%;';
    link.onclick = () => _applyAuthMode('forgot');
    const pw = document.getElementById('authPassword')?.closest('.modal-field');
    if (pw) pw.insertAdjacentElement('afterend', link);
  }
}

// ─── Mode application ─────────────────────────────────────────────────────────
function _applyAuthMode(mode) {
  _authMode = mode;

  const el   = id  => document.getElementById(id);
  const text = (id, t) => { const e = el(id); if (e) e.textContent = t; };
  const show = id  => { const e = el(id); if (e) e.style.display = ''; };
  const hide = id  => { const e = el(id); if (e) e.style.display = 'none'; };

  const pwWrap = el('authPassword')?.closest('.modal-field');
  const emailWrap = el('authEmail')?.closest('.modal-field');
  const showPw    = v => { if (pwWrap)    pwWrap.style.display    = v ? '' : 'none'; };
  const showEmail = v => { if (emailWrap) emailWrap.style.display = v ? '' : 'none'; };

  // Google section visible only on signin/signup
  const gs = el('authGoogleSection');
  if (gs) gs.style.display = (mode === 'signin' || mode === 'signup') ? '' : 'none';

  // T&C checkbox visible only on signup
  const tcField = el('authTcField');
  if (tcField) tcField.style.display = (mode === 'signup') ? '' : 'none';
  const tcCheck = el('authTcCheck');
  if (tcCheck && mode !== 'signup') tcCheck.checked = false;

  text('authError', '');

  // Reset password field state
  const pwInput = el('authPassword');
  if (pwInput) { pwInput.type = 'password'; }
  const pwToggle = document.querySelector('.password-toggle');
  if (pwToggle) pwToggle.textContent = '👁';

  const toggleRow = el('authToggleText')?.parentElement;

  switch (mode) {
    case 'signin':
      text('authModalTitle', 'Welcome Back');
      text('authSubmit',     'Sign In');
      hide('nameField'); showEmail(true); showPw(true);
      if (pwInput) { pwInput.autocomplete = 'current-password'; pwInput.placeholder = '••••••••'; }
      hide('strengthContainer'); hide('authOtpField');
      show('authForgotLink');
      if (toggleRow) toggleRow.style.display = '';
      text('authToggleText', "Don't have an account?");
      text('authToggleBtn',  'Sign Up');
      el('authToggleBtn') && (el('authToggleBtn').onclick = () => _applyAuthMode('signup'));
      setTimeout(() => el('authEmail')?.focus(), 80);
      break;

    case 'signup':
      text('authModalTitle', 'Create Account');
      text('authSubmit',     'Create Account');
      show('nameField'); showEmail(true); showPw(true);
      if (pwInput) { pwInput.autocomplete = 'new-password'; pwInput.placeholder = '••••••••'; }
      show('strengthContainer'); hide('authOtpField');
      hide('authForgotLink');
      if (toggleRow) toggleRow.style.display = '';
      text('authToggleText', 'Already have an account?');
      text('authToggleBtn',  'Sign In');
      el('authToggleBtn') && (el('authToggleBtn').onclick = () => _applyAuthMode('signin'));
      setTimeout(() => el('authEmail')?.focus(), 80);
      break;

    case 'forgot':
      text('authModalTitle', 'Reset Password');
      text('authSubmit',     'Send Code');
      hide('nameField'); showEmail(true); showPw(false);
      el('authEmail') && (el('authEmail').value = '');
      hide('strengthContainer'); hide('authOtpField');
      hide('authForgotLink');
      if (toggleRow) toggleRow.style.display = '';
      text('authToggleText', 'Remember it?');
      text('authToggleBtn',  'Sign In');
      el('authToggleBtn') && (el('authToggleBtn').onclick = () => _applyAuthMode('signin'));
      setTimeout(() => el('authEmail')?.focus(), 80);
      break;

    case 'otp':
      text('authModalTitle', _otpType === 'signup' ? 'Verify Your Email' : 'Enter Reset Code');
      text('authSubmit',     'Verify Code');
      hide('nameField'); showEmail(false); showPw(false);
      hide('strengthContainer'); show('authOtpField');
      hide('authForgotLink');
      el('authOtp') && (el('authOtp').value = '');
      text('authOtpLabel', _otpType === 'signup' ? 'Verification Code' : 'Reset Code');
      text('authOtpHint',
        _otpType === 'signup'
          ? `We sent a verification code to ${_otpEmail}. Enter it to activate your account.`
          : `We sent a reset code to ${_otpEmail}.`
      );
      if (toggleRow) toggleRow.style.display = '';
      text('authToggleText', 'Wrong email?');
      text('authToggleBtn',  'Go Back');
      el('authToggleBtn') && (el('authToggleBtn').onclick = () => _applyAuthMode(_otpType === 'signup' ? 'signup' : 'forgot'));
      setTimeout(() => el('authOtp')?.focus(), 80);
      break;

    case 'set-password':
      text('authModalTitle', 'Set New Password');
      text('authSubmit',     'Update Password');
      hide('nameField'); showEmail(false); showPw(true);
      if (pwInput) { pwInput.autocomplete = 'new-password'; pwInput.placeholder = 'New password (8+ chars)'; pwInput.value = ''; }
      show('strengthContainer'); hide('authOtpField');
      hide('authForgotLink');
      if (toggleRow) toggleRow.style.display = 'none';
      setTimeout(() => el('authPassword')?.focus(), 80);
      break;

    case 'mfa':
      text('authModalTitle', 'Two-Factor Auth');
      text('authSubmit',     'Verify');
      hide('nameField'); showEmail(false); showPw(false);
      hide('strengthContainer'); show('authOtpField');
      hide('authForgotLink');
      el('authOtp') && (el('authOtp').value = '');
      text('authOtpLabel', 'Authenticator Code');
      text('authOtpHint',  'Enter the 6-digit code from your authenticator app.');
      if (toggleRow) toggleRow.style.display = 'none';
      setTimeout(() => el('authOtp')?.focus(), 80);
      break;
  }
}

// Keep old boolean shim so any existing toggleAuthMode() calls still work
function toggleAuthMode() {
  _applyAuthMode(_authMode === 'signup' ? 'signin' : 'signup');
}

// ─── Email validation ─────────────────────────────────────────────────────────
function _isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// ─── Password strength ────────────────────────────────────────────────────────
function _getStrength(pw) {
  let score = 0;
  if (pw.length >= 8)            score++;
  if (pw.length >= 12)           score++;
  if (/[A-Z]/.test(pw))         score++;
  if (/[0-9]/.test(pw))         score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: 'Weak',        color: '#ef4444', pct: '20%' };
  if (score === 2) return { label: 'Fair',        color: '#f97316', pct: '40%' };
  if (score === 3) return { label: 'Good',        color: '#eab308', pct: '65%' };
  if (score === 4) return { label: 'Strong',      color: '#22c55e', pct: '85%' };
  return              { label: 'Very Strong', color: '#16a34a', pct: '100%' };
}
function _updateStrength(pw) {
  const bar = document.getElementById('strengthBar');
  const lbl = document.getElementById('strengthLabel');
  if (!bar || !lbl) return;
  if (!pw) { bar.style.width = '0%'; lbl.textContent = ''; return; }
  const s = _getStrength(pw);
  bar.style.width = s.pct; bar.style.background = s.color;
  lbl.textContent = s.label; lbl.style.color = s.color;
}
document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('authPassword')?.addEventListener('input', function () {
    if (_authMode === 'signup' || _authMode === 'set-password') _updateStrength(this.value);
  });
  // Handle Supabase auth state changes (OAuth redirect, password recovery)
  if (typeof supabase !== 'undefined' && supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        _ensureExtraFields();
        openAuthModal('set-password');
      }
      // OAuth redirect (e.g. Google) — close modal if open, refresh UI
      if (event === 'SIGNED_IN' && session) {
        closeAuthModal();
        updateAuthUI();
        // If this is a brand-new OAuth user (no onboarding yet), redirect
        const isNew = !session.user?.user_metadata?.onboarded;
        if (isNew && window.location.pathname !== '/onboarding') {
          // Give updateAuthUI a moment then go to onboarding
          setTimeout(() => { window.location.href = '/onboarding'; }, 300);
        }
      }
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

// ─── Loading state ────────────────────────────────────────────────────────────
const _btnLabels = {
  signin:         ['Signing in…',       'Sign In'],
  signup:         ['Creating account…', 'Create Account'],
  forgot:         ['Sending code…',     'Send Code'],
  otp:            ['Verifying…',        'Verify Code'],
  'set-password': ['Updating…',         'Update Password'],
  mfa:            ['Verifying…',        'Verify'],
};
function _setLoading(v) {
  const btn = document.getElementById('authSubmit');
  if (!btn) return;
  const [onLabel, offLabel] = _btnLabels[_authMode] || ['Loading…', 'Submit'];
  btn.disabled    = v;
  btn.textContent = v ? onLabel : offLabel;
}

// ─── Main submit dispatcher ───────────────────────────────────────────────────
async function handleAuthSubmit() {
  switch (_authMode) {
    case 'forgot':       return _handleForgot();
    case 'otp':          return _handleOtp();
    case 'set-password': return _handleSetPassword();
    case 'mfa':          return _handleMfa();
    default:             return _handleSignInOrUp();
  }
}

// ─── Sign In / Sign Up ────────────────────────────────────────────────────────
async function _handleSignInOrUp() {
  const email       = (document.getElementById('authEmail')?.value    || '').trim();
  const password    = document.getElementById('authPassword')?.value  || '';
  const displayName = (document.getElementById('authName')?.value     || '').trim();
  const errEl       = document.getElementById('authError');
  if (errEl) errEl.textContent = '';

  if (!email)              { if (errEl) errEl.textContent = 'Please enter your email.';  return; }
  if (!_isValidEmail(email)) { if (errEl) errEl.textContent = 'Please enter a valid email.'; return; }
  if (!password)           { if (errEl) errEl.textContent = 'Please enter your password.'; return; }
  if (_authMode === 'signup' && password.length < 8) {
    if (errEl) errEl.textContent = 'Password must be at least 8 characters.'; return;
  }
  if (_authMode === 'signup' && !document.getElementById('authTcCheck')?.checked) {
    if (errEl) errEl.textContent = 'Please agree to the Terms & Conditions to continue.'; return;
  }

  _setLoading(true);
  try {
    if (_authMode === 'signup') {
      const result = await signUp(email, password, displayName || undefined);
      if (!result.success) { if (errEl) errEl.textContent = result.error; return; }
      fetch('/api/send-welcome-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, agreed_at: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC' })
      }).catch(() => {});
      if (result.session) {
        // Email confirmation OFF — immediately signed in
        closeAuthModal(); updateAuthUI(); window.location.href = '/onboarding';
      } else {
        // Show OTP step inside the modal
        _otpEmail = email; _otpType = 'signup';
        _applyAuthMode('otp');
      }
    } else {
      const result = await signIn(email, password);
      if (!result.success) { if (errEl) errEl.textContent = result.error; return; }
      // Check if MFA step is required
      if (supabase) {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') {
          const factors = await mfaListFactors();
          const factor  = factors.totp?.[0];
          if (factor) {
            const ch = await mfaChallenge(factor.id);
            if (ch.success) {
              _mfaFactorId = factor.id; _mfaChallengeId = ch.challengeId;
              _applyAuthMode('mfa'); return;
            }
          }
        }
      }
      closeAuthModal(); updateAuthUI();
      showSuccessPopup('Signed in successfully! 👋', '✅');
    }
  } catch (err) {
    console.error('Auth error:', err);
    if (errEl) errEl.textContent = 'An unexpected error occurred. Please try again.';
  } finally {
    _setLoading(false);
  }
}

// ─── Forgot Password ──────────────────────────────────────────────────────────
async function _handleForgot() {
  const email = (document.getElementById('authEmail')?.value || '').trim();
  const errEl = document.getElementById('authError');
  if (errEl) errEl.textContent = '';
  if (!email)              { if (errEl) errEl.textContent = 'Please enter your email.'; return; }
  if (!_isValidEmail(email)) { if (errEl) errEl.textContent = 'Please enter a valid email.'; return; }
  _setLoading(true);
  try {
    const result = await forgotPassword(email);
    if (!result.success) { if (errEl) errEl.textContent = result.error; return; }
    _otpEmail = email; _otpType = 'recovery';
    _applyAuthMode('otp');
  } finally {
    _setLoading(false);
  }
}

// ─── OTP Verification ─────────────────────────────────────────────────────────
async function _handleOtp() {
  const code  = (document.getElementById('authOtp')?.value || '').trim();
  const errEl = document.getElementById('authError');
  if (errEl) errEl.textContent = '';
  if (code.length < 6 || code.length > 8) { if (errEl) errEl.textContent = 'Please enter the full verification code (6–8 digits).'; return; }
  _setLoading(true);
  try {
    const result = await verifyOtp(_otpEmail, code, _otpType);
    if (!result.success) { if (errEl) errEl.textContent = result.error || 'Invalid code. Please try again.'; return; }
    if (_otpType === 'signup') {
      closeAuthModal(); updateAuthUI(); window.location.href = '/onboarding';
    } else {
      // Recovery OTP verified — now let them set a new password
      _applyAuthMode('set-password');
    }
  } finally {
    _setLoading(false);
  }
}

// ─── Set New Password ─────────────────────────────────────────────────────────
async function _handleSetPassword() {
  const pw    = document.getElementById('authPassword')?.value || '';
  const errEl = document.getElementById('authError');
  if (errEl) errEl.textContent = '';
  if (pw.length < 8) { if (errEl) errEl.textContent = 'Password must be at least 8 characters.'; return; }
  _setLoading(true);
  try {
    const result = await updatePassword(pw);
    if (!result.success) { if (errEl) errEl.textContent = result.error; return; }
    closeAuthModal(); updateAuthUI();
    showSuccessPopup('Password updated! You\'re signed in. 🔐', '✅');
  } finally {
    _setLoading(false);
  }
}

// ─── MFA Verification ─────────────────────────────────────────────────────────
async function _handleMfa() {
  const code  = (document.getElementById('authOtp')?.value || '').trim();
  const errEl = document.getElementById('authError');
  if (errEl) errEl.textContent = '';
  if (code.length < 6) { if (errEl) errEl.textContent = 'Please enter your 6-digit authenticator code.'; return; }
  _setLoading(true);
  try {
    const result = await mfaVerify(_mfaFactorId, _mfaChallengeId, code);
    if (!result.success) { if (errEl) errEl.textContent = result.error || 'Invalid code. Try again.'; return; }
    closeAuthModal(); updateAuthUI();
    showSuccessPopup('Signed in successfully! 👋', '✅');
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
  popup.querySelector('.success-popup-text').textContent  = message;
  popup.classList.add('show');
  popup._timer = setTimeout(() => popup.classList.remove('show'), 2800);
}

// ─── Auth UI (navbar button + greeting) ──────────────────────────────────────
async function updateAuthUI() {
  try {
    const session    = await checkAuth();
    const btn        = document.getElementById('authBtn');
    const greeting   = document.getElementById('authGreeting');
    const profileBtn = document.getElementById('profileBtn');

    if (session) {
      const name = session.user?.user_metadata?.full_name
        || session.user?.email?.split('@')[0] || 'there';
      if (greeting) { greeting.textContent = `Hi, ${name}! 👋`; greeting.style.display = 'inline'; }
      if (profileBtn) profileBtn.style.display = 'none';
      if (btn) {
        if (window.location.pathname === '/profile') {
          btn.textContent = 'Sign Out';
          btn.onclick = async () => { await signOut(); window.location.href = '/'; };
        } else {
          btn.textContent = '👤 Profile';
          btn.onclick = () => window.location.href = '/profile';
        }
      }
    } else {
      if (greeting)   greeting.style.display = 'none';
      if (profileBtn) profileBtn.style.display = 'none';
      if (btn) { btn.textContent = 'Sign In'; btn.onclick = openAuthModal; }
    }
  } catch (err) {
    console.error('updateAuthUI error:', err);
    const btn = document.getElementById('authBtn');
    if (btn && !btn.onclick) btn.onclick = openAuthModal;
  }
}

// ─── Check-your-email overlay (fallback if OTP isn't configured yet) ─────────
function _showCheckEmailOverlay(email) {
  let overlay = document.getElementById('_checkEmailOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = '_checkEmailOverlay';
    document.body.appendChild(overlay);
  }
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--bg,#0b0f18);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;text-align:center;';
  overlay.innerHTML = `
    <style>@keyframes _cepulse{0%,100%{opacity:1}50%{opacity:.3}}</style>
    <div style="font-size:4rem;margin-bottom:1.25rem;">📧</div>
    <h2 style="font-size:1.75rem;margin:0 0 .65rem;color:var(--fg,#f1f5f9);">Check your inbox</h2>
    <p style="color:var(--fg-muted,#94a3b8);margin:0 0 .4rem;font-size:1rem;max-width:380px;line-height:1.55;">We sent a confirmation link to<br><strong style="color:var(--fg,#f1f5f9);">${email}</strong></p>
    <p style="color:var(--fg-muted,#94a3b8);font-size:.88rem;margin:.9rem 0 2rem;max-width:340px;line-height:1.5;">Click the link to verify your account and get started.</p>
    <div style="display:flex;align-items:center;gap:.55rem;color:var(--fg-muted,#94a3b8);font-size:.82rem;"><span style="width:9px;height:9px;background:var(--accent,#6366f1);border-radius:50%;display:inline-block;animation:_cepulse 1.5s infinite;"></span>Waiting for confirmation…</div>
    <button onclick="document.getElementById('_checkEmailOverlay').remove();openAuthModal();" style="margin-top:2.5rem;background:none;border:none;color:var(--fg-muted,#94a3b8);font-size:.82rem;cursor:pointer;text-decoration:underline;">Wrong email? Go back</button>
  `;
}

// ─── Initialise ───────────────────────────────────────────────────────────────
_ensureExtraFields();
_applyAuthMode('signin');
updateAuthUI();
