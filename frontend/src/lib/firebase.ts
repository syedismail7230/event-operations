import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyClklZ9SfsDYDWe67CnsbdgNKoamAiddok",
  authDomain: "event-booking-a463a.firebaseapp.com",
  projectId: "event-booking-a463a",
  storageBucket: "event-booking-a463a.firebasestorage.app",
  messagingSenderId: "770084222565",
  appId: "1:770084222565:web:fb9fa4ee11f2581d86788c",
  measurementId: "G-GP6N1TCYZE"
};


if (!firebaseConfig.apiKey) {
  console.error("CRITICAL: Firebase configuration missing. App will crash without valid real-time environment variables.");
}

// Initialize Firebase only once
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
