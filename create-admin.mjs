import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA-KN7RmHJg8HwCDCbVvrJIOfsdrsla0iY",
  authDomain: "studio-3387390150-1547b.firebaseapp.com",
  projectId: "studio-3387390150-1547b",
  storageBucket: "studio-3387390150-1547b.firebasestorage.app",
  messagingSenderId: "91888337230",
  appId: "1:91888337230:web:e0c883ac1f040053819e1f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createAdmin() {
  const email = "admin@concierge-ride.local";
  const password = "MasterPassword123!";

  try {
    console.log("Creating user in Firebase Auth...");
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log("User created with UID:", user.uid);

    console.log("Writing admin profile to Firestore...");
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: email,
      phone: "+66000000000",
      fullName: "Master Admin",
      nickname: "Admin",
      employeeId: "ADMIN-001",
      department: "Management",
      role: "admin",
      status: "active",
      photoURL: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    console.log("Admin account created successfully!");
    console.log("Email:", email);
    console.log("Password:", password);
    process.exit(0);
  } catch (error) {
    console.error("Error creating admin account:", error);
    process.exit(1);
  }
}

createAdmin();
