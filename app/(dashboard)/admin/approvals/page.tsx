'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/use-lang';
import type { GeneralRequest, RequestStatus, Destination } from '@/lib/types';
import { getNavigationUrl } from '@/lib/maps';
import DateInput from '@/components/DateInput';
import styles from './approvals.module.css';

const getStaticMapUrl = (req: GeneralRequest) => {
  let validStops: { lat: number; lng: number }[] = [];
  if (req.destinations && req.destinations.length > 0) {
    validStops = req.destinations
      .filter(d => d.latLng && typeof d.latLng.lat === 'number' && typeof d.latLng.lng === 'number')
      .map(d => d.latLng!);
  } else if (req.destinationLatLng && typeof req.destinationLatLng.lat === 'number' && typeof req.destinationLatLng.lng === 'number') {
    validStops = [req.destinationLatLng];
  }

  if (validStops.length === 0) return null;

  // Calculate center and zoom from bounding box
  const lats = validStops.map(s => s.lat);
  const lngs = validStops.map(s => s.lng);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

  // Build markers string for OpenStreetMap staticmap
  const markerParams = validStops.map((latLng, index) => {
    const color = index === 0 ? 'blue' : index === validStops.length - 1 ? 'green' : 'orange';
    return `marker=${latLng.lat},${latLng.lng},${color}`;
  }).join('&');

  const zoom = validStops.length === 1 ? 15 : 13;
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${centerLat},${centerLng}&zoom=${zoom}&size=600x200&${markerParams}`;
};

const formatScheduledDate = (dateStr: string, lang: 'en' | 'th') => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  
  if (lang === 'th') {
    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    return `${d} ${thaiMonths[m - 1]} ${y + 543}`;
  } else {
    const englishMonths = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return `${d} ${englishMonths[m - 1]} ${y}`;
  }
};

const LANG = {
  en: {
    title: 'Review Requests',
    subtitle: 'Manage and review general logistics and errand requests',
    loading: 'Loading requests…',
    noReqs: 'No {filter} requests found',
    submitted: 'Submitted by',
    date: 'Date:',
    noteFromRev: 'Note from reviewer:',
    suggestedDate: 'Suggested date:',
    status: {
      all: 'All',
      pending: 'Pending',
      urgent_pending: '⚡ Urgent Pending',
      urgent_approved: '⚡ Urgent Approved',
      urgent_rejected: '⚡ Urgent Rejected',
      approved: 'Approved',
      rejected: 'Rejected',
      rescheduled: 'Rescheduled',
      in_progress: 'In Progress',
      completed: 'Completed',
    },
    types: {
      document: '📄 Document',
      parcel: '📦 Parcel',
      errand: '🏃 Errand',
      other: '🔧 Other',
    },
    navigate: 'Navigate (Google Maps)',
    approve: 'Approve',
    reject: 'Reject',
    reschedule: 'Reschedule',
    approveUrgent: '✅ Approve Urgent',
    rejectUrgent: '❌ Reject Urgent',
    urgentRejectTitle: 'Reject Urgent Request',
    urgentRejectReasonLabel: 'Reason for rejection (Required)',
    urgentSuggestDateLabel: 'Suggest alternate date (e.g. Tomorrow)',
    bolt: '⚡ Bolt Offer',
    boltModalTitle: '⚡ Suggest Bolt for Business',
    boltModalDesc: 'This will notify the requester that we suggest using Bolt for Business for this trip instead.',
    boltNote: 'Note to requester (optional)',
    addNote: 'Add Note (Optional)',
    submit: 'Confirm',
    cancel: 'Cancel',
    startJob: 'Start Trip',
    completeJob: 'Complete Job',
    proofOfWork: 'Proof of Work',
    completionNote: 'Completion Note',
    uploadPhoto: 'Upload Proof Photo (Optional)',
    startedAtLabel: 'Started At:',
    completedAtLabel: 'Completed At:',
    boltSuggested: 'Bolt Suggested',
    boltSuggestedDesc: 'Requester has been suggested to use Bolt for Business',
  },
  th: {
    title: 'จัดการคำขอ',
    subtitle: 'ตรวจสอบและอนุมัติคำขอขนส่งทั่วไป',
    loading: 'กำลังโหลดคำขอ…',
    noReqs: 'ไม่พบคำขอ{filter}',
    submitted: 'ส่งโดย',
    date: 'ส่งเมื่อ:',
    noteFromRev: 'บันทึกจากผู้ตรวจสอบ:',
    suggestedDate: 'วันที่เสนอแนะ:',
    status: {
      all: 'ทั้งหมด',
      pending: 'รอตรวจสอบ',
      urgent_pending: '⚡ รออนุมัติงานด่วน',
      urgent_approved: '⚡ อนุมัติงานด่วนแล้ว',
      urgent_rejected: '⚡ ไม่อนุมัติงานด่วน',
      approved: 'อนุมัติ',
      rejected: 'ปฏิเสธ',
      rescheduled: 'ขอเลื่อนเวลา',
      in_progress: 'อยู่ระหว่างดำเนินการ',
      completed: 'เสร็จสิ้น',
    },
    types: {
      document: '📄 เอกสาร',
      parcel: '📦 พัสดุ',
      errand: '🏃 ธุระทั่วไป',
      other: '🔧 อื่นๆ',
    },
    navigate: 'นำทาง (Google Maps)',
    approve: 'อนุมัติ',
    reject: 'ปฏิเสธ',
    reschedule: 'เลื่อนเวลา',
    approveUrgent: '✅ อนุมัติงานด่วน',
    rejectUrgent: '❌ ไม่อนุมัติงานด่วน',
    urgentRejectTitle: 'ไม่อนุมัติคำขอใช้งานเร่งด่วน',
    urgentRejectReasonLabel: 'เหตุผลที่ไม่อนุมัติ (ระบุให้ผู้ขอทราบ) *',
    urgentSuggestDateLabel: 'เสนอแนะวัน/เวลาที่แนะนำให้จองใหม่ (เช่น วันพรุ่งนี้)',
    bolt: '⚡ เสนอ Bolt',
    boltModalTitle: '⚡ แนะนำ Bolt for Business',
    boltModalDesc: 'ระบบจะแจ้งผู้ร้องขอว่าเราแนะนำให้ใช้บริการ Bolt for Business แทน เนื่องจากเราไม่สามารถจัดการได้ตามคำขอ',
    boltNote: 'บันทึกถึงผู้ร้องขอ (เลือกได้)',
    addNote: 'เพิ่มบันทึก (เลือกได้)',
    submit: 'ยืนยัน',
    cancel: 'ยกเลิก',
    startJob: 'เริ่มงาน',
    completeJob: 'เสร็จสิ้นงาน',
    proofOfWork: 'หลักฐานการทำงาน',
    completionNote: 'บันทึกหลังเสร็จงาน',
    uploadPhoto: 'อัปโหลดรูปภาพหลักฐาน (เลือกได้)',
    startedAtLabel: 'เริ่มงานเมื่อ:',
    completedAtLabel: 'เสร็จสิ้นเมื่อ:',
    boltSuggested: 'แนะนำ Bolt',
    boltSuggestedDesc: 'แจ้งผู้ร้องขอให้ใช้ Bolt for Business แล้ว',
  }
} as const;

export default function ApprovalsPage() {
  const router = useRouter();
  const { userProfile, isAdmin, isMasterAdmin, isDriver } = useAuth();
  const { lang } = useLang();
  const t = LANG[lang];
  
  const [requests, setRequests] = useState<GeneralRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RequestStatus | 'all'>('pending');

  const [activeReqId, setActiveReqId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'reschedule' | 'bolt' | 'approve_urgent' | 'reject_urgent' | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [rescheduledDate, setRescheduledDate] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!userProfile) return;
    if (!isAdmin && !isMasterAdmin && !isDriver) {
      router.replace('/');
    }
  }, [userProfile, isAdmin, isMasterAdmin, isDriver, router]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'requests'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setRequests(snap.docs.map(d => ({ ...(d.data() as GeneralRequest), id: d.id })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleStartJob = async (id: string) => {
    setActionLoading(true);
    try {
      const updateData = {
        status: 'in_progress' as RequestStatus,
        startedAt: Date.now(),
        updatedAt: Date.now(),
      };
      await updateDoc(doc(db, 'requests', id), updateData);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, ...updateData } as GeneralRequest : r));
    } catch (err) {
      console.error(err);
      alert('Error starting job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteJob = async (id: string) => {
    setActionLoading(true);
    try {
      const updateData = {
        status: 'completed' as RequestStatus,
        completedAt: Date.now(),
        updatedAt: Date.now(),
      };
      await updateDoc(doc(db, 'requests', id), updateData);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, ...updateData } as GeneralRequest : r));
    } catch (err) {
      console.error(err);
      alert('Error completing job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!confirm(lang === 'en' ? 'Are you sure you want to delete this request permanently?' : 'คุณแน่ใจหรือว่าต้องการลบคำขอนี้อย่างถาวร?')) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'requests', id));
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      console.error(err);
      alert('Error deleting request: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAction = async () => {
    if (!activeReqId || !actionType || !userProfile) return;
    if (actionType === 'reject_urgent' && !reviewNote.trim()) {
      alert(lang === 'th' ? 'กรุณาระบุเหตุผลที่ไม่อนุมัติคำขอด่วน' : 'Please provide a reason for rejecting the urgent request.');
      return;
    }

    setActionLoading(true);
    try {
      const statusMap = {
        approve: 'approved',
        reject: 'rejected',
        reschedule: 'rescheduled',
        bolt: 'bolt_suggested',
        approve_urgent: 'urgent_approved',
        reject_urgent: 'urgent_rejected',
      } as const;
      
      const updateData: Partial<GeneralRequest> = {
        status: statusMap[actionType] as any,
        reviewerId: userProfile.uid,
        reviewerName: userProfile.fullName,
        reviewNote: reviewNote || (actionType === 'bolt' ? (lang === 'th' ? 'แนะนำให้ใช้บริการ Bolt for Business แทน' : 'Please use Bolt for Business for this trip.') : null),
        updatedAt: Date.now(),
      };

      if (actionType === 'approve_urgent') {
        updateData.urgentApprovedAt = Date.now();
      }

      if ((actionType === 'reschedule' || actionType === 'reject_urgent') && rescheduledDate) {
        updateData.rescheduledDate = rescheduledDate;
        updateData.suggestedDate = rescheduledDate;
      }

      await updateDoc(doc(db, 'requests', activeReqId), updateData);
      
      setRequests(prev => prev.map(r => 
        r.id === activeReqId ? { ...r, ...updateData } as GeneralRequest : r
      ));
      
      setActiveReqId(null);
      setActionType(null);
      setReviewNote('');
      setRescheduledDate('');
    } catch (err) {
      console.error(err);
      alert('Error updating request');
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);
  const canManage = isAdmin || isMasterAdmin || isDriver;

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
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
      </div>

      <div className={styles.filters} role="tablist" aria-label="Filter requests">
        {(['all', 'urgent_pending', 'pending', 'urgent_approved', 'approved', 'in_progress', 'completed', 'urgent_rejected', 'rejected', 'rescheduled'] as const).map(f => (
          <button
            key={f}
            id={`filter-${f}`}
            role="tab"
            aria-selected={filter === f}
            className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? t.status.all : t.status[f]}
            <span className={styles.filterCount}>
              {f === 'all' ? requests.length : requests.filter(r => r.status === f).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.loadingWrap}>
          <div className="spinner" style={{ color: '#6C63FF' }} />
          <span>{t.loading}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyCard}>
          <div className={styles.emptyIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
          </div>
          <p className={styles.emptyText}>{t.noReqs.replace('{filter}', filter !== 'all' ? ` ${t.status[filter]}` : '')}</p>
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map((req, i) => {
            const date = new Date(req.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const mapUrl = getStaticMapUrl(req);
            return (
              <div key={req.id} className={styles.card} style={{ animationDelay: `${i * 50}ms` }}>
                <div className={styles.cardTop}>
                  <div className={styles.cardType}>{t.types[req.type as keyof typeof t.types] ?? req.type}</div>
                  <span className={`badge badge-${req.status}`}>{t.status[req.status]}</span>
                </div>

                <div className={styles.requesterInfo}>
                  <div className={styles.requesterAvatar}>
                    {req.requesterPhotoURL ? (
                      <img src={req.requesterPhotoURL} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      req.requesterName?.[0] ?? '?'
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-1)' }}>{req.requesterName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-2)' }}>{req.requesterDepartment}</div>
                  </div>
                </div>

                <h3 className={styles.cardTitle}>{req.title}</h3>
                <p className={styles.cardDesc}>{req.description}</p>

                {/* Scheduled Date & Time Highlight Box */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  background: 'rgba(2, 132, 199, 0.04)', 
                  border: '1px solid rgba(2, 132, 199, 0.12)', 
                  padding: '10px 14px', 
                  borderRadius: '10px', 
                  marginTop: '12px', 
                  marginBottom: '12px' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2, 132, 199, 0.12)', color: 'var(--color-primary)', width: '34px', height: '34px', borderRadius: '50%' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', fontWeight: 700 }}>
                      {lang === 'en' ? 'Scheduled Date & Time' : 'วันและเวลาเดินทาง'}
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-1)', marginTop: '2px' }}>
                      {req.requestedDate ? formatScheduledDate(req.requestedDate, lang) : ''} {lang === 'en' ? 'at' : 'เวลา'} {req.requestedTime}
                    </div>
                  </div>
                </div>
                
                {req.destinations && req.destinations.length > 1 && (
                  <div style={{ margin: '12px 0', padding: '12px', background: 'rgba(0,0,0,0.03)', borderRadius: '8px', fontSize: '0.85rem' }}>
                    <strong style={{ display: 'block', marginBottom: '8px' }}>Destinations:</strong>
                    {req.destinations.map((d, idx) => (
                      <div key={idx} style={{ marginBottom: '8px', paddingLeft: '8px', borderLeft: '2px solid var(--color-primary)' }}>
                        <div style={{ fontWeight: 600 }}>Stop {idx + 1}: {d.title || d.address}</div>
                        {d.description && <div style={{ color: 'var(--text-secondary)' }}>{d.description}</div>}
                        {d.title && <div style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>{d.address}</div>}
                        {d.hasPassengers && (
                          <div style={{ marginTop: '6px', fontSize: '0.85rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '6px 8px', borderRadius: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                              <strong>Passengers ({d.passengerCount || 0})</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {mapUrl && (
                  <div style={{ marginTop: '12px', marginBottom: '12px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                    <img 
                      src={mapUrl} 
                      alt="Route Map" 
                      style={{ width: '100%', height: '140px', display: 'block', objectFit: 'cover' }} 
                      onError={(e) => {
                        const parent = e.currentTarget.parentElement;
                        if (parent) parent.style.display = 'none';
                      }}
                    />
                  </div>
                )}

                <div className={styles.cardMeta}>
                  <div className={styles.cardMetaItem}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {req.destinations && req.destinations.length > 1 
                      ? `${req.destinations.length} Stops (Route: ${req.destinations[0].address.substring(0, 15)}... to ${req.destinations[req.destinations.length - 1].address.substring(0, 15)}...)` 
                      : req.destination}
                  </div>
                  <div className={styles.cardMetaItem}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {req.requestedDate} at {req.requestedTime}
                  </div>
                  <div className={styles.cardMetaItem}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {t.date} {date}
                  </div>
                </div>

                {req.reviewNote && (
                  <div className={styles.reviewNote}>
                    <strong>{t.noteFromRev}</strong> {req.reviewNote}
                    {req.rescheduledDate && <> — {t.suggestedDate} <strong>{req.rescheduledDate}</strong></>}
                  </div>
                )}

                {req.status === 'completed' && (
                  <div className={styles.completionDetails} style={{ marginTop: '12px', padding: '12px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      {lang === 'en' ? 'Job Completed Successfully' : 'งานเสร็จสิ้นเรียบร้อยแล้ว'}
                    </div>
                    {req.completedAt && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-2)', marginBottom: '4px' }}>
                        <strong>{t.completedAtLabel}</strong> {new Date(req.completedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    {req.completionNote && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-1)', marginBottom: '8px' }}>
                        <strong>{t.completionNote}:</strong> {req.completionNote}
                      </div>
                    )}
                    {req.completionPhotoURL && (
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-2)', marginBottom: '4px' }}><strong>{t.proofOfWork}:</strong></div>
                        <a href={req.completionPhotoURL} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block' }}>
                          <img 
                            src={req.completionPhotoURL} 
                            alt="Proof of completion" 
                            style={{ maxWidth: '120px', maxHeight: '120px', borderRadius: '8px', border: '1px solid var(--color-border)', cursor: 'pointer', objectFit: 'cover' }} 
                          />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {req.status === 'urgent_pending' && (
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1.5px solid rgba(245, 158, 11, 0.4)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    margin: '12px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: '#b45309', fontSize: '0.9rem' }}>
                      <span>⚡</span>
                      <span>{lang === 'th' ? 'คำขอขอใช้งานเร่งด่วน (รอพิจารณาอนุมัติ)' : 'Urgent Service Pre-Request (Pending Review)'}</span>
                    </div>
                    {req.urgentReason && (
                      <div style={{ fontSize: '0.84rem', color: '#92400e', lineHeight: 1.5 }}>
                        <strong>{lang === 'th' ? 'เหตุผลความจำเป็นเร่งด่วน:' : 'Reason for Urgency:'}</strong> {req.urgentReason}
                      </div>
                    )}
                    <div style={{ fontSize: '0.8rem', color: '#b45309' }}>
                      📍 <strong>{lang === 'th' ? 'จุดหมายโดยสังเขป:' : 'Rough Destination:'}</strong> {req.destination}
                    </div>
                  </div>
                )}

                <div className={styles.cardActions} style={{ flexWrap: 'wrap', gap: '8px', width: '100%', alignItems: 'center' }}>
                  {(req.status === 'approved' || req.status === 'in_progress') && (
                    <a
                      href={getNavigationUrl(req)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.navigateBtn}
                      style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '4px' }}><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
                      {t.navigate}
                    </a>
                  )}

                  {/* Start Job for Approved requests (Drivers/Admins) */}
                  {canManage && req.status === 'approved' && (
                    <button 
                      className="btn btn-gradient" 
                      style={{ flex: 1 }}
                      onClick={() => handleStartJob(req.id)}
                      disabled={actionLoading}
                    >
                      {t.startJob}
                    </button>
                  )}

                  {/* Complete Job for In Progress requests (Drivers/Admins) */}
                  {canManage && req.status === 'in_progress' && (
                    <button 
                      className="btn btn-gradient" 
                      style={{ flex: 1 }}
                      onClick={() => handleCompleteJob(req.id)}
                      disabled={actionLoading}
                    >
                      {t.completeJob}
                    </button>
                  )}

                  {/* Urgent Pending Actions for Drivers/Admins */}
                  {canManage && req.status === 'urgent_pending' && (
                    <>
                      <button 
                        className="btn btn-gradient" 
                        style={{ flex: 1, background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' }}
                        onClick={() => { setActiveReqId(req.id); setActionType('approve_urgent'); }}
                      >
                        {t.approveUrgent}
                      </button>
                      <button 
                        className="btn btn-outline-danger" 
                        style={{ flex: 1 }}
                        onClick={() => { 
                          setActiveReqId(req.id); 
                          setActionType('reject_urgent'); 
                          const d = new Date();
                          d.setDate(d.getDate() + 1);
                          setRescheduledDate(d.toISOString().slice(0, 10));
                        }}
                      >
                        {t.rejectUrgent}
                      </button>
                      <button
                        style={{
                          flex: 1, padding: '8px 10px', borderRadius: '10px', border: '1.5px solid #1DC361',
                          background: 'rgba(29,195,97,0.08)', color: '#1DC361', cursor: 'pointer',
                          fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', gap: 4,
                        }}
                        onClick={() => { setActiveReqId(req.id); setActionType('bolt'); }}
                      >
                        ⚡ {lang === 'th' ? 'เสนอ Bolt' : 'Bolt Offer'}
                      </button>
                    </>
                  )}

                  {/* Standard Pending actions for Drivers/Admins */}
                  {canManage && req.status === 'pending' && (
                    <>
                      <button 
                        className="btn btn-gradient" 
                        style={{ flex: 1 }}
                        onClick={() => { setActiveReqId(req.id); setActionType('approve'); }}
                      >
                        {t.approve}
                      </button>
                      <button 
                        className="btn btn-outline-danger" 
                        style={{ flex: 1 }}
                        onClick={() => { setActiveReqId(req.id); setActionType('reject'); }}
                      >
                        {t.reject}
                      </button>
                      <button 
                        className="btn btn-outline" 
                        style={{ flex: 1 }}
                        onClick={() => { setActiveReqId(req.id); setActionType('reschedule'); }}
                      >
                        {t.reschedule}
                      </button>
                      <button
                        style={{
                          flex: 1, padding: '8px 10px', borderRadius: '10px', border: '1.5px solid #1DC361',
                          background: 'rgba(29,195,97,0.08)', color: '#1DC361', cursor: 'pointer',
                          fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', gap: 4,
                        }}
                        onClick={() => { setActiveReqId(req.id); setActionType('bolt'); }}
                      >
                        ⚡ {lang === 'th' ? 'เสนอ Bolt' : 'Bolt Offer'}
                      </button>
                    </>
                  )}

                  {/* Bolt Suggested status display */}
                  {(req.status as string) === 'bolt_suggested' && (
                    <div style={{
                      width: '100%', padding: '10px 14px', borderRadius: '10px',
                      background: 'rgba(29,195,97,0.08)', border: '1px solid rgba(29,195,97,0.25)',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{ fontSize: '1.1rem' }}>⚡</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1DC361' }}>{t.boltSuggested}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-3)' }}>{t.boltSuggestedDesc}</div>
                      </div>
                    </div>
                  )}

                  {/* Admin Post-Approval / Post-Start Overrides (Only Admins/Master Admins) */}
                  {(isAdmin || isMasterAdmin) && (req.status === 'approved' || req.status === 'in_progress') && (
                    <>
                      <button 
                        className="btn btn-outline-danger" 
                        style={{ padding: '8px 16px', fontSize: '0.85rem', flex: 1, minWidth: '80px', minHeight: '36px' }}
                        onClick={() => { setActiveReqId(req.id); setActionType('reject'); }}
                      >
                        {t.reject}
                      </button>
                      <button 
                        className="btn btn-outline" 
                        style={{ padding: '8px 16px', fontSize: '0.85rem', flex: 1, minWidth: '80px', minHeight: '36px' }}
                        onClick={() => { setActiveReqId(req.id); setActionType('reschedule'); }}
                      >
                        {t.reschedule}
                      </button>
                    </>
                  )}

                  {/* Master Admin Delete Button */}
                  {isMasterAdmin && (
                    <button
                      className="btn btn-outline-danger"
                      style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}
                      onClick={() => handleDeleteRequest(req.id)}
                      disabled={actionLoading}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      {lang === 'en' ? 'Delete' : 'ลบรายการ'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeReqId && actionType && (
        <div className="modal-overlay" onClick={() => setActiveReqId(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            {/* Bolt modal */}
            {actionType === 'bolt' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(29,195,97,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>⚡</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-1)' }}>{t.boltModalTitle}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-3)', marginTop: 2 }}>Bolt for Business</div>
                  </div>
                </div>
                <div style={{ background: 'rgba(29,195,97,0.06)', border: '1px solid rgba(29,195,97,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: '0.85rem', color: 'var(--color-text-2)', marginBottom: 16, lineHeight: 1.5 }}>
                  {t.boltModalDesc}
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-2)', marginBottom: 6 }}>{t.boltNote}</label>
                  <textarea
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    rows={3}
                    placeholder={lang === 'th' ? 'เช่น กรุณาใช้ Bolt for Business เนื่องจากรถไม่พร้อมให้บริการ' : 'e.g. Please use Bolt for Business as our vehicle is unavailable.'}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button className="btn-ghost" onClick={() => setActiveReqId(null)} disabled={actionLoading} style={{ padding: '10px 20px' }}>{t.cancel}</button>
                  <button
                    onClick={handleAction}
                    disabled={actionLoading}
                    style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#1DC361', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem', minWidth: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {actionLoading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : <><span>⚡</span> {lang === 'th' ? 'ส่งข้อเสนอ' : 'Send Offer'}</>}
                  </button>
                </div>
              </>
            ) : actionType === 'reject_urgent' ? (
              <>
                <h2 style={{ marginBottom: '12px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>❌</span>
                  <span>{t.urgentRejectTitle}</span>
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-2)', marginBottom: '16px' }}>
                  {lang === 'th'
                    ? 'กรุณาระบุเหตุผลที่ไม่สามารถให้บริการงานด่วนได้ และเสนอวันที่แนะนำให้ผู้ใช้จองใหม่'
                    : 'Please provide a reason why this urgent request cannot be accommodated and suggest an alternate date.'}
                </p>
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '6px' }}>
                    {t.urgentRejectReasonLabel}
                  </label>
                  <textarea 
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    rows={3}
                    placeholder={lang === 'th' ? 'เช่น รถและคนขับติดภารกิจเต็มทุกคันในช่วงบ่ายนี้ ไม่สามารถรับงานเพิ่มได้' : 'e.g. All vehicles are fully booked for this afternoon.'}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: 'rgba(0,0,0,0.02)', border: '1.5px solid #ef4444', color: 'var(--color-text-1)', resize: 'vertical' }}
                    required
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '6px' }}>
                    {t.urgentSuggestDateLabel}
                  </label>
                  <DateInput
                    value={rescheduledDate}
                    onChange={e => setRescheduledDate(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)' }}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
                  <button className="btn-ghost" onClick={() => setActiveReqId(null)} disabled={actionLoading} style={{ padding: '10px 24px', fontSize: '1rem' }}>{t.cancel}</button>
                  <button className="btn btn-outline-danger" onClick={handleAction} disabled={actionLoading} style={{ padding: '10px 24px', fontSize: '1rem', minWidth: '120px' }}>
                    {actionLoading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : t.submit}
                  </button>
                </div>
              </>
            ) : actionType === 'approve_urgent' ? (
              <>
                <h2 style={{ marginBottom: '12px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>✅</span>
                  <span>{t.approveUrgent}</span>
                </h2>
                <p style={{ fontSize: '0.88rem', color: 'var(--color-text-2)', marginBottom: '16px' }}>
                  {lang === 'th'
                    ? 'เมื่อกดอนุมัติงานด่วนแล้ว ระบบจะส่งการแจ้งเตือนไปยังผู้ร้องขอ เพื่อให้ผู้ร้องขอกรอกรายละเอียดจุดหมาย เส้นทาง และจำนวนผู้โดยสารทันที'
                    : 'Approving this urgent request will immediately notify the requester to complete full route & destination details.'}
                </p>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-2)', marginBottom: '6px' }}>{t.addNote}</label>
                  <textarea 
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    rows={2}
                    placeholder={lang === 'th' ? 'ข้อความเพิ่มเติมถึงผู้ขอ (ไม่บังคับ)' : 'Optional note to requester...'}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
                  <button className="btn-ghost" onClick={() => setActiveReqId(null)} disabled={actionLoading} style={{ padding: '10px 24px', fontSize: '1rem' }}>{t.cancel}</button>
                  <button className="btn btn-gradient" onClick={handleAction} disabled={actionLoading} style={{ padding: '10px 24px', fontSize: '1rem', minWidth: '120px', background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' }}>
                    {actionLoading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : t.submit}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ marginBottom: '16px' }}>
                  {actionType === 'approve' ? t.approve : actionType === 'reject' ? t.reject : actionType === 'reschedule' ? t.reschedule : ''}
                </h2>
                
                {actionType === 'reschedule' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-2)', marginBottom: '6px' }}>{t.suggestedDate}</label>
                    <DateInput
                      value={rescheduledDate}
                      onChange={e => setRescheduledDate(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)' }}
                    />
                  </div>
                )}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-2)', marginBottom: '6px' }}>{t.addNote}</label>
                  <textarea 
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    rows={3}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--color-border)', color: 'var(--color-text-1)', resize: 'vertical' }}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginTop: '32px' }}>
                  <button className="btn-ghost" onClick={() => setActiveReqId(null)} disabled={actionLoading} style={{ padding: '10px 24px', fontSize: '1rem' }}>{t.cancel}</button>
                  <button className="btn-gradient" onClick={handleAction} disabled={actionLoading} style={{ padding: '10px 24px', fontSize: '1rem', minWidth: '120px' }}>
                    {actionLoading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : t.submit}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
