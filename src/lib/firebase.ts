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
  
  // --- THIS IS THE FIX ---
  // We explicitly pass the database URL to initializeApp
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL 
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// Use getDatabase() without arguments if the URL is passed to initializeApp
const rtdb = getDatabase(app); 

// CRITICAL LOCAL EMULATOR CONFIGURATION (remains the same)
if (process.env.NODE_ENV === 'development') {
    connectDatabaseEmulator(rtdb, 'localhost', 9000); 
    console.log("RTDB connected to local emulator on port 9000.");
}

export { auth, db, functions, rtdb };
