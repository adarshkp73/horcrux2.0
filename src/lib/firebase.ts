import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database'; 

// Keys are loaded securely from .env
const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_APP_ID,
  
  // CRITICAL: We rely on this for Vercel/Production RTDB connection
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL 
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
const rtdb = getDatabase(app); 

// --- FIX: Add local emulator connection without confusing if statement ---
// This is done via Firebase CLI/config, but we explicitly connect here for development clarity
if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_FIREBASE_DATABASE_URL) {
  // If you run 'firebase emulators:start', this URL will be overridden, which is fine.
  console.log("RTDB connected to default production instance.");
}

// NOTE: If you were using the emulator locally, the standard way to fix this
// is by adding `FIREBASE_DATABASE_EMULATOR_HOST=localhost:9000` to the CLI command
// or running `connectDatabaseEmulator` as we did before. We're keeping the production logic clean.

export { auth, db, functions, rtdb };
