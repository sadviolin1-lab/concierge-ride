'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNavigationItems } from '@/lib/navigation';
import { useLang } from '@/lib/use-lang';
import styles from './bottom-nav.module.css';

export default function BottomNav() {
  const pathname = usePathname();
  const { lang } = useLang();
  const navItems = useNavigationItems();

  // Take top 4 navigation items relevant to user's role + add Profile link
  const primaryLinks = navItems.slice(0, 4);

  const profileLink = {
    id: 'profile',
    href: '/profile',
    label: lang === 'th' ? 'โปรไฟล์' : 'Profile',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    )
  };

  const allLinks = [...primaryLinks, profileLink];

  return (
    <nav className={styles.bottomNav} aria-label="Mobile Navigation">
      {allLinks.map((link) => {
        const isActive = pathname === link.href || (link.href !== '/home' && pathname.startsWith(link.href));
        return (
          <Link key={link.id} href={link.href} className={`${styles.navItem} ${isActive ? styles.active : ''}`}>
            {link.icon}
            <span style={{ fontSize: '0.65rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '56px' }}>
              {link.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
