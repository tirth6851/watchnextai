// Supabase configuration
const SUPABASE_URL = 'https://lqlqurgthkdknxwwgygx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_M327T9xB7uaQFaNUZtJkRw_VmGK3L7n';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Check if user is logged in
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

// Sign up new user
async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
    });
    
    if (error) {
        console.error('Sign up error:', error);
        return { success: false, error: error.message };
    }
    
    return { success: true, user: data.user };
}

// Sign in user
async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });
    
    if (error) {
        console.error('Sign in error:', error);
        return { success: false, error: error.message };
    }
    
    return { success: true, user: data.user };
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
async function markAsWatched(mediaId, mediaType, title, rating) {
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
            rating: rating
        });
    
    if (error) {
        console.error('Mark as watched error:', error);
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
