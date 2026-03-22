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

// ─── Inject extra fields not in the HTML ─────────────────────────────────────
function _ensureExtraFields() {
  // OTP code input
  if (!document.getElementById('authOtpField')) {
    const field = document.createElement('div');
    field.className = 'modal-field';
    field.id = 'authOtpField';
    field.style.display = 'none';
    field.innerHTML = `
      <label for="authOtp" id="authOtpLabel">Verification Code</label>
      <input type="text" id="authOtp" placeholder="000000" maxlength="6"
             autocomplete="one-time-code" inputmode="numeric"
             style="letter-spacing:.3em;font-size:1.35rem;text-align:center;padding:.55rem;"
             oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,6);" />
      <p id="authOtpHint" style="font-size:.78rem;color:var(--fg-muted,#94a3b8);margin:.45rem 0 0;line-height:1.4;"></p>
    `;
    const sc = document.getElementById('strengthContainer');
    if (sc) sc.insertAdjacentElement('afterend', field);
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
          ? `We sent a 6-digit code to ${_otpEmail}. Enter it to activate your account.`
          : `We sent a 6-digit reset code to ${_otpEmail}.`
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
  // PASSWORD_RECOVERY event (from clicking a reset link in email)
  if (typeof supabase !== 'undefined' && supabase) {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        _ensureExtraFields();
        openAuthModal('set-password');
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

  _setLoading(true);
  try {
    if (_authMode === 'signup') {
      const result = await signUp(email, password, displayName || undefined);
      if (!result.success) { if (errEl) errEl.textContent = result.error; return; }
      fetch('/api/send-welcome-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
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
  if (code.length !== 6) { if (errEl) errEl.textContent = 'Please enter the full 6-digit code.'; return; }
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
  if (code.length !== 6) { if (errEl) errEl.textContent = 'Please enter your 6-digit authenticator code.'; return; }
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
