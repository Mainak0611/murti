// frontend/src/components/Topbar.jsx
import React, { useState } from 'react'; // 1. Import useState
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Topbar.css';

const Topbar = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // 2. State to manage modal visibility
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

    // Function to open the modal
    const showLogoutConfirmation = () => {
        setIsLogoutModalOpen(true);
    };

    // Function to close the modal
    const cancelLogout = () => {
        setIsLogoutModalOpen(false);
    };

    const handleLogout = () => {
        // Clear authentication data
        localStorage.removeItem('userToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        
        // Dispatch custom event to notify App component
        window.dispatchEvent(new Event('logout'));
        
        // Close the modal
        setIsLogoutModalOpen(false); 

        // Redirect to the login page
        navigate('/login');
    };

    // Get username from localStorage, with fallback to decoding from JWT token
    const getUserName = () => {
        const storedUserName = localStorage.getItem('userName');
        if (storedUserName) {
            return storedUserName;
        }
        
        // Fallback: Try to decode from JWT token
        const token = localStorage.getItem('userToken');
        if (token) {
            try {
                // Ensure the token has the correct format before splitting
                if (token.split('.').length === 3) {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    return payload.userId || 'User';
                }
            } catch (e) {
                // Ignore decoding errors
            }
        }
        
        return 'User';
    };

    const userName = getUserName();

    // Get page title based on current route
    const getPageTitle = () => {
        switch(location.pathname) {
            case '/':
                return 'Dashboard';
            case '/payments':
                return 'Payment Records';
            default:
                return 'Dashboard';
        }
    };

    return (
        <>
            <div className="topbar">
                <div className="topbar-left">
                    <button className="topbar-home-btn" onClick={() => navigate('/')} title="Go to Dashboard">
                        <span className="home-icon">🏠</span>
                        <span className="home-text">Dashboard</span>
                    </button>
                    <h1 className="topbar-title">{getPageTitle()}</h1>
                </div>
                
                <div className="topbar-right">
                    <div className="topbar-user">
                        <span className="topbar-user-icon">👤</span>
                        <span className="topbar-user-name">{userName}</span>
                    </div>
                    
                    <button className="topbar-settings-btn" onClick={() => navigate('/change-password')} title="Settings">
                        <span className="settings-icon">⚙️</span>
                        Settings
                    </button>
                    
                    {/* 3. Changed onClick to show the modal */}
                    <button className="topbar-logout-btn" onClick={showLogoutConfirmation}> 
                        <span className="logout-icon">🚪</span>
                        Logout
                    </button>
                </div>
            </div>

            {/* 4. Conditional Modal Rendering */}
            {isLogoutModalOpen && (
                <div className="modal-overlay">
                    <div className="logout-modal">
                        <h2>Confirm Logout</h2>
                        <p>Are you sure you want to log out of your account?</p>
                        <div className="modal-actions">
                            <button className="modal-cancel-btn" onClick={cancelLogout}>Cancel</button>
                            <button className="modal-confirm-btn" onClick={handleLogout}>Logout</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Topbar;