// frontend/src/modules/auth/ForgotPasswordPage.jsx
import React, { useState } from 'react';
import api from '../../lib/api';
import { Link, useNavigate } from 'react-router-dom';
import '../../styles/AuthForm.css';

const ForgotPasswordPage = () => {
    const [step, setStep] = useState(1); // Step 1: Verify, Step 2: Reset Password
    const [userId, setUserId] = useState('');
    const [email, setEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    const handleVerify = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            const res = await api.post('/api/users/forgot-password', { userId, email });
            setSuccess(res.data.message);
            setStep(2); // Move to password reset step
        } catch (err) {
            console.error('Verification error:', err);
            const errorMsg = err.response?.data?.error || err.message || 'Verification failed.';
            setError(errorMsg);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        try {
            const res = await api.post('/api/users/reset-password', { 
                userId, 
                email, 
                newPassword 
            });
            setSuccess(res.data.message);
            
            // Redirect to login after 2 seconds
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (err) {
            console.error('Reset password error:', err);
            const errorMsg = err.response?.data?.error || err.message || 'Password reset failed.';
            setError(errorMsg);
        }
    };

    return (
        <div className="auth-container">
            <h2>Forgot Password</h2>
            
            {step === 1 ? (
                <>
                    <p className="info-text">Enter your User ID and email to verify your identity.</p>
                    <form onSubmit={handleVerify} className="auth-form">
                        <input 
                            type="text" 
                            placeholder="User ID" 
                            value={userId} 
                            onChange={(e) => setUserId(e.target.value)} 
                            required 
                        />
                        <input 
                            type="email" 
                            placeholder="Email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            required 
                        />
                        <button type="submit">Verify</button>
                    </form>
                </>
            ) : (
                <>
                    <p className="info-text">Enter your new password.</p>
                    <form onSubmit={handleResetPassword} className="auth-form">
                        <input 
                            type="password" 
                            placeholder="New Password" 
                            value={newPassword} 
                            onChange={(e) => setNewPassword(e.target.value)} 
                            required 
                            minLength="6"
                        />
                        <input 
                            type="password" 
                            placeholder="Confirm New Password" 
                            value={confirmPassword} 
                            onChange={(e) => setConfirmPassword(e.target.value)} 
                            required 
                            minLength="6"
                        />
                        <button type="submit">Reset Password</button>
                    </form>
                </>
            )}

            {error && <p className="error-message">{error}</p>}
            {success && <p className="success-message">{success}</p>}
            
            <p className="link-text">
                Remember your password? <Link to="/login">Login here</Link>
            </p>
        </div>
    );
};

export default ForgotPasswordPage;
