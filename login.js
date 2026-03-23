/**
 * LeapLearn — Login Page Script
 * Handles: role tabs, form validation, password toggle, submit flow
 */

(function () {
  'use strict';

  /* ── DOM refs ─────────────────────────────────────────────── */
  const form        = document.getElementById('login-form');
  const emailInput  = document.getElementById('email');
  const passInput   = document.getElementById('password');
  const emailError  = document.getElementById('email-error');
  const passError   = document.getElementById('password-error');
  const submitBtn   = document.getElementById('submit-btn');
  const togglePass  = document.querySelector('.toggle-password');
  const eyeOff      = document.querySelector('.eye-off');
  const eyeOn       = document.querySelector('.eye-on');
  const roleTabs    = document.querySelectorAll('.role-tab');

  let currentRole = 'student';

  /* ── Role tab switching ───────────────────────────────────── */
  roleTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      roleTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      currentRole = tab.dataset.role;

      // Update placeholder to reflect role context
      emailInput.placeholder = currentRole === 'educator'
        ? 'educator@school.edu'
        : 'you@school.edu';
    });
  });

  /* ── Password visibility toggle ──────────────────────────── */
  togglePass.addEventListener('click', () => {
    const isPassword = passInput.type === 'password';
    passInput.type = isPassword ? 'text' : 'password';
    eyeOff.classList.toggle('hidden', isPassword);
    eyeOn.classList.toggle('hidden', !isPassword);
    togglePass.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    passInput.focus();
  });

  /* ── Validation helpers ───────────────────────────────────── */
  function showError(input, errorEl, message) {
    input.classList.add('has-error');
    errorEl.textContent = message;
    errorEl.classList.add('visible');
  }

  function clearError(input, errorEl) {
    input.classList.remove('has-error');
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
  }

  function validateEmail(value) {
    if (!value.trim()) return 'Email address is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.';
    return null;
  }

  function validatePassword(value) {
    if (!value) return 'Password is required.';
    if (value.length < 6) return 'Password must be at least 6 characters.';
    return null;
  }

  /* ── Inline validation on blur ───────────────────────────── */
  emailInput.addEventListener('blur', () => {
    const err = validateEmail(emailInput.value);
    err ? showError(emailInput, emailError, err) : clearError(emailInput, emailError);
  });

  emailInput.addEventListener('input', () => {
    if (emailInput.classList.contains('has-error')) {
      const err = validateEmail(emailInput.value);
      err ? showError(emailInput, emailError, err) : clearError(emailInput, emailError);
    }
  });

  passInput.addEventListener('blur', () => {
    const err = validatePassword(passInput.value);
    err ? showError(passInput, passError, err) : clearError(passInput, passError);
  });

  passInput.addEventListener('input', () => {
    if (passInput.classList.contains('has-error')) {
      const err = validatePassword(passInput.value);
      err ? showError(passInput, passError, err) : clearError(passInput, passError);
    }
  });

  /* ── Form submission ──────────────────────────────────────── */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate all fields
    const emailErr = validateEmail(emailInput.value);
    const passErr  = validatePassword(passInput.value);

    if (emailErr) showError(emailInput, emailError, emailErr);
    else          clearError(emailInput, emailError);

    if (passErr) showError(passInput, passError, passErr);
    else         clearError(passInput, passError);

    if (emailErr || passErr) {
      // Focus first invalid field
      if (emailErr) emailInput.focus();
      else passInput.focus();
      return;
    }

    // Loading state
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').textContent = 'Signing in…';

    try {
      // ── Replace this block with your real auth call ──────────
      // Example:
      //   const res = await fetch('/api/auth/login', {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify({
      //       email: emailInput.value.trim(),
      //       password: passInput.value,
      //       role: currentRole,
      //     })
      //   });
      //   if (!res.ok) throw new Error('Invalid credentials');
      //   const { token } = await res.json();
      //   localStorage.setItem('ll_token', token);
      //   window.location.href = '/dashboard.html';
      // ─────────────────────────────────────────────────────────

      // Simulated delay for demo purposes
      await simulateAuth();

      // On success — redirect to dashboard
      submitBtn.querySelector('.btn-text').textContent = '✓ Success!';
      setTimeout(() => {
        // window.location.href = '/dashboard.html';
        alert(`Signed in as ${currentRole}: ${emailInput.value}`);
        resetSubmitBtn();
      }, 800);

    } catch (err) {
      // Show a credential error
      showError(passInput, passError, 'Incorrect email or password. Please try again.');
      passInput.focus();
      resetSubmitBtn();
    }
  });

  function resetSubmitBtn() {
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').textContent = 'Sign in';
  }

  /* ── Demo helper (remove when wiring real API) ───────────── */
  function simulateAuth() {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate success; swap to reject() to test error state
        resolve();
      }, 1400);
    });
  }

  /* ── Social button placeholders ──────────────────────────── */
  document.querySelectorAll('.social-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const provider = btn.getAttribute('aria-label').replace('Sign in with ', '');
      // Wire up OAuth redirect here:
      // window.location.href = `/auth/${provider.toLowerCase()}`;
      alert(`${provider} OAuth coming soon.`);
    });
  });

})();
