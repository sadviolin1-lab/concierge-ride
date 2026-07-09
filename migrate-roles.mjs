import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc } from "firebase/firestore";

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

async function migrateRoles() {
  try {
    console.log("Fetching users from Firestore...");
    const snap = await getDocs(collection(db, "users"));
    
    let count = 0;
    
    for (const d of snap.docs) {
      const u = d.data();
      let newRole = u.role;
      
      // Karnjanawat becomes master_admin
      if (u.employeeId === '100480' || u.email === '100480@conciergeride.local') {
        newRole = 'master_admin';
      } 
      // HR becomes admin
      else if (u.role === 'hr') {
        newRole = 'admin';
      }
      
      if (newRole !== u.role) {
        console.log(`Updating user ${u.employeeId} (${u.fullName}) from ${u.role} to ${newRole}...`);
        await updateDoc(d.ref, { role: newRole });
        count++;
      }
    }
    
    console.log(`Migration complete. Updated ${count} users.`);
    process.exit(0);
  } catch (error) {
    console.error("Error migrating roles:", error);
    process.exit(1);
  }
}

migrateRoles();
