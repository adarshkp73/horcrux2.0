import React from 'react';
import clsx from 'clsx';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input: React.FC<InputProps> = ({ className, ...props }) => {
  return (
    <input
      className={clsx(
        'w-full p-3 bg-grey-dark text-grey-light rounded border border-grey-dark',
        'focus:outline-none focus:border-pure-white focus:ring-1 focus:ring-pure-white',
        className
      )}
      {...props}
    />
  );
};