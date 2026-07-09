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
    subtitle: 'Submit a new logistics or errand request',
    back: 'Back',
    form: {
      type: 'Request Type',
      titleLabel: 'Title / Subject',
      titlePlaceholder: 'e.g., Deliver documents to branch A',
      descLabel: 'Description',
      descPlaceholder: 'Provide more details... (optional)',
      destLabel: 'Destination',
      upTo5Stops: '(Up to 5 stops)',
      dateLabel: 'Requested Date',
      timeLabel: 'Requested Time',
      attachLabel: 'Attachments for Driver',
      attachHint: 'Photos, documents, or bills (optional, max 5 files)',
      attachBtn: 'Add Files / Photos',
      submit: 'Submit Request',
      submitting: 'Submitting...',
      cancel: 'Cancel',
    },
    types: {
      document: '📄 Document',
      parcel: '📦 Parcel',
      errand: '🏃 Errand',
      other: '🔧 Other',
    },
    error: {
      fillAll: 'Please fill in all required fields.',
      timeLimit: 'Requests must be made at least 24 hours in advance. For urgent requests, please contact Asst. Chief Concierge directly.',
      general: 'Failed to submit request. Please try again.',
    }
  },
  th: {
    title: 'สร้างคำขอใหม่',
    subtitle: 'ส่งคำของานรับส่งเอกสาร หรือธุระอื่นๆ',
    back: 'ย้อนกลับ',
    form: {
      type: 'ประเภทคำขอ',
      titleLabel: 'หัวข้อ / เรื่อง',
      titlePlaceholder: 'เช่น ส่งเอกสารไปสาขา A',
      descLabel: 'รายละเอียด',
      descPlaceholder: 'ระบุรายละเอียดเพิ่มเติม... (ไม่บังคับ)',
      destLabel: 'สถานที่ปลายทาง',
      upTo5Stops: '(สูงสุด 5 จุดแวะ)',
      dateLabel: 'วันที่ต้องการ',
      timeLabel: 'เวลาที่ต้องการ',
      attachLabel: 'ไฟล์แนบสำหรับคนขับ',
      attachHint: 'รูปถ่าย เอกสาร หรือบิล (ไม่บังคับ สูงสุด 5 ไฟล์)',
      attachBtn: 'แนบไฟล์ / รูปภาพ',
      submit: 'ส่งคำขอ',
      submitting: 'กำลังส่ง...',
      cancel: 'ยกเลิก',
    },
    types: {
      document: '📄 เอกสาร',
      parcel: '📦 พัสดุ',
      errand: '🏃 ธุระทั่วไป',
      other: '🔧 อื่นๆ',
    },
    error: {
      fillAll: 'กรุณากรอกข้อมูลให้ครบถ้วน',
      timeLimit: 'ต้องจองล่วงหน้าอย่างน้อย 24 ชม. หากเร่งด่วนกรุณาติดต่อ Asst. Chief Concierge โดยตรง',
      general: 'ไม่สามารถส่งคำขอได้ กรุณาลองใหม่',
    }
  }
} as const;

interface AttachFile {
  file: File;
  preview: string | null; // data URL for images
}

export default function NewRequestPage() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const { lang } = useLang();
  const t = LANG[lang];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<RequestType>('document');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [destinations, setDestinations] = useState<Destination[]>([{ id: crypto.randomUUID(), address: '', latLng: null }]);
  const [attachments, setAttachments] = useState<AttachFile[]>([]);

  // Default to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [requestedDate, setRequestedDate] = useState(tomorrow.toISOString().slice(0, 10));
  const [requestedTime, setRequestedTime] = useState('09:00');

  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');

  // Contact Info state
  const [contactType, setContactType] = useState<'self' | 'other'>('self');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Warning Modal State
  const [showWarningModal, setShowWarningModal] = useState(false);

  useEffect(() => {
    if (userProfile && contactType === 'self') {
      setContactName(userProfile.fullName || userProfile.nickname || '');
      setContactPhone(userProfile.phone || '');
    }
  }, [userProfile, contactType]);

  // ── Attachment handling ──────────────────────────────────────
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
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

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

    const requestDateTime = new Date(`${requestedDate}T${requestedTime}:00`);
    const now = new Date();
    const diffHours = (requestDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      setShowWarningModal(true);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const newId = doc(collection(db, 'requests')).id;

      // Upload attachments to Firebase Storage
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

      const newReq: GeneralRequest & { attachments?: typeof attachmentUrls } = {
        id: newId,
        requesterId: userProfile.uid,
        requesterName: userProfile.fullName || userProfile.nickname || userProfile.email,
        requesterDepartment: userProfile.department || '',
        requesterPhotoURL: userProfile.photoURL,
        type,
        typeLabel: t.types[type] || type,
        title: title.trim(),
        description: description.trim(),
        destination: validDestinations[0].title || validDestinations[0].address,
        destinationLatLng: validDestinations[0].latLng,
        destinations: validDestinations,
        requestedDate,
        requestedTime,
        status: 'pending',
        reviewerId: null,
        reviewerName: null,
        reviewNote: null,
        rescheduledDate: null,
        contactType,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
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

  return (
    <div className={styles.page}>
      {/* Header bar */}
      <div className={styles.topBar}>
        <button onClick={() => router.back()} className={styles.backBtn} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          <span>{t.back}</span>
        </button>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
      </div>

      <form className={styles.formCard} onSubmit={handleSubmit}>
        {error && (
          <div className={styles.errorBox}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{t.error[error as keyof typeof t.error] || error}</span>
          </div>
        )}

        {/* Section: Type + Title */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>📋</span>
            <span className={styles.sectionLabel}>{lang === 'th' ? 'ข้อมูลคำขอ' : 'Request Info'}</span>
          </div>
          <div className={styles.formRow}>
            <div className="form-group">
              <label className="form-label">{t.form.type}</label>
              <select className="form-select" value={type} onChange={e => setType(e.target.value as RequestType)}>
                <option value="document">{t.types.document}</option>
                <option value="parcel">{t.types.parcel}</option>
                <option value="errand">{t.types.errand}</option>
                <option value="other">{t.types.other}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t.form.titleLabel} <span className={styles.required}>*</span></label>
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t.form.titlePlaceholder}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t.form.descLabel}</label>
            <textarea
              className="form-input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t.form.descPlaceholder}
              rows={3}
            />
          </div>
        </div>

        {/* Section: Destination */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>🗺️</span>
            <span className={styles.sectionLabel}>{t.form.destLabel} <span className={styles.optBadge}>{t.form.upTo5Stops}</span></span>
          </div>
          <MapSelector destinations={destinations} onDestinationsChange={setDestinations} maxStops={5} />
        </div>

        {/* Section: Date + Time */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>🗓️</span>
            <span className={styles.sectionLabel}>{lang === 'th' ? 'วันและเวลา' : 'Schedule'}</span>
          </div>
          <div className={styles.formRow}>
            <div className="form-group">
              <label className="form-label">{t.form.dateLabel} <span className={styles.required}>*</span></label>
              <DateInput value={requestedDate} onChange={e => setRequestedDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t.form.timeLabel} <span className={styles.required}>*</span></label>
              <input type="time" className="form-input" value={requestedTime} onChange={e => setRequestedTime(e.target.value)} required />
            </div>
          </div>
        </div>

        {/* Section: Contact Info */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>📞</span>
            <span className={styles.sectionLabel}>{lang === 'th' ? 'ข้อมูลผู้ติดต่อ' : 'Contact Info'}</span>
          </div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="contactType"
                checked={contactType === 'self'}
                onChange={() => setContactType('self')}
                disabled={loading}
              />
              <span>{lang === 'th' ? 'ติดต่อกลับผู้ร้องขอ' : 'Contact Requester'}</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="contactType"
                checked={contactType === 'other'}
                onChange={() => setContactType('other')}
                disabled={loading}
              />
              <span>{lang === 'th' ? 'ติดต่อผู้อื่น' : 'Contact Someone Else'}</span>
            </label>
          </div>

          <div className={styles.formRow}>
            <div className="form-group">
              <label className="form-label">{lang === 'th' ? 'ชื่อผู้ติดต่อ' : 'Contact Name'} <span className={styles.required}>*</span></label>
              <input
                type="text"
                className="form-input"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                disabled={contactType === 'self' || loading}
                placeholder={lang === 'th' ? 'ระบุชื่อผู้ติดต่อ' : 'Enter name'}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">{lang === 'th' ? 'เบอร์โทรศัพท์' : 'Phone Number'} <span className={styles.required}>*</span></label>
              <input
                type="tel"
                className="form-input"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                disabled={contactType === 'self' || loading}
                placeholder={lang === 'th' ? 'เช่น 0812345678' : 'e.g., 0812345678'}
                required
              />
            </div>
          </div>
        </div>

        {/* Section: Attachments */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>📎</span>
            <span className={styles.sectionLabel}>
              {t.form.attachLabel}
              <span className={styles.optBadge}>{lang === 'th' ? 'ไม่บังคับ' : 'Optional'}</span>
            </span>
          </div>
          <p className={styles.attachHint}>{t.form.attachHint}</p>

          {/* Preview grid */}
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
              {/* Add more slot */}
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
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <span className={styles.attachDropzoneText}>{t.form.attachBtn}</span>
              <span className={styles.attachDropzoneHint}>JPG, PNG, PDF, DOCX…</span>
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

        {/* Actions */}
        <div className={styles.actions}>
          <button type="button" className="btn-ghost" onClick={() => router.back()}>{t.form.cancel}</button>
          <button type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={loading}>
            {loading ? (
              <><span className="spinner" /> {uploadProgress || t.form.submitting}</>
            ) : (
              <>{t.form.submit}</>
            )}
          </button>
        </div>
      </form>

      {showWarningModal && (
        <div className={styles.modalOverlay} onClick={() => setShowWarningModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalIcon}>⚠️</div>
            <h3 className={styles.modalTitle}>{lang === 'th' ? 'แจ้งเตือนเวลาจอง' : 'Booking Alert'}</h3>
            <p className={styles.modalText}>
              {lang === 'th'
                ? 'ต้องจองล่วงหน้าอย่างน้อย 24 ชม. หากเร่งด่วนกรุณาติดต่อ Asst. Chief Concierge โดยตรง'
                : 'Requests must be made at least 24 hours in advance. For urgent requests, please contact Asst. Chief Concierge directly.'}
            </p>
            <button
              type="button"
              className={styles.modalBtn}
              onClick={() => setShowWarningModal(false)}
            >
              {lang === 'th' ? 'ตกลง' : 'OK'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
