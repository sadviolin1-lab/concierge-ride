'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/use-lang';
import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import styles from './system.module.css';

export default function SystemPage() {
  const { userProfile } = useAuth();
  const router = useRouter();
  const { lang } = useLang();

  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [confirmationWord, setConfirmationWord] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

  // Safeguard: only master_admin can access
  useEffect(() => {
    if (userProfile && userProfile.role !== 'master_admin') {
      router.replace('/home');
    }
  }, [userProfile, router]);

  if (!userProfile || userProfile.role !== 'master_admin') {
    return null; // or loading
  }

  const collections = [
    { id: 'requests', name: lang === 'th' ? 'คำขอทั้งหมด (Requests)' : 'All Requests', desc: lang === 'th' ? 'ลบข้อมูลคำขอรับส่งเอกสาร, พัสดุ, และงานอื่นๆ ทั้งหมด' : 'Delete all delivery and errand requests' },
    { id: 'shuttleRides', name: lang === 'th' ? 'รอบรถรับส่ง (Shuttle Rides)' : 'Shuttle Rides', desc: lang === 'th' ? 'ลบข้อมูลรอบรถรับส่งพนักงานและการจองที่นั่งทั้งหมด' : 'Delete all shuttle schedules and bookings' },
    { id: 'vehicles', name: lang === 'th' ? 'ข้อมูลรถ (Vehicles)' : 'Vehicles', desc: lang === 'th' ? 'ลบข้อมูลรถตู้ รถกระบะ ที่ลงทะเบียนไว้ทั้งหมด' : 'Delete all registered vehicles' },
    { id: 'users', name: lang === 'th' ? 'ผู้ใช้งาน (Users)' : 'Users', desc: lang === 'th' ? 'ลบข้อมูลโปรไฟล์ผู้ใช้งานทั้งหมด (ยกเว้น Master Admin)' : 'Delete all user profiles (Master Admins are skipped)' },
  ];

  const toggleCollection = (id: string) => {
    setSelectedCollections(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleReset = async () => {
    if (confirmationWord !== 'RESET') {
      setMessage({ text: lang === 'th' ? 'พิมพ์ RESET ไม่ถูกต้อง' : 'Invalid confirmation word', type: 'error' });
      return;
    }
    
    if (selectedCollections.length === 0) {
      setMessage({ text: lang === 'th' ? 'กรุณาเลือกอย่างน้อย 1 รายการ' : 'Select at least one collection', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      for (const coll of selectedCollections) {
        if (!['requests', 'shuttleRides', 'vehicles', 'users'].includes(coll)) {
          continue;
        }

        const querySnapshot = await getDocs(collection(db, coll));
        let docsToDelete = querySnapshot.docs;

        if (coll === 'users') {
          // Safeguard: do not delete master_admin
          docsToDelete = querySnapshot.docs.filter(d => d.data().role !== 'master_admin');
        }

        // Batch delete on client side (max 500 per batch)
        for (let i = 0; i < docsToDelete.length; i += 500) {
          const chunk = docsToDelete.slice(i, i + 500);
          const batch = writeBatch(db);
          chunk.forEach(d => {
            batch.delete(doc(db, coll, d.id));
          });
          await batch.commit();
        }
      }

      setMessage({ text: lang === 'th' ? 'ลบข้อมูลสำเร็จ' : 'Database reset successfully!', type: 'success' });
      setSelectedCollections([]);
      setConfirmationWord('');

    } catch (err: any) {
      console.error(err);
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>🚨 System Reset</h1>
        <p className={styles.subtitle}>
          {lang === 'th' 
            ? 'ลบข้อมูลในฐานข้อมูล (ดำเนินการโดย Master Admin เท่านั้น)' 
            : 'Clear database collections (Master Admin only)'}
        </p>
      </div>

      <div className={styles.dangerZone}>
        <h2 className={styles.dangerTitle}>⚠️ Danger Zone</h2>
        <p style={{ marginBottom: 20, fontSize: '0.9rem', color: 'var(--color-text-2)' }}>
          {lang === 'th' 
            ? 'การกระทำนี้ไม่สามารถยกเลิกได้ ข้อมูลที่ถูกลบจะหายไปอย่างถาวร กรุณาตรวจสอบให้แน่ใจก่อนดำเนินการ' 
            : 'This action cannot be undone. Deleted data is permanently removed.'}
        </p>

        <div className={styles.optionsGrid}>
          {collections.map(c => (
            <label key={c.id} className={styles.optionCard}>
              <input 
                type="checkbox" 
                className={styles.checkbox}
                checked={selectedCollections.includes(c.id)}
                onChange={() => toggleCollection(c.id)}
                disabled={loading}
              />
              <div className={styles.optionText}>
                <div className={styles.optionName}>{c.name}</div>
                <div className={styles.optionDesc}>{c.desc}</div>
              </div>
            </label>
          ))}
        </div>

        <div className={styles.confirmationSection}>
          <label className={styles.confirmLabel}>
            {lang === 'th' 
              ? 'พิมพ์คำว่า RESET เพื่อยืนยันการลบข้อมูล' 
              : 'Type RESET to confirm deletion'}
          </label>
          <input 
            type="text" 
            className={styles.confirmInput}
            placeholder="RESET"
            value={confirmationWord}
            onChange={e => setConfirmationWord(e.target.value)}
            disabled={loading}
          />

          <button 
            className={styles.resetBtn}
            onClick={handleReset}
            disabled={loading || confirmationWord !== 'RESET' || selectedCollections.length === 0}
          >
            {loading ? 'Processing...' : (lang === 'th' ? 'ยืนยันการลบข้อมูล' : 'Confirm Delete')}
          </button>
        </div>

        {message && (
          <div className={`${styles.message} ${styles[message.type]}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
