// Supabase client bootstrap for Biz Buddy.
// Fill these with your project values from Supabase Settings > API.
window.BIZBUDDY_SUPABASE_URL = window.BIZBUDDY_SUPABASE_URL || '';
window.BIZBUDDY_SUPABASE_ANON_KEY = window.BIZBUDDY_SUPABASE_ANON_KEY || '';

window.bizBuddySupabase = null;
window.bizBuddySupabaseEnabled = false;

if (window.supabase && window.BIZBUDDY_SUPABASE_URL && window.BIZBUDDY_SUPABASE_ANON_KEY) {
    window.bizBuddySupabase = window.supabase.createClient(
        window.BIZBUDDY_SUPABASE_URL = 'https://nhpkbtufspediqiudern.supabase.co',
        window.BIZBUDDY_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocGtidHVmc3BlZGlxaXVkZXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MDMyMTAsImV4cCI6MjA5MDA3OTIxMH0.f8zMg46LmQt5rZIHWEeCbCEDGPU7iXOAJl1q6-UWtyY'
    );
    window.bizBuddySupabaseEnabled = true;
}
