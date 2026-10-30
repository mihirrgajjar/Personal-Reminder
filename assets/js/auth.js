/**
 * Personal Reminder - Authentication Handler (Phase 1 Foundation)
 * 
 * Provides client-side validation and interactive feedback for the login & reset flows.
 * Supabase Auth client integration is implemented in Phase 2.
 */

(function () {
  'use strict';

  // DOM Elements
  const loginForm = document.getElementById('login-form');
  const resetForm = document.getElementById('reset-form');
  const authTitle = document.getElementById('auth-title');
  const authSubtitle = document.getElementById('auth-subtitle');
  const authAlert = document.getElementById('auth-alert');
  const alertIcon = document.getElementById('alert-icon');
  const alertMessage = document.getElementById('alert-message');

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

  // Helper: Email Validation
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      hideAlert();

      let hasError = false;
      const email = loginEmail.value.trim();
      const password = loginPassword.value;

      // Validate email
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

      // Validate password
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

      // Show loading state
      btnLoginSubmit.disabled = true;
      loginSpinner.classList.remove('hidden');
      loginBtnText.textContent = 'Verifying...';

      // Phase 1 Demo simulation (In Phase 2, Supabase signInWithPassword will be used)
      setTimeout(() => {
        btnLoginSubmit.disabled = false;
        loginSpinner.classList.add('hidden');
        loginBtnText.textContent = 'Sign In';

        // Check demo credentials or accept owner demo login
        showAlert('Demo sign-in verified. Redirecting to dashboard...', 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 600);
      }, 700);
    });
  }

  // Handle Password Reset Submit
  if (resetForm) {
    resetForm.addEventListener('submit', (e) => {
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

      // Phase 1 Demo simulation (In Phase 2, Supabase resetPasswordForEmail will be used)
      setTimeout(() => {
        btnResetSubmit.disabled = false;
        resetSpinner.classList.add('hidden');
        resetBtnText.textContent = 'Send Reset Link';

        showAlert(`A reset link simulation has been sent to ${email}.`, 'success');
      }, 800);
    });
  }
})();
