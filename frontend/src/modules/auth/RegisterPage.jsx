import React, { useState } from 'react';
import api from '../../lib/api';
import { Link } from 'react-router-dom';

const RegisterPage = () => {
    const [userId, setUserId] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        try {
            const res = await api.post('/api/users/register', { userId, email, password });
            
            localStorage.setItem('userToken', res.data.token);
            localStorage.setItem('userId', res.data.userId);
            localStorage.setItem('userName', userId); 
            
            setMessage(res.data.message || 'Registration successful! Logging you in...');
            
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
            
        } catch (err) {
            console.error('Registration error:', err);
            const errorMsg = err.response?.data?.error || err.message || 'Registration failed.';
            setError(errorMsg);
        }
    };

    return (
        <div className="auth-page">
            <style>{`
                :root {
                    --primary: #059669;
                    --primary-hover: #047857;
                    --text-main: #0f172a;
                    --text-muted: #64748b;
                    --bg-input: #f8fafc;
                    --border: #e2e8f0;
                    --danger: #ef4444;
                    --success: #10b981;
                }

                .auth-page {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: radial-gradient(circle at 50% -20%, #f0fdf4 0%, #f1f5f9 100%);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    padding: 20px;
                }

                .auth-card {
                    background: white;
                    width: 100%;
                    max-width: 420px;
                    padding: 40px;
                    border-radius: 16px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.05);
                    border: 1px solid white;
                }

                .auth-header {
                    text-align: center;
                    margin-bottom: 32px;
                }

                .auth-header h2 {
                    font-size: 26px;
                    font-weight: 800;
                    color: var(--text-main);
                    margin: 0 0 8px 0;
                }

                .auth-header p {
                    color: var(--text-muted);
                    font-size: 14px;
                    margin: 0;
                }

                .auth-form {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .input-group {
                    position: relative;
                }

                .input-icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-muted);
                    pointer-events: none;
                }

                .auth-input {
                    width: 100%;
                    padding: 12px 12px 12px 40px; /* Left padding for icon */
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    background: var(--bg-input);
                    font-size: 14px;
                    color: var(--text-main);
                    transition: all 0.2s;
                    box-sizing: border-box;
                }

                .auth-input:focus {
                    outline: none;
                    border-color: var(--primary);
                    background: white;
                    box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
                }

                .auth-btn {
                    background: var(--primary);
                    color: white;
                    padding: 12px;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s;
                    margin-top: 8px;
                }

                .auth-btn:hover {
                    background: var(--primary-hover);
                }

                .alert {
                    padding: 12px;
                    border-radius: 8px;
                    font-size: 13px;
                    margin-top: 16px;
                    text-align: center;
                }
                .alert.error { background: #fef2f2; color: var(--danger); border: 1px solid #fecaca; }
                .alert.success { background: #ecfdf5; color: var(--success); border: 1px solid #a7f3d0; }

                .auth-footer {
                    margin-top: 24px;
                    text-align: center;
                    font-size: 14px;
                    color: var(--text-muted);
                }

                .auth-link {
                    color: var(--primary);
                    text-decoration: none;
                    font-weight: 600;
                }

                .auth-link:hover {
                    text-decoration: underline;
                }
            `}</style>

            <div className="auth-card">
                <div className="auth-header">
                    <h2>Create Account</h2>
                    <p>Get started with Murti Dashboard</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="input-group">
                        <span className="input-icon"><Icons.User /></span>
                        <input 
                            className="auth-input"
                            type="text" 
                            placeholder="User ID" 
                            value={userId} 
                            onChange={(e) => setUserId(e.target.value)} 
                            required 
                        />
                    </div>
                    
                    <div className="input-group">
                        <span className="input-icon"><Icons.Mail /></span>
                        <input 
                            className="auth-input"
                            type="email" 
                            placeholder="Email Address" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            required 
                        />
                    </div>

                    <div className="input-group">
                        <span className="input-icon"><Icons.Lock /></span>
                        <input 
                            className="auth-input"
                            type="password" 
                            placeholder="Password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                        />
                    </div>

                    <button type="submit" className="auth-btn">Create Account</button>
                </form>

                {message && <div className="alert success">{message}</div>}
                {error && <div className="alert error">{error}</div>}
                
                <div className="auth-footer">
                    Already have an account? <Link to="/login" className="auth-link">Login here</Link>
                </div>
            </div>
        </div>
    );
};

// Icons
const Icons = {
    User: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    Mail: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
    Lock: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
};

export default RegisterPage;