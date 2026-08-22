import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.DEV ? "demo-federated-healthcare" : import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

// Connect to local Firestore Emulator during development
if (import.meta.env.DEV && !globalThis._firestoreEmulatorConnected) {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  globalThis._firestoreEmulatorConnected = true;
  console.log("PHC Side App: Connected to Firestore Emulator on 127.0.0.1:8080");
} else {
  console.log("PHC Side App: Connected to Firestore project ID:", firebaseConfig.projectId);
}
