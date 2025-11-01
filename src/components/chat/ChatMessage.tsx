import React from 'react';
import clsx from 'clsx';
import { Timestamp } from 'firebase/firestore'; // 1. Import the Timestamp type

// 2. DEFINE THE NEW PROPS
interface ChatMessageProps {
  text: string;
  isSender: boolean;
  timestamp: Timestamp | null; // <-- ADD THIS PROP
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ text, isSender, timestamp }) => {
  
  // 3. FORMAT THE TIMESTAMP
  // This will convert the Firebase Timestamp into a simple string like "5:33 PM"
  // It will return null if the timestamp isn't ready yet.
  const formattedTime = timestamp
    ? timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div
      className={clsx('flex', isSender ? 'justify-end' : 'justify-start')}
    >
      <div
        className={clsx(
          'max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-lg shadow-md', // Added a subtle shadow
          isSender
            ? 'bg-pure-white text-pure-black'
            : 'bg-grey-dark text-grey-light'
        )}
      >
        {/* The message text */}
        <p className="whitespace-pre-wrap break-words">{text}</p>
        
        {/* 4. DISPLAY THE FORMATTED TIME */}
        {formattedTime && (
          <span
            className={clsx(
              'text-xs mt-1 block text-right', // Aligns time to the right
              isSender ? 'text-grey-mid opacity-90' : 'text-grey-mid'
            )}
          >
            {formattedTime}
          </span>
        )}
      </div>
    </div>
  );
};
