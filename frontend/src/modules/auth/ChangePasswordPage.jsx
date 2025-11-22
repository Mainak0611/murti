import React, { useState } from 'react';
import api from '../../lib/api';
import { useNavigate } from 'react-router-dom';

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
            const res = await api.post('/api/users/change-password', { currentPassword, newPassword });
            setSuccess(res.data.message);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => { navigate('/'); }, 2000);
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Password change failed.';
            setError(errorMsg);
        }
    };

    return (
        <div className="settings-container">
            <style>{`
                :root {
                    --bg-card: #ffffff;
                    --text-main: #0f172a;
                    --text-muted: #64748b;
                    --border: #e2e8f0;
                    --primary: #059669;
                    --primary-hover: #047857;
                    --danger: #ef4444;
                    --success: #10b981;
                    --bg-input: #f8fafc;
                }

                .settings-container {
                    max-width: 600px;
                    margin: 40px auto;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }

                .card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    padding: 32px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }

                h2 { margin: 0 0 8px 0; color: var(--text-main); font-size: 24px; font-weight: 700; }
                .info-text { color: var(--text-muted); margin: 0 0 32px 0; font-size: 14px; }

                .form-group { margin-bottom: 20px; }
                .form-label { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 600; color: var(--text-main); }
                
                .form-input {
                    width: 100%;
                    padding: 12px 16px;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    background: var(--bg-input);
                    color: var(--text-main);
                    font-size: 14px;
                    transition: all 0.2s;
                    box-sizing: border-box; /* Ensures padding doesn't expand width */
                }

                .form-input:focus {
                    outline: none;
                    border-color: var(--primary);
                    background: white;
                    box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
                }

                .btn-group { display: flex; gap: 12px; margin-top: 32px; }

                .btn {
                    padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; flex: 1;
                }
                .btn-primary { background: var(--primary); color: white; }
                .btn-primary:hover { background: var(--primary-hover); }
                
                .btn-outline { background: white; border: 1px solid var(--border); color: var(--text-muted); }
                .btn-outline:hover { background: #f1f5f9; color: var(--text-main); }

                .msg { padding: 12px; border-radius: 8px; font-size: 14px; margin-bottom: 24px; text-align: center; }
                .msg-error { background: #fef2f2; color: var(--danger); border: 1px solid #fee2e2; }
                .msg-success { background: #ecfdf5; color: var(--success); border: 1px solid #d1fae5; }
            `}</style>

            <div className="card">
                <h2>Change Password</h2>
                <p className="info-text">Update your password to keep your account secure.</p>
                
                {error && <div className="msg msg-error">{error}</div>}
                {success && <div className="msg msg-success">{success}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Current Password</label>
                        <input 
                            className="form-input"
                            type="password" 
                            placeholder="••••••••" 
                            value={currentPassword} 
                            onChange={(e) => setCurrentPassword(e.target.value)} 
                            required 
                        />
                    </div>
                    
                    <div className="form-group">
                        <label className="form-label">New Password</label>
                        <input 
                            className="form-input"
                            type="password" 
                            placeholder="••••••••" 
                            value={newPassword} 
                            onChange={(e) => setNewPassword(e.target.value)} 
                            required 
                            minLength="6"
                        />
                    </div>
                    
                    <div className="form-group">
                        <label className="form-label">Confirm New Password</label>
                        <input 
                            className="form-input"
                            type="password" 
                            placeholder="••••••••" 
                            value={confirmPassword} 
                            onChange={(e) => setConfirmPassword(e.target.value)} 
                            required 
                            minLength="6"
                        />
                    </div>
                    
                    <div className="btn-group">
                        <button type="button" onClick={() => navigate('/')} className="btn btn-outline">Cancel</button>
                        <button type="submit" className="btn btn-primary">Update Password</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChangePasswordPage;