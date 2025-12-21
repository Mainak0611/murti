// frontend/src/pages/settings/SettingsPage.jsx
import React, { useState, useLayoutEffect } from 'react';
import SecurityTab from './ChangePasswordPage'; 
import AccessControlTab from './AccessControl'; 
import EmployeeTab from './EmployeeTab'; 

const SettingsPage = () => {
    // --- 1. GET USER ROLE ---
    const getUserRole = () => {
        const token = localStorage.getItem('userToken');
        if (token) {
            try {
                const parts = token.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(atob(parts[1]));
                    return payload.role || 'employee';
                }
            } catch (e) { 
                console.error("Error decoding token", e);
            }
        }
        return 'employee';
    };

    const role = getUserRole();
    const isSuperAdmin = role === 'super_admin';

    // --- 2. SET DEFAULT TAB ---
    // If user is NOT super admin, default them to 'security' immediately
    const [activeTab, setActiveTab] = useState(isSuperAdmin ? 'employees' : 'security');

    return (
        <div className="settings-page-container">
            <style>{`
                /* --- GLOBAL VARIABLES --- */
                :root {
                    --bg-card: #ffffff; --text-main: #0f172a; --text-muted: #64748b;
                    --border: #e2e8f0; --primary: #059669; --primary-hover: #047857;
                    --danger: #ef4444; --success: #10b981; --bg-input: #f8fafc;
                    --bg-body: #f8fafc;
                }

                /* --- MAIN CONTAINER LAYOUT --- */
                .settings-page-container {
                    width: 100%;
                    height: calc(100vh - 80px); /* Adjusted for typical header height */
                    padding: 24px;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    background-color: var(--bg-body);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }

                /* --- SETTINGS CARD --- */
                .settings-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                    display: flex;
                    flex: 1; /* Fills remaining height */
                    overflow: hidden; /* Contains the sidebar/content scroll areas */
                }

                /* --- SIDEBAR --- */
                .settings-sidebar {
                    width: 260px;
                    background: #f8fafc;
                    border-right: 1px solid var(--border);
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    flex-shrink: 0;
                }

                /* --- CONTENT AREA --- */
                .settings-content {
                    flex: 1;
                    padding: 32px 40px;
                    overflow-y: auto; /* Independent scrolling for content */
                    background: white;
                    position: relative;
                }

                /* --- TAB BUTTONS --- */
                .settings-tab-btn {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    width: 100%;
                    padding: 12px 16px;
                    border: none;
                    border-radius: 8px;
                    background: transparent;
                    color: var(--text-muted);
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    text-align: left;
                    transition: all 0.2s ease;
                }
                .settings-tab-btn:hover {
                    background: #e2e8f0;
                    color: var(--text-main);
                }
                .settings-tab-btn.active {
                    background: #ecfdf5; /* Light green background */
                    color: var(--primary);
                }
                .tab-icon {
                    width: 20px;
                    height: 20px;
                    stroke-width: 2px;
                }

                /* --- MOBILE RESPONSIVE --- */
                @media (max-width: 768px) {
                    .settings-page-container { height: auto; padding: 10px; }
                    .settings-card { flex-direction: column; height: auto; overflow: visible; }
                    .settings-sidebar { width: 100%; border-right: none; border-bottom: 1px solid var(--border); padding: 16px; flex-direction: row; overflow-x: auto; }
                    .settings-content { padding: 20px; overflow: visible; }
                    .settings-tab-btn { justify-content: center; }
                    .tab-icon { margin: 0; }
                }
            `}</style>

            <div className="settings-card">
                {/* SIDEBAR TABS */}
                <div className="settings-sidebar">
                    {/* Only Super Admin sees Employees */}
                    {isSuperAdmin && (
                        <button 
                            className={`settings-tab-btn ${activeTab === 'employees' ? 'active' : ''}`}
                            onClick={() => setActiveTab('employees')}
                        >
                            <Icons.UserPlus className="tab-icon" /> 
                            <span className="hidden md:inline">Employees</span>
                        </button>
                    )}

                    {/* Only Super Admin sees Team Access */}
                    {isSuperAdmin && (
                        <button 
                            className={`settings-tab-btn ${activeTab === 'access' ? 'active' : ''}`}
                            onClick={() => setActiveTab('access')}
                        >
                            <Icons.Users className="tab-icon" /> 
                            <span className="hidden md:inline">Team Access</span>
                        </button>
                    )}

                    {/* Everyone sees Security (Change Password) */}
                    <button 
                        className={`settings-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
                        onClick={() => setActiveTab('security')}
                    >
                        <Icons.Lock className="tab-icon" /> 
                        <span className="hidden md:inline">Security</span>
                    </button>
                </div>

                {/* CONTENT AREA */}
                <div className="settings-content">
                    {isSuperAdmin && activeTab === 'employees' && <EmployeeTab />}
                    {isSuperAdmin && activeTab === 'access' && <AccessControlTab />}
                    {activeTab === 'security' && <SecurityTab />}
                </div>
            </div>
        </div>
    );
};

// --- ICONS COMPONENT ---
const Icons = {
    Lock: (props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    Users: (props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    UserPlus: (props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
};

export default SettingsPage;