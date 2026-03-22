// Supabase configuration
const SUPABASE_URL = 'https://lqlqurgthkdknxwwgygx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_M327T9xB7uaQFaNUZtJkRw_VmGK3L7n';

// Initialize Supabase client — defensive in case CDN hasn't loaded yet
if (typeof window.supabase === 'undefined') {
    console.error('Supabase SDK not loaded. Auth features will be unavailable.');
}
const supabase = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// Check if user is logged in
async function checkAuth() {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

// Sign up new user
async function signUp(email, password, displayName) {
    const opts = {
        email,
        password,
        options: {
            emailRedirectTo: window.location.origin + '/onboarding'
        }
    };
    if (displayName) opts.options.data = { full_name: displayName };
    const { data, error } = await supabase.auth.signUp(opts);

    if (error) {
        console.error('Sign up error:', error);
        const msg = error.message === 'Failed to fetch'
            ? 'Cannot reach auth server. Check your internet connection or try again later.'
            : error.message;
        return { success: false, error: msg };
    }

    // Empty identities = email already registered (Supabase behaviour when confirm is on)
    if (data.user?.identities?.length === 0) {
        return { success: false, error: 'This email is already registered. Please sign in instead.' };
    }

    return { success: true, user: data.user, session: data.session };
}

// Sign in user
async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        console.error('Sign in error:', error);
        const msg = error.message === 'Failed to fetch'
            ? 'Cannot reach auth server. Check your internet connection or try again later.'
            : error.message;
        return { success: false, error: msg };
    }
    
    return { success: true, user: data.user };
}

// Send password-reset email
async function forgotPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
}

// Set a new password (called after PASSWORD_RECOVERY event or OTP recovery)
async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };
    return { success: true };
}

// Verify a 6-digit OTP (type: 'signup' | 'recovery' | 'email')
async function verifyOtp(email, token, type) {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type });
    if (error) return { success: false, error: error.message };
    return { success: true, session: data.session };
}

// ── MFA (TOTP) ────────────────────────────────────────────────────────────────

async function mfaEnroll() {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error) return { success: false, error: error.message };
    return { success: true, id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

async function mfaChallenge(factorId) {
    const { data, error } = await supabase.auth.mfa.challenge({ factorId });
    if (error) return { success: false, error: error.message };
    return { success: true, challengeId: data.id };
}

async function mfaVerify(factorId, challengeId, code) {
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
    if (error) return { success: false, error: error.message };
    return { success: true };
}

async function mfaListFactors() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) return { success: false, totp: [] };
    return { success: true, totp: data.totp || [] };
}

async function mfaUnenroll(factorId) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) return { success: false, error: error.message };
    return { success: true };
}

// Sign out user
async function signOut() {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
    }
    
    return { success: true };
}

// Add to watchlist
async function addToWatchlist(mediaId, mediaType, title, posterPath) {
    const session = await checkAuth();
    if (!session) {
        return { success: false, error: 'Not authenticated' };
    }
    
    const { data, error } = await supabase
        .from('watchlist')
        .insert({
            user_id: session.user.id,
            media_id: mediaId,
            media_type: mediaType,
            title: title,
            poster_path: posterPath
        });
    
    if (error) {
        console.error('Add to watchlist error:', error);
        return { success: false, error: error.message };
    }
    
    return { success: true };
}

// Remove from watchlist
async function removeFromWatchlist(mediaId) {
    const session = await checkAuth();
    if (!session) {
        return { success: false, error: 'Not authenticated' };
    }
    
    const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('user_id', session.user.id)
        .eq('media_id', mediaId);
    
    if (error) {
        console.error('Remove from watchlist error:', error);
        return { success: false, error: error.message };
    }
    
    return { success: true };
}

// Get user watchlist
async function getWatchlist() {
    const session = await checkAuth();
    if (!session) {
        return { success: false, error: 'Not authenticated' };
    }
    
    const { data, error } = await supabase
        .from('watchlist')
        .select('*')
        .eq('user_id', session.user.id);
    
    if (error) {
        console.error('Get watchlist error:', error);
        return { success: false, error: error.message };
    }
    
    return { success: true, data: data };
}

// Mark as watched
async function markAsWatched(mediaId, mediaType, title, rating, posterPath) {
    const session = await checkAuth();
    if (!session) {
        return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
        .from('watched')
        .insert({
            user_id: session.user.id,
            media_id: mediaId,
            media_type: mediaType,
            title: title,
            poster_path: posterPath || null,
            rating: rating
        });
    
    if (error) {
        console.error('Mark as watched error:', error);
        return { success: false, error: error.message };
    }
    
    return { success: true };
}

// Remove from watched
async function removeFromWatched(mediaId) {
    const session = await checkAuth();
    if (!session) {
        return { success: false, error: 'Not authenticated' };
    }

    const { error } = await supabase
        .from('watched')
        .delete()
        .eq('user_id', session.user.id)
        .eq('media_id', mediaId);

    if (error) {
        console.error('Remove from watched error:', error);
        return { success: false, error: error.message };
    }

    return { success: true };
}

// Get watched list
async function getWatched() {
    const session = await checkAuth();
    if (!session) {
        return { success: false, error: 'Not authenticated' };
    }

    const { data, error } = await supabase
        .from('watched')
        .select('*')
        .eq('user_id', session.user.id);

    if (error) {
        console.error('Get watched error:', error);
        return { success: false, error: error.message };
    }

    return { success: true, data: data };
}

// ── Watching (currently watching with episode progress) ──────────────────────

async function markAsWatching(mediaId, mediaType, title, posterPath, season, episode, rating) {
    const session = await checkAuth();
    if (!session) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
        .from('watching')
        .upsert({
            user_id: session.user.id,
            media_id: mediaId,
            media_type: mediaType,
            title: title,
            poster_path: posterPath || null,
            current_season: season || 1,
            current_episode: episode || 1,
            rating: rating || null
        }, { onConflict: 'user_id,media_id,media_type' });

    if (error) {
        console.error('Mark as watching error:', error);
        return { success: false, error: error.message };
    }
    return { success: true };
}

async function removeFromWatching(mediaId) {
    const session = await checkAuth();
    if (!session) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
        .from('watching')
        .delete()
        .eq('user_id', session.user.id)
        .eq('media_id', mediaId);

    if (error) {
        console.error('Remove from watching error:', error);
        return { success: false, error: error.message };
    }
    return { success: true };
}

async function getWatching() {
    const session = await checkAuth();
    if (!session) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase
        .from('watching')
        .select('*')
        .eq('user_id', session.user.id);

    if (error) {
        console.error('Get watching error:', error);
        return { success: false, error: error.message };
    }
    return { success: true, data: data };
}
