import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Chat, UserProfile, ChatWithRecipient } from '../../types';
import { useNavigate, useParams } from 'react-router-dom';
import { UserSearch } from '../users/UserSearch';
import { LoadingSpinner } from '../core/LoadingSpinner';
import clsx from 'clsx';

export const ChatSidebar: React.FC = () => {
  const { currentUser } = useAuth();
  const [chats, setChats] = useState<ChatWithRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { id: activeChatId } = useParams<{ id: string }>();

  useEffect(() => {
    if (!currentUser?.uid) {
        setLoading(false);
        setChats([]); 
        return;
    };

    setLoading(true);
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('users', 'array-contains', currentUser.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setError(''); 
        const loadedChats: ChatWithRecipient[] = [];
        
        snapshot.forEach((docRef) => {
          const chat = { id: docRef.id, ...docRef.data() } as Chat;
          const recipientParticipant = chat.participants?.find(
            (p) => p.uid !== currentUser.uid
          );
          if (!recipientParticipant) {
            console.warn(`Chat ${chat.id} has malformed participants.`);
            return; 
          }
          const recipient: UserProfile = {
            uid: recipientParticipant.uid,
            username: recipientParticipant.username,
            email: '', kyberPublicKey: '', createdAt: new Timestamp(0, 0),
            friends: [], username_normalized: '',
          };
          loadedChats.push({ chat, recipient });
        });
        
        // Sort by last message time (newest first)
        loadedChats.sort((a, b) => {
          const timeA = a.chat.lastMessage?.timestamp?.toMillis() || a.chat.id.length;
          const timeB = b.chat.lastMessage?.timestamp?.toMillis() || b.chat.id.length;
          return timeB - timeA;
        });

        setChats(loadedChats);
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to chats:', err);
        setError('Failed to load chats.'); 
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  return (
    <>
      {/* Theme-aware title */}
      <h2 className="text-2xl font-bold text-night dark:text-pure-white mb-4">Photon</h2>

      <UserSearch />

      {/* Theme-aware subtitle */}
      <h3 className="text-lg font-semibold text-grey-dark dark:text-grey-mid mb-2">
        Conversations
      </h3>
      
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center mt-4">
            <LoadingSpinner />
          </div>
        )}

        {/* Theme-aware error/empty text */}
        {!loading && error && chats.length === 0 && (
          <p className="text-red-600 dark:text-red-500 text-center">{error}</p>
        )}

        {!loading && !error && chats.length === 0 && (
          <p className="text-grey-dark dark:text-grey-mid text-center">
            No chats yet. Find a user to start a conversation.
          </p>
        )}

        {/* Theme-aware list items */}
        <div className="space-y-2">
          {chats.map(({ chat, recipient }) => (
            <div
              key={chat.id}
              onClick={() => navigate(`/chat/${chat.id}`)}
              className={clsx(
                'p-3 rounded-lg cursor-pointer transition-colors',
                chat.id === activeChatId
                  ? 'bg-night/10 dark:bg-pure-white text-night dark:text-pure-black'
                  : 'bg-pure-white/50 dark:bg-grey-dark text-night dark:text-grey-light hover:bg-pure-white dark:hover:bg-grey-mid'
              )}
            >
              <p className="font-bold">{recipient.username}</p>
              <p className={clsx(
                "text-sm",
                chat.id === activeChatId ? 'text-grey-dark dark:text-grey-dark' : 'text-grey-mid dark:text-grey-mid'
              )}>
                {chat.lastMessage ? 'Encrypted Message' : 'No messages yet'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};