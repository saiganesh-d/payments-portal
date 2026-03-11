import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.tsx';
import Login from './Login.tsx';
import { useAuthStore } from './store/authStore';
import './index.css';

const PrivateRoute = ({ children, roles }: { children: React.ReactNode, roles: string[] }) => {
  const { token, role } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (role && !roles.includes(role)) return <Navigate to="/" replace />; // unauthorized
  return <>{children}</>;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route 
          path="/*" 
          element={
            <PrivateRoute roles={['ADMIN', 'CLIENT', 'STAFF']}>
              <App />
            </PrivateRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
