import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from './LoadingSpinner';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Get `isVaultUnlocked` and `loading` from our hook
  const { isVaultUnlocked, loading } = useAuth();

  // 2. We still wait for the initial Firebase auth check to complete
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  // 3. THIS IS THE FIX
  // We no longer check `currentUser`. We check if the VAULT is unlocked.
  // If the user refreshed the page, `currentUser` might exist,
  // but `isVaultUnlocked` will be FALSE.
  if (!isVaultUnlocked) {
    // This will redirect the user to the login page to unlock their vault.
    return <Navigate to="/login" replace />;
  }

  // 4. If we are not loading AND the vault is unlocked, show the app.
  return <>{children}</>;
};