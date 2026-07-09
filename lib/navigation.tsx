import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/use-lang';

export const NAV_LANG = {
  en: {
    nav: {
      home: 'Home',
      shuttle: 'Shuttle Booking',
      shuttleDriver: 'Schedules & Roll-Call',
      shuttleDriverBook: 'Book a Seat',
      myRequests: 'My Requests',
      newRequest: 'New Request',
      dashboard: 'Dashboard',
      users: 'User Management',
      approvals: 'Approvals',
      vehicles: 'Vehicles',
      reports: 'Reports',
      system: 'System Reset',
    },
  },
  th: {
    nav: {
      home: 'หน้าหลัก',
      shuttle: 'จองรถรับส่ง',
      shuttleDriver: 'ตารางเดินรถ & เช็คชื่อ',
      shuttleDriverBook: 'จองที่นั่งสำหรับตัวเอง',
      myRequests: 'คำขอของฉัน',
      newRequest: 'สร้างคำขอใหม่',
      dashboard: 'แผงควบคุม',
      users: 'จัดการผู้ใช้',
      approvals: 'อนุมัติคำขอ',
      vehicles: 'จัดการรถ',
      reports: 'รายงาน',
      system: 'รีเซ็ตระบบ',
    },
  }
} as const;

export interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: React.ReactNode;
}

const iconSize = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function useNavigationItems(): NavItem[] {
  const { userProfile } = useAuth();
  const { lang } = useLang();
  const t = NAV_LANG[lang].nav;
  
  const role = userProfile?.role ?? 'staff';
  const purpose = userProfile?.purpose;
  
  const isMasterAdmin = role === 'master_admin';
  const isAdmin = role === 'admin' || isMasterAdmin;
  const isDriver = role === 'driver';
  const isHR = role === 'hr';

  const isPurposeShuttle = purpose === 'shuttle';
  const isPurposeRequest = purpose === 'request';
  const isPurposeBoth = purpose === 'both';
  const hasValidPurpose = isPurposeShuttle || isPurposeRequest || isPurposeBoth;

  const items: NavItem[] = [];

  // 1. Home
  items.push({
    id: 'home',
    href: '/home',
    label: t.home,
    icon: <svg {...iconSize}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  });

  // 2. Shuttle Booking
  if (!isDriver && (!hasValidPurpose || isPurposeShuttle || isPurposeBoth || isAdmin || isHR)) {
    items.push({
      id: 'shuttle',
      href: '/shuttle',
      label: t.shuttle,
      icon: <svg {...iconSize}><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg>,
    });
  }

  // 3. Driver Shuttle
  if (isDriver) {
    items.push({
      id: 'shuttleDriver',
      href: '/shuttle',
      label: t.shuttleDriver,
      icon: <svg {...iconSize}><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg>,
    });
    items.push({
      id: 'shuttleDriverBook',
      href: '/shuttle?mode=book',
      label: t.shuttleDriverBook,
      icon: <svg {...iconSize}><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>,
    });
  }
  
  // 4. My Requests
  if (!isDriver && (!hasValidPurpose || isPurposeRequest || isPurposeBoth || isAdmin || isHR)) {
     items.push({
        id: 'requests',
        href: '/requests',
        label: t.myRequests,
        icon: <svg {...iconSize}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
     });
  }

  // 5. Dashboard (Admin)
  if (isAdmin || isHR) {
    items.push({
      id: 'dashboard',
      href: '/admin',
      label: t.dashboard,
      icon: <svg {...iconSize}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
    });
    items.push({
      id: 'users',
      href: '/admin/users',
      label: t.users,
      icon: <svg {...iconSize}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    });
  }

  // 6. Approvals
  if (isAdmin || isDriver) {
    items.push({
      id: 'approvals',
      href: '/admin/approvals',
      label: t.approvals,
      icon: <svg {...iconSize}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
    });
    items.push({
      id: 'vehicles',
      href: '/admin/vehicles',
      label: t.vehicles,
      icon: <svg {...iconSize}><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
    });
  }

  // 7. Reports
  if (isAdmin || isHR || isDriver) {
    items.push({
      id: 'reports',
      href: '/reports',
      label: t.reports,
      icon: <svg {...iconSize}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    });
  }

  // 8. System Reset (Master Admin)
  if (isMasterAdmin) {
    items.push({
      id: 'system',
      href: '/admin/system',
      label: t.system,
      icon: <svg {...iconSize}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    });
  }

  return items;
}
