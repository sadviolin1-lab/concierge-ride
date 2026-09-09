'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/use-lang';
import Link from 'next/link';
import styles from './home.module.css';
import { useNavigationItems } from '@/lib/navigation';
import type { GeneralRequest } from '@/lib/types';
import DateInput from '@/components/DateInput';
import { getNavigationUrl } from '@/lib/maps';

const HOME_LANG = {
  en: {
    welcome: 'Welcome back,',
    subtitle: 'What would you like to do today?',
    quickActions: 'Quick Actions',
    activeRequests: 'Active Requests',
    pendingLabel: 'Pending',
    approvedLabel: 'Approved',
    inProgressLabel: 'In Progress',
    rescheduledLabel: 'Rescheduled',
    noActive: 'No active requests',
    viewAll: 'View All',
    newRequest: 'New Request',
  },
  th: {
    welcome: 'ยินดีต้อนรับกลับ,',
    subtitle: 'วันนี้คุณต้องการทำอะไร?',
    quickActions: 'เมนูด่วน',
    activeRequests: 'คำขอที่ดำเนินอยู่',
    pendingLabel: 'รออนุมัติ',
    approvedLabel: 'อนุมัติแล้ว',
    inProgressLabel: 'กำลังดำเนินการ',
    rescheduledLabel: 'เลื่อนวันที่',
    noActive: 'ไม่มีคำขอที่ดำเนินอยู่',
    viewAll: 'ดูทั้งหมด',
    newRequest: 'สร้างคำขอใหม่',
  }
} as const;

const STATUS_CONFIG = {
  pending:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '⏳' },
  approved:    { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: '✅' },
  in_progress: { color: '#0284c7', bg: 'rgba(2,132,199,0.12)',  icon: '🚗' },
  rescheduled: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', icon: '📅' },
  rejected:    { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: '❌' },
  completed:   { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: '✓' },
} as const;

function formatDate(dateStr: string, lang: 'en' | 'th') {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  if (lang === 'th') {
    const thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return `${d} ${thMonths[m - 1]} ${y + 543}`;
  }
  const enMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${enMonths[m - 1]} ${y}`;
}

function formatDateTime(timestamp: number, lang: 'en' | 'th') {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); // DD/MM/YYYY
  const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr} ${timeStr}`;
}

export default function HomePage() {
  const { userProfile, isAdmin, isMasterAdmin } = useAuth();
  const { lang } = useLang();
  const t = HOME_LANG[lang];
  const isDriver = userProfile?.role === 'driver';

  const navItems = useNavigationItems();
  const quickActions = navItems.filter(item => item.id !== 'home');

  const [pendingCount, setPendingCount] = useState(0);
  const [activeRequests, setActiveRequests] = useState<GeneralRequest[]>([]);
  const [loadingReqs, setLoadingReqs] = useState(true);
  const [expandedReqId, setExpandedReqId] = useState<string | null>(null);
  const [homeActionType, setHomeActionType] = useState<'approve' | 'reject' | 'reschedule' | 'bolt' | null>(null);
  const [homeNote, setHomeNote] = useState('');
  const [homeReschedDate, setHomeReschedDate] = useState('');
  const [homeActionLoading, setHomeActionLoading] = useState(false);

  const [completeReqId, setCompleteReqId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [completionFile, setCompletionFile] = useState<File | null>(null);
  const [completing, setCompleting] = useState(false);

  // Admin: watch pending user approvals
  useEffect(() => {
    const role = userProfile?.role;
    if (role === 'admin' || role === 'master_admin' || role === 'hr') {
      const q = query(collection(db, 'users'), where('status', '==', 'pending'));
      return onSnapshot(
        q,
        snap => setPendingCount(snap.size),
        _err => setPendingCount(0)
      );
    }
  }, [userProfile?.role]);

  // Watch active requests (real-time)
  useEffect(() => {
    if (!userProfile?.uid) return;

    const ACTIVE_STATUSES = ['pending', 'approved', 'in_progress', 'rescheduled'];

    let q;
    if (isAdmin || isMasterAdmin || isDriver) {
      q = query(
        collection(db, 'requests'),
        where('status', 'in', ACTIVE_STATUSES),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
    } else {
      q = query(
        collection(db, 'requests'),
        where('requesterId', '==', userProfile.uid),
        where('status', 'in', ACTIVE_STATUSES),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
    }

    const unsub = onSnapshot(
      q,
      snap => {
        setActiveRequests(snap.docs.map(d => d.data() as GeneralRequest));
        setLoadingReqs(false);
      },
      _err => {
        setLoadingReqs(false);
      }
    );
    return unsub;
  }, [userProfile?.uid, isAdmin, isMasterAdmin, isDriver]);

  const handleHomeAction = async (reqId: string, action: 'approve' | 'reject' | 'reschedule' | 'bolt') => {
    if (!userProfile) return;
    setHomeActionLoading(true);
    try {
      const statusMap = { approve: 'approved', reject: 'rejected', reschedule: 'rescheduled', bolt: 'bolt_suggested' };
      const defaultBoltNote = lang === 'th' ? 'แนะนำให้ใช้บริการ Bolt for Business แทน' : 'Please use Bolt for Business for this trip.';
      await updateDoc(doc(db, 'requests', reqId), {
        status: statusMap[action],
        reviewerId: userProfile.uid,
        reviewerName: userProfile.fullName,
        reviewNote: homeNote || (action === 'bolt' ? defaultBoltNote : null),
        ...(action === 'reschedule' && homeReschedDate ? { rescheduledDate: homeReschedDate } : {}),
        updatedAt: Date.now(),
      });
      setExpandedReqId(null);
      setHomeActionType(null);
      setHomeNote('');
      setHomeReschedDate('');
    } catch (err) {
      console.error(err);
    } finally {
      setHomeActionLoading(false);
    }
  };

  const handleStartJob = async (req: GeneralRequest, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userProfile) return;
    try {
      await updateDoc(doc(db, 'requests', req.id), {
        status: 'in_progress',
        startedByUid: userProfile.uid,
        startedByName: userProfile.fullName || userProfile.nickname || userProfile.email,
        startedAt: Date.now(),
        updatedAt: Date.now(),
      });
      const navUrl = getNavigationUrl(req);
      if (navUrl) {
        window.open(navUrl, '_blank');
      }
    } catch (err) {
      console.error('Failed to start job:', err);
    }
  };

  const handleCompleteJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeReqId || completing) return;
    setCompleting(true);
    try {
      let photoURL = null;
      if (completionFile) {
        const fileRef = ref(storage, `requests/completion_${completeReqId}_${Date.now()}`);
        await uploadBytes(fileRef, completionFile);
        photoURL = await getDownloadURL(fileRef);
      }
      
      await updateDoc(doc(db, 'requests', completeReqId), {
        status: 'completed',
        completionNote: completionNote || null,
        completionPhotoURL: photoURL,
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });
      
      setCompleteReqId(null);
      setCompletionNote('');
      setCompletionFile(null);
    } catch (err) {
      console.error('Failed to complete job:', err);
    } finally {
      setCompleting(false);
    }
  };

  const toggleExpand = (reqId: string) => {
    if (expandedReqId === reqId) {
      setExpandedReqId(null);
      setHomeActionType(null);
      setHomeNote('');
      setHomeReschedDate('');
    } else {
      setExpandedReqId(reqId);
      setHomeActionType(null);
      setHomeNote('');
      setHomeReschedDate('');
    }
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: t.pendingLabel,
      approved: t.approvedLabel,
      in_progress: t.inProgressLabel,
      rescheduled: t.rescheduledLabel,
    };
    return map[status] || status;
  };

  return (
    <div className={styles.container}>
      {/* Welcome card */}
      <div className={styles.welcomeCard}>
        <h1 className={styles.greeting}>{t.welcome} {userProfile?.nickname || userProfile?.fullName?.split(' ')[0]} 👋</h1>
        <p className={styles.subtitle}>{t.subtitle}</p>
      </div>

      {/* ── Active Requests Banner ── */}
      {(activeRequests.length > 0 || loadingReqs) && (
        <div className={styles.activeSection}>
          <div className={styles.activeSectionHeader}>
            <div className={styles.activeSectionTitle}>
              <span className={styles.liveDot} />
              {t.activeRequests}
              {activeRequests.length > 0 && (
                <span className={styles.activeCount}>{activeRequests.length}</span>
              )}
            </div>
            <Link href="/requests" className={styles.viewAllLink}>{t.viewAll} →</Link>
          </div>

          {loadingReqs ? (
            <div className={styles.reqSkeleton}>
              <div className={styles.skeletonLine} />
              <div className={styles.skeletonLine} style={{ width: '60%' }} />
            </div>
          ) : (
            <div className={styles.reqList}>
              {activeRequests.map(req => {
                const cfg = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                const isExpanded = expandedReqId === req.id;
                const isPendingAct = (isAdmin || isMasterAdmin || isDriver) && req.status === 'pending';
                const isApprovedAct = isDriver && req.status === 'approved';
                return (
                  <div key={req.id} className={styles.reqCard} onClick={() => toggleExpand(req.id)} style={{ cursor: 'pointer' }}>
                    <div className={styles.reqCardHeader}>
                      <div className={styles.reqCardLeft}>
                        <div className={styles.reqStatusIcon} style={{ background: cfg.bg, color: cfg.color }}>
                          {cfg.icon}
                        </div>
                        <div className={styles.reqCardInfo}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div className={styles.reqCardTitle}>{req.title}</div>
                            <span style={{ fontSize: 10, color: 'var(--color-text-3)', marginLeft: 8, flexShrink: 0 }}>
                              {isExpanded ? '▲' : '▼'}
                            </span>
                          </div>
                          <div className={styles.reqCardMeta}>
                            {req.destination && <span>📍 {req.destination}</span>}
                            {req.requestedDate && <span>· {formatDate(req.requestedDate, lang)} {req.requestedTime}</span>}
                          </div>
                          {req.isEdited && req.editedAt && (
                            <div style={{
                              fontSize: '0.72rem',
                              fontWeight: '600',
                              color: '#ea580c',
                              background: 'rgba(234, 88, 12, 0.08)',
                              border: '1px solid rgba(234, 88, 12, 0.2)',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              marginTop: '6px',
                              width: 'fit-content'
                            }}>
                              <span>⚠️</span>
                              <span>
                                {lang === 'th'
                                  ? `แก้ไขรายละเอียดเมื่อ ${formatDateTime(req.editedAt, lang)}`
                                  : `Details updated on ${formatDateTime(req.editedAt, lang)}`}
                              </span>
                            </div>
                          )}
                          {req.startedByName && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-2)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>🚗</span>
                              <span>{lang === 'th' ? 'คนขับ:' : 'Driver:'} {req.startedByName}</span>
                            </div>
                          )}
                          {(isAdmin || isMasterAdmin || isDriver) && (
                            <div className={styles.reqCardRequester}>
                              👤 {req.requesterName}{req.requesterDepartment && ` · ${req.requesterDepartment}`}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={styles.reqStatusBadge} style={{ background: cfg.bg, color: cfg.color }}>
                        {statusLabel(req.status)}
                      </div>
                    </div>

                    {/* Expanded full details */}
                    {isExpanded && (
                      <div className={styles.reqExpandedDetails} onClick={e => e.stopPropagation()}>
                        {req.destinations && req.destinations.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <h4>{lang === 'th' ? 'จุดแวะ' : 'Stops'}:</h4>
                            {req.destinations.map((d, i) => (
                              <div key={i} style={{ fontSize: '0.8rem' }}>
                                <strong>{i+1}. {d.title}</strong>
                                {d.address && <div style={{ color: 'var(--color-text-3)' }}>{d.address}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                        {req.description && (
                          <div>
                            <h4>{lang === 'th' ? 'รายละเอียด' : 'Description'}:</h4>
                            <div style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{req.description}</div>
                          </div>
                        )}
                        <div style={{ fontSize: '0.8rem' }}>
                          <strong>{lang === 'th' ? 'ผู้โดยสาร' : 'Passengers'}:</strong> {req.destinations?.some(d => d.hasPassengers) ? `✅ (${req.destinations.reduce((acc, d) => acc + (d.passengerCount || 0), 0)})` : '❌'}
                        </div>
                      </div>
                    )}

                    {/* Start Job Button for Driver (Directly on card) */}
                    {isApprovedAct && (
                      <div onClick={e => e.stopPropagation()} style={{ marginTop: '8px' }}>
                        <button className={styles.startJobBtn} onClick={e => handleStartJob(req, e)}>
                          🚀 {lang === 'th' ? 'เริ่มงาน / นำทาง' : 'Start Job / Navigate'}
                        </button>
                      </div>
                    )}

                    {/* Complete Job Form for Driver */}
                    {isExpanded && isDriver && req.status === 'in_progress' && (
                      <div className={styles.completionForm} onClick={e => e.stopPropagation()}>
                        {completeReqId !== req.id ? (
                          <button className={styles.completeJobBtn} onClick={() => setCompleteReqId(req.id)}>
                            ✅ {lang === 'th' ? 'ดำเนินการเสร็จสิ้น' : 'Complete Job'}
                          </button>
                        ) : (
                          <form onSubmit={handleCompleteJob} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-1)' }}>
                              {lang === 'th' ? 'ยืนยันการเสร็จสิ้น' : 'Confirm Completion'}
                            </div>
                            <textarea
                              placeholder={lang === 'th' ? 'บันทึกเพิ่มเติม (ตัวเลือก)' : 'Note (optional)'}
                              value={completionNote}
                              onChange={e => setCompletionNote(e.target.value)}
                              style={{ padding: 10, borderRadius: 10, border: '1px solid var(--color-border)', width: '100%', minHeight: 60, fontSize: '0.85rem', fontFamily: 'inherit', resize: 'vertical' }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <label style={{ fontSize: '0.8rem', color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>
                                {lang === 'th' ? '📷 แนบรูปถ่าย:' : '📷 Attach photo:'}
                              </label>
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={e => setCompletionFile(e.target.files?.[0] || null)}
                                style={{ fontSize: '0.8rem', width: '100%' }}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                              <button type="submit" disabled={completing} style={{ flex: 1, padding: '10px', background: 'var(--color-success)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: completing ? 'default' : 'pointer' }}>
                                {completing ? '...' : (lang === 'th' ? 'บันทึก' : 'Save')}
                              </button>
                              <button type="button" onClick={() => { setCompleteReqId(null); setCompletionNote(''); setCompletionFile(null); }} style={{ flex: 1, padding: '10px', background: 'var(--color-bg-2)', color: 'var(--color-text-1)', border: '1px solid var(--color-border)', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}

                    {/* Inline action panel for admin & driver */}
                    {isExpanded && isPendingAct && (
                      <div className={styles.inlineActions} onClick={e => e.stopPropagation()}>
                        {homeActionType === null && (
                          <div className={styles.inlineActionBtns}>
                            <button className={styles.inlineApprove} onClick={() => handleHomeAction(req.id, 'approve')} disabled={homeActionLoading}>
                              ✅ {lang === 'th' ? 'อนุมัติ' : 'Approve'}
                            </button>
                            <button className={styles.inlineReject} onClick={() => setHomeActionType('reject')} disabled={homeActionLoading}>
                              ❌ {lang === 'th' ? 'ปฏิเสธ' : 'Reject'}
                            </button>
                            <button className={styles.inlineReschedule} onClick={() => setHomeActionType('reschedule')} disabled={homeActionLoading}>
                              📅 {lang === 'th' ? 'เลื่อน' : 'Reschedule'}
                            </button>
                            <button className={styles.inlineBolt} onClick={() => handleHomeAction(req.id, 'bolt')} disabled={homeActionLoading}>
                              ⚡ Bolt
                            </button>
                          </div>
                        )}

                        {homeActionType === 'reject' && (
                          <div className={styles.inlineSubForm}>
                            <p className={styles.inlineSubLabel}>{lang === 'th' ? 'เหตุผลในการปฏิเสธ (ไม่บังคับ)' : 'Rejection reason (optional)'}</p>
                            <textarea
                              className={styles.inlineTextarea}
                              rows={2}
                              value={homeNote}
                              onChange={e => setHomeNote(e.target.value)}
                              placeholder={lang === 'th' ? 'ระบุเหตุผล...' : 'State reason...'}
                            />
                            <div className={styles.inlineSubBtns}>
                              <button className={styles.inlineCancelSub} onClick={() => setHomeActionType(null)}>{lang === 'th' ? 'กลับ' : 'Back'}</button>
                              <button className={styles.inlineReject} onClick={() => handleHomeAction(req.id, 'reject')} disabled={homeActionLoading}>
                                {homeActionLoading ? '...' : (lang === 'th' ? 'ยืนยันปฏิเสธ' : 'Confirm Reject')}
                              </button>
                            </div>
                          </div>
                        )}

                        {homeActionType === 'reschedule' && (
                          <div className={styles.inlineSubForm}>
                            <p className={styles.inlineSubLabel}>{lang === 'th' ? 'วันที่เสนอแนะ' : 'Suggested date'}</p>
                            <DateInput value={homeReschedDate} onChange={e => setHomeReschedDate(e.target.value)} />
                            <textarea
                              className={styles.inlineTextarea}
                              rows={2}
                              value={homeNote}
                              onChange={e => setHomeNote(e.target.value)}
                              placeholder={lang === 'th' ? 'บันทึก (ไม่บังคับ)...' : 'Note (optional)...'}
                              style={{ marginTop: 8 }}
                            />
                            <div className={styles.inlineSubBtns}>
                              <button className={styles.inlineCancelSub} onClick={() => setHomeActionType(null)}>{lang === 'th' ? 'กลับ' : 'Back'}</button>
                              <button className={styles.inlineReschedule} onClick={() => handleHomeAction(req.id, 'reschedule')} disabled={homeActionLoading || !homeReschedDate}>
                                {homeActionLoading ? '...' : (lang === 'th' ? 'ยืนยัน' : 'Confirm')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Quick Actions ── */}
      <div>
        <h2 className={styles.sectionTitle}>{t.quickActions}</h2>
        <div className={styles.quickActions}>
          {quickActions.map(action => (
            <Link key={action.id} href={action.href} className={styles.actionCard}>
              <div className={styles.actionIcon}>{action.icon}</div>
              <span className={styles.actionTitle}>{action.label}</span>
              {action.id === 'users' && pendingCount > 0 && (
                <span className={styles.badge}>{pendingCount}</span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
