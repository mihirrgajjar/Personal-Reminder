/**
 * Personal Reminder - Authentication Handler
 * 
 * Supports Supabase Auth (Sign In, Password Reset, Password Update)
 * with graceful fallback to demo mode when credentials are unconfigured.
 */

(function () {
  'use strict';

  // DOM Elements
  const loginForm = document.getElementById('login-form');
  const resetForm = document.getElementById('reset-form');
  const updatePasswordForm = document.getElementById('update-password-form');
  const authTitle = document.getElementById('auth-title');
  const authSubtitle = document.getElementById('auth-subtitle');
  const authAlert = document.getElementById('auth-alert');
  const alertIcon = document.getElementById('alert-icon');
  const alertMessage = document.getElementById('alert-message');
  const authConfigNotice = document.getElementById('auth-config-notice');

  const btnToggleReset = document.getElementById('btn-toggle-reset');
  const btnCancelReset = document.getElementById('btn-cancel-reset');

  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const loginEmailError = document.getElementById('login-email-error');
  const loginPasswordError = document.getElementById('login-password-error');
  const loginSpinner = document.getElementById('login-spinner');
  const loginBtnText = document.getElementById('login-btn-text');
  const btnLoginSubmit = document.getElementById('btn-login-submit');

  const resetEmail = document.getElementById('reset-email');
  const resetEmailError = document.getElementById('reset-email-error');
  const resetSpinner = document.getElementById('reset-spinner');
  const resetBtnText = document.getElementById('reset-btn-text');
  const btnResetSubmit = document.getElementById('btn-reset-submit');

  const newPassword = document.getElementById('new-password');
  const newPasswordError = document.getElementById('new-password-error');
  const updatePasswordSpinner = document.getElementById('update-password-spinner');
  const updatePasswordBtnText = document.getElementById('update-password-btn-text');
  const btnUpdatePasswordSubmit = document.getElementById('btn-update-password-submit');

  // Helper: Show Alert
  function showAlert(message, type = 'error') {
    if (!authAlert) return;
    authAlert.className = `alert alert-${type}`;
    alertMessage.textContent = message;

    if (type === 'success') {
      alertIcon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
    } else {
      alertIcon.innerHTML = '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>';
    }
    authAlert.classList.remove('hidden');
  }

  function hideAlert() {
    if (authAlert) authAlert.classList.add('hidden');
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Check if Supabase credentials are configured
  const isConfigured = window.SupabaseModule && window.SupabaseModule.isConfigured();
  if (!isConfigured && authConfigNotice) {
    authConfigNotice.classList.remove('hidden');
  }

  // Check URL hash / params for password recovery link
  async function checkRecoveryMode() {
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(window.location.search);
    const isRecovery = urlParams.get('type') === 'recovery' || hash.includes('type=recovery');

    if (isRecovery) {
      if (loginForm) loginForm.classList.add('hidden');
      if (resetForm) resetForm.classList.add('hidden');
      if (updatePasswordForm) updatePasswordForm.classList.remove('hidden');
      authTitle.textContent = 'Set New Password';
      authSubtitle.textContent = 'Enter your new owner password below.';
    }
  }

  // Check if user is already logged in
  async function checkExistingSession() {
    if (isConfigured) {
      try {
        const session = await window.SupabaseModule.getSession();
        if (session && session.user) {
          // If already authenticated and not resetting password, forward to dashboard
          if (!window.location.hash.includes('type=recovery')) {
            window.location.replace('dashboard.html');
          }
        }
      } catch (e) {
        console.warn('Session verification notice:', e.message);
      }
    }
  }

  // Switch to Reset Form
  if (btnToggleReset) {
    btnToggleReset.addEventListener('click', () => {
      hideAlert();
      loginForm.classList.add('hidden');
      resetForm.classList.remove('hidden');
      authTitle.textContent = 'Reset Password';
      authSubtitle.textContent = 'Enter your email to receive a password recovery link.';
      resetEmail.focus();
    });
  }

  // Switch back to Login Form
  if (btnCancelReset) {
    btnCancelReset.addEventListener('click', () => {
      hideAlert();
      resetForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
      authTitle.textContent = 'Owner Sign In';
      authSubtitle.textContent = 'Private reminder portal. Enter your credentials to continue.';
      loginEmail.focus();
    });
  }

  // Handle Login Submit
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      let hasError = false;
      const email = loginEmail.value.trim();
      const password = loginPassword.value;

      if (!email) {
        loginEmail.classList.add('error');
        loginEmailError.textContent = 'Email address is required.';
        loginEmailError.classList.remove('hidden');
        hasError = true;
      } else if (!isValidEmail(email)) {
        loginEmail.classList.add('error');
        loginEmailError.textContent = 'Please enter a valid email address.';
        loginEmailError.classList.remove('hidden');
        hasError = true;
      } else {
        loginEmail.classList.remove('error');
        loginEmailError.classList.add('hidden');
      }

      if (!password) {
        loginPassword.classList.add('error');
        loginPasswordError.textContent = 'Password is required.';
        loginPasswordError.classList.remove('hidden');
        hasError = true;
      } else {
        loginPassword.classList.remove('error');
        loginPasswordError.classList.add('hidden');
      }

      if (hasError) return;

      btnLoginSubmit.disabled = true;
      loginSpinner.classList.remove('hidden');
      loginBtnText.textContent = 'Signing in...';

      if (isConfigured) {
        try {
          await window.SupabaseModule.signIn(email, password);
          showAlert('Sign-in successful. Loading dashboard...', 'success');
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 500);
        } catch (err) {
          btnLoginSubmit.disabled = false;
          loginSpinner.classList.add('hidden');
          loginBtnText.textContent = 'Sign In';

          let friendlyMessage = err.message || 'Authentication failed.';
          if (friendlyMessage.includes('Invalid login credentials')) {
            friendlyMessage = 'Invalid email or password. Please check your credentials.';
          } else if (friendlyMessage.includes('Email not confirmed')) {
            friendlyMessage = 'Email address has not been confirmed in Supabase Auth.';
          } else if (friendlyMessage.includes('Failed to fetch')) {
            friendlyMessage = 'Network error: Unable to connect to Supabase. Check your internet connection or Supabase URL.';
          }
          showAlert(friendlyMessage, 'error');
        }
      } else {
        // Fallback for local demo simulation when config.js has not been filled
        setTimeout(() => {
          btnLoginSubmit.disabled = false;
          loginSpinner.classList.add('hidden');
          loginBtnText.textContent = 'Sign In';

          showAlert('Demo sign-in accepted (Supabase unconfigured). Redirecting...', 'success');
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 500);
        }, 600);
      }
    });
  }

  // Handle Password Reset Request
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const email = resetEmail.value.trim();
      if (!email || !isValidEmail(email)) {
        resetEmail.classList.add('error');
        resetEmailError.textContent = 'Please enter a valid email address.';
        resetEmailError.classList.remove('hidden');
        return;
      }

      resetEmail.classList.remove('error');
      resetEmailError.classList.add('hidden');

      btnResetSubmit.disabled = true;
      resetSpinner.classList.remove('hidden');
      resetBtnText.textContent = 'Sending...';

      if (isConfigured) {
        try {
          await window.SupabaseModule.resetPassword(email);
          btnResetSubmit.disabled = false;
          resetSpinner.classList.add('hidden');
          resetBtnText.textContent = 'Send Reset Link';
          showAlert(`Password recovery email sent to ${email}. Please check your inbox.`, 'success');
        } catch (err) {
          btnResetSubmit.disabled = false;
          resetSpinner.classList.add('hidden');
          resetBtnText.textContent = 'Send Reset Link';
          showAlert(err.message || 'Unable to send password recovery email.', 'error');
        }
      } else {
        setTimeout(() => {
          btnResetSubmit.disabled = false;
          resetSpinner.classList.add('hidden');
          resetBtnText.textContent = 'Send Reset Link';
          showAlert(`(Demo Mode) Password recovery email simulated for ${email}.`, 'success');
        }, 600);
      }
    });
  }

  // Handle Update Password Submit (Recovery flow)
  if (updatePasswordForm) {
    updatePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const pwd = newPassword.value;
      if (!pwd || pwd.length < 6) {
        newPassword.classList.add('error');
        newPasswordError.textContent = 'Password must be at least 6 characters.';
        newPasswordError.classList.remove('hidden');
        return;
      }

      newPassword.classList.remove('error');
      newPasswordError.classList.add('hidden');

      btnUpdatePasswordSubmit.disabled = true;
      updatePasswordSpinner.classList.remove('hidden');
      updatePasswordBtnText.textContent = 'Updating...';

      try {
        const sb = window.SupabaseModule.getClient();
        if (!sb) throw new Error('Supabase client unavailable.');

        const { error } = await sb.auth.updateUser({ password: pwd });
        if (error) throw error;

        showAlert('Password successfully updated! Redirecting to dashboard...', 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1200);
      } catch (err) {
        btnUpdatePasswordSubmit.disabled = false;
        updatePasswordSpinner.classList.add('hidden');
        updatePasswordBtnText.textContent = 'Update Password';
        showAlert(err.message || 'Unable to update password.', 'error');
      }
    });
  }

  // Initialize
  checkRecoveryMode();
  checkExistingSession();
})();
