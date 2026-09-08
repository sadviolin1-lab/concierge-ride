'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/use-lang';
import LangToggle from '@/components/LangToggle';
import styles from './login.module.css';

// ── สองภาษา / Bilingual text ─────────────────────────────────────────────────
const LANG = {
  th: {
    sub:          'ระบบจัดการบริการรับส่ง',
    welcome:      'ยินดีต้อนรับ',
    tagline:      'เข้าสู่ระบบเพื่อใช้งาน',
    idLabel:      'รหัสพนักงาน',
    idPlaceholder:'เช่น 123456',
    pwLabel:      'รหัสผ่าน',
    pwPlaceholder:'••••••••',
    submit:       'เข้าสู่ระบบ',
    submitting:   'กำลังเข้าสู่ระบบ…',
    noAccount:    'ยังไม่มีบัญชี?',
    createLink:   'สมัครใช้งานที่นี่',
    errInvalid:   'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่',
    errEmpty:     'กรุณากรอกรหัสพนักงาน',
  },
  en: {
    sub:          'Staff Transport Management',
    welcome:      'Welcome back',
    tagline:      'Sign in to your account to continue',
    idLabel:      'Employee ID',
    idPlaceholder:'e.g. 123456',
    pwLabel:      'Password',
    pwPlaceholder:'••••••••',
    submit:       'Sign In',
    submitting:   'Signing in…',
    noAccount:    "Don't have an account?",
    createLink:   'Create one here',
    errInvalid:   'Employee ID or password is incorrect. Please try again.',
    errEmpty:     'Please enter your Employee ID.',
  },
} as const;



export default function LoginPage() {
  const { firebaseUser, userProfile, signInWithEmployeeId, loading } = useAuth();
  const router = useRouter();

  // Wait for the context to reflect the logged in state, then redirect
  useEffect(() => {
    if (!loading && firebaseUser && userProfile && userProfile.status === 'active') {
      router.replace('/home');
    }
  }, [loading, firebaseUser, userProfile, router]);

  const { lang, setLang } = useLang();
  const t = LANG[lang];

  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim()) {
      setError(t.errEmpty);
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await signInWithEmployeeId(employeeId, password);
      // Wait for onAuthStateChanged to pick up the user, useEffect will handle redirect
    } catch (err: any) {
      const msg = err?.message || '';
      const code = err?.code || '';
      const isAuthError = code.startsWith('auth/') || msg.includes('auth/');
      
      if (isAuthError) {
        console.warn("Login failed (auth error):", code || msg);
      } else {
        console.error("Login Error:", err);
      }

      if (
        msg.includes('invalid-credential') ||
        msg.includes('wrong-password') ||
        msg.includes('Firebase') ||
        msg.includes('auth/')
      ) {
        setError(t.errInvalid);
      } else {
        // Show the custom message from signInWithEmployeeId (bilingual)
        setError(msg || t.errInvalid);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* reCAPTCHA container for safety during Auth transitions */}
      <div id="recaptcha-container" style={{ position: 'absolute', bottom: 0 }} />

      <div className={styles.card} role="main">
        {/* Header row: Logo & Language Toggle */}
        <div className={styles.headerRow}>
          <div className={styles.logo}>
            <div className={styles.logoIcon} aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="2.5" fill="currentColor" />
                <line x1="12" y1="2" x2="12" y2="9.5" />
                <line x1="12" y1="12" x2="4" y2="17" />
                <line x1="12" y1="12" x2="20" y2="17" />
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 className={styles.logoTitle}>Concierge Ride</h1>
              <p className={styles.logoSub}>{t.sub}</p>
            </div>
          </div>
          <div className={styles.langToggleWrap}>
            <LangToggle />
          </div>
        </div>

        <hr className="divider" />

        <h2 className={styles.heading}>{t.welcome}</h2>
        <p className={styles.subHeading}>{t.tagline}</p>

        {error && (
          <div className={styles.errorBox} role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {/* Employee ID field */}
          <div className="form-group">
            <label className="form-label" htmlFor="login-employee-id">
              {t.idLabel}
            </label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon} aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="5" width="20" height="14" rx="2"/>
                  <path d="M16 10h2M16 14h2M6 10h6M6 14h4"/>
                </svg>
              </span>
              <input
                id="login-employee-id"
                type="text"
                className={`form-input ${styles.inputWithIcon}`}
                placeholder={t.idPlaceholder}
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                required
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          {/* Password field */}
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              {t.pwLabel}
            </label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon} aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                className={`form-input ${styles.inputWithIcon}`}
                placeholder={t.pwPlaceholder}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-3)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 4
                }}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            className={`btn btn-primary ${styles.submitBtn}`}
            disabled={isSubmitting || loading}
          >
            {isSubmitting
              ? <><span className="spinner" />{t.submitting}</>
              : t.submit}
          </button>
        </form>

        <p className={styles.footer}>
          {t.noAccount}{' '}
          <Link href="/register" className={styles.link}>{t.createLink}</Link>
        </p>
      </div>
    </div>
  );
}
