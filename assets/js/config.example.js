/**
 * Personal Reminder App - Frontend Configuration Template
 * 
 * INSTRUCTIONS FOR OWNER:
 * 1. Copy this file to `assets/js/config.js`
 * 2. Obtain your Supabase project URL and anon/publishable key:
 *    - Go to https://supabase.com/dashboard -> Select your project
 *    - Click Settings (gear icon) -> API
 *    - Copy "Project URL" and paste as SUPABASE_URL
 *    - Copy "anon public" Project API key and paste as SUPABASE_ANON_KEY
 * 3. Never commit `assets/js/config.js` with real credentials (it is in .gitignore).
 * 4. NEVER put the Supabase service-role key or Resend API key here.
 */

window.APP_CONFIG = window.APP_CONFIG || {
  // Public Supabase configuration (safe for frontend with Row Level Security)
  SUPABASE_URL: 'https://your-project-ref.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key-here',
  
  // Default timezone
  DEFAULT_TIMEZONE: 'Asia/Kolkata',

  // Set to false when connecting to your live Supabase project
  DEMO_MODE: false
};
