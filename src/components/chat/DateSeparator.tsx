import React from 'react';

interface DateSeparatorProps {
  date: string;
}

export const DateSeparator: React.FC<DateSeparatorProps> = ({ date }) => {
  return (
    // This creates a centered "pill" or "bubble"
    <div className="flex justify-center my-4">
      <span className="bg-grey-dark text-grey-mid text-sm font-semibold px-4 py-1 rounded-full">
        {date}
      </span>
    </div>
  );
};
