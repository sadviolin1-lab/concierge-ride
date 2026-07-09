'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import styles from './rejected.module.css';

export default function RejectedPage() {
  const { userProfile, signOut } = useAuth();
  const router = useRouter();

  return (
    <div className={styles.page}>
      <div className={styles.card} role="main">
        <div className={styles.iconWrap} aria-hidden>
          <div className={styles.iconRing}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
        </div>
        <h1 className={styles.title}>Account Not Approved</h1>
        <p className={styles.body}>
          Your account registration was not approved by HR. Please contact your HR department for more information.
        </p>
        {userProfile?.rejectionReason && (
          <div className={styles.reasonBox}>
            <strong>Reason provided:</strong> {userProfile.rejectionReason}
          </div>
        )}
        <button
          id="rejected-signout-btn"
          className="btn-ghost"
          onClick={async () => { await signOut(); router.replace('/login'); }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
