import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { useAuth } from '../hooks/useAuth';
import clsx from 'clsx'; 

// --- Icon components moved back here ---
const MenuIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-6 h-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
    />
  </svg>
);

const LogoutIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={1.5} 
    stroke="currentColor" 
    className="w-6 h-6"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" 
    />
  </svg>
);
// --- End of Icon components ---


const Dashboard: React.FC = () => {
  const { logout } = useAuth();
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };

  return (
    <div className="flex h-screen w-screen relative">
      
      {/* 1. SIDEBAR TOGGLE BUTTON (MOVED BACK) */}
      {/* This button is now in the parent and will ALWAYS be visible */}
      <button
        onClick={toggleSidebar}
        className={clsx(
          "absolute top-4 z-20 p-2 bg-grey-dark text-pure-white rounded-full transition-all duration-300 ease-in-out",
          "hover:bg-grey-mid"
        )}
        style={{ left: '1rem' }} // Always 1rem from the left edge
        title="Toggle Sidebar"
      >
        <MenuIcon />
      </button>

      {/* 2. LOGOUT BUTTON (Stays top-right) */}
      <button
        onClick={logout}
        className="absolute top-4 right-4 z-20 p-2 text-grey-mid hover:text-pure-white"
        title="Logout"
      >
        <LogoutIcon />
      </button>

      {/* 3. THE SIDEBAR CONTAINER */}
      <div
        className={clsx(
          "bg-night border-r border-grey-dark flex flex-col h-full",
          "transition-all duration-300 ease-in-out", 
          isSidebarVisible
            // THIS IS THE FIX:
            // Add `pt-16` padding to the top. This pushes all of the
            // sidebar's content ("Photon", search, etc.) down,
            // leaving a "safe area" for the toggle button to live.
            ? "w-full md:w-1/3 lg:w-1/4 p-4 pt-16"
            : "w-0 p-0 overflow-hidden" 
        )}
      >
        {/* We no longer pass the 'onToggle' prop */}
        <ChatSidebar isVisible={isSidebarVisible} />
      </div>

      {/* 4. THE CHAT WINDOW (Outlet) */}
      <div className="flex-1 flex flex-col">
        <Outlet />
      </div>
    </div>
  );
};

export default Dashboard;
