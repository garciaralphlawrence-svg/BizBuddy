// Supabase client bootstrap for Biz Buddy.
//
// DEMO MODE (default): both values below are empty, so cloud sync is OFF.
// All data lives in this browser's localStorage and no network request is made.
//
// To turn cloud sync back on, fill in your project values from
// Supabase Settings > API (see SUPABASE_SETUP.md). The Supabase JS library is
// only downloaded when both values are set.
window.BIZBUDDY_SUPABASE_URL = window.BIZBUDDY_SUPABASE_URL || '';
window.BIZBUDDY_SUPABASE_ANON_KEY = window.BIZBUDDY_SUPABASE_ANON_KEY || '';

window.bizBuddySupabase = null;
window.bizBuddySupabaseEnabled = false;

// app.js awaits this promise before reading cloud state. It resolves to true
// when the client is ready, or false in demo mode / if the library fails to load.
window.bizBuddySupabaseReady = (function initSupabaseClient() {
    const url = window.BIZBUDDY_SUPABASE_URL;
    const anonKey = window.BIZBUDDY_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
        return Promise.resolve(false);
    }

    function createClient() {
        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            return false;
        }
        window.bizBuddySupabase = window.supabase.createClient(url, anonKey);
        window.bizBuddySupabaseEnabled = true;
        return true;
    }

    if (window.supabase) {
        return Promise.resolve(createClient());
    }

    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload = () => resolve(createClient());
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });
})();
