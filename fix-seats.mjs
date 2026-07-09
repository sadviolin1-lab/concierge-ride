import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, ...value] = line.split('=');
  if (key && value) acc[key.trim()] = value.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);

async function fixSeats() {
  await signInWithEmailAndPassword(auth, "admin@concierge-ride.local", "MasterPassword123!");
  console.log('Logged in as admin');

  const vSnap = await getDocs(collection(db, 'vehicles'));
  for (const d of vSnap.docs) {
    const data = d.data();
    if (data.passengerSeats && data.totalSeats !== data.passengerSeats) {
      console.log(`Fixing vehicle ${d.id}: ${data.totalSeats} -> ${data.passengerSeats}`);
      await updateDoc(doc(db, 'vehicles', d.id), { totalSeats: data.passengerSeats });
    }
  }

  const rSnap = await getDocs(collection(db, 'shuttleRides'));
  for (const d of rSnap.docs) {
    const data = d.data();
    if (data.totalSeats === 14) {
      console.log(`Fixing ride ${d.id}: 14 -> 13`);
      await updateDoc(doc(db, 'shuttleRides', d.id), { totalSeats: 13 });
    }
  }
  console.log('Done');
}

fixSeats().catch(console.error).finally(() => process.exit(0));
