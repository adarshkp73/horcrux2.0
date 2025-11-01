import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { useAuth } from '../hooks/useAuth';
import clsx from 'clsx'; 
import { ThemeToggle } from '../components/core/ThemeToggle'; // <-- 1. IMPORT

// --- Icon components ---
const ArrowLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);
const ArrowRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);
const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
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
    // The main background is now inherited from body
    <div className="flex h-screen w-screen relative">
      
      {/* --- 1. THE SIDEBAR CONTAINER --- */}
      <div
        className={clsx(
          // Updated theme-aware background and border
          "bg-grey-light dark:bg-night border-r border-grey-mid/20 dark:border-grey-dark flex flex-col h-full",
          "transition-all duration-300 ease-in-out", 
          isSidebarVisible
            ? "w-full md:w-1/3 lg:w-1/4 p-4"
            : "w-0 p-0 overflow-hidden" 
        )}
      >
        {isSidebarVisible && <ChatSidebar />}
      </div>

      {/* --- 2. THE CHAT WINDOW (Outlet) --- */}
      <div className="flex-1 flex flex-col relative">
        
        {/* 3. THE TOGGLE BUTTON */}
        <button
          onClick={toggleSidebar}
          className={clsx(
            "absolute z-10 w-8 h-8 rounded-full",
            // Theme-aware button colors
            "bg-pure-white dark:bg-grey-dark text-night dark:text-pure-white",
            "flex items-center justify-center",
            "top-1/2 -translate-y-1/2", 
            "transition-all duration-300 ease-in-out",
            // Theme-aware border
            "hover:bg-grey-light dark:hover:bg-grey-mid border-2 border-grey-light dark:border-night",
            isSidebarVisible ? "-translate-x-1/2" : "translate-x-1/2"
          )}
          style={{ left: 0 }} 
          title={isSidebarVisible ? "Hide sidebar" : "Show sidebar"}
        >
          {isSidebarVisible ? <ArrowLeftIcon /> : <ArrowRightIcon />}
        </button>
        
        {/* 4. TOP-RIGHT BUTTONS (NEW LAYOUT) */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {/* THE NEW THEME TOGGLE */}
          <ThemeToggle />

          {/* THE LOGOUT BUTTON */}
          <button
            onClick={logout}
            // Theme-aware icon color
            className="p-2 text-grey-mid hover:text-night dark:text-grey-mid dark:hover:text-pure-white"
            title="Logout"
          >
            <LogoutIcon />
          </button>
        </div>

        <Outlet />
      </div>
    </div>
  );
};

export default Dashboard;