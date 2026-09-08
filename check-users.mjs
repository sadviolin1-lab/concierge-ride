import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA-KN7RmHJg8HwCDCbVvrJIOfsdrsla0iY",
  authDomain: "studio-3387390150-1547b.firebaseapp.com",
  projectId: "studio-3387390150-1547b",
  storageBucket: "studio-3387390150-1547b.firebasestorage.app",
  messagingSenderId: "91888337230",
  appId: "1:91888337230:web:e0c883ac1f040053819e1f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkUsers() {
  try {
    const snap = await getDocs(collection(db, "users"));
    console.log("--- Firebase Users ---");
    snap.docs.forEach(d => {
      const u = d.data();
      console.log(`${u.email} | ${u.fullName} | Role: ${u.role} | Status: ${u.status}`);
    });
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

checkUsers();
