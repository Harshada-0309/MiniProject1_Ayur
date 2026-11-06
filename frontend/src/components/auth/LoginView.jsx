import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import DashboardIcon from '../ui/DashboardIcons';
import ThemeToggle from '../ui/ThemeToggle';
import '../../styles/split-login.css';

export default function LoginView({ onLoginSuccess, onNavigateToLanding }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Proactively purge any legacy demo accounts from browser localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ayurdiet_remember_email');
      if (saved === 'vaidya@ayurdiet.clinic' || saved === 'dr.sharma@ayurdiet.clinic') {
        localStorage.removeItem('ayurdiet_remember_email');
      }
    } catch (_) {}
  }, []);

  // Sign In / Common Fields
  const [email, setEmail] = useState(() => {
    const saved = localStorage.getItem('ayurdiet_remember_email');
    if (saved === 'vaidya@ayurdiet.clinic' || saved === 'dr.sharma@ayurdiet.clinic') {
      try {
        localStorage.removeItem('ayurdiet_remember_email');
      } catch (_) {}
      return '';
    }
    return saved || '';
  });
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => {
    const saved = localStorage.getItem('ayurdiet_remember_email');
    return Boolean(saved && saved !== 'vaidya@ayurdiet.clinic' && saved !== 'dr.sharma@ayurdiet.clinic');
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Register Fields
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('Clinical Dietitian');
  const [qualifications, setQualifications] = useState('BAMS, PGD Clinical Nutrition');

  // Check if current email string is a syntactically valid email
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedEmail = email.trim();

    if (isRegisterMode) {
      // Registration validation
      if (!name.trim()) {
        setErrorMessage('Please enter your full practitioner name (e.g. Dr. Ananya Sen).');
        return;
      }
      if (!trimmedEmail) {
        setErrorMessage('Please enter your professional clinic email address.');
        return;
      }
      if (!isEmailValid) {
        setErrorMessage('Please enter a valid email address.');
        return;
      }
      if (!password || password.length < 6) {
        setErrorMessage('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please re-enter.');
        return;
      }

      try {
        setLoading(true);
        const res = await api.register({
          name: name.trim(),
          email: trimmedEmail,
          password,
          role: role.trim() || 'Clinical Dietitian',
          qualifications: qualifications.trim() || 'BAMS, Certified Ayurvedic Nutritionist',
          clinic_name: 'AyurDiet Integrative Health Clinic',
        });

        if (res?.data?.dietitian && onLoginSuccess) {
          onLoginSuccess(res.data.dietitian);
        }
      } catch (err) {
        console.error('Registration error:', err);
        setErrorMessage(err.message || 'Registration failed. Please check your information.');
      } finally {
        setLoading(false);
      }
    } else {
      // Sign In validation
      if (!trimmedEmail || !password) {
        setErrorMessage('Please enter both your clinic email and practitioner password.');
        return;
      }

      try {
        setLoading(true);

        if (rememberMe) {
          localStorage.setItem('ayurdiet_remember_email', trimmedEmail);
        } else {
          localStorage.removeItem('ayurdiet_remember_email');
        }

        const res = await api.login({
          email: trimmedEmail,
          password,
        });

        if (res?.data?.dietitian && onLoginSuccess) {
          onLoginSuccess(res.data.dietitian);
        }
      } catch (err) {
        console.error('Login error:', err);
        setErrorMessage(
          err.message || 'Authentication failed. Please verify your practitioner credentials.'
        );
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="split-login-backdrop">
      {/* Dimmed atmospheric background overlay */}
      <div className="split-login-dimmed-overlay" />

      {/* Main Split-Screen Card */}
      <div className="split-login-container" role="main" aria-label="AyurDiet Practitioner Authentication">

        {/* Left Side: Form Panel (~41% on desktop) */}
        <div className="split-login-form-panel">
          <div className="split-login-inner-top">

            {/* AyurDiet Logo Header */}
            <div className="split-login-brand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <img
                src="/images/ayurdiet-logo-horizontal.png"
                alt="AyurDiet — Ayurvedic Nutrition & Dietitian"
                className="split-login-logo"
                onClick={onNavigateToLanding}
                title="Return to AyurDiet Home"
                style={{ cursor: 'pointer' }}
              />
              <ThemeToggle />
            </div>

            {/* Mode Switcher Tabs */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1.5px solid var(--color-border)',
                marginBottom: '1rem',
                gap: '1rem',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(false);
                  setErrorMessage('');
                }}
                style={{
                  flex: 1,
                  padding: '0.65rem 0',
                  border: 'none',
                  background: 'none',
                  fontWeight: !isRegisterMode ? 700 : 500,
                  color: !isRegisterMode ? 'var(--color-primary)' : 'var(--color-slate-muted)',
                  borderBottom: !isRegisterMode ? '2.5px solid var(--color-primary)' : '2.5px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  transition: 'all 0.15s ease',
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(true);
                  setErrorMessage('');
                }}
                style={{
                  flex: 1,
                  padding: '0.65rem 0',
                  border: 'none',
                  background: 'none',
                  fontWeight: isRegisterMode ? 700 : 500,
                  color: isRegisterMode ? 'var(--color-primary)' : 'var(--color-slate-muted)',
                  borderBottom: isRegisterMode ? '2.5px solid var(--color-primary)' : '2.5px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  transition: 'all 0.15s ease',
                }}
              >
                Create Account
              </button>
            </div>

            {/* Typography per mode */}
            <h1 className="split-login-title">
              {isRegisterMode ? 'Register Practitioner' : 'Welcome Back'}
            </h1>
            <p className="split-login-subtitle">
              {isRegisterMode
                ? 'Register a new clinical dietitian account to access patient assessments and dietary protocols.'
                : 'Sign in to your AyurDiet account to continue your personalized nutrition journey.'}
            </p>

            {/* Error Alert */}
            {errorMessage && (
              <div className="split-login-error" role="alert">
                <span className="split-login-error-icon" style={{ display: 'flex', alignItems: 'center' }}>
                  <DashboardIcon name="shield-alert" size={15} />
                </span>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success Alert */}
            {successMessage && (
              <div className="toast-banner toast-success" style={{ margin: '0 0 1rem 0' }}>
                <DashboardIcon name="check" size={15} />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Authentication / Registration Form */}
            <form onSubmit={handleSubmit} className="split-login-form" noValidate>

              {/* Full Name Field (Register Mode Only) */}
              {isRegisterMode && (
                <div className="split-input-group">
                  <label className="split-input-label" htmlFor="dietitian-name">
                    Full Practitioner Name <span style={{ color: 'var(--color-error)' }}>*</span>
                  </label>
                  <div className="split-input-wrapper">
                    <input
                      id="dietitian-name"
                      type="text"
                      className="split-input"
                      placeholder="e.g. Dr. Ananya Sen"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              {/* Email Field */}
              <div className="split-input-group">
                <label className="split-input-label" htmlFor="dietitian-email">
                  Email Address <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <div className="split-input-wrapper">
                  <input
                    id="dietitian-email"
                    type="email"
                    className={`split-input ${isEmailValid ? 'is-valid' : ''}`}
                    placeholder="name@ayurdiet.clinic"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    disabled={loading}
                  />
                  {isEmailValid && (
                    <span className="split-valid-badge" title="Valid email format" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <circle cx="9" cy="9" r="9" fill="#3F6B35" />
                        <path d="M5.5 9.2L7.8 11.5L12.5 6.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </div>
              </div>

              {/* Password Field */}
              <div className="split-input-group">
                <label className="split-input-label" htmlFor="dietitian-password">
                  Password <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <div className="split-input-wrapper">
                  <input
                    id="dietitian-password"
                    type={showPassword ? 'text' : 'password'}
                    className="split-input"
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                    disabled={loading}
                    style={{ paddingRight: '42px' }}
                  />
                  <button
                    type="button"
                    className="split-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field (Register Mode Only) */}
              {isRegisterMode && (
                <div className="split-input-group">
                  <label className="split-input-label" htmlFor="dietitian-confirm-password">
                    Confirm Password <span style={{ color: 'var(--color-error)' }}>*</span>
                  </label>
                  <div className="split-input-wrapper">
                    <input
                      id="dietitian-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      className="split-input"
                      placeholder="Repeat your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              {/* Professional Title & Qualifications (Register Mode Only) */}
              {isRegisterMode && (
                <div className="grid-2" style={{ gap: '0.65rem' }}>
                  <div className="split-input-group">
                    <label className="split-input-label" htmlFor="dietitian-role">
                      Professional Role
                    </label>
                    <input
                      id="dietitian-role"
                      type="text"
                      className="split-input"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="e.g. Clinical Dietitian"
                      disabled={loading}
                    />
                  </div>

                  <div className="split-input-group">
                    <label className="split-input-label" htmlFor="dietitian-quals">
                      Qualifications
                    </label>
                    <input
                      id="dietitian-quals"
                      type="text"
                      className="split-input"
                      value={qualifications}
                      onChange={(e) => setQualifications(e.target.value)}
                      placeholder="e.g. BAMS, MD"
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              {/* Form Options Row: Remember Me (Sign In Mode Only) */}
              {!isRegisterMode && (
                <div className="split-form-row">
                  <label className="split-checkbox-label" htmlFor="login-remember-me">
                    <input
                      id="login-remember-me"
                      type="checkbox"
                      className="split-checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      disabled={loading}
                    />
                    <span>Remember me</span>
                  </label>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="split-submit-btn"
                disabled={loading}
                id="login-submit-button"
                style={{ marginTop: isRegisterMode ? '0.5rem' : '1rem' }}
              >
                {loading ? (
                  <span className="split-btn-loading">
                    <span className="split-spinner" />
                    {isRegisterMode ? 'Creating Account...' : 'Authenticating...'}
                  </span>
                ) : (
                  isRegisterMode ? 'Create Practitioner Account' : 'Sign In'
                )}
              </button>
            </form>

          </div>

          {/* Navigation back to Public Landing */}
          <div className="split-login-footer">
            <button
              type="button"
              className="split-back-link"
              onClick={onNavigateToLanding}
            >
              ← Return to AyurDiet Home
            </button>
          </div>

        </div>

        {/* Right Side: High-Resolution Fruit Bowl Photograph (~59% on desktop) */}
        <div className="split-login-image-panel" aria-hidden="true">
          <div className="split-image-container">
            <img
              src="/images/fruit-bowl-login.jpg"
              alt="Fresh wholesome Ayurvedic fruit and granola bowl with berries, bananas, and seeds"
              className="split-food-image"
              loading="eager"
            />
            {/* Subtle luxury overlay vignette */}
            <div className="split-image-overlay" />

            {/* Subtle floating Satvik Ahara badge */}
            <div className="split-image-badge">
              <span className="split-badge-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DashboardIcon name="sprout" size={18} />
              </span>
              <div className="split-badge-text">
                <strong>Satvik Ahara</strong>
                <span>Pure nourishment for body, mind & doshas</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
