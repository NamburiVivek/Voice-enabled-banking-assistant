/**
 * Auth.jsx - Login + Sign Up page with two-panel layout.
 * 🔒 All inputs sanitised via the backend (Pydantic).
 * 🔒 Password never stored or logged client-side.
 * 🔒 Generic error messages to prevent user enumeration.
 */

import React, { useState, useCallback } from 'react';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Mic,
  Zap,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import './Auth.css';

// ── Password strength calculator ──────────────────────────────────
function calcStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[@$!%*?&^#\-_]/.test(pw)) score++;
  return score; // 0–4
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_CLASSES = ['', 'filled-weak', 'filled-fair', 'filled-good', 'filled-strong'];

function PasswordStrength({ password }) {
  if (!password) return null;
  const score = calcStrength(password);
  return (
    <div className="password-strength">
      <div className="strength-bars">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`strength-bar ${i <= score ? STRENGTH_CLASSES[score] : ''}`}
          />
        ))}
      </div>
      <span className="strength-label">{STRENGTH_LABELS[score]}</span>
    </div>
  );
}

// ── Branding panel ────────────────────────────────────────────────
function BrandPanel() {
  return (
    <div className="auth-brand-panel">
      <div className="auth-brand-content">
        <div className="auth-brand-logo">
          <LeafLogo size={32} />
          <span className="auth-brand-logo-name">Voxa Bank AI</span>
        </div>

        <div className="auth-brand-hero">
          <h1 className="auth-brand-tagline">
            Banking that<br />
            <span>understands you</span>
          </h1>
          <p className="auth-brand-desc">
            Transfer money, check balances, and manage your finances — all with
            your voice. Secure, instant, and always available.
          </p>
        </div>

        <div className="auth-brand-badges">
          {[
            { icon: <Mic size={18} />, title: 'Voice-First Banking', sub: 'Natural language commands' },
            { icon: <ShieldCheck size={18} />, title: 'Bank-Grade Security', sub: 'End-to-end encrypted' },
            { icon: <Zap size={18} />, title: 'Instant Responses', sub: 'Powered by Groq AI' },
          ].map(({ icon, title, sub }) => (
            <div key={title} className="auth-badge">
              <div className="auth-badge-icon">{icon}</div>
              <div className="auth-badge-text">
                <strong>{title}</strong>
                <span>{sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Leaf Logo (reused from Dashboard) ────────────────────────────
function LeafLogo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="leafGradAuth" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-primary)" />
          <stop offset="100%" stopColor="var(--color-accent)" />
        </linearGradient>
      </defs>
      <path d="M50 92 L50 22" stroke="url(#leafGradAuth)" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 34 C30 34 14 18 12 4 C34 4 50 16 50 34 Z" fill="url(#leafGradAuth)" />
      <path d="M50 50 C72 50 88 34 90 20 C68 20 50 32 50 50 Z" fill="url(#leafGradAuth)" />
      <path d="M50 62 C34 62 22 50 19 38 C39 38 50 46 50 62 Z" fill="url(#leafGradAuth)" />
    </svg>
  );
}

// ── Alert Banner ──────────────────────────────────────────────────
function Alert({ type, message }) {
  if (!message) return null;
  const Icon = type === 'error' ? AlertCircle : CheckCircle;
  return (
    <div className={`auth-alert ${type}`}>
      <Icon size={16} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{message}</span>
    </div>
  );
}

// ── Login Form ────────────────────────────────────────────────────
function LoginForm({ onSwitchToRegister }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');

    // Basic client-side gate (server validates fully)
    if (!email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setIsLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      // On success, AuthContext updates user → App re-routes to dashboard
    } catch (err) {
      const msg = err?.response?.data?.detail;
      if (msg) {
        setError(msg);
      } else if (!err?.response) {
        setError('Cannot reach backend server (Network or CORS error). Please check backend URL & status.');
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [email, password, login]);

  return (
    <>
      <div className="auth-form-header">
        <h2 className="auth-form-title">Welcome back</h2>
        <p className="auth-form-subtitle">Sign in to your Voxa account</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Alert type="error" message={error} />

        <div className="form-group">
          <label className="form-label" htmlFor="login-email">Email address</label>
          <div className="form-input-wrapper">
            <span className="form-input-icon"><Mail size={16} /></span>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              maxLength={254}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="login-password">Password</label>
          <div className="form-input-wrapper">
            <span className="form-input-icon"><Lock size={16} /></span>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              maxLength={128}
            />
            <button
              type="button"
              className="form-password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          id="login-submit-btn"
          type="submit"
          className="auth-submit-btn"
          disabled={isLoading}
        >
          {isLoading ? (
            <><div className="spinner" /> Signing in…</>
          ) : (
            <>Sign In <ArrowRight size={18} /></>
          )}
        </button>
      </form>

      <div className="auth-switch">
        Don't have an account?
        <button onClick={onSwitchToRegister}>Create one free</button>
      </div>
    </>
  );
}

// ── Register Form ─────────────────────────────────────────────────
function RegisterForm({ onSwitchToLogin }) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!fullName.trim() || fullName.trim().length < 2) errs.fullName = 'Name must be at least 2 characters.';
    if (!email.includes('@')) errs.email = 'Enter a valid email address.';
    if (password.length < 8) errs.password = 'Password must be at least 8 characters.';
    if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match.';
    return errs;
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsLoading(true);
    try {
      await register(fullName.trim(), email.trim().toLowerCase(), password, confirmPassword);
    } catch (err) {
      const data = err?.response?.data;
      if (Array.isArray(data?.detail)) {
        setError(data.detail.map((e) => e.msg).join(' '));
      } else if (data?.detail) {
        setError(data.detail);
      } else if (!err?.response) {
        setError('Cannot reach backend server (Network or CORS error). Please check backend URL & status.');
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [fullName, email, password, confirmPassword, register]);

  return (
    <>
      <div className="auth-form-header">
        <h2 className="auth-form-title">Create account</h2>
        <p className="auth-form-subtitle">Join Voxa and bank smarter</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Alert type="error" message={error} />

        {/* Full Name */}
        <div className="form-group">
          <label className="form-label" htmlFor="reg-name">Full name</label>
          <div className="form-input-wrapper">
            <span className="form-input-icon"><User size={16} /></span>
            <input
              id="reg-name"
              type="text"
              className={`form-input ${fieldErrors.fullName ? 'error' : ''}`}
              placeholder="Alex Johnson"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
              maxLength={80}
            />
          </div>
          {fieldErrors.fullName && <p className="form-error-text"><AlertCircle size={12} />{fieldErrors.fullName}</p>}
        </div>

        {/* Email */}
        <div className="form-group">
          <label className="form-label" htmlFor="reg-email">Email address</label>
          <div className="form-input-wrapper">
            <span className="form-input-icon"><Mail size={16} /></span>
            <input
              id="reg-email"
              type="email"
              className={`form-input ${fieldErrors.email ? 'error' : ''}`}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              maxLength={254}
            />
          </div>
          {fieldErrors.email && <p className="form-error-text"><AlertCircle size={12} />{fieldErrors.email}</p>}
        </div>

        {/* Password */}
        <div className="form-group">
          <label className="form-label" htmlFor="reg-password">Password</label>
          <div className="form-input-wrapper">
            <span className="form-input-icon"><Lock size={16} /></span>
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              className={`form-input ${fieldErrors.password ? 'error' : ''}`}
              placeholder="Min 8 chars, with uppercase & symbol"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              maxLength={128}
            />
            <button
              type="button"
              className="form-password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <PasswordStrength password={password} />
          {fieldErrors.password && <p className="form-error-text"><AlertCircle size={12} />{fieldErrors.password}</p>}
        </div>

        {/* Confirm Password */}
        <div className="form-group">
          <label className="form-label" htmlFor="reg-confirm">Confirm password</label>
          <div className="form-input-wrapper">
            <span className="form-input-icon"><Lock size={16} /></span>
            <input
              id="reg-confirm"
              type={showConfirm ? 'text' : 'password'}
              className={`form-input ${fieldErrors.confirmPassword ? 'error' : ''}`}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              maxLength={128}
            />
            <button
              type="button"
              className="form-password-toggle"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {fieldErrors.confirmPassword && (
            <p className="form-error-text"><AlertCircle size={12} />{fieldErrors.confirmPassword}</p>
          )}
        </div>

        <p className="auth-terms">
          By creating an account, you agree to our{' '}
          <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>.
        </p>

        <button
          id="register-submit-btn"
          type="submit"
          className="auth-submit-btn"
          disabled={isLoading}
        >
          {isLoading ? (
            <><div className="spinner" /> Creating account…</>
          ) : (
            <>Create Account <ArrowRight size={18} /></>
          )}
        </button>
      </form>

      <div className="auth-switch">
        Already have an account?
        <button onClick={onSwitchToLogin}>Sign in</button>
      </div>
    </>
  );
}

// ── Auth Page (container) ─────────────────────────────────────────
export default function AuthPage({ onBack }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'

  return (
    <div className="auth-page">
      <BrandPanel />

      <div className="auth-form-panel">
        <div className="auth-form-wrapper">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                fontSize: '0.88rem',
                cursor: 'pointer',
                marginBottom: '1.25rem',
                padding: '0.25rem 0',
              }}
            >
              ← Back to Home
            </button>
          )}

          {/* Tabs */}
          <div className="auth-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={mode === 'login'}
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => setMode('login')}
              id="tab-login"
            >
              Sign In
            </button>
            <button
              role="tab"
              aria-selected={mode === 'register'}
              className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => setMode('register')}
              id="tab-register"
            >
              Sign Up
            </button>
          </div>

          {mode === 'login' ? (
            <LoginForm onSwitchToRegister={() => setMode('register')} />
          ) : (
            <RegisterForm onSwitchToLogin={() => setMode('login')} />
          )}
        </div>
      </div>
    </div>
  );
}
