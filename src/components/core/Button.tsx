import React from 'react';
import clsx from 'clsx';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
  isLoading?: boolean;
};

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  isLoading = false,
  ...props
}) => {
  const baseStyles = 'w-full p-3 rounded font-bold transition-all disabled:opacity-50';
  
  const variants = {
    primary: 'bg-pure-white text-pure-black hover:bg-grey-light',
    secondary: 'bg-grey-dark text-grey-light hover:bg-grey-mid',
  };

  return (
    <button
      className={clsx(baseStyles, variants[variant], className)}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? '...' : children}
    </button>
  );
};