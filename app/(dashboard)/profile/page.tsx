'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { db, storage, auth } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/use-lang';
import ImageCropperModal from '@/components/ImageCropperModal';

const LANG = {
  en: {
    title: 'My Profile',
    subtitle: 'Manage your personal information',
    save: 'Save Changes',
    saving: 'Saving…',
    success: 'Profile updated successfully!',
    error: 'Failed to update profile.',
    fields: {
      fullName: 'Full Name *',
      nickname: 'Nickname',
      department: 'Department *',
      photoURL: 'Profile Picture',
      changePhoto: 'Change Picture',
      uploading: 'Uploading…',
      phone: 'Phone Number *',
      employeeId: 'Employee ID (Read Only)',
    },
    crop: { title: 'Crop Profile Picture', cancel: 'Cancel', apply: 'Apply' },
    logout: 'Log Out',
    pwd: {
      title: 'Change Password',
      old: 'Current Password',
      new: 'New Password (min 6 chars)',
      confirm: 'Confirm New Password',
      update: 'Update Password',
      updating: 'Updating...',
      success: 'Password updated successfully!',
      mismatch: 'Passwords do not match.',
      short: 'Password must be at least 6 characters.',
      error: 'Failed to update password. Please check your current password.',
      reauth: 'For security reasons, please log out and log back in to change your password.',
      showButton: 'Change Password',
      hideButton: 'Cancel Password Change',
    }
  },
  th: {
    title: 'โปรไฟล์ส่วนตัว',
    subtitle: 'จัดการข้อมูลส่วนตัวของคุณ',
    save: 'บันทึกการเปลี่ยนแปลง',
    saving: 'กำลังบันทึก…',
    success: 'อัปเดตโปรไฟล์สำเร็จ!',
    error: 'เกิดข้อผิดพลาดในการอัปเดต',
    fields: {
      fullName: 'ชื่อ-นามสกุล *',
      nickname: 'ชื่อเล่น',
      department: 'แผนก *',
      photoURL: 'รูปโปรไฟล์',
      changePhoto: 'เปลี่ยนรูปภาพ',
      uploading: 'กำลังอัปโหลด…',
      phone: 'เบอร์โทรศัพท์ *',
      employeeId: 'รหัสพนักงาน (แก้ไขไม่ได้)',
    },
    crop: { title: 'ครอปรูปโปรไฟล์', cancel: 'ยกเลิก', apply: 'ตกลง' },
    logout: 'ออกจากระบบ',
    pwd: {
      title: 'เปลี่ยนรหัสผ่าน',
      old: 'รหัสผ่านปัจจุบัน',
      new: 'รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)',
      confirm: 'ยืนยันรหัสผ่านใหม่',
      update: 'อัปเดตรหัสผ่าน',
      updating: 'กำลังอัปเดต...',
      success: 'เปลี่ยนรหัสผ่านสำเร็จ!',
      mismatch: 'รหัสผ่านไม่ตรงกัน',
      short: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
      error: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน กรุณาตรวจสอบรหัสผ่านปัจจุบันของคุณ',
      reauth: 'เพื่อความปลอดภัย กรุณาออกจากระบบและเข้าสู่ระบบใหม่เพื่อเปลี่ยนรหัสผ่าน',
      showButton: 'เปลี่ยนรหัสผ่าน',
      hideButton: 'ยกเลิกการเปลี่ยนรหัสผ่าน',
    }
  }
} as const;

const COUNTRY_CODES = [
  { code: '+66', country: 'Thailand', flag: '🇹🇭' },
  { code: '+1', country: 'USA', flag: '🇺🇸' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
  { code: '+95', country: 'Myanmar', flag: '🇲🇲' },
  { code: '+855', country: 'Cambodia', flag: '🇰🇭' },
  { code: '+856', country: 'Laos', flag: '🇱🇦' },
  { code: '+84', country: 'Vietnam', flag: '🇻🇳' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
];

const DEPARTMENTS = [
  'Accounting', 'Administration', 'Engineering', 'Food & Beverage',
  'Front Office', 'Housekeeping', 'Human Resources', 'IT', 'Management',
  'Marketing', 'Purchasing', 'Sales', 'Security', 'Spa'
];

export default function ProfilePage() {
  const router = useRouter();
  const { userProfile, refreshProfile, signOut } = useAuth();
  const { lang } = useLang();
  const t = LANG[lang];

  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [department, setDepartment] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [countryCode, setCountryCode] = useState('+66');
  const [localPhone, setLocalPhone] = useState('');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  useEffect(() => {
    if (userProfile) {
      setFullName(userProfile.fullName || '');
      setNickname(userProfile.nickname || '');
      setDepartment(userProfile.department || '');
      setPhotoURL(userProfile.photoURL || '');
      
      const fullPhone = userProfile.phone || '';
      let matchedCode = '+66';
      let localNum = fullPhone;
      
      const sortedCodes = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
      for (const c of sortedCodes) {
        if (fullPhone.startsWith(c.code)) {
          matchedCode = c.code;
          localNum = fullPhone.slice(c.code.length);
          break;
        }
      }
      setCountryCode(matchedCode);
      setLocalPhone(localNum);
    }
  }, [userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    const cleanedLocal = localPhone.trim().replace(/^0+/, ''); // Remove leading zeros
    const finalPhone = countryCode + cleanedLocal;

    if (!fullName.trim() || !department.trim() || !localPhone.trim()) {
      setMessage({ text: t.error, type: 'error' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await updateDoc(doc(db, 'users', userProfile.uid), {
        fullName: fullName.trim(),
        nickname: nickname.trim(),
        department: department.trim(),
        phone: finalPhone,
        photoURL: photoURL.trim() || null,
        updatedAt: Date.now(),
      });
      await refreshProfile();
      setMessage({ text: t.success, type: 'success' });
    } catch {
      setMessage({ text: t.error, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !auth.currentUser.email) return;

    if (newPassword.length < 6) {
      setPasswordMessage({ text: t.pwd.short, type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: t.pwd.mismatch, type: 'error' });
      return;
    }

    setPasswordLoading(true);
    setPasswordMessage(null);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, oldPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      setPasswordMessage({ text: t.pwd.success, type: 'success' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordMessage(null);
      }, 3000);
    } catch (error: any) {
      console.error("Password change error", error);
      if (error.code === 'auth/requires-recent-login') {
        setPasswordMessage({ text: t.pwd.reauth, type: 'warning' });
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setPasswordMessage({ text: t.pwd.error, type: 'error' });
      } else {
        setPasswordMessage({ text: t.pwd.error, type: 'error' });
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile) return;

    const src = URL.createObjectURL(file);
    setTempImageSrc(src);
    // Reset input so selecting the same file again works
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setTempImageSrc(null);
    if (!userProfile) return;

    setUploading(true);
    setMessage(null);
    try {
      const storageRef = ref(storage, `profilePictures/${userProfile.uid}-${Date.now()}.jpg`);
      await uploadBytes(storageRef, croppedBlob);
      const downloadURL = await getDownloadURL(storageRef);
      setPhotoURL(downloadURL);
      
      // Auto save the profile with new photo
      await updateDoc(doc(db, 'users', userProfile.uid), {
        photoURL: downloadURL,
        updatedAt: Date.now(),
      });
      await refreshProfile();
      setMessage({ text: t.success, type: 'success' });
    } catch (error) {
      console.error("Profile picture upload failed:", error);
      setMessage({ text: t.error, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  if (!userProfile) return null;

  return (
    <div style={{ maxWidth: 600, animation: 'fadeInUp 0.4s ease both' }}>
      <button onClick={() => router.back()} className="btn-ghost" style={{ alignSelf: 'flex-start', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }} aria-label="Go back">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>{lang === 'en' ? 'Back' : 'ย้อนกลับ'}</span>
      </button>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text-1)' }}>{t.title}</h1>
        <p style={{ color: 'var(--color-text-2)', fontSize: '0.9rem', marginTop: 4 }}>{t.subtitle}</p>
      </div>

      {message && (
        <div 
          style={{ 
            padding: '12px 16px', 
            borderRadius: 8, 
            marginBottom: 20, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            background: message.type === 'success' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            color: message.type === 'success' ? '#86EFAC' : '#FCA5A5',
            border: `1px solid ${message.type === 'success' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
          }}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ background: 'var(--color-surface)', padding: 32, borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {/* Profile Picture Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ 
            position: 'relative', width: 100, height: 100, borderRadius: '50%', 
            background: 'var(--color-bg-2)', border: '3px solid var(--color-surface)', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.1), 0 0 0 1px var(--color-border)',
            overflow: 'hidden', marginBottom: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {photoURL ? (
              <img src={photoURL} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" color="var(--color-text-3)"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            )}
          </div>
          <button 
            type="button" 
            className="btn-ghost" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ fontSize: '0.85rem', padding: '6px 16px', borderRadius: 999 }}
          >
            {uploading ? <><span className="spinner" />{t.fields.uploading}</> : t.fields.changePhoto}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept="image/*" 
            onChange={handleFileChange}
          />
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
            <label className="form-label">{t.fields.fullName}</label>
            <input type="text" className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} required />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
            <label className="form-label">{t.fields.nickname}</label>
            <input type="text" className="form-input" value={nickname} onChange={e => setNickname(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
            <label className="form-label">{t.fields.department}</label>
            <select
              className="form-select"
              value={department}
              onChange={e => setDepartment(e.target.value)}
              required
            >
              <option value="" disabled>{lang === 'th' ? 'เลือกแผนก...' : 'Select department...'}</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
            <label className="form-label" style={{ opacity: 0.6 }}>{t.fields.employeeId}</label>
            <input type="text" className="form-input" value={userProfile.employeeId} disabled style={{ opacity: 0.5 }} />
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '8px 0' }} />

        <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
            <label className="form-label">{t.fields.phone}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div ref={countryDropdownRef} style={{ position: 'relative', width: 140, flexShrink: 0 }}>
                <div 
                  className="form-input" 
                  onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none', padding: '0 12px', height: '42px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.2rem' }}>{COUNTRY_CODES.find(c => c.code === countryCode)?.flag}</span>
                    <span style={{ fontWeight: 500 }}>{countryCode}</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5, transform: isCountryDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
                
                {isCountryDropdownOpen && (
                  <div style={{ 
                    position: 'absolute', 
                    top: '100%', 
                    left: 0, 
                    right: 0, 
                    marginTop: 4, 
                    background: 'var(--color-surface)', 
                    border: '1px solid var(--color-border)', 
                    borderRadius: 8, 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 50,
                    maxHeight: 200,
                    overflowY: 'auto'
                  }}>
                    {COUNTRY_CODES.map(c => (
                      <div 
                        key={c.code}
                        onClick={() => { setCountryCode(c.code); setIsCountryDropdownOpen(false); }}
                        style={{ 
                          padding: '8px 12px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 12, 
                          cursor: 'pointer',
                          background: countryCode === c.code ? 'var(--color-bg-2)' : 'transparent',
                          borderBottom: '1px solid var(--color-border)'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = countryCode === c.code ? 'var(--color-bg-2)' : 'transparent')}
                      >
                        <span style={{ fontSize: '1.4rem' }}>{c.flag}</span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.8rem', opacity: 0.7, lineHeight: 1 }}>{c.country}</span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{c.code}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <input 
                type="tel" 
                className="form-input" 
                value={localPhone} 
                onChange={e => setLocalPhone(e.target.value)} 
                placeholder="812345678"
                required 
                style={{ flex: 1, height: '42px' }}
              />
            </div>
          </div>

        <div style={{ marginTop: 16 }}>
          <button type="submit" className="btn btn-gradient" style={{ width: '100%', padding: '14px', fontSize: '1rem' }} disabled={saving || uploading}>
            {saving ? <><span className="spinner" />{t.saving}</> : t.save}
          </button>
        </div>
      </form>

      {/* Button to toggle password change form */}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
        <button 
          type="button" 
          className="btn btn-outline" 
          style={{ width: '100%', padding: '12px' }}
          onClick={() => {
            setShowPasswordForm(!showPasswordForm);
            setPasswordMessage(null);
          }}
        >
          {showPasswordForm ? t.pwd.hideButton : t.pwd.showButton}
        </button>
      </div>

      {/* Password Change Form */}
      {showPasswordForm && (
        <form onSubmit={handlePasswordChange} style={{ marginTop: 24, background: 'var(--color-surface)', padding: 32, borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--color-text-1)' }}>{t.pwd.title}</h2>
          </div>

          {passwordMessage && (
            <div 
              style={{ 
                padding: '12px 16px', 
                borderRadius: 8, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8,
                background: passwordMessage.type === 'success' ? 'rgba(34, 197, 94, 0.12)' : passwordMessage.type === 'warning' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: passwordMessage.type === 'success' ? '#86EFAC' : passwordMessage.type === 'warning' ? '#FBBF24' : '#FCA5A5',
                border: `1px solid ${passwordMessage.type === 'success' ? 'rgba(34, 197, 94, 0.25)' : passwordMessage.type === 'warning' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
              }}
            >
              {passwordMessage.text}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t.pwd.old}</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showOldPassword ? "text" : "password"} 
                className="form-input" 
                value={oldPassword} 
                onChange={e => setOldPassword(e.target.value)} 
                required 
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-3)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 4
                }}
              >
                {showOldPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label">{t.pwd.new}</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showNewPassword ? "text" : "password"} 
                  className="form-input" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  required 
                  minLength={6}
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-3)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 4
                  }}
                >
                  {showNewPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label">{t.pwd.confirm}</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showConfirmPassword ? "text" : "password"} 
                  className="form-input" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  required 
                  minLength={6}
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-3)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 4
                  }}
                >
                  {showConfirmPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-outline" disabled={passwordLoading}>
              {passwordLoading ? <><span className="spinner" />{t.pwd.updating}</> : t.pwd.update}
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
        <button 
          onClick={handleLogout} 
          style={{ 
            color: '#ef4444', 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: 'none', 
            padding: '10px 24px', 
            borderRadius: '999px',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          {t.logout}
        </button>
      </div>

      {tempImageSrc && (
        <ImageCropperModal
          imageSrc={tempImageSrc}
          onCancel={() => setTempImageSrc(null)}
          onCrop={handleCropComplete}
          langDict={{ cropTitle: t.crop.title, cancel: t.crop.cancel, apply: t.crop.apply }}
        />
      )}
    </div>
  );
}
