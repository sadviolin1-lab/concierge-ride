'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/use-lang';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';
import ViewAsDropdown from '@/components/ViewAsDropdown';
import LangToggle from '@/components/LangToggle';
import styles from './dashboard-layout.module.css';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { firebaseUser, userProfile, loading, impersonatedRole, setImpersonatedRole, signOut } = useAuth();
  const { lang } = useLang();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) { router.replace('/login'); return; }
    if (!userProfile) return;
    if (userProfile.status === 'pending') { router.replace('/pending'); return; }
    if (userProfile.status === 'rejected') { router.replace('/rejected'); return; }
    if (userProfile.status === 'suspended') { router.replace('/suspended'); return; }
  }, [loading, firebaseUser, userProfile, router]);

  if (loading || !userProfile || userProfile.status !== 'active') {
    return (
      <div className="page-loader">
        <div className="spinner" />
        <span className="logo-text">Concierge Ride</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      {/* Desktop Header */}
      <div className={styles.desktopHeaderSpacer}></div>
      <header className={styles.desktopHeader}>
        <div className={styles.headerLogoArea}>
          <div className={styles.headerLogoIcon} aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" />
              <line x1="12" y1="2" x2="12" y2="9.5" />
              <line x1="12" y1="12" x2="4" y2="17" />
              <line x1="12" y1="12" x2="20" y2="17" />
            </svg>
          </div>
          <div>
            <div className={styles.headerLogoText}>{lang === 'en' ? 'Concierge Ride' : 'คอนเซียร์จ ไรด์'}</div>
            <div className={styles.headerLogoTagline}>{lang === 'en' ? 'Transport Manager' : 'ระบบจัดการรถรับส่ง'}</div>
          </div>
        </div>
        
        <div className={styles.headerRight}>
          <LangToggle />
          <ViewAsDropdown />
          <div 
            className={styles.headerUser}
            onClick={() => router.push('/profile')}
            role="button"
            tabIndex={0}
          >
            <div className={styles.headerAvatar}>
              {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt={userProfile.fullName} />
              ) : (
                <span>{userProfile?.fullName?.[0] ?? '?'}</span>
              )}
            </div>
            <div className={styles.headerUserInfo}>
              <span className={styles.headerUserName}>{userProfile?.nickname || userProfile?.fullName}</span>
              <span className={`badge badge-${userProfile?.role ?? 'staff'}`} style={{ alignSelf: 'flex-start', fontSize: '0.65rem', padding: '2px 4px' }}>
                {userProfile?.role ?? 'staff'}
              </span>
            </div>
          </div>
          <button
            className={styles.headerSignOutBtn}
            onClick={async () => { await signOut(); router.replace('/login'); }}
            title="Sign out"
            aria-label="Sign out"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        {/* Desktop sidebar */}
        <div className={styles.sidebarDesktop}>
          <Sidebar />
        </div>

        {/* Main area */}
        <div className={styles.main}>
          {/* Mobile header */}
          <header className={styles.mobileHeaderLarge}>
            <div className={styles.headerTop}>
              <div className={styles.logoWrapper}>
                <svg className={styles.steeringWheelIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="2.5" fill="currentColor" />
                  <line x1="12" y1="2" x2="12" y2="9.5" />
                  <line x1="12" y1="12" x2="4" y2="17" />
                  <line x1="12" y1="12" x2="20" y2="17" />
                </svg>
                <span className={styles.mobileLogoTextWhite}>Concierge Ride</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LangToggle light />
                <ViewAsDropdown />
              </div>
            </div>
            
            <div className={styles.headerProfileSection}>
              <div className={styles.largeAvatar}>
                {userProfile?.photoURL ? (
                  <img src={userProfile.photoURL} alt={userProfile.fullName} />
                ) : (
                  <span>{userProfile?.fullName?.[0] ?? '?'}</span>
                )}
              </div>
              <div className={styles.headerGreeting}>
                <p className={styles.greetingText}>{lang === 'en' ? 'Welcome back,' : 'สวัสดี,'}</p>
                <h1 className={styles.nickname}>{userProfile?.nickname || userProfile?.fullName}</h1>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button 
                    className={styles.editProfileBtn} 
                    onClick={() => router.push('/profile')}
                  >
                    {lang === 'en' ? 'Edit Profile' : 'แก้ไขโปรไฟล์'}
                  </button>
                  <button 
                    className={styles.editProfileBtn} 
                    onClick={async () => { await signOut(); router.replace('/login'); }}
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
                  >
                    {lang === 'en' ? 'Log Out' : 'ออกจากระบบ'}
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className={styles.content}>
            {children}
          </main>
        </div>
        
        {/* Mobile bottom nav */}
        <BottomNav />
      </div>
    </div>
  );
}
