// 1. Add 'useMemo' to our React imports
import React, { useEffect, useState, useRef, useMemo } from 'react';
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
import * as Crypto from '../lib/crypto';
import { ChatInput } from '../components/chat/ChatInput';
import { ChatMessage } from '../components/chat/ChatMessage';
import { LoadingSpinner } from '../components/core/LoadingSpinner';

// 2. Import our new components and utilities
import { DateSeparator } from '../components/chat/DateSeparator';
import { formatDateSeparator } from '../lib/dateUtils';

// 3. Define a new type for our list items
type ChatListItem = 
  | { type: 'message'; data: Message }
  | { type: 'date'; date: Date };


const ChatRoom: React.FC = () => {
  const { id: chatId } = useParams<{ id: string }>();
  const { currentUser, getChatKey, decapAndSaveKey } = useAuth();
  
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [decryptedMessages, setDecryptedMessages] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const messageListRef = useRef<HTMLDivElement>(null);

  // ... (All useEffect hooks 1 & 2 are unchanged) ...
  // ... (useEffect 3: Decrypt Messages is unchanged) ...
  // ... (useEffect 4: Auto-scroll is unchanged) ...
  // ... (handleSendMessage function is unchanged) ...
  
  // --- (All functions from line 30 to 207 are unchanged) ---
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

  useEffect(() => {
    if (messages.length === 0) return;
    const decryptAll = async () => {
      const key = await getChatKey(chatId!);
      if (!key) {
        console.log("Waiting for chat key... Clearing previous decryptions.");
        setDecryptedMessages(new Map()); 
        return;
      }
      const newDecrypted = new Map(decryptedMessages);
      let needsUpdate = false;
      for (const msg of messages) {
        if (msg.id && !newDecrypted.has(msg.id)) { 
          try {
            const plaintext = await Crypto.decryptWithAES(key, msg.encryptedText);
            newDecrypted.set(msg.id, plaintext);
            needsUpdate = true;
          } catch (err) {
            console.warn("Failed to decrypt message (key was present):", msg.id, err);
            newDecrypted.set(msg.id, "[DECRYPTION FAILED]");
            needsUpdate = true;
          }
        }
      }
      if (needsUpdate) {
        setDecryptedMessages(newDecrypted);
      }
    };
    decryptAll();
  }, [messages, chatId, getChatKey, decryptedMessages]);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [decryptedMessages]); 
  
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

  
  // 4. --- NEW LOGIC: GROUP MESSAGES BY DATE ---
  const groupedChatItems = useMemo(() => {
    const items: ChatListItem[] = [];
    let lastDate: string | null = null;

    messages.forEach((message) => {
      // We need a valid timestamp to do anything
      if (message.timestamp) {
        const messageDate = message.timestamp.toDate();
        const dateString = messageDate.toLocaleDateString(); // e.g., "10/31/2025"

        // Check if this message is on a new day
        if (dateString !== lastDate) {
          // If it is, add a date separator to our new array
          items.push({ type: 'date', date: messageDate });
          lastDate = dateString; // Update the last seen date
        }
      }
      
      // Finally, add the message itself to the array
      items.push({ type: 'message', data: message });
    });

    return items;
  }, [messages]); // This logic only re-runs when the 'messages' array changes


  // ... (Loading/Error JSX is unchanged) ...
  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>;
  }
  if (!chat) {
    return <div className="flex-1 flex items-center justify-center">Chat not found.</div>;
  }
  const recipient = chat.participants?.find(p => p.uid !== currentUser!.uid);


  // --- (This is the render() return) ---
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
        {/* 5. --- UPDATED RENDER LOGIC --- */}
        {/* We now map over our new `groupedChatItems` array */}
        {groupedChatItems.map((item, index) => {
          
          // Case 1: The item is a date separator
          if (item.type === 'date') {
            return (
              <DateSeparator 
                key={item.date.toISOString()} 
                date={formatDateSeparator(item.date)} 
              />
            );
          }

          // Case 2: The item is a message
          const msg = item.data;
          const plaintext = msg.id ? decryptedMessages.get(msg.id) || "..." : "...";
          
          return (
            <ChatMessage
              key={msg.id || index} // Use index as fallback key
              text={plaintext}
              isSender={msg.senderId === currentUser!.uid}
              timestamp={msg.timestamp || null}
            />
          );
        })}
      </div>

      <ChatInput onSend={handleSendMessage} />
    </div>
  );
};

export default ChatRoom;
