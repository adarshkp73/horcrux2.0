import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from '../core/LoadingSpinner';

const AuthLayout: React.FC = () => {
  // 1. Get ALL the relevant auth states
  const { currentUser, loading, isVaultUnlocked } = useAuth();

  // 2. We still wait for the initial Firebase check
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-pure-black">
        <LoadingSpinner />
      </div>
    );
  }

  // 3. THIS IS THE FIX
  // Only redirect to the dashboard if the user is
  // LOGGED IN *AND* THEIR VAULT IS UNLOCKED.
  if (currentUser && isVaultUnlocked) {
    return <Navigate to="/" replace />;
  }

  // 4. If we are not loading, and the user is NOT fully authenticated
  //    (i.e., they are logged out, OR they are in the "vault locked" state)
  //    ...then we MUST show the <Outlet /> (the Login or SignUp page).
  //    This breaks the redirect loop.
  return (
    <div className="flex items-center justify-center min-h-screen bg-pure-black">
      <div className="w-full max-w-md p-8 bg-night rounded-lg shadow-lg">
        <h1 className="text-4xl font-bold text-center text-pure-white mb-8">
          PHOTON
        </h1>
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;