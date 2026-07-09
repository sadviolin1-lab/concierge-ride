'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function RootPage() {
  const { firebaseUser, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!firebaseUser) {
      router.replace('/login');
      return;
    }

    if (!userProfile) {
      router.replace('/login');
      return;
    }

    if (userProfile.status === 'pending') {
      router.replace('/pending');
      return;
    }

    if (userProfile.status === 'rejected') {
      router.replace('/rejected');
      return;
    }

    // Redirect all users to the new home dashboard hub
    router.replace('/home');
  }, [loading, firebaseUser, userProfile, router]);

  return (
    <div className="page-loader">
      <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3, color: '#6C63FF' }} />
      <span className="logo-text">Concierge Ride</span>
    </div>
  );
}
