'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/use-lang';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';
import ViewAsDropdown from '@/components/ViewAsDropdown';
import LangToggle from '@/components/LangToggle';
import AppLogo from '@/components/AppLogo';
import styles from './dashboard-layout.module.css';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { firebaseUser, userProfile, loading, impersonatedRole, setImpersonatedRole, signOut } = useAuth();
  const { lang } = useLang();
  const router = useRouter();

  useEffect(() => {
    // Fallback if loading hangs for more than 2 seconds
    const fallback = setTimeout(() => {
      if (!userProfile || userProfile.status !== 'active') {
        window.location.href = '/login';
      }
    }, 2000);

    if (loading) return () => clearTimeout(fallback);

    clearTimeout(fallback);
    if (!firebaseUser || !userProfile) {
      try { router.replace('/login'); } catch {}
      window.location.href = '/login';
      return;
    }
    if (userProfile.status === 'pending') { window.location.href = '/pending'; return; }
    if (userProfile.status === 'rejected') { window.location.href = '/rejected'; return; }
    if (userProfile.status === 'suspended') { window.location.href = '/suspended'; return; }
  }, [loading, firebaseUser, userProfile, router]);

  if (loading || !userProfile || userProfile.status !== 'active') {
    return (
      <div className="page-loader">
        <AppLogo size={48} style={{ marginBottom: 12 }} />
        <span className="logo-text">Concierge Ride</span>
        {/* Only show Sign in button after auth check is complete, not during loading */}
        {!loading && (
          <button
            type="button"
            onClick={() => { window.location.href = '/login'; }}
            style={{
              marginTop: 16,
              fontSize: '0.85rem',
              color: 'var(--color-primary, #0284C7)',
              background: 'rgba(2, 132, 199, 0.08)',
              border: '1px solid rgba(2, 132, 199, 0.2)',
              padding: '6px 14px',
              borderRadius: '20px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Sign in
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      {/* Desktop Header */}
      <div className={styles.desktopHeaderSpacer}></div>
      <header className={styles.desktopHeader}>
        <div className={styles.headerLogoArea}>
          <AppLogo size={38} style={{ borderRadius: '10px' }} />
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
                <AppLogo size={34} style={{ borderRadius: '8px' }} />
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
