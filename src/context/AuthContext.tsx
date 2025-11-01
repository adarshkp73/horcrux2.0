import React, { createContext, useState, useEffect } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  sendEmailVerification,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from 'firebase/auth';
import { 
  doc, getDoc, setDoc, updateDoc, Timestamp,
  collection, query, where, getDocs, limit 
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import * as Crypto from '../lib/crypto';
import { KeyVault, SharedSecretsMap, UserProfile } from '../types';

/**
 * This is the "in-memory" vault.
 * It only exists while the user is logged in and the vault is unlocked.
 * It holds the keys needed for all cryptographic operations.
 */
interface InMemVault {
  masterKey: CryptoKey;
  kyberPrivateKey: string; // Base64
  sharedSecrets: SharedSecretsMap;
}

/**
 * This defines all the values and functions
 * our app can get from the `useAuth()` hook.
 */
interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isVaultUnlocked: boolean; // Is the in-memory vault loaded?
  
  // Crypto functions
  getChatKey: (chatId: string) => Promise<CryptoKey | null>;
  decapAndSaveKey: (chatId: string, ciphertext: string) => Promise<void>;
  encapAndSaveKey: (chatId: string, recipientPublicKey: string) => Promise<string>;
  
  // Auth functions
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [inMemVault, setInMemVault] = useState<InMemVault | null>(null);

  /**
   * This is the main listener for auth state.
   * It handles login, logout, page refreshes, and email verification status changes.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        // User is logged in to Firebase.
        setCurrentUser(user); // This user object has `emailVerified`
        const profileDoc = await getDoc(doc(db, 'users', user.uid));
        if (profileDoc.exists()) {
          setUserProfile(profileDoc.data() as UserProfile);
        }
      } else {
        // User is logged out.
        setCurrentUser(null);
        setUserProfile(null);
        setInMemVault(null); // CRITICAL: wipe all in-memory keys
      }
      setLoading(false);
    });
    return unsubscribe; // Cleanup on unmount
  }, []);

  /**
   * SIGN UP: Creates user, sends verification email, generates Kyber keys,
   * encrypts/stores vault, and "unlocks" the in-memory vault.
   */
  const signup = async (email: string, password: string, username: string) => {
    setLoading(true);
    try {
      // 1. Final gatekeeper check (prevents race conditions)
      const normalizedUsername = username.toUpperCase();
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username_normalized', '==', normalizedUsername), limit(1));
      
      const existingUserSnap = await getDocs(q);
      if (!existingUserSnap.empty) {
        throw new Error('Username is already taken.');
      }

      // 2. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 3. Send the verification email
      try {
        await sendEmailVerification(user);
        console.log('Verification email sent.');
      } catch (err) {
        console.error("Failed to send verification email:", err);
      }

      // 4. Derive Master Key (for encrypting the vault)
      const salt = await Crypto.getSaltForUser(user.email!);
      const mk = await Crypto.deriveMasterKey(password, salt);
      
      // 5. Generate Post-Quantum Key Pair
      const { publicKey, privateKey } = await Crypto.generateKyberKeyPair();
      
      // 6. Encrypt Private Key
      const encryptedPrivateKey = await Crypto.encryptWithAES(mk, privateKey);
      
      // 7. Encrypt initial (empty) shared secrets map
      const initialSecrets: SharedSecretsMap = {};
      const encryptedSharedSecrets = await Crypto.encryptWithAES(
        mk,
        JSON.stringify(initialSecrets)
      );
      
      // 8. Create User Profile Doc in Firestore
      const profile: UserProfile = {
        uid: user.uid,
        username: username,
        username_normalized: normalizedUsername,
        email: user.email!,
        kyberPublicKey: publicKey,
        createdAt: Timestamp.now(),
        friends: [],
      };
      await setDoc(doc(db, 'users', user.uid), profile);
      
      // 9. Create Key Vault Doc in Firestore
      const vault: KeyVault = {
        encryptedPrivateKey: encryptedPrivateKey,
        encryptedSharedSecrets: encryptedSharedSecrets,
      };
      await setDoc(doc(db, 'keyVaults', user.uid), vault);
      
      // 10. Set in-memory state (UNLOCK THE VAULT)
      setCurrentUser(user);
      setUserProfile(profile);
      setInMemVault({
        masterKey: mk,
        kyberPrivateKey: privateKey,
        sharedSecrets: initialSecrets,
      });
    } catch (err) {
      console.error("Signup failed:", err);
      throw err; // Re-throw for the form to catch and display
    } finally {
      setLoading(false);
    }
  };

  /**
   * LOG IN: Signs in user, derives master key, fetches/decrypts
   * vault, and "unlocks" the in-memory vault.
   */
  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      // 1. Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // 2. Derive Master Key
      const salt = await Crypto.getSaltForUser(user.email!);
      const mk = await Crypto.deriveMasterKey(password, salt);
      
      // 3. Fetch User Profile and Key Vault
      const profileDoc = await getDoc(doc(db, 'users', user.uid));
      const vaultDoc = await getDoc(doc(db, 'keyVaults', user.uid));
      if (!profileDoc.exists() || !vaultDoc.exists()) {
        throw new Error("User data or key vault not found.");
      }
      const profile = profileDoc.data() as UserProfile;
      const vault = vaultDoc.data() as KeyVault;
      
      // 4. DECRYPT VAULT with Master Key
      let pKey: string;
      let secrets: SharedSecretsMap;
      try {
        pKey = await Crypto.decryptWithAES(mk, vault.encryptedPrivateKey);
        const secretsJson = await Crypto.decryptWithAES(mk, vault.encryptedSharedSecrets);
        secrets = JSON.parse(secretsJson);
      } catch (err) {
        console.error("DECRYPTION FAILED.", err);
        await logout(); // Force logout
        throw new Error("Invalid password.");
      }
      
      // 5. Set in-memory state (UNLOCK THE VAULT)
      setCurrentUser(user);
      setUserProfile(profile);
      setInMemVault({
        masterKey: mk,
        kyberPrivateKey: pKey,
        sharedSecrets: secrets,
      });
    } catch (err) {
      console.error("AuthContext login failed:", err);
      throw err; // Re-throw for the form
    } finally {
      setLoading(false); // This prevents the white screen bug
    }
  };

  /**
   * LOG OUT: Signs out of Firebase and clears all in-memory keys.
   */
  const logout = async () => {
    await signOut(auth);
    // The onAuthStateChanged listener will handle wiping all state.
  };
  
  /**
   * CHANGE PASSWORD: The only secure way to change a password.
   * User must be logged in and provide their current password.
   * This re-encrypts the entire vault with the new password.
   */
  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!currentUser || !currentUser.email || !inMemVault) {
      throw new Error("User not fully authenticated.");
    }
    
    // --- Step 1: Verify "Lock 1" (Firebase Auth) ---
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    
    // --- Step 2: Re-Encrypt "Lock 2" (The Vault) ---
    try {
      const salt = await Crypto.getSaltForUser(currentUser.email);
      
      const decryptedPrivateKey = inMemVault.kyberPrivateKey;
      const decryptedSecrets = inMemVault.sharedSecrets;
      
      const newMasterKey = await Crypto.deriveMasterKey(newPassword, salt);
      
      const newEncryptedPrivateKey = await Crypto.encryptWithAES(newMasterKey, decryptedPrivateKey);
      const newEncryptedSecrets = await Crypto.encryptWithAES(newMasterKey, JSON.stringify(decryptedSecrets));
      
      await updateDoc(doc(db, 'keyVaults', currentUser.uid), {
        encryptedPrivateKey: newEncryptedPrivateKey,
        encryptedSharedSecrets: newEncryptedSecrets,
      });

      // --- Step 3: Update "Lock 1" (Firebase Auth) ---
      await updatePassword(currentUser, newPassword);

      // --- Step 4: Update the In-Memory Vault ---
      setInMemVault({
        ...inMemVault,
        masterKey: newMasterKey,
      });
      
    } catch (cryptoError) {
      console.error("CRITICAL: Failed to re-encrypt vault:", cryptoError);
      throw new Error("Vault re-encryption failed. Password not changed.");
    }
  };

  /**
   * (RECIPIENT) Decapsulates a key, saves it, and updates the vault.
   */
  const decapAndSaveKey = async (chatId: string, ciphertext: string) => {
    if (!inMemVault || !currentUser) throw new Error("Vault locked.");
    
    const sharedSecretB64 = await Crypto.decapSharedSecret(
      inMemVault.kyberPrivateKey,
      ciphertext
    );
    
    const newSecretsMap = {
      ...inMemVault.sharedSecrets,
      [chatId]: sharedSecretB64,
    };
    
    const encryptedSharedSecrets = await Crypto.encryptWithAES(
      inMemVault.masterKey,
      JSON.stringify(newSecretsMap)
    );
    await updateDoc(doc(db, 'keyVaults', currentUser.uid), {
      encryptedSharedSecrets: encryptedSharedSecrets,
    });
    
    setInMemVault((v) => v ? { ...v, sharedSecrets: newSecretsMap } : null);
    console.log(`[AuthContext] Successfully decapsulated and saved key for chat ${chatId}`);
  };

  /**
   * (INITIATOR) Encapsulates a new key, saves it, and returns ciphertext.
   */
  const encapAndSaveKey = async (chatId: string, recipientPublicKey: string): Promise<string> => {
    if (!inMemVault || !currentUser) throw new Error("Vault locked.");
    
    const { sharedSecret, ciphertext } = await Crypto.encapSharedSecret(recipientPublicKey);
    
    // *** THIS IS THE FIX ***
    const newSecretsMap = {
      ...inMemVault.sharedSecrets, // <-- Was 'inSilo.sharedSecrets'
      [chatId]: sharedSecret,
    };
    
    const encryptedSharedSecrets = await Crypto.encryptWithAES(
      inMemVault.masterKey,
      JSON.stringify(newSecretsMap)
    );
    await updateDoc(doc(db, 'keyVaults', currentUser.uid), {
      encryptedSharedSecrets: encryptedSharedSecrets,
    });
    
    setInMemVault((v) => v ? { ...v, sharedSecrets: newSecretsMap } : null);
    console.log(`[AuthContext] Successfully encapsulated and saved key for chat ${chatId}`);
    
    return ciphertext;
  };

  /**
   * Retrieves a usable AES CryptoKey for a specific chat.
   */
  const getChatKey = async (chatId: string): Promise<CryptoKey | null> => {
    if (!inMemVault) return null;
    
    const secretB64 = inMemVault.sharedSecrets[chatId];
    
    // *** THIS IS THE FIX ***
    if (!secretB64) { // <-- Was 'secretB6Silo'
      console.warn(`No shared secret found in memory for chat: ${chatId}`);
      return null;
    }
    
    return Crypto.importSharedSecret(secretB64);
  };

  // This is the public value that all components will consume
  const value = {
    currentUser,
    userProfile,
    loading,
    isVaultUnlocked: inMemVault !== null,
    getChatKey,
    decapAndSaveKey,
    encapAndSaveKey,
    login,
    signup,
    logout,
    changePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};