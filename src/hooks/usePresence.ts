import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { 
  rtdb, 
  // We don't import this from lib/firebase.ts anymore, 
  // but we ensure it's set up in our firebase.ts file.
} from '../lib/firebase'; 
import { 
  ref, 
  onValue, 
  set, 
  onDisconnect, 
  serverTimestamp, 
  off, 
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

  // ... (Monitoring logic is unchanged, as it's not the problem) ...
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


  // --- The Final Corrected Logic for Setting Presence ---
  useEffect(() => {
    const uid = currentUser?.uid;
    if (!uid || !isVaultUnlocked || uidToMonitor) {
        // If state is not ready, do nothing.
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
    
    // Check connectivity before setting status
    const connectedRef = ref(rtdb, '.info/connected');
    
    const unsubscribe = onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === true) {
        // Connection confirmed! This logic is guaranteed to work if RTDB is configured.
        onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase).then(() => {
          set(userStatusDatabaseRef, isOnlineForDatabase);
        }).catch(err => {
          console.error("RTDB Set Error (Online): Connection established, but WRITE failed.", err);
        });
      } else {
        // Connection failure - ensures we are marked offline locally
        set(userStatusDatabaseRef, isOfflineForDatabase);
        console.warn("RTDB Connection Failure: Could not connect to .info/connected");
      }
    });

    // Cleanup: Clear the listener and explicitly set offline on unmount/logout
    return () => {
      off(connectedRef, 'value', unsubscribe);
      onDisconnect(userStatusDatabaseRef).cancel();
      set(userStatusDatabaseRef, isOfflineForDatabase);
    };
  }, [currentUser, isVaultUnlocked, uidToMonitor]);

  return status;
};
