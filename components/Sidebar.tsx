'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/use-lang';
import ViewAsDropdown from '@/components/ViewAsDropdown';
import LangToggle from '@/components/LangToggle';
import styles from './sidebar.module.css';
import { useNavigationItems } from '@/lib/navigation';

const SIDEBAR_LANG = {
  en: {
    title: 'Concierge Ride',
    tagline: 'Transport Manager',
  },
  th: {
    title: 'คอนเซียร์จ ไรด์',
    tagline: 'ระบบจัดการรถรับส่ง',
  }
} as const;

export default function Sidebar({ mobile = false, onClose }: { mobile?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { userProfile, signOut } = useAuth();
  const { lang } = useLang();
  const t = SIDEBAR_LANG[lang];
  const role = userProfile?.role ?? 'staff';
  
  const visibleItems = useNavigationItems();

  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (role === 'admin' || role === 'master_admin' || role === 'hr') {
      const q = query(collection(db, 'users'), where('status', '==', 'pending'));
      const unsubscribe = onSnapshot(q, (snap) => {
        setPendingCount(snap.size);
      });
      return () => unsubscribe();
    }
  }, [role]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href) && pathname[href.length] === undefined);

  return (
    <aside className={`${styles.sidebar} ${mobile ? styles.sidebarMobile : ''}`}>
      {/* Logo */}
      <div className={styles.logoArea}>
        <div className={styles.logoIcon} aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            <line x1="12" y1="2" x2="12" y2="9.5" />
            <line x1="12" y1="12" x2="4" y2="17" />
            <line x1="12" y1="12" x2="20" y2="17" />
          </svg>
        </div>
        <div>
          <div className={styles.logoName}>{t.title}</div>
          <div className={styles.logoTagline}>{t.tagline}</div>
        </div>
        {mobile && (
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className={styles.nav} aria-label="Main navigation">
        <ul className={styles.navList}>
          {visibleItems.map(item => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ''}`}
                onClick={onClose}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>
                  {item.label}
                </span>
                {item.id === 'users' && pendingCount > 0 && (
                  <span className={styles.badge}>{pendingCount}</span>
                )}
                {isActive(item.href) && <span className={styles.activeIndicator} aria-hidden />}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* User profile */}
      <div className={styles.userArea}>
        <div style={{ padding: '0 12px 12px', display: 'flex', justifyContent: 'center' }}>
          <ViewAsDropdown />
        </div>

        {/* Language Toggle inside Sidebar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <LangToggle />
        </div>

        <div className={styles.userCard}>
          <Link href="/profile" className={styles.profileLink}>
            <div className={styles.userAvatar}>
              {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt={userProfile.fullName} />
              ) : (
                <span>{userProfile?.fullName?.[0] ?? '?'}</span>
              )}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{userProfile?.nickname ?? userProfile?.fullName}</span>
              <span className={`badge badge-${role}`} style={{ alignSelf: 'flex-start' }}>{role}</span>
            </div>
          </Link>
          <button
            id="sidebar-signout-btn"
            className={styles.signOutBtn}
            onClick={handleSignOut}
            title="Sign out"
            aria-label="Sign out"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
