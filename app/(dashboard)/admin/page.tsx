'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/use-lang';
import styles from './admin.module.css';

interface Stats {
  totalUsers: number;
  pendingUsers: number;
  activeUsers: number;
  pendingRequests: number;
  totalRequests: number;
  totalShuttleBookings: number;
}

const LANG = {
  en: {
    greeting: 'Good {time}, {name} 👋',
    morning: 'morning',
    afternoon: 'afternoon',
    evening: 'evening',
    subtitle: "Here's your Concierge Ride overview",
    viewReports: 'View Reports',
    loading: 'Loading…',
    cards: {
      pendingUsers: { title: 'Pending Approvals', desc: 'User registrations awaiting review' },
      activeUsers: { title: 'Active Users', desc: 'Out of {total} total registrations' },
      pendingReqs: { title: 'Pending Requests', desc: 'General logistics requests to review' },
      shuttle: { title: 'Shuttle Bookings', desc: 'Total seats booked across all shifts' }
    },
    quickActions: 'Quick Actions',
    qa: {
      users: 'Manage Users',
      approvals: 'Review Requests',
      vehicles: 'Fleet Management',
      reports: 'Monthly Reports'
    }
  },
  th: {
    greeting: 'สวัสดีตอน{time} {name} 👋',
    morning: 'เช้า',
    afternoon: 'บ่าย',
    evening: 'เย็น',
    subtitle: "นี่คือภาพรวมระบบ Concierge Ride ของคุณ",
    viewReports: 'ดูรายงาน',
    loading: 'กำลังโหลด…',
    cards: {
      pendingUsers: { title: 'รอการอนุมัติ', desc: 'ผู้สมัครใหม่ที่รอการตรวจสอบ' },
      activeUsers: { title: 'ผู้ใช้งานระบบ', desc: 'จากจำนวนผู้ลงทะเบียนทั้งหมด {total} คน' },
      pendingReqs: { title: 'คำขอรอตรวจสอบ', desc: 'คำขอขนส่งทั่วไปที่รออนุมัติ' },
      shuttle: { title: 'จองรถรับส่ง', desc: 'จำนวนที่นั่งรวมที่ถูกจองในทุกกะ' }
    },
    quickActions: 'เมนูด่วน',
    qa: {
      users: 'จัดการผู้ใช้',
      approvals: 'อนุมัติคำขอ',
      vehicles: 'จัดการรถ',
      reports: 'รายงานประจำเดือน'
    }
  }
} as const;

export default function AdminPage() {
  const router = useRouter();
  const { userProfile, isAdmin, isHR } = useAuth();
  const { lang } = useLang();
  const t = LANG[lang];
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, pendingUsers: 0, activeUsers: 0, pendingRequests: 0, totalRequests: 0, totalShuttleBookings: 0 });
  const [loading, setLoading] = useState(true);

  const hasAccess = isAdmin || isHR;

  // Protect route
  useEffect(() => {
    if (userProfile && !hasAccess) router.replace('/home');
  }, [userProfile, hasAccess, router]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const [usersSnap, requestsSnap, ridesSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'requests')),
        getDocs(collection(db, 'shuttleRides')),
      ]);

      const users = usersSnap.docs.map(d => d.data());
      const requests = requestsSnap.docs.map(d => d.data());
      const rides = ridesSnap.docs.map(d => d.data() as any);

      const totalShuttleBookings = rides.reduce((acc: number, r: any) => acc + (r.seats?.length ?? 0), 0);

      setStats({
        totalUsers: users.length,
        pendingUsers: users.filter((u: any) => u.status === 'pending').length,
        activeUsers: users.filter((u: any) => u.status === 'active').length,
        pendingRequests: requests.filter((r: any) => r.status === 'pending').length,
        totalRequests: requests.length,
        totalShuttleBookings,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) fetchStats();
  }, [hasAccess, fetchStats]);

  if (!userProfile || !hasAccess) return null;

  const cards = [
    {
      title: t.cards.pendingUsers.title,
      value: stats.pendingUsers,
      desc: t.cards.pendingUsers.desc,
      href: '/admin/users',
      color: '#F59E0B',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <line x1="17" y1="11" x2="17" y2="17"/>
          <line x1="14" y1="14" x2="20" y2="14"/>
        </svg>
      ),
    },
    {
      title: t.cards.activeUsers.title,
      value: stats.activeUsers,
      desc: t.cards.activeUsers.desc.replace('{total}', stats.totalUsers.toString()),
      href: '/admin/users',
      color: '#22C55E',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <polyline points="16 11 18 13 22 9"/>
        </svg>
      ),
    },
    {
      title: t.cards.pendingReqs.title,
      value: stats.pendingRequests,
      desc: t.cards.pendingReqs.desc,
      href: '/admin/approvals',
      color: '#6C63FF',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      ),
    },
    {
      title: t.cards.shuttle.title,
      value: stats.totalShuttleBookings,
      desc: t.cards.shuttle.desc,
      href: '/shuttle',
      color: '#4ECDC4',
      icon: (
         <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
           <circle cx="12" cy="12" r="10" />
           <circle cx="12" cy="12" r="2.5" fill="currentColor" />
           <line x1="12" y1="2" x2="12" y2="9.5" />
           <line x1="12" y1="12" x2="4" y2="17" />
           <line x1="12" y1="12" x2="20" y2="17" />
         </svg>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <button onClick={() => router.back()} className="btn-ghost" style={{ alignSelf: 'flex-start', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }} aria-label="Go back">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>{lang === 'en' ? 'Back' : 'ย้อนกลับ'}</span>
      </button>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {t.greeting
              .replace('{time}', t[getGreeting()])
              .replace('{name}', userProfile?.nickname ?? userProfile?.fullName ?? '')}
          </h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
        <Link href="/reports" id="view-reports-btn" className="btn-ghost">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          {t.viewReports}
        </Link>
      </div>

      {loading ? (
        <div className={styles.loadingWrap}><div className="spinner" style={{ color: '#6C63FF' }} /><span>{t.loading}</span></div>
      ) : (
        <div className={styles.statsGrid}>
          {cards.map((card, i) => (
            <Link
              key={card.title}
              href={card.href}
              id={`stat-card-${i}`}
              className={styles.statCard}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className={styles.statIcon} style={{ color: card.color, background: `${card.color}15`, border: `1px solid ${card.color}25` }}>
                {card.icon}
              </div>
              <div className={styles.statValue} style={{ color: card.color }}>{card.value}</div>
              <div className={styles.statTitle}>{card.title}</div>
              <div className={styles.statDesc}>{card.desc}</div>
              <div className={styles.statArrow} aria-hidden>→</div>
            </Link>
          ))}
        </div>
      )}

      {/* Quick links */}
      <div className={styles.quickLinks}>
        <h2 className={styles.sectionTitle}>{t.quickActions}</h2>
        <div className={styles.quickGrid}>
          <Link href="/admin/users" id="quick-users" className={styles.quickCard}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            {t.qa.users}
          </Link>
          <Link href="/admin/approvals" id="quick-approvals" className={styles.quickCard}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            {t.qa.approvals}
          </Link>
          <Link href="/admin/vehicles" id="quick-vehicles" className={styles.quickCard}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            {t.qa.vehicles}
          </Link>
          <Link href="/reports" id="quick-reports" className={styles.quickCard}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            {t.qa.reports}
          </Link>
        </div>
      </div>
    </div>
  );
}

function getGreeting(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}
