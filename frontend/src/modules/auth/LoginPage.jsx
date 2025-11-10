// frontend/src/modules/auth/LoginPage.jsx (Updated with Toast Notifications)
import React, { useState } from 'react';
import api from '../../lib/api';
import { Link } from 'react-router-dom';
// Import Toastify Components
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'; 

import '../../styles/AuthForm.css';
import '../../styles/Toast.css';

const LoginPage = () => {
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');
    // Removed the 'error' state since toast will handle the display
    // const [error, setError] = useState(''); 

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            const res = await api.post('/api/users/login', { userId, password });
            
            // Store the token, user ID, and username
            localStorage.setItem('userToken', res.data.token);
            localStorage.setItem('userId', res.data.userId);
            localStorage.setItem('userName', res.data.userName);

            // Show success toast
            console.log('Showing success toast');
            toast.success('Login successful! Redirecting...');

            // Redirect after a short delay to show the toast
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
            
        } catch (err) {
            console.error('Login error:', err);
            console.error('Error response:', err.response);
            
            // Determine the error message
            const errorMsg = err.response?.data?.error || err.message || 'Login failed. Please check your credentials.';

            // Display Toast Notification for error
            console.log('Attempting to show toast with message:', errorMsg);
            toast.error(errorMsg);
        }
    };

    return (
        <>
            <ToastContainer 
                position="top-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
                style={{ zIndex: 99999 }}
            />
            
            <div className="auth-container">
                <h2>User Login</h2>
            <form onSubmit={handleSubmit} className="auth-form">
                <input 
                    type="text" 
                    placeholder="User ID" 
                    value={userId} 
                    onChange={(e) => setUserId(e.target.value)} 
                    required 
                />
                <input 
                    type="password" 
                    placeholder="Password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                />
                <button type="submit">Login</button>
            </form>
            
            {/* Removed static error message display */}
            {/* {error && <p className="error-message">{error}</p>} */}
            
            {/* Forgot Password Link */}
            <p className="link-text">
                <Link to="/forgot-password">Forgot Password?</Link>
            </p>
            
            {/* LINK TO REGISTRATION PAGE */}
            <p className="link-text">
                Need an account? <Link to="/register">Register here</Link>
            </p>
            </div>
        </>
    );
};

export default LoginPage;