'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import styles from './bottom-nav.module.css';

export default function BottomNav() {
  const pathname = usePathname();
  const { isAdmin, isHR, isDriver } = useAuth();

  const links = [
    {
      href: '/home',
      label: 'Home',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      )
    },
  ];

  if (isAdmin || isHR) {
    links.push({
      href: '/admin',
      label: 'Admin',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      )
    });
  }

  links.push({
    href: '/profile',
    label: 'Profile',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    )
  });

  return (
    <nav className={styles.bottomNav}>
      {links.map((link) => {
        const isActive = pathname.startsWith(link.href);
        return (
          <Link key={link.href} href={link.href} className={`${styles.navItem} ${isActive ? styles.active : ''}`}>
            {link.icon}
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
