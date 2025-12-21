// frontend/src/modules/settings/SecurityTab.jsx
import React, { useState } from 'react';
import api from '../../lib/api';

const SecurityTab = () => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    // Toggle Visibility
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');

        if (newPassword !== confirmPassword) return setError('New passwords do not match.');
        if (newPassword.length < 6) return setError('New password must be at least 6 characters.');

        setIsSubmitting(true);
        try {
            const res = await api.post('/api/users/change-password', { currentPassword, newPassword });
            setSuccess(res.data.message);
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        } catch (err) {
            setError(err.response?.data?.error || 'Password change failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div>
            <style>{`
                /* Form Layout */
                .security-container { max-width: 480px; }
                
                h2 { font-size: 24px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; }
                .info-text { color: #64748b; margin: 0 0 32px 0; font-size: 14px; }

                /* Form Group & Inputs */
                .form-group { margin-bottom: 20px; }
                .form-label { display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px; }
                
                .input-wrapper { position: relative; display: flex; align-items: center; }
                
                .form-input {
                    width: 100%; 
                    padding: 10px 12px; 
                    padding-right: 40px; /* Space for eye icon */
                    border: 1px solid #e2e8f0; 
                    border-radius: 6px;
                    font-size: 14px; 
                    color: #0f172a; 
                    transition: all 0.2s;
                    background: #fff;
                }
                .form-input:focus { 
                    outline: none; 
                    border-color: #059669; 
                    box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1); 
                }

                /* Toggle Button (Eye Icon) */
                .toggle-btn {
                    position: absolute;
                    right: 8px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: #94a3b8;
                    padding: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: color 0.2s;
                }
                .toggle-btn:hover { color: #475569; }

                /* Feedback Messages */
                .msg { padding: 12px 16px; border-radius: 6px; margin-bottom: 24px; font-size: 14px; font-weight: 500; display: flex; gap: 8px; align-items: center; }
                .msg-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
                .msg-error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }

                /* Buttons */
                .btn-primary { 
                    background: #059669; 
                    color: white; 
                    border: none; 
                    padding: 10px 24px; 
                    border-radius: 6px; 
                    font-size: 14px; 
                    font-weight: 600; 
                    cursor: pointer; 
                    transition: background 0.2s;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                }
                .btn-primary:hover { background: #047857; }
                .btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }
            `}</style>

            <div className="security-container">
                <h2>Change Password</h2>
                <p className="info-text">Update your password to keep your account secure.</p>
                
                {error && <div className="msg msg-error"><Icons.AlertCircle /> {error}</div>}
                {success && <div className="msg msg-success"><Icons.CheckCircle /> {success}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Current Password</label>
                        <div className="input-wrapper">
                            <input 
                                className="form-input" 
                                type={showCurrent ? "text" : "password"} 
                                value={currentPassword} 
                                onChange={e => setCurrentPassword(e.target.value)} 
                                required 
                                placeholder="Enter current password"
                            />
                            <button type="button" className="toggle-btn" onClick={() => setShowCurrent(!showCurrent)}>
                                {showCurrent ? <Icons.EyeOff /> : <Icons.Eye />}
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">New Password</label>
                        <div className="input-wrapper">
                            <input 
                                className="form-input" 
                                type={showNew ? "text" : "password"} 
                                value={newPassword} 
                                onChange={e => setNewPassword(e.target.value)} 
                                required 
                                minLength="6" 
                                placeholder="Min. 6 characters"
                            />
                            <button type="button" className="toggle-btn" onClick={() => setShowNew(!showNew)}>
                                {showNew ? <Icons.EyeOff /> : <Icons.Eye />}
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Confirm New Password</label>
                        <div className="input-wrapper">
                            <input 
                                className="form-input" 
                                type={showConfirm ? "text" : "password"} 
                                value={confirmPassword} 
                                onChange={e => setConfirmPassword(e.target.value)} 
                                required 
                                minLength="6" 
                                placeholder="Re-enter new password"
                            />
                            <button type="button" className="toggle-btn" onClick={() => setShowConfirm(!showConfirm)}>
                                {showConfirm ? <Icons.EyeOff /> : <Icons.Eye />}
                            </button>
                        </div>
                    </div>

                    <div style={{ marginTop: 32 }}>
                        <button type="submit" className="btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? 'Updating...' : 'Update Password'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const Icons = {
    Eye: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    EyeOff: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
    AlertCircle: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    CheckCircle: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
};

export default SecurityTab;