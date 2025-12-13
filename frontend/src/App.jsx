import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from "./components/Layout";
import HomePage from "./modules/HomePage/HomePage.jsx";
import PaymentTracker from "./modules/payments/PaymentTracker.jsx"; 
import LoginPage from './modules/auth/LoginPage.jsx';
import RegisterPage from './modules/auth/RegisterPage.jsx';
import ForgotPasswordPage from './modules/auth/ForgotPasswordPage.jsx';
import ChangePasswordPage from './modules/auth/ChangePasswordPage.jsx';
import PartyEnquiriesPage from "./modules/partyEnquiry/index.jsx";
import ItemMaster from "./modules/itemMaster/index.jsx";

// 1. IMPORT THE HOOK
import useScrollToTop from './hooks/useScrollToTop';

// 2. CREATE THE HELPER COMPONENT
// This component renders nothing visual but triggers the scroll logic
const ScrollHandler = () => {
  useScrollToTop();
  return null;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('userToken'));
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = () => {
      setIsAuthenticated(!!localStorage.getItem('userToken'));
      setIsLoading(false);
    };
    setTimeout(checkAuth, 500); // Slight delay for smooth transition
  }, []);

  // Listen for storage changes & logout events
  useEffect(() => {
    const checkAuth = () => {
      setIsAuthenticated(!!localStorage.getItem('userToken'));
    };
    window.addEventListener('storage', checkAuth);
    window.addEventListener('logout', checkAuth);
    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('logout', checkAuth);
    };
  }, []);

  // --- Professional Loading Screen ---
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8fafc', // Slate 50
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #e2e8f0; /* Slate 200 */
            border-top: 3px solid #059669; /* Emerald 600 */
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-bottom: 16px;
          }
        `}</style>
        <div className="spinner"></div>
        <div style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>
          Loading Dashboard...
        </div>
      </div>
    );
  }

  // --- Unauthenticated Routes ---
  if (!isAuthenticated) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

  // --- Authenticated Routes (Protected) ---
  return (
    <Router>
      {/* 3. PLACE THE SCROLL HANDLER HERE */}
      {/* It sits inside Router but outside Routes so it stays active during navigation */}
      <ScrollHandler />
      
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} /> 
          <Route path="/payments" element={<PaymentTracker />} />
          <Route path="/party-enquiries" element={<PartyEnquiriesPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/item-master" element={<ItemMaster />} />
          
          {/* Redirect generic auth paths back to dashboard if already logged in */}
          <Route path="/login" element={<Navigate to="/" replace />} /> 
          <Route path="/register" element={<Navigate to="/" replace />} />
          <Route path="/forgot-password" element={<Navigate to="/" replace />} />
          
          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} /> 
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;