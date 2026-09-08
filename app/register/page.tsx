'use client';

import { useState, useRef, ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  completeDirectRegistration,
  type PhoneRegisterData,
} from '@/lib/auth-context';
import { useLang, type Lang } from '@/lib/use-lang';
import LangToggle from '@/components/LangToggle';
import styles from './register.module.css';

// ── Bilingual text ────────────────────────────────────────────────────────────
const T = {
  en: {
    heading:      'Create an Account',
    subHeading:   'Enter your details — Admin will review and approve your account.',
    photoHint:    'Profile Photo *',
    fullName:     'Full Name', nickname: 'Nickname',
    employeeId:   'Employee ID', department: 'Department',
    selectDept:   'Select department…',
    password:     'Password', pwPlaceholder: 'Min. 6 characters',
    confirm:      'Confirm Password', confirmPlaceholder: 'Repeat password',
    submit:       'Submit & Create Account',
    submitting:   'Creating Account…',
    haveAccount:  'Already have an account?',
    signIn:       'Sign in',
    purpose:      'Purpose of Usage',
    selectPurpose:'Select purpose…',
    optShuttle:   'Employee Shuttle Service Only',
    optRequest:   'Vehicle Request Service Only',
    optBoth:      'Both (Shuttle & Ride Request)',
    optDriver:    'Driver / Transport Staff',
    errName:      'Please enter your full name.',
    errNick:      'Please enter your nickname.',
    errEmpId:     'Please enter your Employee ID.',
    errDept:      'Please select your department.',
    errPwLen:     'Password must be at least 6 characters.',
    errPwMatch:   'Passwords do not match.',
    errPurpose:   'Please select a purpose of usage.',
    errPhoneUsed: 'This Employee ID is already registered.',
    errRegister:  'Registration failed. Please try again.',
    errPhoto:     'Please upload a profile photo.',
  },
  th: {
    heading:      'สมัครใช้งาน',
    subHeading:   'กรอกข้อมูลของคุณ — แอดมินจะตรวจสอบและอนุมัติบัญชีของคุณ',
    photoHint:    'รูปโปรไฟล์ *',
    fullName:     'ชื่อ-นามสกุล', nickname: 'ชื่อเล่น',
    employeeId:   'รหัสพนักงาน', department: 'แผนก',
    selectDept:   'เลือกแผนก…',
    password:     'รหัสผ่าน', pwPlaceholder: 'อย่างน้อย 6 ตัวอักษร',
    confirm:      'ยืนยันรหัสผ่าน', confirmPlaceholder: 'กรอกรหัสผ่านอีกครั้ง',
    submit:       'สมัครและสร้างบัญชี',
    submitting:   'กำลังสร้างบัญชี…',
    haveAccount:  'มีบัญชีอยู่แล้ว?',
    signIn:       'เข้าสู่ระบบ',
    purpose:      'วัตถุประสงค์การใช้งาน',
    selectPurpose:'เลือกวัตถุประสงค์…',
    optShuttle:   'เลือกใช้งานเฉพาะบริการรับส่งพนักงาน (Shuttle Booking)',
    optRequest:   'เลือกใช้งานเฉพาะการขอใช้บริการรถ (Ride Request)',
    optBoth:      'เลือกใช้งานทั้ง 2 บริการ (Both Services)',
    optDriver:    'พนักงานขับรถ (Driver)',
    errName:      'กรุณากรอกชื่อ-นามสกุล',
    errNick:      'กรุณากรอกชื่อเล่น',
    errEmpId:     'กรุณากรอกรหัสพนักงาน',
    errDept:      'กรุณาเลือกแผนก',
    errPwLen:     'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
    errPwMatch:   'รหัสผ่านไม่ตรงกัน',
    errPurpose:   'กรุณาเลือกวัตถุประสงค์การใช้งาน',
    errPhoneUsed: 'รหัสพนักงานนี้ถูกลงทะเบียนแล้ว',
    errRegister:  'การสมัครล้มเหลว กรุณาลองใหม่',
    errPhoto:     'กรุณาอัปโหลดรูปโปรไฟล์',
  },
} as const;

// ── Departments ───────────────────────────────────────────────────────────────
const DEPARTMENTS = [
  'Accounting',
  'Administration',
  'Engineering',
  'Food & Beverage',
  'Front Office',
  'Housekeeping',
  'Human Resources',
  'IT',
  'Kitchen',
  'Management',
  'ResCare',
  'Sales & Marketing',
  'Security'
];



export default function RegisterPage() {
  const router = useRouter();
  const { lang, setLang } = useLang();
  const t = T[lang];

  // ── State ─────────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    fullName: '', nickname: '', employeeId: '',
    department: '', password: '', confirmPassword: '',
    purpose: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // UI state
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const set = (key: keyof typeof form) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);
    // Reset input value so onChange fires again if user picks the same file or re-opens camera
    e.target.value = '';
  };

  const handlePhotoClick = () => {
    if (fileRef.current) {
      // Reset so onChange always fires on mobile (even if same file re-captured)
      fileRef.current.value = '';
      fileRef.current.click();
    }
  };

  const validateInfo = (): string | null => {
    if (!form.fullName.trim())   return t.errName;
    if (!form.nickname.trim())   return t.errNick;
    if (!form.employeeId.trim()) return t.errEmpId;
    if (!form.department)        return t.errDept;
    if (!form.purpose)           return t.errPurpose;
    if (!photoFile)              return t.errPhoto;
    if (form.password.length < 6)                return t.errPwLen;
    if (form.password !== form.confirmPassword)   return t.errPwMatch;
    return null;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateInfo();
    if (err) { setError(err); return; }
    setError('');
    setIsSubmitting(true);
    
    try {
      const data: PhoneRegisterData = {
        phone: '',
        password: form.password,
        fullName: form.fullName,
        nickname: form.nickname,
        employeeId: form.employeeId,
        department: form.department,
        photoFile,
        purpose: form.purpose as any,
      };
      await completeDirectRegistration(data);
      router.replace('/pending');
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('email-already-in-use')) setError(t.errPhoneUsed);
      else setError(t.errRegister);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.card} role="main">
        {/* Language toggle */}
        <div className={styles.langToggleWrap}>
          <LangToggle />
        </div>

        {/* Logo */}
        <div className={styles.logoRow}>
          <div className={styles.logoIcon} aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" />
              <line x1="12" y1="2" x2="12" y2="9.5" />
              <line x1="12" y1="12" x2="4" y2="17" />
              <line x1="12" y1="12" x2="20" y2="17" />
            </svg>
          </div>
          <span className={styles.logoTitle}>Concierge Ride</span>
        </div>

        {/* Error banner */}
        {error && (
          <div className={styles.errorBox} role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        <div>
          <h1 className={styles.heading}>{t.heading}</h1>
          <p className={styles.subHeading}>{t.subHeading}</p>
        </div>

        <form className={styles.form} onSubmit={handleRegister} noValidate>
          {/* Photo */}
          <div className={styles.photoSection}>
            <button type="button" id="photo-upload-btn" className={styles.photoButton}
              onClick={handlePhotoClick} aria-label="Upload profile photo">
              {photoPreview
                ? <img src={photoPreview} alt="Preview" className={styles.photoPreview} />
                : <div className={styles.photoPlaceholder}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>{lang === 'th' ? 'อัปโหลดรูป' : 'Upload Photo'}</span>
                  </div>}
              <div className={styles.photoBadge}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              </div>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className={styles.hiddenInput}
              onChange={handlePhotoChange}
            />
            <p className={styles.photoHint}>{t.photoHint}</p>
          </div>

          <div className={styles.grid2}>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-fullname">{t.fullName} *</label>
              <input id="reg-fullname" type="text" className="form-input" placeholder="John Doe"
                value={form.fullName} onChange={set('fullName')} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-nickname">{t.nickname} *</label>
              <input id="reg-nickname" type="text" className="form-input" placeholder="John"
                value={form.nickname} onChange={set('nickname')} required />
            </div>
          </div>

          <div className={styles.grid2}>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-empid">{t.employeeId} *</label>
              <input id="reg-empid" type="text" className="form-input" placeholder="123456"
                value={form.employeeId} onChange={set('employeeId')} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-dept">{t.department} *</label>
              <select id="reg-dept" className="form-select" value={form.department} onChange={set('department')} required>
                <option value="" disabled hidden>{t.selectDept}</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>



          <div className="form-group">
            <label className="form-label" htmlFor="reg-purpose">{t.purpose} *</label>
            <select id="reg-purpose" className="form-select" value={form.purpose} onChange={set('purpose')} required>
              <option value="" disabled hidden>{t.selectPurpose}</option>
              <option value="shuttle">{t.optShuttle}</option>
              <option value="request">{t.optRequest}</option>
              <option value="both">{t.optBoth}</option>
              <option value="driver">{t.optDriver}</option>
            </select>
          </div>

          <div className={styles.grid2}>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">{t.password} *</label>
              <div style={{ position: 'relative' }}>
                <input id="reg-password" type={showPassword ? "text" : "password"} className="form-input"
                  placeholder={t.pwPlaceholder} value={form.password} onChange={set('password')}
                  required autoComplete="new-password" style={{ paddingRight: '40px' }} />
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
            <div className="form-group">
              <label className="form-label" htmlFor="reg-confirm">{t.confirm} *</label>
              <div style={{ position: 'relative' }}>
                <input id="reg-confirm" type={showConfirmPassword ? "text" : "password"} className="form-input"
                  placeholder={t.confirmPlaceholder} value={form.confirmPassword} onChange={set('confirmPassword')}
                  required autoComplete="new-password" style={{ paddingRight: '40px' }} />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                  {showConfirmPassword ? (
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
          </div>

          <button id="register-btn" type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={isSubmitting}>
            {isSubmitting ? (
               <><span className="spinner" />{t.submitting}</>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
                {t.submit}
              </>
            )}
          </button>
        </form>

        <p className={styles.footer}>
          {t.haveAccount}{' '}
          <Link href="/login" className={styles.link}>{t.signIn}</Link>
        </p>
      </div>
    </div>
  );
}
