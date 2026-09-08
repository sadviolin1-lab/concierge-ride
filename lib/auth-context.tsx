'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  EmailAuthProvider,
  updateEmail,
  updatePassword,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from './firebase';
import type { UserProfile, UserRole, EmploymentType } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isMasterAdmin: boolean;
  isAdmin: boolean;
  isDriver: boolean;
  isHR: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithEmployeeId: (employeeId: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  impersonatedRole: UserRole | null;
  setImpersonatedRole: (role: UserRole | null) => void;
  isActualMasterAdmin: boolean;
}

export interface PhoneRegisterData {
  phone: string;          // E.164 format (+66...)
  password: string;
  fullName: string;
  nickname: string;
  employeeId: string;
  department: string;
  photoFile: File | null;
  purpose: 'shuttle' | 'request' | 'both' | 'driver';
  employmentType?: EmploymentType;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonatedRole, setImpersonatedRoleState] = useState<UserRole | null>(null);

  // Load from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('cr_impersonated_role');
    if (saved) {
      setImpersonatedRoleState(saved as UserRole);
    }
  }, []);

  const setImpersonatedRole = (role: UserRole | null) => {
    setImpersonatedRoleState(role);
    if (role) {
      sessionStorage.setItem('cr_impersonated_role', role);
    } else {
      sessionStorage.removeItem('cr_impersonated_role');
    }
  };

  const fetchProfile = useCallback(async (uid: string): Promise<UserProfile | null> => {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as UserProfile;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!firebaseUser) return;
    const profile = await fetchProfile(firebaseUser.uid);
    setUserProfile(profile);
  }, [firebaseUser, fetchProfile]);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;
    let fallbackTimer: NodeJS.Timeout | null = setTimeout(() => {
      setLoading(false);
    }, 2000);

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      setLoading(true);
      try {
        if (user) {
          setFirebaseUser(user);
          
          if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
          }

          const profileFallback = setTimeout(() => {
            setLoading(false);
          }, 2500);

          unsubscribeSnapshot = onSnapshot(doc(db, 'users', user.uid), async (snap) => {
            clearTimeout(profileFallback);
            if (snap.exists()) {
              let profile = snap.data() as UserProfile;
              
              // Auto-unsuspend if time has expired
              if (profile && profile.status === 'suspended' && profile.suspendedUntil) {
                const now = Date.now();
                if (now >= profile.suspendedUntil) {
                  await updateDoc(doc(db, 'users', user.uid), {
                    status: 'active',
                    suspendedUntil: null
                  });
                  profile = { ...profile, status: 'active', suspendedUntil: undefined };
                }
              }
              
              setUserProfile(profile);
            } else {
              setUserProfile(null);
              firebaseSignOut(auth).catch(() => {});
            }
            setLoading(false);
          }, (error) => {
            clearTimeout(profileFallback);
            console.error('Error in profile snapshot:', error);
            setLoading(false);
          });

        } else {
          setFirebaseUser(null);
          setUserProfile(null);
          if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
            unsubscribeSnapshot = null;
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching auth state or profile:', error);
        setFirebaseUser(user);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithEmployeeId = async (employeeId: string, password: string) => {
    const trimmedId = employeeId.trim();
    if (!trimmedId) {
      throw new Error('Please enter your Employee ID.');
    }

    const safeId = trimmedId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const generatedEmail = `${safeId}@conciergeride.local`;

    await signInWithEmailAndPassword(auth, generatedEmail, password);
  };

  const signOut = async () => {
    sessionStorage.removeItem('cr_impersonated_role');
    setImpersonatedRoleState(null);
    await firebaseSignOut(auth);
    setUserProfile(null);
  };

  const isActualMasterAdmin = userProfile?.role === 'master_admin';
  
  // Impersonated active role overrides
  const activeRole = (isActualMasterAdmin && impersonatedRole) ? impersonatedRole : userProfile?.role;
  const isMasterAdmin = activeRole === 'master_admin';
  const isAdmin = activeRole === 'admin' || activeRole === 'master_admin';
  const isDriver = activeRole === 'driver';
  const isHR = activeRole === 'hr';

  const effectiveUserProfile = userProfile ? {
    ...userProfile,
    role: activeRole ?? userProfile.role
  } : null;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile: effectiveUserProfile,
        loading,
        isMasterAdmin,
        isAdmin,
        isDriver,
        isHR,
        signIn,
        signInWithEmployeeId,
        signOut,
        refreshProfile,
        impersonatedRole,
        setImpersonatedRole,
        isActualMasterAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

// ── Phone OTP helpers (used directly in register page) ───────────────────────

/** Format a Thai phone number to E.164 (+66...) */
export function formatThaiPhone(raw: string): string {
  if (!raw || !raw.trim()) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    return '+66' + digits.slice(1);
  }
  if (digits.startsWith('66') && digits.length === 11) {
    return '+' + digits;
  }
  if (digits.startsWith('+')) return raw.replace(/[^\d+]/g, '');
  return '+66' + digits;
}

/** Create or recreate the invisible reCAPTCHA verifier */
export function createRecaptchaVerifier(containerId: string): RecaptchaVerifier {
  const element = document.getElementById(containerId);
  if (!element) {
    throw new Error(`reCAPTCHA container "${containerId}" not found.`);
  }

  // Clean up old instance if present
  const existing = (window as any).__crRecaptcha as RecaptchaVerifier | undefined;
  if (existing) {
    try { 
      existing.clear(); 
      (window as any).__crRecaptcha = undefined;
    } catch {}
  }
  
  const verifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  (window as any).__crRecaptcha = verifier;
  return verifier;
}

/** Send OTP to a phone number — returns ConfirmationResult */
export async function sendOtp(
  phone: string,
  containerId: string
): Promise<ConfirmationResult> {
  const verifier = createRecaptchaVerifier(containerId);
  return signInWithPhoneNumber(auth, phone, verifier);
}

/**
 * Direct registration without OTP.
 * Creates an email/password account directly.
 */
export async function completeDirectRegistration(
  data: PhoneRegisterData
): Promise<void> {
  // Generate a deterministic system email (never shown to user)
  const safeId = data.employeeId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const generatedEmail = `${safeId}@conciergeride.local`;

  // Create Firebase Auth user
  const userCredential = await createUserWithEmailAndPassword(auth, generatedEmail, data.password);
  const user = userCredential.user;
  const uid = user.uid;

  // Update Firebase display name
  await updateProfile(user, { displayName: data.fullName });

  // Upload profile photo if provided
  let photoURL: string | null = null;
  if (data.photoFile) {
    try {
      const storageRef = ref(storage, `profilePictures/${uid}-${Date.now()}.jpg`);
      await uploadBytes(storageRef, data.photoFile);
      photoURL = await getDownloadURL(storageRef);
      await updateProfile(user, { photoURL });
    } catch (photoErr) {
      console.warn('Failed to upload profile photo:', photoErr);
    }
  }

  // Save user profile to Firestore
  const now = Date.now();
  const profile: UserProfile = {
    uid,
    email: generatedEmail,   // stored for signInWithEmployeeId lookup
    phone: data.phone,
    fullName: data.fullName,
    nickname: data.nickname,
    employeeId: data.employeeId,
    department: data.department,
    role: data.employeeId === '100480' ? 'admin' : (data.purpose === 'driver' ? 'driver' : 'staff'),
    status: data.employeeId === '100480' ? 'active' : 'pending',
    photoURL,
    purpose: data.purpose,
    employmentType: data.employmentType || 'employee',
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, 'users', uid), profile);
}

/**
 * Complete registration after OTP is confirmed.
 */
export async function completePhoneRegistration(
  confirmationResult: ConfirmationResult,
  otp: string,
  data: PhoneRegisterData
): Promise<void> {
  const userCredential = await confirmationResult.confirm(otp);
  const user = userCredential.user;
  const uid = user.uid;

  const safeId = data.employeeId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const generatedEmail = `${safeId}@conciergeride.local`;

  await updateEmail(user, generatedEmail);
  await updatePassword(user, data.password);
  await updateProfile(user, { displayName: data.fullName });

  let photoURL: string | null = null;
  if (data.photoFile) {
    try {
      const storageRef = ref(storage, `profilePictures/${uid}-${Date.now()}.jpg`);
      await uploadBytes(storageRef, data.photoFile);
      photoURL = await getDownloadURL(storageRef);
      await updateProfile(user, { photoURL });
    } catch (photoErr) {
      console.warn('Failed to upload profile photo:', photoErr);
    }
  }

  const now = Date.now();
  const profile: UserProfile = {
    uid,
    email: generatedEmail,
    phone: data.phone,
    fullName: data.fullName,
    nickname: data.nickname,
    employeeId: data.employeeId,
    department: data.department,
    role: data.employeeId === '100480' ? 'admin' : (data.purpose === 'driver' ? 'driver' : 'staff'),
    status: data.employeeId === '100480' ? 'active' : 'pending',
    photoURL,
    purpose: data.purpose,
    employmentType: data.employmentType || 'employee',
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, 'users', uid), profile);
}

// ── Firestore helpers ─────────────────────────────────────────────────────────

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>) {
  await updateDoc(doc(db, 'users', uid), {
    ...updates,
    updatedAt: Date.now(),
  });
}
