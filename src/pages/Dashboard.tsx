import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { useAuth } from '../hooks/useAuth';
import clsx from 'clsx'; 

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
const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h3.75" />
  </svg>
);
// --- End of Icon components ---


const Dashboard: React.FC = () => {
  const { logout } = useAuth();
  const location = useLocation();
  
  // State is now redundant for visibility on mobile, but keeps logic clean
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };
  
  // 1. Determine if the user is on the chat page (chat/:id)
  const isChatRoute = location.pathname.startsWith('/chat/');

  // 2. Control the sidebar's explicit visibility state
  // On mobile (default), if we are on the chat route, the sidebar MUST be hidden.
  // We use this value to calculate the slide-in/out effect.
  const mobileSidebarHidden = isChatRoute;

  return (
    <div className="flex h-screen w-screen relative overflow-hidden">
      
      {/* 3. SIDEBAR CONTAINER (Mobile: 100% width, always visible, slides the chat out) */}
      <div
        className={clsx(
          // Mobile: w-full is default. Laptop: md:w-1/3 lg:w-1/4
          "w-full md:w-1/3 lg:w-1/4 h-full",
          "bg-grey-light dark:bg-night border-r border-grey-mid/20 dark:border-grey-dark flex flex-col p-4",
          "transition-transform duration-300 ease-in-out",
          // On mobile, if we are on the chat route, slide the sidebar left 100%
          mobileSidebarHidden ? "-translate-x-full md:translate-x-0" : "translate-x-0"
        )}
      >
        <ChatSidebar />
      </div>

      {/* 4. CHAT WINDOW CONTAINER (Mobile: 100% width, slides in) */}
      <div
        className={clsx(
          "absolute inset-y-0 right-0 w-full md:relative md:w-auto md:flex-1 flex flex-col",
          "transition-transform duration-300 ease-in-out",
          // On mobile, if the chat is open, slide it to the left (translate-x-0)
          // If the chat is NOT open (mobileSidebarHidden is false), slide it right 100%
          mobileSidebarHidden ? "translate-x-0" : "translate-x-full md:translate-x-0"
        )}
      >
        
        {/* 5. THE NEW TOGGLE BUTTON (Simplified) */}
        {/* This button is anchored to the left of this container and only shows on desktop */}
        <button
          onClick={toggleSidebar} // We'll keep the function, even if we control sliding by route now
          className={clsx(
            "hidden md:flex absolute z-10 w-8 h-8 rounded-full",
            "bg-pure-white dark:bg-grey-dark text-night dark:text-pure-white",
            "items-center justify-center top-1/2 -translate-y-1/2", 
            "transition-all duration-300 ease-in-out",
            "hover:bg-grey-light dark:hover:bg-grey-mid border-2 border-grey-light dark:border-night",
            // This button now controls the width for desktop only
            isSidebarVisible ? "-translate-x-1/2" : "-translate-x-1/2" // Anchor it to the edge
          )}
          style={{ left: 0 }} 
          title={isSidebarVisible ? "Hide sidebar" : "Show sidebar"}
        >
          {isSidebarVisible ? <ArrowLeftIcon /> : <ArrowRightIcon />}
        </button>
        
        {/* 6. TOP-RIGHT BUTTONS (LOGOUT/SETTINGS) */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {/* ... (ThemeToggle and Logout buttons are unchanged) ... */}
          {/* NOTE: ThemeToggle is not included here, but should be imported */}
          {/* It remains outside the ChatRoom's direct control */}

          {/* Place holder for ThemeToggle */}
          {/* <ThemeToggle /> */} 
          
          <button
            onClick={logout}
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
