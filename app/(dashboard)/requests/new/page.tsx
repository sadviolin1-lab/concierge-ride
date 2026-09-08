'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/use-lang';
import type { GeneralRequest, RequestType, Destination } from '@/lib/types';
import MapSelector from '@/components/MapSelector';
import DateInput from '@/components/DateInput';
import styles from './new-request.module.css';

const LANG = {
  en: {
    title: 'New Request',
    subtitle: 'Create a clear, trackable request for concierge drivers',
    back: 'Back',
    types: {
      document: { label: 'Document', icon: '📄', desc: 'Invoices, contracts, bank checks' },
      parcel: { label: 'Parcel / Cargo', icon: '📦', desc: 'Packages, office supplies, food' },
      errand: { label: 'General Errand', icon: '🏃', desc: 'Government, banks, post office' },
      other: { label: 'Passenger / Other', icon: '👥', desc: 'Staff shuttle, special requests' },
    },
    templates: {
      document: ['Deliver Document to Limelight', 'Collect Invoice', 'Bank Check Deposit', 'Submit Official Docs', 'Sign Agreement'],
      parcel: ['Pickup Parcel from...', 'Deliver Goods to Client', 'Buy Office Supplies', 'Food/Bakery Transport', 'Move Equipment'],
      errand: ['Bank Errand', 'Vehicle Tax Renewal', 'District Office Errand', 'Post Office', 'Utility Payment'],
      other: ['Pickup Staff', 'Dropoff Staff to Airport', 'VIP Guest Transport', 'Maintenance Task', 'Site Inspection'],
    },
    sections: {
      info: '1. Request Type & Subject',
      dest: '2. Destination & Stops',
      schedule: '3. Schedule & Time',
      contact: '4. Contact for Driver',
      attach: '5. Attachments for Driver',
      preview: '📋 Driver Trip Summary',
    },
    form: {
      type: 'Request Type',
      titleLabel: 'Title / Subject',
      titlePlaceholder: 'e.g., Deliver document to Limelight',
      titleSuggestions: 'Quick Suggestions:',
      descLabel: 'Additional Description',
      descPlaceholder: 'Provide any specific instructions or requirements... (optional)',
      upTo5Stops: 'Up to 5 stops',
      dateLabel: 'Requested Date',
      timeLabel: 'Requested Time',
      tomorrow: '📅 Tomorrow (Standard >= 24h)',
      customDate: '🗓️ Custom Date',
      urgentPreset: '⚡ Urgent (< 24h / Today)',
      urgentBannerTitle: '⚡ Urgent Service Pre-Request (< 24 Hours)',
      urgentBannerText: 'Urgent requests will be submitted directly to Admin & Drivers for feasibility review. Once approved, you will be notified to enter complete route and stop details.',
      quickDestLabel: 'Rough Destination / Route Summary',
      quickDestPlaceholder: 'e.g. From Head Office to Limelight Phuket',
      urgentReasonLabel: 'Reason for Urgency',
      urgentReasonPlaceholder: 'Explain why this request is needed urgently (e.g. Client needs signed contract by 3:00 PM)...',
      contactSelf: '👤 Contact Requester',
      contactOther: '👥 Contact Someone Else',
      contactName: 'Contact Name',
      contactPhone: 'Phone Number',
      attachLabel: 'Attachments',
      attachHint: 'Photos, bills, receipts, or sample documents (max 5 files)',
      attachBtn: 'Add Files / Photos',
      submit: 'Submit Request',
      submitUrgent: '🚀 Submit Urgent Request for Review',
      submitting: 'Submitting...',
      cancel: 'Cancel',
      previewHint: 'Live preview of what the driver will receive',
      noStopsYet: 'Please enter at least 1 destination',
      stopsCount: 'Stops',
      passengers: 'Passengers',
    },
    error: {
      fillAll: 'Please fill in all required fields (Subject, Phone, Destination).',
      urgentFillAll: 'Please fill in Subject, Rough Destination, Phone, and Reason for Urgency.',
      general: 'Failed to submit request. Please try again.',
    }
  },
  th: {
    title: 'สร้างคำขอใหม่',
    subtitle: 'ระบบส่งงานรับ-ส่งเอกสาร พัสดุ และธุระทั่วไปสำหรับแผนกคอนเซียร์จ',
    back: 'ย้อนกลับ',
    types: {
      document: { label: 'เอกสาร', icon: '📄', desc: 'ส่ง/รับเอกสาร วางบิล ฝากเช็ค' },
      parcel: { label: 'พัสดุ / สิ่งของ', icon: '📦', desc: 'รับพัสดุ ซื้อของ ขนย้าย' },
      errand: { label: 'วิ่งธุระทั่วไป', icon: '🏃', desc: 'ติดต่อราชการ ธนาคาร ไปรษณีย์' },
      other: { label: 'รับ-ส่งคน / อื่นๆ', icon: '👥', desc: 'รับส่งพนักงาน งานพิเศษ' },
    },
    templates: {
      document: ['ส่งเอกสารไป Limelight', 'รับเอกสารวางบิล', 'ฝากเช็คธนาคาร', 'ยื่นเอกสารราชการ', 'เซ็นเอกสารสัญญา'],
      parcel: ['รับพัสดุจาก...', 'ส่งของให้ลูกค้า', 'ซื้ออุปกรณ์สำนักงาน', 'รับของเบเกอรี่/อาหาร', 'ขนย้ายอุปกรณ์'],
      errand: ['ติดต่อธนาคาร', 'ต่อภาษี/พ.ร.บ. รถยนต์', 'ติดต่อที่ว่าการอำเภอ', 'ไปรษณีย์ไทย', 'จ่ายค่าน้ำ/ค่าไฟ'],
      other: ['รับพนักงานจาก...', 'ส่งพนักงานไปสนามบิน', 'รับแขก VIP', 'งานซ่อมบำรุง', 'ตรวจเช็คหน้างาน'],
    },
    sections: {
      info: '1. ประเภทและชื่องาน',
      dest: '2. จุดหมาย & เส้นทาง',
      schedule: '3. วันและเวลานัดหมาย',
      contact: '4. ข้อมูลผู้ติดต่อให้คนขับ',
      attach: '5. ไฟล์แนบ / รูปภาพ',
      preview: '📋 สรุปข้อมูลสำหรับคนขับ',
    },
    form: {
      type: 'ประเภทคำขอ',
      titleLabel: 'หัวข้อ / เรื่อง',
      titlePlaceholder: 'เช่น ส่งเอกสารไป Limelight',
      titleSuggestions: 'ตัวอย่างหัวข้อยอดนิยม:',
      descLabel: 'รายละเอียดเพิ่มเติม',
      descPlaceholder: 'ระบุรายละเอียดคำสั่งงานเพิ่มเติม... (ไม่บังคับ)',
      upTo5Stops: 'สูงสุด 5 จุดแวะ',
      dateLabel: 'วันที่ต้องการ',
      timeLabel: 'เวลาที่ต้องการ',
      tomorrow: '📅 พรุ่งนี้ (จองปกติ)',
      customDate: '🗓️ กำหนดเอง',
      urgentPreset: '⚡ ขอใช้งานด่วน (< 24 ชม. / วันนี้)',
      urgentBannerTitle: '⚡ คำขอขอใช้งานเร่งด่วน (< 24 ชั่วโมง)',
      urgentBannerText: 'คำขอเร่งด่วนจะถูกส่งไปให้ Admin และคนขับรถพิจารณาความพร้อมก่อนทันที เมื่อได้รับการอนุมัติ ท่านจะได้รับการแจ้งเตือนเพื่อเข้ามาระบุรายละเอียดจุดหมายและเส้นทางต่อไป',
      quickDestLabel: 'จุดหมายโดยสังเขป / เส้นทางคร่าวๆ',
      quickDestPlaceholder: 'เช่น จากสำนักงานใหญ่ ไป Limelight ภูเก็ต',
      urgentReasonLabel: 'เหตุผลความจำเป็นเร่งด่วน',
      urgentReasonPlaceholder: 'ระบุเหตุผลความจำเป็น เช่น ลูกค้าต้องการเซ็นสัญญาและรับเช็คด่วนก่อน 15:00 น....',
      contactSelf: '👤 ติดต่อฉัน (ผู้ร้องขอ)',
      contactOther: '👥 ติดต่อผู้อื่น',
      contactName: 'ชื่อผู้ติดต่อ',
      contactPhone: 'เบอร์โทรศัพท์',
      attachLabel: 'ไฟล์แนบ',
      attachHint: 'รูปถ่าย บิล ใบเสร็จ หรือเอกสารอ้างอิง (สูงสุด 5 ไฟล์)',
      attachBtn: 'แนบไฟล์ / รูปภาพ',
      submit: 'ส่งคำขอปกติ',
      submitUrgent: '🚀 ส่งคำขอใช้งานด่วนให้ Admin & คนขับพิจารณา',
      submitting: 'กำลังส่ง...',
      cancel: 'ยกเลิก',
      previewHint: 'ภาพตัวอย่างใบงานที่คนขับจะได้รับ',
      noStopsYet: 'กรุณาระบุจุดหมายอย่างน้อย 1 จุด',
      stopsCount: 'จุดแวะ',
      passengers: 'ผู้โดยสาร',
    },
    error: {
      fillAll: 'กรุณากรอกข้อมูลให้ครบถ้วน (หัวข้องาน, เบอร์โทร, จุดหมาย)',
      urgentFillAll: 'กรุณากรอกข้อมูลให้ครบถ้วน (หัวข้องาน, จุดหมายคร่าวๆ, เบอร์โทร, และเหตุผลความจำเป็นเร่งด่วน)',
      general: 'ไม่สามารถส่งคำขอได้ กรุณาลองใหม่',
    }
  }
} as const;

interface AttachFile {
  file: File;
  preview: string | null;
}

export default function NewRequestPage() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const { lang } = useLang();
  const t = LANG[lang] || LANG.en;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<RequestType>('document');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [destinations, setDestinations] = useState<Destination[]>([{ id: crypto.randomUUID(), title: '', address: '', latLng: null }]);
  const [quickDestination, setQuickDestination] = useState('');
  const [urgentReason, setUrgentReason] = useState('');
  const [attachments, setAttachments] = useState<AttachFile[]>([]);

  // Schedule states
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [requestedDate, setRequestedDate] = useState(tomorrow.toISOString().slice(0, 10));
  const [requestedTime, setRequestedTime] = useState('09:00');
  const [datePreset, setDatePreset] = useState<'tomorrow' | 'custom' | 'urgent'>('tomorrow');

  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');

  // Contact states
  const [contactType, setContactType] = useState<'self' | 'other'>('self');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  useEffect(() => {
    if (userProfile && contactType === 'self') {
      setContactName(userProfile.fullName || userProfile.nickname || '');
      setContactPhone(userProfile.phone || '');
    }
  }, [userProfile, contactType]);

  const handleDatePreset = (preset: 'tomorrow' | 'custom' | 'urgent') => {
    setDatePreset(preset);
    if (preset === 'tomorrow') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      setRequestedDate(d.toISOString().slice(0, 10));
      setRequestedTime('09:00');
    } else if (preset === 'urgent') {
      const now = new Date();
      setRequestedDate(now.toISOString().slice(0, 10));
      const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
      const hh = String(nextHour.getHours()).padStart(2, '0');
      const mm = String(nextHour.getMinutes()).padStart(2, '0');
      setRequestedTime(`${hh}:${mm}`);
    }
  };

  const isUrgentMode = datePreset === 'urgent';

  // Attachments
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 5 - attachments.length;
    const toAdd = files.slice(0, remaining);

    toAdd.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = ev => {
          setAttachments(prev => [...prev, { file, preview: ev.target?.result as string }]);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachments(prev => [...prev, { file, preview: null }]);
      }
    });
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    if (isUrgentMode) {
      // Urgent Pre-Request Validation
      if (!title.trim() || !quickDestination.trim() || !urgentReason.trim() || !contactPhone.trim()) {
        setError('urgentFillAll');
        return;
      }
    } else {
      // Standard Request Validation
      const validDestinations = destinations.filter(d => (d.title || d.address).trim().length > 0);

      if (!title.trim() || validDestinations.length === 0 || !requestedDate || !requestedTime) {
        setError('fillAll');
        return;
      }

      const missingTitle = validDestinations.some(d => !d.title || !d.title.trim());
      if (missingTitle) {
        setError('fillAll');
        return;
      }

      if (!contactPhone.trim()) {
        setError('fillAll');
        return;
      }
    }

    setError('');
    setLoading(true);

    try {
      const newId = doc(collection(db, 'requests')).id;

      // Upload attachments
      const attachmentUrls: { name: string; url: string; type: string }[] = [];
      if (attachments.length > 0) {
        setUploadProgress(lang === 'th' ? 'กำลังอัพโหลดไฟล์...' : 'Uploading files...');
        for (const att of attachments) {
          const storageRef = ref(storage, `requests/${newId}/${att.file.name}`);
          await uploadBytes(storageRef, att.file);
          const url = await getDownloadURL(storageRef);
          attachmentUrls.push({ name: att.file.name, url, type: att.file.type });
        }
        setUploadProgress('');
      }

      const validDestinations = destinations.filter(d => (d.title || d.address).trim().length > 0);

      const newReq: GeneralRequest & { attachments?: typeof attachmentUrls } = {
        id: newId,
        requesterId: userProfile.uid,
        requesterName: userProfile.fullName || userProfile.nickname || userProfile.email,
        requesterDepartment: userProfile.department || '',
        requesterPhotoURL: userProfile.photoURL,
        type,
        typeLabel: t.types[type]?.label || type,
        title: title.trim(),
        description: description.trim(),
        destination: isUrgentMode ? quickDestination.trim() : (validDestinations[0]?.title || validDestinations[0]?.address || ''),
        destinationLatLng: isUrgentMode ? null : (validDestinations[0]?.latLng || null),
        destinations: isUrgentMode 
          ? [{ id: crypto.randomUUID(), title: quickDestination.trim(), address: quickDestination.trim(), latLng: null }] 
          : validDestinations,
        requestedDate,
        requestedTime,
        status: isUrgentMode ? 'urgent_pending' : 'pending',
        reviewerId: null,
        reviewerName: null,
        reviewNote: null,
        rescheduledDate: null,
        contactType,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        isUrgent: isUrgentMode,
        urgentReason: isUrgentMode ? urgentReason.trim() : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...(attachmentUrls.length > 0 && { attachments: attachmentUrls }),
      };

      await setDoc(doc(db, 'requests', newId), newReq);
      router.push('/requests');
    } catch (err) {
      console.error(err);
      setError('general');
      setLoading(false);
    }
  };

  const fileIcon = (mime: string) => {
    if (mime.startsWith('image/')) return '🖼️';
    if (mime.includes('pdf')) return '📄';
    if (mime.includes('word') || mime.includes('doc')) return '📝';
    if (mime.includes('excel') || mime.includes('sheet') || mime.includes('xls')) return '📊';
    return '📎';
  };

  const validStops = destinations.filter(d => (d.title || d.address).trim().length > 0);
  const totalPassengers = destinations.reduce((sum, d) => sum + (d.hasPassengers ? (d.passengerCount || 1) : 0), 0);

  return (
    <div className={styles.page}>
      {/* Top Bar */}
      <div className={styles.topBar}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="Go back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          <span>{t.back}</span>
        </button>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className={styles.errorBox}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{t.error[error as keyof typeof t.error] || error}</span>
          </div>
        )}

        <div className={styles.contentGrid}>
          {/* Left Column: Form Sections */}
          <div className={styles.formCol}>
            
            {/* Section 1: Request Type & Subject */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>📋</span>
                  {t.sections.info}
                </span>
              </div>

              {/* Visual Category Cards */}
              <div className={styles.typeGrid}>
                {(['document', 'parcel', 'errand', 'other'] as RequestType[]).map((cat) => {
                  const info = t.types[cat];
                  const isActive = type === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      className={`${styles.typeCard} ${isActive ? styles.typeCardActive : ''}`}
                      onClick={() => setType(cat)}
                    >
                      <span className={styles.typeIcon}>{info.icon}</span>
                      <span className={styles.typeLabel}>{info.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Title / Subject Input */}
              <div className="form-group">
                <label className="form-label">
                  {t.form.titleLabel} <span className={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={t.form.titlePlaceholder}
                  required
                  style={{ fontSize: '0.95rem', fontWeight: 600 }}
                />
              </div>

              {/* Smart Quick Suggestion Chips */}
              <div className={styles.chipsRow}>
                <span className={styles.chipsLabel}>{t.form.titleSuggestions}</span>
                {t.templates[type]?.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={styles.suggestionChip}
                    onClick={() => setTitle(item)}
                  >
                    + {item}
                  </button>
                ))}
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">{t.form.descLabel}</label>
                <textarea
                  className="form-input"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={t.form.descPlaceholder}
                  rows={2}
                />
              </div>
            </div>

            {/* Section 2: Schedule & Mode Selection */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>🗓️</span>
                  {t.sections.schedule}
                </span>
              </div>

              {/* Quick Date Presets */}
              <div className={styles.schedulePresetRow}>
                <button
                  type="button"
                  className={`${styles.presetBtn} ${datePreset === 'tomorrow' ? styles.presetBtnActive : ''}`}
                  onClick={() => handleDatePreset('tomorrow')}
                >
                  {t.form.tomorrow}
                </button>
                <button
                  type="button"
                  className={`${styles.presetBtn} ${datePreset === 'custom' ? styles.presetBtnActive : ''}`}
                  onClick={() => handleDatePreset('custom')}
                >
                  {t.form.customDate}
                </button>
                <button
                  type="button"
                  className={`${styles.presetBtn} ${datePreset === 'urgent' ? styles.presetBtnActive : ''}`}
                  style={datePreset === 'urgent' ? { background: '#d97706', borderColor: '#d97706', color: '#fff' } : { borderColor: 'rgba(217, 119, 6, 0.4)', color: '#b45309' }}
                  onClick={() => handleDatePreset('urgent')}
                >
                  {t.form.urgentPreset}
                </button>
              </div>

              <div className={styles.formRow}>
                <div className="form-group">
                  <label className="form-label">{t.form.dateLabel} <span className={styles.required}>*</span></label>
                  <DateInput value={requestedDate} onChange={e => { setRequestedDate(e.target.value); setDatePreset('custom'); }} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{t.form.timeLabel} <span className={styles.required}>*</span></label>
                  <input type="time" className="form-input" value={requestedTime} onChange={e => setRequestedTime(e.target.value)} required />
                </div>
              </div>

              {/* Urgent Pre-Request Notice */}
              {isUrgentMode && (
                <div className={styles.urgentNoticeBox}>
                  <div className={styles.urgentNoticeTitle}>
                    {t.form.urgentBannerTitle}
                  </div>
                  <p className={styles.urgentNoticeText}>
                    {t.form.urgentBannerText}
                  </p>
                </div>
              )}
            </div>

            {/* Section 3: Destination & Stops (Standard vs Urgent) */}
            {isUrgentMode ? (
              <div className={styles.section} style={{ border: '1.5px solid rgba(245, 158, 11, 0.4)' }}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle} style={{ color: '#b45309' }}>
                    <span className={styles.sectionIcon}>⚡</span>
                    {lang === 'th' ? '2. รายละเอียดคำขอใช้งานเร่งด่วน' : '2. Urgent Request Details'}
                  </span>
                  <span className={styles.optBadge} style={{ background: '#fef3c7', color: '#b45309', fontWeight: 700 }}>
                    {lang === 'th' ? 'รออนุมัติก่อนปักหมุด' : 'Pre-approval'}
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    {t.form.quickDestLabel} <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={quickDestination}
                    onChange={e => setQuickDestination(e.target.value)}
                    placeholder={t.form.quickDestPlaceholder}
                    required={isUrgentMode}
                    style={{ fontSize: '0.95rem' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    {t.form.urgentReasonLabel} <span className={styles.required}>*</span>
                  </label>
                  <textarea
                    className="form-input"
                    value={urgentReason}
                    onChange={e => setUrgentReason(e.target.value)}
                    placeholder={t.form.urgentReasonPlaceholder}
                    rows={3}
                    required={isUrgentMode}
                    style={{ border: '1px solid rgba(245,158,11,0.5)' }}
                  />
                </div>
              </div>
            ) : (
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>
                    <span className={styles.sectionIcon}>🗺️</span>
                    {t.sections.dest}
                  </span>
                  <span className={styles.optBadge}>{t.form.upTo5Stops}</span>
                </div>
                <MapSelector destinations={destinations} onDestinationsChange={setDestinations} maxStops={5} />
              </div>
            )}

            {/* Section 4: Contact Info */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>📞</span>
                  {t.sections.contact}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', cursor: 'pointer', fontWeight: contactType === 'self' ? 700 : 500 }}>
                  <input
                    type="radio"
                    name="contactType"
                    checked={contactType === 'self'}
                    onChange={() => setContactType('self')}
                    disabled={loading}
                  />
                  <span>{t.form.contactSelf}</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', cursor: 'pointer', fontWeight: contactType === 'other' ? 700 : 500 }}>
                  <input
                    type="radio"
                    name="contactType"
                    checked={contactType === 'other'}
                    onChange={() => setContactType('other')}
                    disabled={loading}
                  />
                  <span>{t.form.contactOther}</span>
                </label>
              </div>

              <div className={styles.formRow}>
                <div className="form-group">
                  <label className="form-label">{t.form.contactName} <span className={styles.required}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    disabled={contactType === 'self' || loading}
                    placeholder="Enter name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t.form.contactPhone} <span className={styles.required}>*</span></label>
                  <input
                    type="tel"
                    className="form-input"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    disabled={contactType === 'self' || loading}
                    placeholder="e.g. 0812345678"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Attachments */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>📎</span>
                  {t.sections.attach}
                </span>
                <span className={styles.optBadge}>{lang === 'th' ? 'ไม่บังคับ' : 'Optional'}</span>
              </div>
              <p className={styles.attachHint}>{t.form.attachHint}</p>

              {attachments.length > 0 && (
                <div className={styles.attachGrid}>
                  {attachments.map((att, i) => (
                    <div key={i} className={styles.attachItem}>
                      {att.preview ? (
                        <img src={att.preview} alt={att.file.name} className={styles.attachThumb} />
                      ) : (
                        <div className={styles.attachDoc}>
                          <span className={styles.attachDocIcon}>{fileIcon(att.file.type)}</span>
                          <span className={styles.attachDocName}>{att.file.name}</span>
                        </div>
                      )}
                      <button type="button" className={styles.attachRemove} onClick={() => removeAttachment(i)} aria-label="Remove">✕</button>
                    </div>
                  ))}
                  {attachments.length < 5 && (
                    <button type="button" className={styles.attachAddMore} onClick={() => fileInputRef.current?.click()}>
                      <span>+</span>
                    </button>
                  )}
                </div>
              )}

              {attachments.length === 0 && (
                <button type="button" className={styles.attachDropzone} onClick={() => fileInputRef.current?.click()}>
                  <div className={styles.attachDropzoneIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <span className={styles.attachDropzoneText}>{t.form.attachBtn}</span>
                  <span className={styles.attachDropzoneHint}>JPG, PNG, PDF, DOCX (Max 5)</span>
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Right Column: Driver Live Summary Preview */}
          <div className={styles.previewSticky}>
            <div className={styles.previewCard}>
              <div className={styles.previewHeader}>
                <span className={styles.previewTitle}>
                  <span>🚗</span>
                  <span>{t.sections.preview}</span>
                </span>
                <span className={styles.previewBadge} style={isUrgentMode ? { background: '#fef3c7', color: '#b45309' } : {}}>
                  {isUrgentMode ? '⚡ ' + (lang === 'th' ? 'งานด่วน' : 'Urgent') : `${t.types[type]?.icon} ${t.types[type]?.label}`}
                </span>
              </div>

              {/* Subject */}
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-3)', fontWeight: 600 }}>
                  {t.form.titleLabel.toUpperCase()}
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-1)', marginTop: 2 }}>
                  {title || <span style={{ color: 'var(--color-text-3)', fontStyle: 'italic', fontWeight: 400 }}>—</span>}
                </div>
              </div>

              {/* Destination / Itinerary */}
              {isUrgentMode ? (
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 700, marginBottom: 4 }}>
                    📍 {t.form.quickDestLabel.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-text-1)' }}>
                    {quickDestination || <span style={{ color: 'var(--color-text-3)', fontStyle: 'italic' }}>—</span>}
                  </div>
                  {urgentReason && (
                    <div style={{ marginTop: 8, padding: 8, background: '#fffbeb', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)', fontSize: '0.78rem', color: '#92400e' }}>
                      <strong>⚡ {t.form.urgentReasonLabel}:</strong> {urgentReason}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 8 }}>
                    ITINERARY ({validStops.length} {t.form.stopsCount.toUpperCase()})
                  </div>
                  {validStops.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-3)', fontStyle: 'italic' }}>
                      {t.form.noStopsYet}
                    </div>
                  ) : (
                    <div className={styles.previewTimeline}>
                      {validStops.map((stop, idx) => (
                        <div key={idx} className={styles.timelineItem}>
                          <div className={styles.timelineDot} style={{ background: '#0284c7' }}>
                            {idx + 1}
                          </div>
                          <div className={styles.timelineContent}>
                            <span className={styles.timelinePlace}>{stop.title || stop.address}</span>
                            {stop.description && <span className={styles.timelineNote}>📝 {stop.description}</span>}
                            {stop.hasPassengers && (
                              <span style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600 }}>
                                👥 {stop.passengerCount || 1} {t.form.passengers}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Meta Info */}
              <div className={styles.previewMetaRow}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>📅 {t.form.dateLabel}:</span>
                  <span className={styles.metaValue}>{requestedDate} ({requestedTime})</span>
                </div>

                {isUrgentMode && (
                  <div className={styles.metaItem} style={{ color: '#b45309' }}>
                    <span className={styles.metaLabel}>⚡ ประเภท:</span>
                    <span className={styles.metaValue} style={{ color: '#b45309', fontWeight: 700 }}>งานด่วน (&lt; 24 ชม.)</span>
                  </div>
                )}

                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>👤 {t.form.contactName}:</span>
                  <span className={styles.metaValue}>{contactName || '—'}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>📞 {t.form.contactPhone}:</span>
                  <span className={styles.metaValue}>{contactPhone || '—'}</span>
                </div>
                {!isUrgentMode && totalPassengers > 0 && (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>👥 {t.form.passengers}:</span>
                    <span className={styles.metaValue}>{totalPassengers}</span>
                  </div>
                )}
              </div>

              {/* Submit Action */}
              <button
                type="submit"
                className={`btn btn-primary ${styles.submitBtn}`}
                style={isUrgentMode ? { background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)' } : {}}
                disabled={loading}
              >
                {loading ? (
                  <><span className="spinner" /> {uploadProgress || t.form.submitting}</>
                ) : isUrgentMode ? (
                  <>{t.form.submitUrgent}</>
                ) : (
                  <>🚀 {t.form.submit}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

