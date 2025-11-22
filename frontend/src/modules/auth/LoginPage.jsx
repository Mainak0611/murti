import React, { useState } from 'react';
import api from '../../lib/api';
import { Link } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const LoginPage = () => {
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/api/users/login', { userId, password });
            localStorage.setItem('userToken', res.data.token);
            localStorage.setItem('userId', res.data.userId);
            localStorage.setItem('userName', res.data.userName);
            toast.success('Login successful! Redirecting...');
            setTimeout(() => { window.location.href = '/'; }, 1000);
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Login failed.';
            toast.error(errorMsg);
        }
    };

    return (
        <div className="auth-layout">
            <ToastContainer position="top-right" theme="light" />
            
            {/* SHARED AUTH CSS */}
            <style>{`
                :root {
                    --bg-body: #f8fafc;
                    --bg-card: #ffffff;
                    --text-main: #0f172a;
                    --text-muted: #64748b;
                    --border: #e2e8f0;
                    --primary: #059669;
                    --primary-hover: #047857;
                }

                .auth-layout {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background-color: var(--bg-body);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    padding: 20px;
                    position: relative;
                }

                /* Background Decoration */
                .auth-layout::before {
                    content: ''; position: absolute; width: 100%; height: 100%;
                    background: radial-gradient(circle at 50% 0%, rgba(5, 150, 105, 0.05) 0%, transparent 500px);
                    pointer-events: none;
                }

                .auth-card {
                    background: var(--bg-card);
                    width: 100%;
                    max-width: 400px;
                    padding: 40px;
                    border-radius: 24px;
                    border: 1px solid var(--border);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    position: relative;
                    z-index: 1;
                }

                .brand-header { text-align: center; margin-bottom: 32px; }
                .brand-title { font-size: 28px; font-weight: 800; color: var(--text-main); margin: 0; letter-spacing: -0.5px; }
                .brand-subtitle { font-size: 14px; color: var(--text-muted); margin-top: 8px; }

                .form-group { margin-bottom: 20px; }
                .form-input {
                    width: 100%; padding: 12px 16px; border: 1px solid var(--border); border-radius: 12px;
                    font-size: 15px; color: var(--text-main); background: #f8fafc;
                    transition: all 0.2s; box-sizing: border-box;
                }
                .form-input:focus {
                    outline: none; border-color: var(--primary); background: white;
                    box-shadow: 0 0 0 4px rgba(5, 150, 105, 0.1);
                }

                .btn-submit {
                    width: 100%; padding: 14px; background: var(--primary); color: white;
                    border: none; border-radius: 12px; font-weight: 600; font-size: 15px;
                    cursor: pointer; margin-top: 10px; transition: background 0.2s;
                }
                .btn-submit:hover { background: var(--primary-hover); }

                .auth-footer { margin-top: 24px; text-align: center; font-size: 14px; color: var(--text-muted); display: flex; flex-direction: column; gap: 12px; }
                .auth-link { color: var(--primary); text-decoration: none; font-weight: 600; }
                .auth-link:hover { text-decoration: underline; }
            `}</style>

            <div className="auth-card">
                <div className="brand-header">
                    <h1 className="brand-title">Murti</h1>
                    <p className="brand-subtitle">Welcome back! Please login.</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <input 
                            className="form-input"
                            type="text" 
                            placeholder="User ID" 
                            value={userId} 
                            onChange={(e) => setUserId(e.target.value)} 
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <input 
                            className="form-input"
                            type="password" 
                            placeholder="Password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                        />
                    </div>
                    <button type="submit" className="btn-submit">Sign In</button>
                </form>
                
                <div className="auth-footer">
                    <div><Link to="/forgot-password" class="auth-link">Forgot Password?</Link></div>
                    <div>Don't have an account? <Link to="/register" className="auth-link">Create one</Link></div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;