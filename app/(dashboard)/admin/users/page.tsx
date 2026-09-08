'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth, formatThaiPhone } from '@/lib/auth-context';
import type { UserProfile, UserRole, UserStatus, UserPurpose } from '@/lib/types';
import styles from './users.module.css';
import DateInput from '@/components/DateInput';
import { auth } from '@/lib/firebase';
import { useLang } from '@/lib/use-lang';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: number, lang: 'en' | 'th') {
  return new Date(ts).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function isExpired(ts?: number) {
  return ts != null && ts < Date.now();
}

function isBanned(u: UserProfile) {
  return u.status === 'suspended';
}

// ── ModalClose helper ────────────────────────────────────────────────────────
function ModalCloseBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button className={styles.modalClose} onClick={onClick} disabled={disabled} type="button">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  );
}

const DEPARTMENTS = [
  'Accounting',
  'Administration',
  'Engineering',
  'Food & Beverage',
  'Front Office',
  'Housekeeping',
  'Human Resources',
  'IT',
  'Kitchen',
  'Management',
  'ResCare',
  'Sales & Marketing',
  'Security'
];

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ManageUsersPage() {
  const router = useRouter();
  const { userProfile, isMasterAdmin, isAdmin, isHR } = useAuth();
  const { lang } = useLang();
  const hasAccess = isAdmin || isHR;
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [resetModal, setResetModal] = useState<{ isOpen: boolean; uid: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);



  const [banModal, setBanModal] = useState<{ uid: string; name: string } | null>(null);
  const [banDays, setBanDays] = useState('7');
  const [banCustomDays, setBanCustomDays] = useState('');

  const [expiryModal, setExpiryModal] = useState<{ uid: string; name: string; current?: number } | null>(null);
  const [expiryDate, setExpiryDate] = useState('');

  const [deleteModal, setDeleteModal] = useState<{ uid: string; name: string } | null>(null);
  const [editProfileModal, setEditProfileModal] = useState<{
    isOpen: boolean;
    uid: string;
    fullName: string;
    nickname: string;
    department: string;
    phone: string;
    employeeId: string;
  } | null>(null);

  const [isUpdating, setIsUpdating] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  const showToast = (text: string, type: 'error' | 'success' = 'error') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Protect route
  useEffect(() => {
    if (userProfile && !hasAccess) router.replace('/home');
  }, [userProfile, hasAccess, router]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list = snap.docs.map(d => d.data() as UserProfile);
      list.sort((a, b) => b.createdAt - a.createdAt);
      setUsers(list);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) fetchUsers();
  }, [hasAccess, fetchUsers]);

  const patchUser = async (uid: string, data: Partial<UserProfile>) => {
    if (userProfile && uid === userProfile.uid && data.status === 'suspended') {
      showToast('คุณไม่สามารถแบนบัญชีของตัวเองได้');
      return;
    }
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'users', uid), { ...data, updatedAt: Date.now() });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...data } : u));
    } catch (err) {
      console.error(err);
      showToast('อัปเดตข้อมูลไม่สำเร็จ');
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Ban ──────────────────────────────────────────────────────────────────
  const handleBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banModal) return;
    if (userProfile && banModal.uid === userProfile.uid) {
      showToast('คุณไม่สามารถแบนบัญชีของตัวเองได้');
      setBanModal(null);
      return;
    }
    const days = banDays === 'custom' ? (parseInt(banCustomDays, 10) || 1) : parseInt(banDays, 10);
    const suspendedUntil = Date.now() + days * 86400000;
    await patchUser(banModal.uid, { status: 'suspended', suspendedUntil });
    setBanModal(null);
    showToast(`แบน ${banModal.name} เป็นเวลา ${days} วัน`, 'success');
  };

  const handleUnban = async (uid: string, name: string) => {
    await patchUser(uid, { status: 'active', suspendedUntil: null as any });
    showToast(`ปลดแบน ${name} แล้ว`, 'success');
  };

  // ── Expiry ───────────────────────────────────────────────────────────────
  const handleSetExpiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expiryModal || !expiryDate) return;
    const ts = new Date(expiryDate).getTime();
    await patchUser(expiryModal.uid, { accountExpiresAt: ts });
    setExpiryModal(null);
    showToast(`กำหนดวันหมดอายุให้ ${expiryModal.name} แล้ว`, 'success');
  };

  const handleClearExpiry = async (uid: string, name: string) => {
    await patchUser(uid, { accountExpiresAt: undefined });
    showToast(`ลบวันหมดอายุของ ${name} แล้ว`, 'success');
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!deleteModal) return;
    if (userProfile && deleteModal.uid === userProfile.uid) {
      showToast('คุณไม่สามารถลบบัญชีของตัวเองได้');
      setDeleteModal(null);
      return;
    }
    setIsUpdating(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ targetUid: deleteModal.uid })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setUsers(prev => prev.filter(u => u.uid !== deleteModal.uid));
      setDeleteModal(null);
      showToast('ลบผู้ใช้สำเร็จ', 'success');
    } catch (err: any) {
      showToast(err.message || 'ลบไม่สำเร็จ');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProfileModal) return;

    const { uid, fullName, nickname, department, phone } = editProfileModal;
    if (!fullName.trim() || !department.trim()) {
      showToast('กรุณากรอกชื่อและเลือกแผนกให้ครบถ้วน');
      return;
    }

    const formattedPhone = formatThaiPhone(phone);

    await patchUser(uid, {
      fullName: fullName.trim(),
      nickname: nickname.trim(),
      department: department.trim(),
      phone: formattedPhone,
    });

    setEditProfileModal(null);
    showToast('แก้ไขข้อมูลโปรไฟล์สำเร็จ', 'success');
  };

  // ── Reset Password ────────────────────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModal || !newPassword || newPassword.length < 6) return;
    setResetLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ targetUid: resetModal.uid, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`รีเซ็ตรหัสผ่านของ ${resetModal.name} สำเร็จ`, 'success');
      setResetModal(null);
      setNewPassword('');
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  // ── Filter ───────────────────────────────────────────────────────────────
  const filteredUsers = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = u.fullName?.toLowerCase().includes(q);
      const matchId = u.employeeId?.toLowerCase().includes(q);
      const matchDept = u.department?.toLowerCase().includes(q);
      if (!matchName && !matchId && !matchDept) return false;
    }
    return true;
  });

  const canManage = (u: UserProfile) => isMasterAdmin || (hasAccess && u.role !== 'master_admin');

  if (!userProfile || !hasAccess) return null;

  // ── Status badge color ───────────────────────────────────────────────────
  const statusColor = (s: UserStatus) => ({
    active:    { bg: 'rgba(16,185,129,0.12)', color: 'var(--color-success)', border: 'rgba(16,185,129,0.3)' },
    pending:   { bg: 'rgba(245,158,11,0.12)',  color: 'var(--color-warning)', border: 'rgba(245,158,11,0.3)' },
    suspended: { bg: 'rgba(239,68,68,0.12)',   color: 'var(--color-danger)',  border: 'rgba(239,68,68,0.3)' },
    rejected:  { bg: 'rgba(107,114,128,0.12)', color: 'var(--color-text-2)', border: 'rgba(107,114,128,0.3)' },
  }[s] ?? { bg: 'transparent', color: 'inherit', border: 'transparent' });

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className={styles.page}>
      <button onClick={() => router.back()} className={styles.backBtn} aria-label="Go back">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        <span>Back</span>
      </button>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Manage Users</h1>
          <p className={styles.subtitle}>Review and manage employee access, roles, and account settings.</p>
        </div>
        <div className={styles.headerStats}>
          <span className={styles.statChip}>{users.length} Total</span>
          <span className={styles.statChip} style={{ color: 'var(--color-warning)' }}>
            {users.filter(u => u.status === 'pending').length} Pending
          </span>
          <span className={styles.statChip} style={{ color: 'var(--color-danger)' }}>
            {users.filter(isBanned).length} Banned
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel} htmlFor="search-filter">Search:</label>
          <input
            id="search-filter"
            type="text"
            className="form-input"
            placeholder="Name, ID, Dept..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ minWidth: 200 }}
          />
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel} htmlFor="status-filter">Status:</label>
          <select id="status-filter" className="form-select" style={{ minWidth: 140 }}
            value={statusFilter} onChange={e => setStatusFilter(e.target.value as UserStatus | 'all')}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel} htmlFor="role-filter">Role:</label>
          <select id="role-filter" className="form-select" style={{ minWidth: 140 }}
            value={roleFilter} onChange={e => setRoleFilter(e.target.value as UserRole | 'all')}>
            <option value="all">All Roles</option>
            <option value="staff">Staff</option>
            <option value="driver">Driver</option>
            <option value="hr">HR</option>
            <option value="admin">Admin</option>
            <option value="master_admin">Master Admin</option>
          </select>
        </div>
        {(searchQuery || statusFilter !== 'all' || roleFilter !== 'all') && (
          <button
            className="btn-ghost"
            style={{ marginLeft: 'auto', fontSize: '0.85rem', padding: '6px 12px' }}
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setRoleFilter('all');
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* User List */}
      <div className={styles.userList}>
        {loading ? (
          <div className={styles.loadingWrap}>
            <div className="spinner" style={{ color: 'var(--color-primary)' }} />
            <span>Loading users...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className={styles.emptyState}>No users found.</div>
        ) : filteredUsers.map(u => {
          const sc = statusColor(u.status);
          const banned = isBanned(u);
          const expired = isExpired(u.accountExpiresAt);
          const isSelf = u.uid === userProfile?.uid;
          return (
            <div key={u.uid} className={styles.userCard}>
              {/* ── Left: Avatar + Info ──────────────────── */}
              <div className={styles.cardLeft}>
                <div className={styles.avatar}>
                  {u.photoURL ? <img src={u.photoURL} alt={u.fullName} /> : (u.fullName?.[0] ?? '?')}
                </div>
                <div className={styles.userInfo}>
                  <div className={styles.userNameRow}>
                    <span className={styles.userName}>{u.fullName}</span>
                    {isSelf && (
                      <span style={{
                        background: 'rgba(59, 130, 246, 0.12)',
                        color: 'var(--color-primary, #3b82f6)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        👤 {lang === 'th' ? 'บัญชีของคุณ' : 'You'}
                      </span>
                    )}
                    {banned && (
                      <span className={styles.tagBanned}>
                        🔒 Banned {u.suspendedUntil ? `until ${formatDate(u.suspendedUntil, lang)}` : 'Indefinitely'}
                      </span>
                    )}
                    {expired && !banned && (
                      <span className={styles.tagExpired}>⏰ Expired {formatDate(u.accountExpiresAt!, lang)}</span>
                    )}
                    {u.accountExpiresAt && !expired && (
                      <span className={styles.tagExpiry}>📅 Exp {formatDate(u.accountExpiresAt, lang)}</span>
                    )}
                  </div>
                  <span className={styles.userEmail}>{u.email || u.phone}</span>
                  <div className={styles.userMeta}>
                    <span className={styles.metaChip}>#{u.employeeId}</span>
                    <span className={styles.metaChip}>{u.department}</span>
                  </div>
                </div>
              </div>

              {/* ── Middle: Role & Status selects ────────── */}
              <div className={styles.cardMid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Role</label>
                  <select
                    className={styles.actionSelect}
                    value={u.role}
                    onChange={e => patchUser(u.uid, { role: e.target.value as UserRole })}
                    disabled={!canManage(u) || isUpdating}
                  >
                    <option value="staff">Staff</option>
                    <option value="driver">Driver</option>
                    <option value="hr">HR</option>
                    <option value="admin">Admin</option>
                    {isMasterAdmin && <option value="master_admin">Master Admin</option>}
                  </select>
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Status</label>
                  <select
                    className={styles.actionSelect}
                    style={{ color: sc.color, borderColor: sc.border, background: sc.bg }}
                    value={u.status}
                    onChange={e => {
                      const val = e.target.value as UserStatus;
                      const updates: Partial<UserProfile> = { status: val };
                      if (val !== 'suspended') {
                        updates.suspendedUntil = null as any;
                      }
                      patchUser(u.uid, updates);
                    }}
                    disabled={!canManage(u) || isUpdating}
                  >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="rejected">Rejected</option>
                    {u.status === 'suspended' && <option value="suspended" disabled>Suspended</option>}
                  </select>
                </div>
              </div>

              {/* ── Right: Action buttons ─────────────────── */}
              <div className={styles.cardActions}>
                {/* Edit Profile */}
                <button
                  className={styles.actionBtn}
                  onClick={() => {
                    setEditProfileModal({
                      isOpen: true,
                      uid: u.uid,
                      fullName: u.fullName || '',
                      nickname: u.nickname || '',
                      department: u.department || '',
                      phone: u.phone || '',
                      employeeId: u.employeeId || '',
                    });
                  }}
                  disabled={!canManage(u) || isUpdating}
                  title="Edit Profile"
                >
                  ✏️ Edit Profile
                </button>

                {/* Reset Password */}
                <button
                  className={styles.actionBtn}
                  onClick={() => setResetModal({ isOpen: true, uid: u.uid, name: u.fullName })}
                  disabled={!canManage(u) || isUpdating}
                  title="Reset Password"
                >
                  🔑 Reset PW
                </button>

                {/* Ban / Unban */}
                {banned ? (
                  <button
                    className={styles.actionBtnWarning}
                    onClick={() => handleUnban(u.uid, u.fullName)}
                    disabled={!canManage(u) || isUpdating || isSelf}
                    title={isSelf ? (lang === 'th' ? 'ไม่สามารถปลดแบนตัวเองได้' : 'Cannot unban yourself') : 'Unban'}
                  >
                    ✅ Unban
                  </button>
                ) : (
                  <button
                    className={styles.actionBtnOrange}
                    onClick={() => {
                      if (isSelf) {
                        showToast(lang === 'th' ? 'คุณไม่สามารถแบนบัญชีของตัวเองได้' : 'You cannot ban your own account');
                        return;
                      }
                      setBanModal({ uid: u.uid, name: u.fullName });
                    }}
                    disabled={!canManage(u) || isUpdating || isSelf}
                    title={isSelf ? (lang === 'th' ? 'ไม่สามารถแบนตัวเองได้' : 'Cannot ban yourself') : 'Ban User'}
                  >
                    🔒 Ban
                  </button>
                )}

                {/* Account Expiry */}
                <button
                  className={styles.actionBtnPurple}
                  onClick={() => {
                    setExpiryModal({ uid: u.uid, name: u.fullName, current: u.accountExpiresAt });
                    if (u.accountExpiresAt) {
                      const d = new Date(u.accountExpiresAt);
                      setExpiryDate(d.toISOString().split('T')[0]);
                    } else {
                      setExpiryDate('');
                    }
                  }}
                  disabled={!canManage(u) || isUpdating}
                  title="Set Account Expiry"
                >
                  📅 Expiry
                </button>

                {/* Delete */}
                <button
                  className={styles.actionBtnDanger}
                  onClick={() => {
                    if (isSelf) {
                      showToast(lang === 'th' ? 'คุณไม่สามารถลบบัญชีของตัวเองได้' : 'You cannot delete your own account');
                      return;
                    }
                    setDeleteModal({ uid: u.uid, name: u.fullName });
                  }}
                  disabled={!canManage(u) || isUpdating || isSelf}
                  title={isSelf ? (lang === 'th' ? 'ไม่สามารถลบบัญชีตัวเองได้' : 'Cannot delete yourself') : 'Cannot delete yourself'}
                >
                  🗑 Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════════════ */}

      {/* Reset Password Modal */}
      {resetModal?.isOpen && (
        <div className={styles.modalOverlay} onClick={() => !resetLoading && setResetModal(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>🔑 Reset Password</h3>
              <ModalCloseBtn onClick={() => setResetModal(null)} disabled={resetLoading} />
            </div>
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label className="form-label">New Password for <strong>{resetModal.name}</strong></label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    required minLength={6}
                    style={{ paddingRight: 44 }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                      background:'none', border:'none', cursor:'pointer', color:'var(--color-text-3)',
                      display:'flex', alignItems:'center', padding:4 }}>
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className="btn btn-secondary" onClick={() => setResetModal(null)} disabled={resetLoading} style={{ flex:1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={resetLoading} style={{ flex:1 }}>
                  {resetLoading ? <><span className="spinner" style={{ borderTopColor:'white' }} /> Resetting...</> : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* Ban Modal */}
      {banModal && (
        <div className={styles.modalOverlay} onClick={() => !isUpdating && setBanModal(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>🔒 Ban User</h3>
              <ModalCloseBtn onClick={() => setBanModal(null)} disabled={isUpdating} />
            </div>
            <p style={{ fontSize:'0.9rem', color:'var(--color-text-2)', marginBottom:16 }}>
              แบนบัญชีของ <strong style={{ color:'var(--color-text-1)' }}>{banModal.name}</strong> ผู้ใช้จะไม่สามารถเข้าสู่ระบบได้จนกว่าจะหมดอายุการแบน
            </p>
            <form onSubmit={handleBan}>
              <div className="form-group">
                <label className="form-label">ระยะเวลาแบน:</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom: banDays === 'custom' ? 12 : 0 }}>
                  {[['1','1 วัน'],['3','3 วัน'],['7','7 วัน'],['14','14 วัน'],['30','30 วัน'],['custom','กำหนดเอง']].map(([val, label]) => (
                    <label key={val} style={{
                      display:'flex', alignItems:'center', gap:8, padding:'10px 14px',
                      border:`2px solid ${banDays === val ? 'var(--color-danger)' : 'var(--color-border)'}`,
                      borderRadius:'var(--radius-md)', cursor:'pointer',
                      background: banDays === val ? 'rgba(239,68,68,0.08)' : 'var(--color-surface)',
                      transition:'all 0.15s'
                    }}>
                      <input type="radio" name="banDays" value={val} checked={banDays === val}
                        onChange={() => setBanDays(val)} style={{ accentColor:'var(--color-danger)' }} />
                      <span style={{ fontSize:'0.875rem', fontWeight: banDays === val ? 600 : 400 }}>{label}</span>
                    </label>
                  ))}
                </div>
                {banDays === 'custom' && (
                  <input
                    type="number" className="form-input" min={1} max={3650}
                    placeholder="จำนวนวัน (1-3650)"
                    value={banCustomDays} onChange={e => setBanCustomDays(e.target.value)}
                    required style={{ marginTop:8 }}
                  />
                )}
              </div>
              <div className={styles.modalActions}>
                <button type="button" className="btn btn-secondary" onClick={() => setBanModal(null)} disabled={isUpdating} style={{ flex:1 }}>ยกเลิก</button>
                <button type="submit" className="btn" disabled={isUpdating}
                  style={{ flex:1, background:'linear-gradient(135deg,#DC2626,#991B1B)', color:'white', boxShadow:'0 4px 12px rgba(220,38,38,0.35)' }}>
                  {isUpdating ? <><span className="spinner" style={{ borderTopColor:'white' }} /> กำลังแบน...</> : '🔒 ยืนยันการแบน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Expiry Modal */}
      {expiryModal && (
        <div className={styles.modalOverlay} onClick={() => !isUpdating && setExpiryModal(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>📅 Account Expiry Date</h3>
              <ModalCloseBtn onClick={() => setExpiryModal(null)} disabled={isUpdating} />
            </div>
            <p style={{ fontSize:'0.9rem', color:'var(--color-text-2)', marginBottom:16 }}>
              กำหนดวันหมดอายุบัญชีสำหรับ <strong style={{ color:'var(--color-text-1)' }}>{expiryModal.name}</strong>
              <br/><span style={{ fontSize:'0.8rem' }}>เหมาะสำหรับพนักงานชั่วคราวที่มีวันสิ้นสุดสัญญา</span>
            </p>
            <form onSubmit={handleSetExpiry}>
              <div className="form-group">
                <label className="form-label">วันที่หมดอายุ:</label>
                <DateInput
                  value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)}
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
                {expiryModal.current && (
                  <p style={{ fontSize:'0.78rem', color:'var(--color-text-3)', marginTop:6 }}>
                    ปัจจุบัน: {formatDate(expiryModal.current, lang)}
                  </p>
                )}
              </div>
              <div className={styles.modalActions} style={{ flexWrap:'wrap' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setExpiryModal(null)} disabled={isUpdating} style={{ flex:1, minWidth:100 }}>ยกเลิก</button>
                {expiryModal.current && (
                  <button type="button" className="btn btn-secondary" disabled={isUpdating}
                    onClick={() => { handleClearExpiry(expiryModal.uid, expiryModal.name); setExpiryModal(null); }}
                    style={{ flex:1, minWidth:100, color:'var(--color-danger)', borderColor:'rgba(239,68,68,0.3)' }}>
                    🗑 ลบวันหมดอายุ
                  </button>
                )}
                <button type="submit" className="btn btn-primary" disabled={isUpdating} style={{ flex:1, minWidth:100 }}>
                  {isUpdating ? <><span className="spinner" style={{ borderTopColor:'white' }} /> บันทึก...</> : '📅 บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteModal && (
        <div className={styles.modalOverlay} onClick={() => !isUpdating && setDeleteModal(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth:420 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, padding:'8px 0 4px' }}>
              <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(239,68,68,0.1)',
                border:'2px solid rgba(239,68,68,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </div>
              <div style={{ textAlign:'center' }}>
                <h3 style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--color-text-1)', marginBottom:6 }}>ลบผู้ใช้งาน</h3>
                <p style={{ fontSize:'0.9rem', color:'var(--color-text-2)', lineHeight:1.6 }}>
                  คุณต้องการลบ <strong style={{ color:'var(--color-text-1)' }}>{deleteModal.name}</strong> อย่างถาวรใช่ไหม?<br/>
                  <span style={{ color:'var(--color-danger)', fontSize:'0.82rem' }}>การกระทำนี้ไม่สามารถยกเลิกได้</span>
                </p>
              </div>
            </div>
            <div className={styles.modalActions} style={{ marginTop:8 }}>
              <button className="btn btn-secondary" onClick={() => setDeleteModal(null)} disabled={isUpdating} style={{ flex:1 }}>ยกเลิก</button>
              <button className="btn" onClick={handleConfirmDelete} disabled={isUpdating}
                style={{ flex:1, background:'linear-gradient(135deg,#DC2626,#991B1B)', color:'white', boxShadow:'0 4px 12px rgba(220,38,38,0.35)' }}>
                {isUpdating ? <><span className="spinner" style={{ borderTopColor:'white' }} /> กำลังลบ...</> : '🗑 ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editProfileModal?.isOpen && (
        <div className={styles.modalOverlay} onClick={() => !isUpdating && setEditProfileModal(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>✏️ Edit Profile</h3>
              <ModalCloseBtn onClick={() => setEditProfileModal(null)} disabled={isUpdating} />
            </div>
            <form onSubmit={handleSaveProfile}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Employee ID</label>
                <input type="text" className="form-input" value={editProfileModal.employeeId} disabled style={{ opacity: 0.5 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={editProfileModal.fullName}
                  onChange={e => setEditProfileModal(prev => prev ? { ...prev, fullName: e.target.value } : null)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Nickname</label>
                <input
                  type="text"
                  className="form-input"
                  value={editProfileModal.nickname}
                  onChange={e => setEditProfileModal(prev => prev ? { ...prev, nickname: e.target.value } : null)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Department *</label>
                <select
                  className="form-select"
                  value={editProfileModal.department}
                  onChange={e => setEditProfileModal(prev => prev ? { ...prev, department: e.target.value } : null)}
                  required
                >
                  <option value="" disabled>Select Department...</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Phone Number</label>
                <input
                  type="tel"
                  className="form-input"
                  value={editProfileModal.phone}
                  onChange={e => setEditProfileModal(prev => prev ? { ...prev, phone: e.target.value } : null)}
                  placeholder="08X-XXX-XXXX"
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditProfileModal(null)} disabled={isUpdating} style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isUpdating} style={{ flex: 1 }}>
                  {isUpdating ? <><span className="spinner" style={{ borderTopColor: 'white' }} /> Saving...</> : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div style={{
          position:'fixed', bottom:32, left:'50%', transform:'translateX(-50%)', zIndex:9999,
          background: toastMsg.type === 'success' ? 'rgba(16,185,129,0.95)' : 'rgba(220,38,38,0.95)',
          color:'white', padding:'14px 24px', borderRadius:'var(--radius-full)',
          display:'flex', alignItems:'center', gap:10,
          boxShadow:'0 8px 32px rgba(0,0,0,0.25)', backdropFilter:'blur(8px)',
          fontSize:'0.9rem', fontWeight:500, maxWidth:'90vw', animation:'fadeInUp 0.3s ease'
        }}>
          {toastMsg.type === 'success'
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
          {toastMsg.text}
        </div>
      )}
    </div>
  );
}
