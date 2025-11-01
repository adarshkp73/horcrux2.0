import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from '../core/LoadingSpinner';

const AuthLayout: React.FC = () => {
  const { currentUser, loading, isVaultUnlocked } = useAuth();

  if (loading) {
    return (
      // Use theme-aware background
      <div className="flex items-center justify-center min-h-screen bg-grey-light dark:bg-pure-black">
        <LoadingSpinner />
      </div>
    );
  }
  
  if (currentUser && isVaultUnlocked) {
    return <Navigate to="/" replace />;
  }

  return (
    // Theme-aware background
    <div className="flex items-center justify-center min-h-screen bg-grey-light dark:bg-pure-black">
      {/* Theme-aware card */}
      <div className="w-full max-w-md p-8 bg-pure-white dark:bg-night rounded-lg shadow-xl">
        {/* Theme-aware title */}
        <h1 className="text-4xl font-bold text-center text-night dark:text-pure-white mb-8">
          PHOTON
        </h1>
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;