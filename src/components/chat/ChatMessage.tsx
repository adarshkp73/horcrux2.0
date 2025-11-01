import React from 'react';
import clsx from 'clsx';

interface ChatMessageProps {
  text: string;
  isSender: boolean;
  timestamp?: string; // You can format this later
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ text, isSender }) => {
  return (
    <div
      className={clsx('flex', isSender ? 'justify-end' : 'justify-start')}
    >
      <div
        className={clsx(
          'max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-lg',
          isSender
            ? 'bg-pure-white text-pure-black'
            : 'bg-grey-dark text-grey-light'
        )}
      >
        <p>{text}</p>
      </div>
    </div>
  );
};