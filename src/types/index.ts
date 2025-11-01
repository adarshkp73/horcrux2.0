import { Timestamp } from 'firebase/firestore';

// Stored in `users/{userId}`
// This is public-facing user data
// Add this new interface
export interface ChatParticipant {
  uid: string;
  username: string;
}
export interface UserProfile {
  uid: string;
  username: string;
  username_normalized: string; // For search
  email: string;
  kyberPublicKey: string; // Base64 encoded
  createdAt: Timestamp;
  friends: string[]; // array of UIDs
}

// Stored in `keyVaults/{userId}`
// This is private, encrypted data, only readable by the user
export interface KeyVault {
  encryptedPrivateKey: string; // Base64, AES-GCM encrypted
  encryptedSharedSecrets: string; // Base64, AES-GCM encrypted JSON blob
}

// This is the structure of the JSON blob *inside* encryptedSharedSecrets
export type SharedSecretsMap = {
  [chatId: string]: string; // [chatId]: sharedSecret (Base64)
};

export interface ChatWithRecipient {
  chat: Chat;
  recipient: UserProfile;
}

// Stored in `chatRequests/{docId}`
export interface ChatRequest {
  id?: string;
  senderId: string;
  recipientUsername: string;
  status: 'pending' | 'accepted' | 'denied';
  createdAt: Timestamp;
}

// This object is stored in the `chats` doc during KEM
export interface KeyEncapsulationData {
  recipientId: string;
  ciphertext: string; // Base6t4 encoded
}

// Stored in `chats/{chatId}`
export interface Chat {
  id: string; 
  // NEW: We now store participant info for fast sidebar loading
  participants: [ChatParticipant, ChatParticipant];
  // We still keep this simple array for security rules & queries
  users: [string, string]; 
  lastMessage: {
    encryptedText: string;
    timestamp: Timestamp;
  } | null;
  // This field exists only during key exchange
  keyEncapsulationData: KeyEncapsulationData | null;
}

// Stored in `chats/{chatId}/messages/{messageId}`
export interface Message {
  id?: string;
  senderId: string;
  encryptedText: string; // "iv_b64:ciphertext_b64"
  timestamp: Timestamp;
}