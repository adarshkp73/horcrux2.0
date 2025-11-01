import React, { createContext, useState, useEffect } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import * as Crypto from '../lib/crypto';
import { KeyVault, SharedSecretsMap, UserProfile } from '../types';

// This is the "in-memory" vault.
// It only exists while the user is logged in.
// It holds the keys needed for all cryptographic operations.
interface InMemVault {
  masterKey: CryptoKey;
  kyberPrivateKey: string; // Base64
  sharedSecrets: SharedSecretsMap;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;

  isVaultUnlocked: boolean;
  
  // This function is the gateway to all chat E2EE.
  // It gets the key from the in-memory vault.
  getChatKey: (chatId: string) => Promise<CryptoKey | null>;
  
  // This is the KEM Decapsulation flow
  decapAndSaveKey: (chatId: string, ciphertext: string) => Promise<void>;
  
  // This is the KEM Encapsulation flow
  encapAndSaveKey: (chatId: string, recipientPublicKey: string) => Promise<string>; // returns ciphertext

  // Standard auth functions
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // The IN-MEMORY VAULT.
  // This is the most sensitive data in the app.
  // It is wiped on logout.
  const [inMemVault, setInMemVault] = useState<InMemVault | null>(null);

  // Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        setCurrentUser(user);
        // User is logged in, but we still need to "unlock" the vault.
        // We'll fetch the profile, but the vault remains locked
        // until `login()` or `signup()` provides the password.
        const profileDoc = await getDoc(doc(db, 'users', user.uid));
        if (profileDoc.exists()) {
          setUserProfile(profileDoc.data() as UserProfile);
        }
      } else {
        // User logged out. WIPE EVERYTHING.
        setCurrentUser(null);
        setUserProfile(null);
        setInMemVault(null); // Critical: wipe in-memory keys
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  /**
   * SIGN UP: Creates user, derives master key, generates Kyber keys,
   * encrypts/stores vault, and "unlocks" the in-memory vault.
   */
  const signup = async (email: string, password: string, username: string) => {
    setLoading(true);

    // 1. Create Firebase User
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Derive Master Key from password
    const salt = await Crypto.getSaltForUser(user.email!);
    const mk = await Crypto.deriveMasterKey(password, salt);

    // 3. Generate Post-Quantum Key Pair
    const { publicKey, privateKey } = await Crypto.generateKyberKeyPair();

    // 4. Encrypt Private Key with Master Key
    const encryptedPrivateKey = await Crypto.encryptWithAES(mk, privateKey);

    // 5. Encrypt initial (empty) shared secrets map
    const initialSecrets: SharedSecretsMap = {};
    const encryptedSharedSecrets = await Crypto.encryptWithAES(
      mk,
      JSON.stringify(initialSecrets)
    );

    // 6. Create User Profile Doc (public data)
    const profile: UserProfile = {
      uid: user.uid,
      username: username,
      username_normalized: username.toUpperCase(),
      email: user.email!,
      kyberPublicKey: publicKey,
      createdAt: Timestamp.now(),
      friends: [],
    };
    await setDoc(doc(db, 'users', user.uid), profile);

    // 7. Create Key Vault Doc (private, encrypted data)
    const vault: KeyVault = {
      encryptedPrivateKey: encryptedPrivateKey,
      encryptedSharedSecrets: encryptedSharedSecrets,
    };
    await setDoc(doc(db, 'keyVaults', user.uid), vault);

    // 8. Set in-memory state (UNLOCK THE VAULT)
    setCurrentUser(user);
    setUserProfile(profile);
    setInMemVault({
      masterKey: mk,
      kyberPrivateKey: privateKey,
      sharedSecrets: initialSecrets,
    });
    setLoading(false);
  };

  /**
   * LOG IN: Signs in user, derives master key, fetches/decrypts
   * vault, and "unlocks" the in-memory vault.
   */
  const login = async (email: string, password: string) => {
    // 1. Set context loading state
    setLoading(true);

    try {
      // 2. Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 3. Derive Master Key (must be same as signup)
      const salt = await Crypto.getSaltForUser(user.email!);
      const mk = await Crypto.deriveMasterKey(password, salt);

      // 4. Fetch User Profile and Key Vault
      const profileDoc = await getDoc(doc(db, 'users', user.uid));
      const vaultDoc = await getDoc(doc(db, 'keyVaults', user.uid));

      if (!profileDoc.exists() || !vaultDoc.exists()) {
        throw new Error("User data or key vault not found.");
      }

      const profile = profileDoc.data() as UserProfile;
      const vault = vaultDoc.data() as KeyVault;

      // 5. DECRYPT VAULT with Master Key
      let pKey: string;
      let secrets: SharedSecretsMap;
      try {
        pKey = await Crypto.decryptWithAES(mk, vault.encryptedPrivateKey);
        const secretsJson = await Crypto.decryptWithAES(mk, vault.encryptedSharedSecrets);
        secrets = JSON.parse(secretsJson);
      } catch (err) {
        console.error("DECRYPTION FAILED.", err);
        await logout(); // Force logout
        // This custom error will be caught by our new helper
        throw new Error("Invalid password.");
      }

      // 6. Set in-memory state (UNLOCK THE VAULT)
      setCurrentUser(user);
      setUserProfile(profile);
      setInMemVault({
        masterKey: mk,
        kyberPrivateKey: pKey,
        sharedSecrets: secrets,
      });

    } catch (err) {
      // 7. If *anything* fails (login, decryption), re-throw the error
      // so the Login.tsx component can see it and display a message.
      console.error("AuthContext login failed:", err);
      throw err; // Re-throw the original error
    
    } finally {
      // 8. CRITICAL: No matter what happens (success or error),
      // set loading back to false. This prevents the white screen.
      setLoading(false);
    }
  };

  /**
   * LOG OUT: Signs out of Firebase and clears all in-memory keys.
   */
  const logout = async () => {
    await signOut(auth);
    // The onAuthStateChanged listener will handle wiping state.
  };

  // --- E2EE CHAT FUNCTIONS ---

  /**
   * (RECIPIENT) Decapsulates a key, saves it, and updates the vault.
   */
  const decapAndSaveKey = async (chatId: string, ciphertext: string) => {
    if (!inMemVault || !currentUser) throw new Error("Vault locked.");

    // 1. Decapsulate the key
    const sharedSecretB64 = await Crypto.decapSharedSecret(
      inMemVault.kyberPrivateKey,
      ciphertext
    );

    // 2. Add to in-memory vault
    const newSecretsMap = {
      ...inMemVault.sharedSecrets,
      [chatId]: sharedSecretB64,
    };
    
    // 3. Re-encrypt and save the *entire* secrets map to Firestore
    const encryptedSharedSecrets = await Crypto.encryptWithAES(
      inMemVault.masterKey,
      JSON.stringify(newSecretsMap)
    );

    await updateDoc(doc(db, 'keyVaults', currentUser.uid), {
      encryptedSharedSecrets: encryptedSharedSecrets,
    });

    // 4. Update the in-memory state
    setInMemVault((v) => v ? { ...v, sharedSecrets: newSecretsMap } : null);
    console.log(`[AuthContext] Successfully decapsulated and saved key for chat ${chatId}`);
  };

  /**
   * (INITIATOR) Encapsulates a new key, saves it, and returns ciphertext.
   */
  const encapAndSaveKey = async (chatId: string, recipientPublicKey: string): Promise<string> => {
    if (!inMemVault || !currentUser) throw new Error("Vault locked.");

    // 1. Encapsulate the key
    const { sharedSecret, ciphertext } = await Crypto.encapSharedSecret(recipientPublicKey);

    // 2. Add to in-memory vault
    const newSecretsMap = {
      ...inMemVault.sharedSecrets,
      [chatId]: sharedSecret,
    };

    // 3. Re-encrypt and save the *entire* secrets map to Firestore
    const encryptedSharedSecrets = await Crypto.encryptWithAES(
      inMemVault.masterKey,
      JSON.stringify(newSecretsMap)
    );
    await updateDoc(doc(db, 'keyVaults', currentUser.uid), {
      encryptedSharedSecrets: encryptedSharedSecrets,
    });

    // 4. Update in-memory state
    setInMemVault((v) => v ? { ...v, sharedSecrets: newSecretsMap } : null);
    
    console.log(`[AuthContext] Successfully encapsulated and saved key for chat ${chatId}`);

    // 5. Return the ciphertext to be sent to the recipient
    return ciphertext;
  };

  /**
   * Retrieves a usable AES CryptoKey for a specific chat.
   */
  const getChatKey = async (chatId: string): Promise<CryptoKey | null> => {
    if (!inMemVault) return null;

    const secretB64 = inMemVault.sharedSecrets[chatId];
    if (!secretB64) {
      console.warn(`No shared secret found in memory for chat: ${chatId}`);
      return null;
    }
    
    // Import the raw key into a CryptoKey for AES-GCM use
    return Crypto.importSharedSecret(secretB64);
  };


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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};