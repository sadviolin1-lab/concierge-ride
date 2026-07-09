'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/use-lang';
import styles from './pending.module.css';

const LANG = {
  en: {
    title: 'Account Pending Approval',
    body1: 'Your registration has been submitted successfully. The HR team or an Administrator will review your account and activate it shortly.',
    body2: 'You will be able to sign in and use the system once your account is approved.',
    name: 'Name',
    empId: 'Employee ID',
    dept: 'Department',
    status: 'Status',
    pending: 'Pending',
    signOut: 'Sign Out'
  },
  th: {
    title: 'รอการอนุมัติบัญชี',
    body1: 'ระบบได้รับข้อมูลการสมัครของคุณเรียบร้อยแล้ว ทีมงาน HR หรือผู้ดูแลระบบจะตรวจสอบและเปิดใช้งานบัญชีของคุณในไม่ช้า',
    body2: 'คุณจะสามารถเข้าสู่ระบบและใช้งานได้เมื่อบัญชีของคุณได้รับการอนุมัติแล้ว',
    name: 'ชื่อ-นามสกุล',
    empId: 'รหัสพนักงาน',
    dept: 'แผนก',
    status: 'สถานะ',
    pending: 'รออนุมัติ',
    signOut: 'ออกจากระบบ'
  }
} as const;

export default function PendingPage() {
  const { userProfile, signOut, loading } = useAuth();
  const router = useRouter();
  const { lang } = useLang();
  const t = LANG[lang];

  useEffect(() => {
    if (loading) return;
    if (!userProfile) { router.replace('/login'); return; }
    if (userProfile.status === 'active') { router.replace('/'); return; }
    if (userProfile.status === 'rejected') { router.replace('/rejected'); return; }
  }, [loading, userProfile, router]);

  return (
    <div className={styles.page}>
      <div className={styles.blob1} aria-hidden />
      <div className={styles.blob2} aria-hidden />

      <div className={styles.card} role="main" aria-live="polite">
        <div className={styles.iconWrap} aria-hidden>
          <div className={styles.iconRing}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
        </div>

        <h1 className={styles.title}>{t.title}</h1>
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
              <span className="badge badge-pending">{t.pending}</span>
            </div>
          </div>
        )}

        <button
          id="pending-signout-btn"
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
