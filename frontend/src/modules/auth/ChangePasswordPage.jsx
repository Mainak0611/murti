// frontend/src/modules/auth/ChangePasswordPage.jsx
import React, { useState } from 'react';
import api from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import '../../styles/ChangePassword.css';

const ChangePasswordPage = () => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            setError('New passwords do not match.');
            return;
        }

        if (newPassword.length < 6) {
            setError('New password must be at least 6 characters long.');
            return;
        }

        if (currentPassword === newPassword) {
            setError('New password must be different from current password.');
            return;
        }

        try {
            const res = await api.post('/api/users/change-password', { 
                currentPassword, 
                newPassword 
            });
            setSuccess(res.data.message);
            
            // Clear form
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            
            // Redirect to dashboard after 2 seconds
            setTimeout(() => {
                navigate('/');
            }, 2000);
        } catch (err) {
            console.error('Change password error:', err);
            const errorMsg = err.response?.data?.error || err.message || 'Password change failed.';
            setError(errorMsg);
        }
    };

    const handleCancel = () => {
        navigate('/');
    };

    return (
        <div className="change-password-page">
            <div className="change-password-container">
                <h2>Change Password</h2>
                <p className="info-text">Enter your current password and choose a new one.</p>
                
                <form onSubmit={handleSubmit} className="change-password-form">
                    <div className="form-group">
                        <label>Current Password</label>
                        <input 
                            type="password" 
                            placeholder="Enter current password" 
                            value={currentPassword} 
                            onChange={(e) => setCurrentPassword(e.target.value)} 
                            required 
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>New Password</label>
                        <input 
                            type="password" 
                            placeholder="Enter new password (min 6 characters)" 
                            value={newPassword} 
                            onChange={(e) => setNewPassword(e.target.value)} 
                            required 
                            minLength="6"
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Confirm New Password</label>
                        <input 
                            type="password" 
                            placeholder="Confirm new password" 
                            value={confirmPassword} 
                            onChange={(e) => setConfirmPassword(e.target.value)} 
                            required 
                            minLength="6"
                        />
                    </div>

                    {error && <p className="error-message">{error}</p>}
                    {success && <p className="success-message">{success}</p>}
                    
                    <div className="button-group">
                        <button type="submit" className="submit-btn">Change Password</button>
                        <button type="button" onClick={handleCancel} className="cancel-btn">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordPage;
