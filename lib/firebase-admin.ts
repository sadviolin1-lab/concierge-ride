import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  try {
    if (process.env.FIREBASE_PRIVATE_KEY) {
      initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // Handle escaped newlines in the private key
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      console.warn('Firebase private key is missing. Firebase Admin will not be initialized.');
    }
  } catch (error: any) {
    console.error('Firebase admin initialization error', error.stack);
  }
}

export const adminAuth = new Proxy({} as any, {
  get(target, prop) {
    const auth = getAuth();
    const val = (auth as any)[prop];
    return typeof val === 'function' ? val.bind(auth) : val;
  }
});

export const adminDb = new Proxy({} as any, {
  get(target, prop) {
    const db = getFirestore();
    const val = (db as any)[prop];
    return typeof val === 'function' ? val.bind(db) : val;
  }
});
