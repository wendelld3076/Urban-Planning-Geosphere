import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAZ4Bh1AeQia2s4EW5WD-2oCi-TqlG_Awo",
  authDomain: "urban-planning-geosphere.firebaseapp.com",
  projectId: "urban-planning-geosphere",
  storageBucket: "urban-planning-geosphere.firebasestorage.app",
  messagingSenderId: "256752836749",
  appId: "1:256752836749:web:4a5f186a39534178a882c4",
  measurementId: "G-M4L1GTY5FW"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

try {
  enableIndexedDbPersistence(db).catch((err) => {
    console.warn("Firestore offline persistence could not be enabled:", err.code);
  });
} catch (e) {
  console.warn("Firestore offline persistence failed to initialize:", e);
}
export const isFirebaseConfigured = true;

// Optional analytics initialization
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (error) {
  console.warn("Analytics failed to initialize:", error);
}
export { analytics };
