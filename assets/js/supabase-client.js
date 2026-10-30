/**
 * Personal Reminder - Supabase Client & Authentication Controller
 * 
 * Handles Supabase initialization, user authentication, session persistence,
 * protected routes, and user profile management.
 */

window.SupabaseModule = (function () {
  'use strict';

  let client = null;

  // Verify whether the app has valid, non-placeholder credentials
  function isConfigured() {
    if (typeof window.APP_CONFIG === 'undefined') return false;
    const url = window.APP_CONFIG.SUPABASE_URL;
    const key = window.APP_CONFIG.SUPABASE_ANON_KEY;
    if (!url || !key) return false;
    if (url.includes('your-project-ref') || key.includes('your-anon-key')) return false;
    return true;
  }

  // Initialize Supabase client
  function getClient() {
    if (client) return client;

    if (!isConfigured()) {
      return null;
    }

    if (typeof window.supabase === 'undefined') {
      console.error('Supabase library is not loaded from CDN.');
      return null;
    }

    client = window.supabase.createClient(
      window.APP_CONFIG.SUPABASE_URL,
      window.APP_CONFIG.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    return client;
  }

  // Sign in with email and password
  async function signIn(email, password) {
    const sb = getClient();
    if (!sb) {
      throw new Error('Supabase is not configured. Please supply your Supabase URL and Anon Key in config.js.');
    }

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  // Sign out
  async function signOut() {
    const sb = getClient();
    if (sb) {
      await sb.auth.signOut();
    }
    // Clear any local caches
    window.location.href = 'login.html';
  }

  // Send password reset email
  async function resetPassword(email) {
    const sb = getClient();
    if (!sb) {
      throw new Error('Supabase is not configured. Please set your credentials in config.js.');
    }

    const redirectTo = `${window.location.origin}/login.html?type=recovery`;
    const { data, error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    return data;
  }

  // Get current session
  async function getSession() {
    const sb = getClient();
    if (!sb) return null;
    const { data: { session }, error } = await sb.auth.getSession();
    if (error) throw error;
    return session;
  }

  // Get current user
  async function getUser() {
    const sb = getClient();
    if (!sb) return null;
    const { data: { user }, error } = await sb.auth.getUser();
    if (error) throw error;
    return user;
  }

  // Fetch or initialize profile
  async function getProfile(userId) {
    const sb = getClient();
    if (!sb) return null;

    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }

    return data;
  }

  // Update profile
  async function updateProfile(userId, updates) {
    const sb = getClient();
    if (!sb) throw new Error('Supabase is not configured.');

    const payload = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await sb
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Route protection helper for dashboard
  async function requireAuth() {
    // If running in demo mode without Supabase credentials configured, allow preview
    if (!isConfigured()) {
      return { isDemo: true, user: { email: 'owner@gmail.com', id: 'demo-user-id' } };
    }

    const sb = getClient();
    if (!sb) {
      window.location.replace('login.html');
      return null;
    }

    const session = await getSession();
    if (!session || !session.user) {
      window.location.replace('login.html');
      return null;
    }

    return { isDemo: false, session, user: session.user };
  }

  return {
    isConfigured,
    getClient,
    signIn,
    signOut,
    resetPassword,
    getSession,
    getUser,
    getProfile,
    updateProfile,
    requireAuth
  };
})();
