// frontend/src/App.jsx (Updated with Layout, Sidebar, and HomePage)
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from "./components/Layout";
import HomePage from "./modules/HomePage/HomePage.jsx";
import PaymentTracker from "./modules/payments/PaymentTracker.jsx"; 
import LoginPage from './modules/auth/LoginPage.jsx';
import RegisterPage from './modules/auth/RegisterPage.jsx';
import ForgotPasswordPage from './modules/auth/ForgotPasswordPage.jsx';
import ChangePasswordPage from './modules/auth/ChangePasswordPage.jsx';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('userToken'));
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    // Simulate checking authentication (in case of async operations in future)
    const checkAuth = () => {
      setIsAuthenticated(!!localStorage.getItem('userToken'));
      setIsLoading(false);
    };
    
    // Small delay to prevent flash
    setTimeout(checkAuth, 100);
  }, []);

  // Listen for storage changes (for logout from other tabs) and custom events
  useEffect(() => {
    const checkAuth = () => {
      setIsAuthenticated(!!localStorage.getItem('userToken'));
    };

    // Listen for storage changes
    window.addEventListener('storage', checkAuth);
    
    // Listen for custom logout event
    window.addEventListener('logout', checkAuth);

    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('logout', checkAuth);
    };
  }, []);

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: '24px',
        fontWeight: 'bold'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
          Loading...
        </div>
      </div>
    );
  }

  // If NOT authenticated, show only the login and registration pages
  if (!isAuthenticated) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          {/* Redirect all other requests to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

  // If authenticated, show the full application with Layout
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} /> 
          <Route path="/payments" element={<PaymentTracker />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          {/* Add more authenticated routes here */}
          {/* Redirect back to the main app if user tries to access /login or /register while logged in */}
          <Route path="/login" element={<Navigate to="/" replace />} /> 
          <Route path="/register" element={<Navigate to="/" replace />} />
          <Route path="/forgot-password" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} /> 
        </Routes>
      </Layout>
    </Router>
  );
}
export default App;