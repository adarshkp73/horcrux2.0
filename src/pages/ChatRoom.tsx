import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Chat, Message, ChatListItem } from '../types';
import {
  doc,
  onSnapshot,
  collection,
  addDoc,
  Timestamp,
  updateDoc,
  query,
  orderBy,
  setDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import * as Crypto from '../lib/crypto';
import { ChatInput } from '../components/chat/ChatInput';
import { ChatMessage } from '../components/chat/ChatMessage';
import { LoadingSpinner } from '../components/core/LoadingSpinner';
import { DateSeparator } from '../components/chat/DateSeparator';
import { formatDateSeparator } from '../lib/dateUtils';

const ChatRoom: React.FC = () => {
  const { id: chatId } = useParams<{ id: string }>();
  const { currentUser, getChatKey, decapAndSaveKey } = useAuth();
  
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [decryptedMessages, setDecryptedMessages] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const messageListRef = useRef<HTMLDivElement>(null);

  // --- (useEffect 1: Listen to Chat Document) ---
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
        try {
          await decapAndSaveKey(chatId, kemData.ciphertext);
          await updateDoc(doc.ref, { keyEncapsulationData: null });
        } catch (err) {
          console.error("Failed to decapsulate key:", err);
        }
      }
      setLoading(false);
    });
    return () => unsubChat();
  }, [chatId, currentUser, decapAndSaveKey]);

  // --- (useEffect 2: "Mark as Read") ---
  useEffect(() => {
    if (!chatId || !currentUser || !chat) {
      return;
    }

    const lastMsg = chat.lastMessage;
    const myLastRead = (chat.lastRead && chat.lastRead[currentUser.uid]) ? chat.lastRead[currentUser.uid] : null;

    let needsReadUpdate = false;
    if (lastMsg && lastMsg.senderId !== currentUser.uid) {
      if (!myLastRead || myLastRead.toMillis() < lastMsg.timestamp.toMillis()) {
        needsReadUpdate = true;
      }
    }

    if (needsReadUpdate) {
      console.log(`Marking chat ${chatId} as read...`);
      setDoc(doc(db, 'chats', chatId), {
        lastRead: {
          [currentUser.uid]: Timestamp.now()
        }
      }, { merge: true })
      .catch(err => console.error("Error marking chat as read:", err));
    }

  }, [chat, chatId, currentUser]); 

  // --- (useEffect 3: Listen to Messages) ---
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

  // --- (useEffect 4: Decrypt Messages) ---
  useEffect(() => {
    if (messages.length === 0) return;
    const decryptAll = async () => {
      const key = await getChatKey(chatId!);
      if (!key) {
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

  // --- (useEffect 5: Auto-scroll) ---
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [decryptedMessages]); 
  
  // --- (handleSendMessage function: THIS IS THE FIX) ---
  const handleSendMessage = async (text: string) => {
    if (!chatId || !currentUser) return;
    const key = await getChatKey(chatId);
    if (!key) {
      alert("Error: Chat key is not available. Cannot send message.");
      return;
    }
    const encryptedText = await Crypto.encryptWithAES(key, text);
    
    // 1. Create the new message object
    const newMessage = {
      senderId: currentUser.uid,
      encryptedText: encryptedText,
      timestamp: Timestamp.now(), 
    };
    
    // 2. Add the new message to the subcollection
    await addDoc(collection(db, 'chats', chatId, 'messages'), newMessage);
    
    // 3. Update the `lastMessage` field on the main chat doc
    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage: {
        senderId: currentUser.uid, // <-- THIS IS THE NEW LINE
        encryptedText: encryptedText,
        timestamp: newMessage.timestamp,
      }
    });
  };
  
  // --- (groupedChatItems logic is unchanged) ---
  const groupedChatItems = useMemo(() => {
    const items: ChatListItem[] = [];
    let lastDate: string | null = null;
    messages.forEach((message) => {
      if (message.timestamp) {
        const messageDate = message.timestamp.toDate();
        const dateString = messageDate.toLocaleDateString();
        if (dateString !== lastDate) {
          items.push({ type: 'date', date: messageDate });
          lastDate = dateString;
        }
      }
      items.push({ type: 'message', data: message });
    });
    return items;
  }, [messages]);

  // --- (Rest of the render/JSX is unchanged) ---
  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>;
  }
  if (!chat || !currentUser) { 
    return <div className="flex-1 flex items-center justify-center">Chat not found.</div>;
  }
  
  const recipient = chat.participants?.find(p => p.uid !== currentUser.uid);

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  let showReadReceipt = false;
  
  if (recipient && lastMessage && lastMessage.senderId === currentUser.uid) {
    const recipientLastRead = (chat.lastRead && chat.lastRead[recipient.uid]) ? chat.lastRead[recipient.uid] : null;
    if (recipientLastRead && recipientLastRead.toMillis() >= lastMessage.timestamp.toMillis()) {
      showReadReceipt = true;
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="p-4 border-b border-grey-mid/20 dark:border-grey-dark">
        <h2 className="text-xl font-bold">
          Chat with {recipient ? recipient.username : '...'}
        </h2>
      </div>

      <div 
        ref={messageListRef} 
        className="flex-1 p-4 space-y-4 overflow-y-auto"
      >
        {groupedChatItems.map((item, index) => {
          if (item.type === 'date') {
            return (
              <DateSeparator 
                key={item.date.toISOString()} 
                date={formatDateSeparator(item.date)} 
              />
            );
          }
          const msg = item.data;
          const plaintext = msg.id ? decryptedMessages.get(msg.id) || "..." : "...";
          return (
            <ChatMessage
              key={msg.id || index}
              text={plaintext}
              isSender={msg.senderId === currentUser.uid}
              timestamp={msg.timestamp || null}
            />
          );
        })}
      </div>

      <div className="h-6 px-4 pb-2 text-right">
        {showReadReceipt && (
          <span className="text-sm text-grey-mid">
            Read
          </span>
        )}
      </div>

      <ChatInput onSend={handleSendMessage} />
    </div>
  );
};

export default ChatRoom;