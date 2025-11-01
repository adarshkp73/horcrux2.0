import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { rtdb } from '../lib/firebase';
import { 
  ref, 
  onValue, 
  set, 
  onDisconnect, 
  serverTimestamp, 
  off, 
  get, // <-- New: Used to check connection status
} from 'firebase/database';

interface PresenceStatus {
  state: 'online' | 'offline';
  last_changed: number; // Unix timestamp
}

/**
 * Hook to manage and listen for a specific user's presence status.
 */
export const usePresence = (uidToMonitor?: string) => {
  const { currentUser, isVaultUnlocked } = useAuth();
  const targetUid = uidToMonitor || currentUser?.uid;

  // ... (Monitoring logic is unchanged, as it is simple and reactive) ...
  const [status, setStatus] = useState<PresenceStatus>({
    state: 'offline',
    last_changed: 0,
  });

  useEffect(() => {
    if (!targetUid) return;
    const statusRef = ref(rtdb, 'status/' + targetUid);
    const handleStatusChange = (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        setStatus({
          state: data.state,
          last_changed: data.last_changed || Date.now(),
        });
      } else {
        setStatus({
          state: 'offline',
          last_changed: 0,
        });
      }
    };
    onValue(statusRef, handleStatusChange);
    return () => off(statusRef, 'value', handleStatusChange);
  }, [targetUid]);


  // --- FIX: Logic for the CURRENT USER (Setting Presence) ---
  useEffect(() => {
    const uid = currentUser?.uid;
    // Condition 1: Must be logged in AND have an unlocked vault
    // Condition 2: Must NOT be monitoring another UID (i.e., we are setting our OWN status)
    if (!uid || !isVaultUnlocked || uidToMonitor) {
        // If state is not ready, do nothing. Do NOT explicitly set offline here.
        return;
    }

    const userStatusDatabaseRef = ref(rtdb, 'status/' + uid);
    const isOnlineForDatabase = {
      state: 'online',
      last_changed: serverTimestamp(),
    };
    const isOfflineForDatabase = {
      state: 'offline',
      last_changed: serverTimestamp(),
    };
    
    // 1. Check connectivity before setting status
    const connectedRef = ref(rtdb, '.info/connected');
    
    const unsubscribe = onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === true) {
        // 2. Set onDisconnect handler only if connected
        onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase).then(() => {
          // 3. Set status to online
          set(userStatusDatabaseRef, isOnlineForDatabase);
        }).catch(err => {
          console.error("RTDB Set Error (Online):", err);
        });
      }
    });

    // 4. Cleanup: Clear the listener and explicitly set offline on unmount/logout
    return () => {
      off(connectedRef, 'value', unsubscribe);
      onDisconnect(userStatusDatabaseRef).cancel();
      // Set status to offline explicitly
      set(userStatusDatabaseRef, isOfflineForDatabase);
    };
  }, [currentUser, isVaultUnlocked, uidToMonitor]);

  return status;
};
