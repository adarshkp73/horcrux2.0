import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import { ProtectedRoute } from './components/core/ProtectedRoute';
import AuthLayout from './components/auth/AuthLayout';
import ChatRoom from './pages/ChatRoom';

function App() {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
      </Route>

      {/* Protected Main App Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      >
        <Route path="chat/:id" element={<ChatRoom />} />
        {/* You can add a default "welcome" screen */}
        <Route index element={
          <div className="flex items-center justify-center h-full">
            <p className="text-grey-mid">Select a chat to begin</p>
          </div>
        } />
      </Route>
    </Routes>
  );
}

export default App;