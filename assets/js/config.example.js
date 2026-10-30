/**
 * Personal Reminder App - Frontend Configuration Template
 * 
 * INSTRUCTIONS:
 * 1. Copy this file to `assets/js/config.js`
 * 2. Fill in your project's public Supabase URL and anon/publishable key.
 * 3. Never commit `config.js` with real credentials to Git (it is ignored by .gitignore).
 * 4. NEVER put service-role keys or Resend API keys in this frontend file.
 */

window.APP_CONFIG = {
  // Public Supabase configuration (safe for frontend use with Row Level Security)
  SUPABASE_URL: 'https://your-project-ref.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key-here',
  
  // Default timezone
  DEFAULT_TIMEZONE: 'Asia/Kolkata',

  // Mock / Demo mode flag for Phase 1 local UI preview before Supabase is connected
  DEMO_MODE: true
};
