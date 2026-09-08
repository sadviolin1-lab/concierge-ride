import { NextRequest, NextResponse } from 'next/server';
import { getApps } from 'firebase-admin/app';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    if (!getApps().length) {
      return NextResponse.json({ error: 'Firebase Admin is not configured on server' }, { status: 503 });
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'Invalid token' }, { status: 401 });
    }

    const callerUid = decodedToken.uid;

    // Check caller's role in Firestore
    const callerDoc = await adminDb.collection('users').doc(callerUid).get();
    if (!callerDoc.exists) {
      return NextResponse.json({ error: 'Caller not found' }, { status: 404 });
    }

    const callerData = callerDoc.data();
    const callerRole = callerData?.role;

    if (callerRole !== 'admin' && callerRole !== 'master_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body = await req.json();
    const { targetUid, newPassword } = body;

    if (!targetUid || !newPassword) {
      return NextResponse.json({ error: 'Missing targetUid or newPassword' }, { status: 400 });
    }

    // Verify target user is not master admin, unless caller is master admin
    const targetDoc = await adminDb.collection('users').doc(targetUid).get();
    if (targetDoc.exists) {
      const targetData = targetDoc.data();
      if (targetData?.role === 'master_admin' && callerRole !== 'master_admin') {
         return NextResponse.json({ error: 'Cannot reset password for Master Admin' }, { status: 403 });
      }
    }

    // Update password
    await adminAuth.updateUser(targetUid, {
      password: newPassword,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error resetting password:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
