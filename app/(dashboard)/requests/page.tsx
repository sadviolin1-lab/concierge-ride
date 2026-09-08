'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/use-lang';
import type { GeneralRequest, RequestStatus, Destination } from '@/lib/types';
import { getNavigationUrl } from '@/lib/maps';
import MapSelector from '@/components/MapSelector';
import DateInput from '@/components/DateInput';
import styles from './requests.module.css';

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

const formatDateTime = (timestamp: number, lang: 'en' | 'th') => {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); // DD/MM/YYYY
  const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr} ${timeStr}`;
};

const LANG = {
  en: {
    title: 'My Requests',
    subtitle: 'Track your logistics and errand requests',
    newReq: 'New Request',
    loading: 'Loading requests…',
    noReqs: 'No {filter} requests found',
    createFirst: 'Create your first request',
    submitted: 'Submitted',
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
    proofOfWork: 'Proof of Work',
    completionNote: 'Completion Note',
    completedAtLabel: 'Completed At:',
    urgentPendingBanner: '⏳ Your urgent request was sent to Admin & Drivers and is awaiting approval...',
    urgentApprovedBanner: '🎉 Urgent request approved! Please provide route and stop details for the driver.',
    fillUrgentDestBtn: '📍 Fill Destination & Stops',
    urgentRejectedBanner: '❌ Urgent request could not be accommodated.',
    rescheduleToNextDayBtn: '📅 Reschedule to Another Date',
    urgentModalTitle: '⚡ Enter Route Details for Urgent Request',
    confirmUrgentTripBtn: '🚀 Confirm Details & Dispatch Driver',
  },
  th: {
    title: 'คำขอของฉัน',
    subtitle: 'ติดตามสถานะคำขอต่างๆ ของคุณ',
    newReq: 'สร้างคำขอใหม่',
    loading: 'กำลังโหลดคำขอ…',
    noReqs: 'ไม่พบคำขอ{filter}',
    createFirst: 'สร้างคำขอแรกของคุณ',
    submitted: 'ส่งเมื่อ',
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
    proofOfWork: 'หลักฐานการทำงาน',
    completionNote: 'บันทึกหลังเสร็จงาน',
    completedAtLabel: 'เสร็จสิ้นเมื่อ:',
    urgentPendingBanner: '⏳ คำขอใช้งานด่วนของคุณถูกส่งไปยัง Admin & คนขับเรียบร้อยแล้ว อยู่ระหว่างรอการพิจารณาอนุมัติ...',
    urgentApprovedBanner: '🎉 คำขอใช้งานด่วนได้รับการอนุมัติแล้ว! กรุณาระบุรายละเอียดจุดหมาย เส้นทาง และผู้โดยสาร',
    fillUrgentDestBtn: '📍 กรอกรายละเอียดจุดหมายและเส้นทาง',
    urgentRejectedBanner: '❌ คำขอใช้งานด่วนไม่สามารถให้บริการได้',
    rescheduleToNextDayBtn: '📅 ย้ายไปจองในวันถัดไป / วันอื่น',
    urgentModalTitle: '⚡ ระบุรายละเอียดจุดหมายสำหรับคำขอด่วน',
    confirmUrgentTripBtn: '🚀 บันทึกรายละเอียดและยืนยันการเดินทาง',
  }
} as const;

export default function RequestsPage() {
  const router = useRouter();
  const { userProfile, isMasterAdmin } = useAuth();
  const { lang } = useLang();
  const t = LANG[lang];
  const [requests, setRequests] = useState<GeneralRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RequestStatus | 'all'>('all');

  // Edit Request Modal State
  const [editingRequest, setEditingRequest] = useState<GeneralRequest | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editContactName, setEditContactName] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Urgent Filling Modal State
  const [fillingUrgentReq, setFillingUrgentReq] = useState<GeneralRequest | null>(null);
  const [urgentStops, setUrgentStops] = useState<Destination[]>([]);
  const [savingUrgentStops, setSavingUrgentStops] = useState(false);

  // Urgent Reschedule Modal State
  const [reschedulingUrgentReq, setReschedulingUrgentReq] = useState<GeneralRequest | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('09:00');
  const [savingReschedule, setSavingReschedule] = useState(false);

  useEffect(() => {
    if (editingRequest) {
      setEditTitle(editingRequest.title);
      setEditDesc(editingRequest.description);
      setEditDate(editingRequest.requestedDate);
      setEditTime(editingRequest.requestedTime);
      setEditContactName(editingRequest.contactName || '');
      setEditContactPhone(editingRequest.contactPhone || '');
    }
  }, [editingRequest]);

  useEffect(() => {
    if (fillingUrgentReq) {
      if (fillingUrgentReq.destinations && fillingUrgentReq.destinations.length > 0) {
        setUrgentStops(fillingUrgentReq.destinations);
      } else {
        setUrgentStops([{
          title: fillingUrgentReq.destination || '',
          address: '',
          latLng: fillingUrgentReq.destinationLatLng || null,
          description: '',
          hasPassengers: false,
          passengerCount: 1,
        }]);
      }
    }
  }, [fillingUrgentReq]);

  useEffect(() => {
    if (reschedulingUrgentReq) {
      const defaultDate = reschedulingUrgentReq.suggestedDate || reschedulingUrgentReq.rescheduledDate || '';
      if (defaultDate) {
        setRescheduleDate(defaultDate);
      } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setRescheduleDate(tomorrow.toISOString().slice(0, 10));
      }
      setRescheduleTime(reschedulingUrgentReq.requestedTime || '09:00');
    }
  }, [reschedulingUrgentReq]);

  const fetchRequests = useCallback(async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'requests'),
        where('requesterId', '==', userProfile.uid),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setRequests(snap.docs.map(d => ({ ...(d.data() as GeneralRequest), id: d.id })));
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

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
        <Link href="/requests/new" id="new-request-btn" className="btn btn-gradient" style={{ padding: '12px 24px', fontSize: '1.05rem', boxShadow: 'var(--shadow-md)', borderRadius: 'var(--radius-full)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          {t.newReq}
        </Link>
      </div>

      {/* Filter tabs */}
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
          {filtered.map((req, i) => (
            <RequestCard 
              key={req.id} 
              request={req} 
              delay={i * 50} 
              langDict={t} 
              isMasterAdmin={isMasterAdmin}
              onDelete={async (id) => {
                if (confirm(lang === 'en' ? 'Are you sure you want to delete this request permanently?' : 'คุณแน่ใจหรือว่าต้องการลบคำขอนี้อย่างถาวร?')) {
                  try {
                    await deleteDoc(doc(db, 'requests', id));
                    setRequests(prev => prev.filter(r => r.id !== id));
                  } catch (err: any) {
                    alert(err.message);
                  }
                }
              }}
              onEdit={setEditingRequest}
              onFillUrgent={setFillingUrgentReq}
              onRescheduleUrgent={setReschedulingUrgentReq}
            />
          ))}
        </div>
      )}

      {/* Edit Standard Request Modal */}
      {editingRequest && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '16px'
        }} onClick={() => setEditingRequest(null)}>
          <div style={{
            background: 'var(--color-surface, #ffffff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '16px', width: '100%', maxWidth: '500px',
            padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: 'var(--shadow-lg)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-1)' }}>
              {lang === 'th' ? 'แก้ไขรายละเอียดคำขอ' : 'Edit Request Details'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-2)' }}>
                  {lang === 'th' ? 'หัวข้อ / เรื่อง' : 'Title / Subject'}
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-2)' }}>
                  {lang === 'th' ? 'รายละเอียด' : 'Description'}
                </label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={3}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.9rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-2)' }}>
                    {lang === 'th' ? 'วันที่ต้องการ' : 'Requested Date'}
                  </label>
                  <DateInput
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-2)' }}>
                    {lang === 'th' ? 'เวลาที่ต้องการ' : 'Requested Time'}
                  </label>
                  <input
                    type="time"
                    value={editTime}
                    onChange={e => setEditTime(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-2)' }}>
                    {lang === 'th' ? 'ชื่อผู้ติดต่อ' : 'Contact Name'}
                  </label>
                  <input
                    type="text"
                    value={editContactName}
                    onChange={e => setEditContactName(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-2)' }}>
                    {lang === 'th' ? 'เบอร์โทรศัพท์' : 'Phone Number'}
                  </label>
                  <input
                    type="tel"
                    value={editContactPhone}
                    onChange={e => setEditContactPhone(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setEditingRequest(null)}
                style={{ flex: 1, padding: '10px' }}
                disabled={savingEdit}
              >
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  if (!editTitle.trim() || !editDate || !editTime || !editContactPhone.trim()) {
                    alert(lang === 'th' ? 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' : 'Please fill in all required fields.');
                    return;
                  }
                  setSavingEdit(true);
                  try {
                    const now = Date.now();
                    await updateDoc(doc(db, 'requests', editingRequest.id), {
                      title: editTitle.trim(),
                      description: editDesc.trim(),
                      requestedDate: editDate,
                      requestedTime: editTime,
                      contactName: editContactName.trim(),
                      contactPhone: editContactPhone.trim(),
                      isEdited: true,
                      editedAt: now,
                      updatedAt: now
                    });
                    setRequests(prev => prev.map(r => r.id === editingRequest.id ? {
                      ...r,
                      title: editTitle.trim(),
                      description: editDesc.trim(),
                      requestedDate: editDate,
                      requestedTime: editTime,
                      contactName: editContactName.trim(),
                      contactPhone: editContactPhone.trim(),
                      isEdited: true,
                      editedAt: now,
                      updatedAt: now
                    } : r));
                    setEditingRequest(null);
                  } catch (err: any) {
                    alert(err.message);
                  } finally {
                    setSavingEdit(false);
                  }
                }}
                style={{ flex: 1, padding: '10px' }}
                disabled={savingEdit}
              >
                {savingEdit ? '...' : (lang === 'th' ? 'บันทึก' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Urgent Request Destination & Stops Modal */}
      {fillingUrgentReq && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '16px'
        }} onClick={() => setFillingUrgentReq(null)}>
          <div style={{
            background: 'var(--color-surface, #ffffff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '20px', width: '100%', maxWidth: '780px',
            maxHeight: '90vh', overflowY: 'auto',
            padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px',
            boxShadow: 'var(--shadow-lg)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontWeight: 800, fontSize: '0.85rem' }}>
                <span>⚡</span>
                <span>{lang === 'th' ? 'คำขอใช้งานด่วนได้รับการอนุมัติแล้ว' : 'Urgent Request Approved'}</span>
              </div>
              <h2 style={{ margin: '4px 0 2px 0', fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text-1)' }}>
                {t.urgentModalTitle}
              </h2>
              <div style={{ fontSize: '0.86rem', color: 'var(--color-text-2)' }}>
                {lang === 'th'
                  ? `งาน: "${fillingUrgentReq.title}" | กำหนดเวลา: วันนี้ ${fillingUrgentReq.requestedTime} น.`
                  : `Job: "${fillingUrgentReq.title}" | Scheduled: Today at ${fillingUrgentReq.requestedTime}`}
              </div>
            </div>

            <MapSelector
              destinations={urgentStops}
              onDestinationsChange={setUrgentStops}
              maxStops={5}
            />

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setFillingUrgentReq(null)}
                disabled={savingUrgentStops}
                style={{ padding: '10px 20px' }}
              >
                {lang === 'th' ? 'ไว้กรอกภายหลัง' : 'Cancel'}
              </button>
              <button
                type="button"
                className="btn btn-gradient"
                disabled={savingUrgentStops}
                onClick={async () => {
                  const valid = urgentStops.filter(d => (d.title || d.address).trim());
                  if (valid.length === 0) {
                    alert(lang === 'th' ? 'กรุณาระบุจุดหมายหรือสถานที่ปลายทางอย่างน้อย 1 จุด' : 'Please provide at least 1 destination stop.');
                    return;
                  }

                  setSavingUrgentStops(true);
                  try {
                    const now = Date.now();
                    const primaryDest = valid[0].title || valid[0].address;
                    const primaryLatLng = valid[0].latLng || null;

                    const updatePayload: Partial<GeneralRequest> = {
                      destinations: valid,
                      destination: primaryDest,
                      destinationLatLng: primaryLatLng,
                      status: 'approved', // Officially ready and dispatched
                      updatedAt: now,
                    };

                    await updateDoc(doc(db, 'requests', fillingUrgentReq.id), updatePayload);

                    setRequests(prev => prev.map(r => r.id === fillingUrgentReq.id ? {
                      ...r,
                      ...updatePayload
                    } as GeneralRequest : r));

                    setFillingUrgentReq(null);
                    alert(lang === 'th' ? 'บันทึกเส้นทางเรียบร้อยแล้ว คนขับได้รับงานแล้ว!' : 'Route details saved! The driver is now dispatched.');
                  } catch (err: any) {
                    console.error(err);
                    alert(err.message);
                  } finally {
                    setSavingUrgentStops(false);
                  }
                }}
                style={{ padding: '10px 24px', fontSize: '1rem', minWidth: '160px' }}
              >
                {savingUrgentStops ? <div className="spinner" style={{ width: 16, height: 16 }} /> : t.confirmUrgentTripBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Urgent Rejected Reschedule to Next Day Modal */}
      {reschedulingUrgentReq && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '16px'
        }} onClick={() => setReschedulingUrgentReq(null)}>
          <div style={{
            background: 'var(--color-surface, #ffffff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '16px', width: '100%', maxWidth: '480px',
            padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: 'var(--shadow-lg)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-1)' }}>
              {t.rescheduleToNextDayBtn}
            </h3>
            
            {reschedulingUrgentReq.reviewNote && (
              <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem', color: '#b91c1c' }}>
                <strong>{t.noteFromRev}</strong> {reschedulingUrgentReq.reviewNote}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-2)' }}>
                  {lang === 'th' ? 'เลือกวันที่ต้องการจองใหม่ (ล่วงหน้าอย่างน้อย 1 วัน)' : 'Select New Booking Date'}
                </label>
                <DateInput
                  value={rescheduleDate}
                  onChange={e => setRescheduleDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-2)' }}>
                  {lang === 'th' ? 'เวลา' : 'Time'}
                </label>
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={e => setRescheduleTime(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setReschedulingUrgentReq(null)}
                style={{ flex: 1, padding: '10px' }}
                disabled={savingReschedule}
              >
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  if (!rescheduleDate || !rescheduleTime) {
                    alert(lang === 'th' ? 'กรุณาระบุวันและเวลา' : 'Please specify date and time.');
                    return;
                  }
                  setSavingReschedule(true);
                  try {
                    const now = Date.now();
                    const updatePayload: Partial<GeneralRequest> = {
                      requestedDate: rescheduleDate,
                      requestedTime: rescheduleTime,
                      isUrgent: false,
                      status: 'pending', // Re-enter standard pending queue
                      updatedAt: now,
                    };
                    await updateDoc(doc(db, 'requests', reschedulingUrgentReq.id), updatePayload);
                    setRequests(prev => prev.map(r => r.id === reschedulingUrgentReq.id ? {
                      ...r,
                      ...updatePayload
                    } as GeneralRequest : r));
                    setReschedulingUrgentReq(null);
                    alert(lang === 'th' ? 'ย้ายวันจองสำเร็จ และส่งคำขอใหม่อีกครั้งแล้ว' : 'Request rescheduled successfully.');
                  } catch (err: any) {
                    alert(err.message);
                  } finally {
                    setSavingReschedule(false);
                  }
                }}
                style={{ flex: 1, padding: '10px' }}
                disabled={savingReschedule}
              >
                {savingReschedule ? '...' : (lang === 'th' ? 'ยืนยันจองใหม่' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestCard({ 
  request: req, 
  delay, 
  langDict: t, 
  isMasterAdmin, 
  onDelete,
  onEdit,
  onFillUrgent,
  onRescheduleUrgent,
}: { 
  request: GeneralRequest; 
  delay: number; 
  langDict: typeof LANG['en'] | typeof LANG['th']; 
  isMasterAdmin: boolean; 
  onDelete: (id: string) => Promise<void>;
  onEdit: (req: GeneralRequest) => void;
  onFillUrgent: (req: GeneralRequest) => void;
  onRescheduleUrgent: (req: GeneralRequest) => void;
}) {
  const { lang } = useLang();
  const date = new Date(req.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const mapUrl = getStaticMapUrl(req);

  return (
    <div
      className={styles.card}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={styles.cardTop}>
        <div className={styles.cardType}>{t.types[req.type as keyof typeof t.types] ?? req.type}</div>
        <span className={`badge badge-${req.status}`}>{t.status[req.status]}</span>
      </div>

      <h3 className={styles.cardTitle}>{req.title}</h3>
      <p className={styles.cardDesc}>{req.description}</p>

      {req.startedByName && (
        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-2)', display: 'flex', alignItems: 'center', gap: '6px', margin: '8px 0 12px 0' }}>
          <span>🚗</span>
          <strong>{lang === 'th' ? 'ผู้ดำเนินงาน (คนขับ):' : 'Driver:'}</strong>
          <span>{req.startedByName}</span>
        </div>
      )}

      {req.isEdited && req.editedAt && (
        <div style={{
          fontSize: '0.78rem',
          fontWeight: '600',
          color: '#ea580c',
          background: 'rgba(234, 88, 12, 0.08)',
          border: '1px solid rgba(234, 88, 12, 0.2)',
          padding: '4px 10px',
          borderRadius: '8px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          margin: '8px 0 12px 0',
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

      {/* Urgent Pending Banner */}
      {req.status === 'urgent_pending' && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1.5px solid rgba(245, 158, 11, 0.35)',
          borderRadius: '10px',
          padding: '12px 14px',
          marginTop: '10px',
          marginBottom: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: '#b45309', fontSize: '0.88rem' }}>
            <span>⏳</span>
            <span>{t.urgentPendingBanner}</span>
          </div>
          {req.urgentReason && (
            <div style={{ fontSize: '0.82rem', color: '#92400e' }}>
              <strong>{lang === 'th' ? 'เหตุผลความเร่งด่วน:' : 'Urgency Reason:'}</strong> {req.urgentReason}
            </div>
          )}
        </div>
      )}

      {/* Urgent Approved Celebration Banner */}
      {req.status === 'urgent_approved' && (
        <div style={{
          background: 'rgba(22, 163, 74, 0.1)',
          border: '1.5px solid rgba(22, 163, 74, 0.35)',
          borderRadius: '10px',
          padding: '12px 14px',
          marginTop: '10px',
          marginBottom: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: '#15803d', fontSize: '0.88rem' }}>
            <span>🎉</span>
            <span>{t.urgentApprovedBanner}</span>
          </div>
          <button
            type="button"
            className="btn btn-gradient"
            style={{ width: '100%', padding: '10px', fontSize: '0.92rem', background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' }}
            onClick={() => onFillUrgent(req)}
          >
            {t.fillUrgentDestBtn}
          </button>
        </div>
      )}

      {/* Urgent Rejected Banner */}
      {req.status === 'urgent_rejected' && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1.5px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '10px',
          padding: '12px 14px',
          marginTop: '10px',
          marginBottom: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: '#b91c1c', fontSize: '0.88rem' }}>
            <span>❌</span>
            <span>{t.urgentRejectedBanner}</span>
          </div>
          {req.reviewNote && (
            <div style={{ fontSize: '0.82rem', color: '#991b1b' }}>
              <strong>{t.noteFromRev}</strong> {req.reviewNote}
            </div>
          )}
          {(req.suggestedDate || req.rescheduledDate) && (
            <div style={{ fontSize: '0.82rem', color: '#991b1b' }}>
              <strong>{t.suggestedDate}</strong> {req.suggestedDate || req.rescheduledDate}
            </div>
          )}
          <button
            type="button"
            className="btn btn-outline"
            style={{ width: '100%', padding: '8px 12px', fontSize: '0.88rem', border: '1.5px solid #dc2626', color: '#dc2626' }}
            onClick={() => onRescheduleUrgent(req)}
          >
            {t.rescheduleToNextDayBtn}
          </button>
        </div>
      )}

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
                    <strong>Passengers ({d.passengerCount || 0})</strong>{d.passengerName ? `: ${d.passengerName}` : ''}
                  </div>
                  {d.passengerContact && (
                    <div style={{ paddingLeft: '20px', marginTop: '2px' }}>📞 {d.passengerContact}</div>
                  )}
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
            style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }} 
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
          {t.submitted} {date}
        </div>
      </div>

      {req.reviewNote && req.status !== 'urgent_rejected' && (
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

      {(req.status === 'approved' || req.status === 'in_progress' || req.status === 'pending' || req.status === 'rescheduled' || isMasterAdmin) && (
        <div className={styles.cardActions} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
          {(req.status === 'approved' || req.status === 'in_progress') && (
            <a
              href={getNavigationUrl(req)}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.navigateBtn}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/><polyline points="12 10 12 10 12 10"/><line x1="12" y1="13" x2="12" y2="13"/></svg>
              {t.navigate}
            </a>
          )}
          {(req.status === 'pending' || req.status === 'rescheduled') && (
            <button
              className="btn btn-outline"
              style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}
              onClick={() => onEdit(req)}
            >
              📝 {lang === 'th' ? 'แก้ไขรายละเอียด' : 'Edit Details'}
            </button>
          )}
          {isMasterAdmin && (
            <button
              className="btn btn-outline-danger"
              style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}
              onClick={() => onDelete(req.id)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              {lang === 'en' ? 'Delete' : 'ลบรายการ'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
