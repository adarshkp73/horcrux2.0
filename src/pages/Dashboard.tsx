import React from 'react';
import { Outlet } from 'react-router-dom';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/core/Button';

const Dashboard: React.FC = () => {
  const { logout } = useAuth();

  return (
    <div className="flex h-screen w-screen">
      <ChatSidebar />
      <div className="flex-1 flex flex-col">
        {/* Main content area */}
        <Outlet />
      </div>
      {/* TODO: Move this logout button to a better place */}
      <div className="absolute top-4 right-4">
        <Button onClick={logout} variant="secondary" className="w-auto px-4 py-2">
          Logout
        </Button>
      </div>
    </div>
  );
};

export default Dashboard;