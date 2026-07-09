'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/use-lang';
import type { Vehicle, VehicleType } from '@/lib/types';
import { VEHICLE_CONFIGS } from '@/lib/types';
import styles from './vehicles.module.css';

const LANG = {
  en: {
    title: 'Vehicles Management',
    subtitle: 'Add, edit, and manage shuttle vehicles',
    loading: 'Loading vehicles...',
    addBtn: 'Add Vehicle',
    edit: 'Edit',
    delete: 'Delete',
    table: {
      name: 'Name',
      plate: 'License Plate',
      type: 'Type',
      seats: 'Passenger Seats',
      status: 'Status',
      actions: 'Actions',
    },
    modal: {
      addTitle: 'Add New Vehicle',
      editTitle: 'Edit Vehicle',
      name: 'Vehicle Name',
      plate: 'License Plate',
      type: 'Vehicle Type',
      seats: 'Passenger Seats',
      active: 'Is Active',
      cancel: 'Cancel',
      save: 'Save',
    },
    status: {
      active: 'Active',
      inactive: 'Inactive',
    },
    types: {
      carry: 'Carry',
      pickup: 'Pickup',
      van: 'Van',
    }
  },
  th: {
    title: 'จัดการรถรับส่ง',
    subtitle: 'เพิ่ม แก้ไข และจัดการรถรับส่งพนักงาน',
    loading: 'กำลังโหลดข้อมูลรถ...',
    addBtn: 'เพิ่มรถ',
    edit: 'แก้ไข',
    delete: 'ลบ',
    table: {
      name: 'ชื่อรถ',
      plate: 'ป้ายทะเบียน',
      type: 'ประเภท',
      seats: 'ที่นั่งผู้โดยสาร',
      status: 'สถานะ',
      actions: 'จัดการ',
    },
    modal: {
      addTitle: 'เพิ่มรถใหม่',
      editTitle: 'แก้ไขข้อมูลรถ',
      name: 'ชื่อรถ',
      plate: 'ป้ายทะเบียน',
      type: 'ประเภทรถ',
      seats: 'จำนวนที่นั่งผู้โดยสาร',
      active: 'เปิดใช้งาน',
      cancel: 'ยกเลิก',
      save: 'บันทึก',
    },
    status: {
      active: 'ใช้งาน',
      inactive: 'ไม่ใช้งาน',
    },
    types: {
      carry: 'แครี่',
      pickup: 'กระบะ',
      van: 'รถตู้',
    }
  }
} as const;

export default function VehiclesPage() {
  const router = useRouter();
  const { userProfile, isAdmin, isMasterAdmin, isDriver } = useAuth();
  const { lang } = useLang();
  const t = LANG[lang];

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    plate: '',
    type: 'van' as VehicleType,
    passengerSeats: 11,
    isActive: true
  });

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'vehicles'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle));
      setVehicles(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userProfile && (isAdmin || isMasterAdmin || isDriver)) {
      fetchVehicles();
    }
  }, [userProfile, isAdmin, isMasterAdmin, isDriver, fetchVehicles]);

  const openAddModal = () => {
    setEditingId(null);
    setFormData({ name: '', plate: '', type: 'van', passengerSeats: 11, isActive: true });
    setIsModalOpen(true);
  };

  const openEditModal = (v: Vehicle) => {
    setEditingId(v.id);
    setFormData({
      name: v.name,
      plate: v.licensePlate,
      type: v.type,
      passengerSeats: v.passengerSeats,
      isActive: v.isActive
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.plate.trim()) return;
    
    const config = VEHICLE_CONFIGS[formData.type];
    
    try {
      const seats = Number(formData.passengerSeats) || 0;
      if (editingId) {
        await updateDoc(doc(db, 'vehicles', editingId), {
          name: formData.name.trim(),
          licensePlate: formData.plate.trim(),
          type: formData.type,
          isActive: formData.isActive,
          totalSeats: seats,
          passengerSeats: seats,
          description: config.description,
        });
      } else {
        const newId = doc(collection(db, 'vehicles')).id;
        const newVeh: Vehicle = {
          id: newId,
          name: formData.name.trim(),
          licensePlate: formData.plate.trim(),
          type: formData.type,
          isActive: formData.isActive,
          totalSeats: seats,
          passengerSeats: seats,
          description: config.description,
        };
        await setDoc(doc(db, 'vehicles', newId), newVeh);
      }
      setIsModalOpen(false);
      fetchVehicles();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this vehicle?')) {
      try {
        await deleteDoc(doc(db, 'vehicles', id));
        fetchVehicles();
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (!userProfile) return null;
  if (!isAdmin && !isMasterAdmin && !isDriver) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Access Denied</div>;
  }

  return (
    <div className={styles.page}>
      <button onClick={() => router.back()} className={styles.backBtn} aria-label="Go back">
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
        {(isAdmin || isMasterAdmin) && (
          <button className="btn btn-primary" onClick={openAddModal}>
            + {t.addBtn}
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles.loadingWrap}><span className="spinner" /> {t.loading}</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t.table.name}</th>
                <th>{t.table.plate}</th>
                <th>{t.table.type}</th>
                <th>{t.table.seats}</th>
                <th>{t.table.status}</th>
                <th>{t.table.actions}</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map(v => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>{v.name}</td>
                  <td>{v.licensePlate}</td>
                  <td>{t.types[v.type] || v.type}</td>
                  <td>{v.passengerSeats}</td>
                  <td>
                    <span className={`${styles.badge} ${v.isActive ? styles.badgeActive : styles.badgeInactive}`}>
                      {v.isActive ? t.status.active : t.status.inactive}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => openEditModal(v)}>
                        {t.edit}
                      </button>
                      {(isAdmin || isMasterAdmin) && (
                        <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '0.8rem', color: 'var(--color-danger)' }} onClick={() => handleDelete(v.id)}>
                          {t.delete}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className={styles.emptyState}>No vehicles found. Add one to get started.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>{editingId ? t.modal.editTitle : t.modal.addTitle}</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">{t.modal.name}</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  placeholder="e.g. Van 1"
                  disabled={isDriver && !isAdmin && !isMasterAdmin}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">{t.modal.plate}</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.plate} 
                  onChange={e => setFormData({ ...formData, plate: e.target.value })} 
                  placeholder="e.g. 1กข 1234"
                  disabled={isDriver && !isAdmin && !isMasterAdmin}
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t.modal.type}</label>
                <select 
                  className="form-select" 
                  value={formData.type} 
                  onChange={e => setFormData({ ...formData, type: e.target.value as VehicleType })}
                  disabled={isDriver && !isAdmin && !isMasterAdmin}
                >
                  <option value="van">{t.types.van}</option>
                  <option value="pickup">{t.types.pickup}</option>
                  <option value="carry">{t.types.carry}</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t.modal.seats}</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={formData.passengerSeats} 
                  onChange={e => setFormData({ ...formData, passengerSeats: parseInt(e.target.value) || 0 })} 
                  min="1"
                  disabled={isDriver && !isAdmin && !isMasterAdmin}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={formData.isActive} 
                  onChange={e => setFormData({ ...formData, isActive: e.target.checked })} 
                />
                {t.modal.active}
              </label>
            </div>

            <div className={styles.modalActions}>
              <button className="btn-ghost" onClick={() => setIsModalOpen(false)}>
                {t.modal.cancel}
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                {t.modal.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
