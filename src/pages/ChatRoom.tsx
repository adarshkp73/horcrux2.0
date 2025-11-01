import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Chat, Message } from '../types';
import {
  doc,
  onSnapshot,
  collection,
  addDoc,
  Timestamp,
  updateDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as Crypto from '../lib/crypto'; // Make sure this path is correct (e.g., ../lib/crypto)
import { ChatInput } from '../components/chat/ChatInput';
import { ChatMessage } from '../components/chat/ChatMessage';
import { LoadingSpinner } from '../components/core/LoadingSpinner';

const ChatRoom: React.FC = () => {
  const { id: chatId } = useParams<{ id: string }>();
  const { currentUser, getChatKey, decapAndSaveKey } = useAuth();
  
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [decryptedMessages, setDecryptedMessages] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const messageListRef = useRef<HTMLDivElement>(null);

  // --- EFFECT 1: Listen to the Chat Document ---
  // ... (This effect is unchanged)
  useEffect(() => {
    if (!chatId || !currentUser) return;

    setLoading(true);
    const unsubChat = onSnapshot(doc(db, 'chats', chatId), async (doc) => {
      if (!doc.exists()) {
        console.error("Chat does not exist");
        setLoading(false);
        return;
      }
      
      const chatData = { id: doc.id, ...doc.data() } as Chat;
      setChat(chatData);

      const kemData = chatData.keyEncapsulationData;
      if (kemData && kemData.recipientId === currentUser.uid) {
        console.log("KEM data found for me. Decapsulating...");
        try {
          await decapAndSaveKey(chatId, kemData.ciphertext);
          await updateDoc(doc.ref, { keyEncapsulationData: null });
          console.log("KEM complete. Removed KEM data from chat doc.");
        } catch (err) {
          console.error("Failed to decapsulate key:", err);
        }
      }
      setLoading(false);
    });

    return () => unsubChat();
  }, [chatId, currentUser, decapAndSaveKey]);

  // --- EFFECT 2: Listen to Messages (WITH SORTING) ---
  // ... (This effect is unchanged)
  useEffect(() => {
    if (!chatId) return;

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc')); 

    const unsubMessages = onSnapshot(
      q, 
      (snapshot) => {
        const msgs: Message[] = [];
        snapshot.forEach(doc => {
          msgs.push({ id: doc.id, ...doc.data() } as Message);
        });
        setMessages(msgs);
      }
    );

    return () => unsubMessages();
  }, [chatId]);

  // --- EFFECT 3: Decrypt Messages (THIS IS THE FIX) ---
  useEffect(() => {
    if (messages.length === 0) return;

    const decryptAll = async () => {
      const key = await getChatKey(chatId!);
      
      if (!key) {
        // Key is not ready. Clear any old decryptions and wait.
        console.log("Waiting for chat key... Clearing previous decryptions.");
        setDecryptedMessages(new Map()); 
        return;
      }

      // Key is available, proceed.
      const newDecrypted = new Map(decryptedMessages);
      let needsUpdate = false;

      for (const msg of messages) {
        
        // === THIS IS THE CORRECTED LOGIC ===
        // We must ONLY try to decrypt if:
        // 1. The message has a valid ID.
        // 2. We have not already decrypted it.
        if (msg.id && !newDecrypted.has(msg.id)) { 
          try {
            const plaintext = await Crypto.decryptWithAES(key, msg.encryptedText);
            newDecrypted.set(msg.id, plaintext); // This line is now safe
            needsUpdate = true;
          } catch (err) {
            console.warn("Failed to decrypt message (key was present):", msg.id, err);
            newDecrypted.set(msg.id, "[DECRYPTION FAILED]");
            needsUpdate = true;
          }
        }
        // If msg.id is undefined, or we already have it in the map, we do nothing.
        // === END OF CORRECTED LOGIC ===
      }

      if (needsUpdate) {
        setDecryptedMessages(newDecrypted);
      }
    };

    decryptAll();
    
  }, [messages, chatId, getChatKey, decryptedMessages]); // Dependencies are correct

  // --- EFFECT 4: Auto-scroll to bottom ---
  // ... (This effect is unchanged)
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [decryptedMessages]); 

  
  // --- SEND MESSAGE (Encryption Flow) ---
  // ... (This function is unchanged)
  const handleSendMessage = async (text: string) => {
    if (!chatId || !currentUser) return;

    const key = await getChatKey(chatId);
    if (!key) {
      alert("Error: Chat key is not available. Cannot send message.");
      return;
    }

    const encryptedText = await Crypto.encryptWithAES(key, text);

    const newMessage = {
      senderId: currentUser.uid,
      encryptedText: encryptedText,
      timestamp: Timestamp.now(), 
    };

    await addDoc(collection(db, 'chats', chatId, 'messages'), newMessage);
    
    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage: {
        encryptedText: encryptedText,
        timestamp: newMessage.timestamp,
      }
    });
  };

  // ... (Rest of the JSX is unchanged) ...
  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>;
  }

  if (!chat) {
    return <div className="flex-1 flex items-center justify-center">Chat not found.</div>;
  }

  // Add optional chaining `?.` as a defensive measure
  const recipient = chat.participants?.find(p => p.uid !== currentUser!.uid);

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="p-4 border-b border-grey-dark">
        <h2 className="text-xl font-bold">
          Chat with {recipient ? recipient.username : '...'}
        </h2>
      </div>

      <div 
        ref={messageListRef} 
        className="flex-1 p-4 space-y-4 overflow-y-auto"
      >
        {messages.map((msg) => {
          // This ensures that if msg.id was undefined, it's just skipped.
          const plaintext = msg.id ? decryptedMessages.get(msg.id) || "..." : "...";
          return (
            <ChatMessage
              key={msg.id || Math.random()} // Use random key as fallback
              text={plaintext}
              isSender={msg.senderId === currentUser!.uid}
            />
          );
        })}
      </div>

      <ChatInput onSend={handleSendMessage} />
    </div>
  );
};

export default ChatRoom;