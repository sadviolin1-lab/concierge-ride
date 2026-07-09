'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/use-lang';
import LangToggle from '@/components/LangToggle';
import styles from '../pending/pending.module.css';

const LANG = {
  en: {
    title: 'Account Suspended',
    body1: 'Your account has been temporarily suspended.',
    body2: 'If you have any questions, please contact the HR team or an Administrator.',
    name: 'Name',
    empId: 'Employee ID',
    dept: 'Department',
    status: 'Status',
    suspended: 'Suspended',
    signOut: 'Sign Out'
  },
  th: {
    title: 'บัญชีถูกระงับการใช้งาน',
    body1: 'บัญชีของคุณถูกระงับการใช้งานชั่วคราว',
    body2: 'หากคุณมีข้อสงสัย กรุณาติดต่อทีม HR หรือผู้ดูแลระบบ',
    name: 'ชื่อ-นามสกุล',
    empId: 'รหัสพนักงาน',
    dept: 'แผนก',
    status: 'สถานะ',
    suspended: 'ถูกระงับ',
    signOut: 'ออกจากระบบ'
  }
} as const;

export default function SuspendedPage() {
  const { userProfile, signOut, loading } = useAuth();
  const router = useRouter();
  const { lang } = useLang();
  const t = LANG[lang];

  useEffect(() => {
    if (loading) return;
    if (!userProfile) { router.replace('/login'); return; }
    if (userProfile.status === 'active') { router.replace('/'); return; }
    if (userProfile.status === 'pending') { router.replace('/pending'); return; }
    if (userProfile.status === 'rejected') { router.replace('/rejected'); return; }
  }, [loading, userProfile, router]);

  return (
    <div className={styles.page}>
      <div className={styles.blob1} aria-hidden />
      <div className={styles.blob2} aria-hidden />

      <div className={styles.card} role="main" aria-live="polite" style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <LangToggle />
        </div>
        <div className={styles.iconWrap} aria-hidden>
          <div className={styles.iconRing} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          </div>
        </div>

        <h1 className={styles.title} style={{ color: '#ef4444' }}>{t.title}</h1>
        <p className={styles.body}>
          {t.body1}
        </p>
        <p className={styles.body}>
          {t.body2}
        </p>

        {userProfile && (
          <div className={styles.infoCard}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>{t.name}</span>
              <span className={styles.infoValue}>{userProfile.fullName}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>{t.empId}</span>
              <span className={styles.infoValue}>{userProfile.employeeId}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>{t.dept}</span>
              <span className={styles.infoValue}>{userProfile.department}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>{t.status}</span>
              <span className="badge badge-danger">{t.suspended}</span>
            </div>
            {userProfile.suspendedUntil && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Until</span>
                <span className={styles.infoValue}>
                  {new Date(userProfile.suspendedUntil).toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}
                </span>
              </div>
            )}
          </div>
        )}

        <button
          id="suspended-signout-btn"
          className="btn-ghost"
          onClick={async () => { await signOut(); router.replace('/login'); }}
          style={{ alignSelf: 'center' }}
        >
          {t.signOut}
        </button>
      </div>
    </div>
  );
}
