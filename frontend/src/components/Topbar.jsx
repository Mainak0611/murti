import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Topbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

    // --- Logic ---
    const handleLogout = () => {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        window.dispatchEvent(new Event('logout'));
        setIsLogoutModalOpen(false);
        navigate('/login');
    };

    const getPageTitle = () => {
        if (location.pathname === '/') return 'Dashboard';
        if (location.pathname.startsWith('/payments')) return 'Payment Records';
        if (location.pathname.startsWith('/reports')) return 'Reports';
        if (location.pathname.startsWith('/change-password')) return 'Settings';
        if (location.pathname.startsWith('/party-enquiries')) return 'Party Enquiries';
        if (location.pathname.startsWith('/item-master')) return 'Item Master';
        return 'Dashboard';
    };

    return (
        <>
            {/* Internal CSS */}
            <style>{`
                :root {
                    --topbar-h: 72px;
                    --text-main: #0f172a;
                    --text-muted: #64748b;
                    --border: #e2e8f0;
                    --primary: #059669;
                    --danger: #ef4444;
                }

                .topbar {
                    height: var(--topbar-h);
                    min-height: var(--topbar-h);
                    max-height: var(--topbar-h);
                    background: #ffffff;
                    border-bottom: 1px solid var(--border);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 32px;
                    position: sticky;
                    top: 0;
                    z-index: 40;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
                    flex-shrink: 0;
                }

                .topbar-left {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }

                .topbar-title {
                    font-size: 20px;
                    font-weight: 700;
                    color: var(--text-main);
                    margin: 0;
                }

                .topbar-right {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                /* Action Buttons */
                .icon-btn {
                    background: transparent;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    padding: 10px;
                    border-radius: 10px;
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.2s;
                }

                .icon-btn:hover {
                    background: #f1f5f9;
                    color: var(--text-main);
                }

                .icon-btn.logout:hover {
                    background: #fef2f2;
                    color: var(--danger);
                }

                /* Modal Styles */
                .modal-overlay {
                    position: fixed; inset: 0;
                    background: rgba(15, 23, 42, 0.6);
                    backdrop-filter: blur(4px);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 100;
                }

                .modal-box {
                    background: white;
                    padding: 32px;
                    border-radius: 16px;
                    width: 90%; max-width: 400px;
                    text-align: center;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                }

                .modal-icon {
                    font-size: 40px; margin-bottom: 16px; display: block;
                }

                .modal-actions {
                    display: flex; justify-content: center; gap: 12px; margin-top: 24px;
                }

                .btn-modal {
                    padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none;
                }
                .btn-cancel { background: white; border: 1px solid var(--border); color: var(--text-main); }
                .btn-cancel:hover { background: #f8fafc; }
                .btn-confirm { background: var(--danger); color: white; }
                .btn-confirm:hover { background: #dc2626; }

            `}</style>

            <div className="topbar">
                <div className="topbar-left">
                    {/* Only show Dashboard button if not on dashboard */}
                    {location.pathname !== '/' && (
                        <button className="icon-btn" onClick={() => navigate('/')} title="Back to Dashboard">
                            <Icons.ArrowLeft />
                        </button>
                    )}
                    <h1 className="topbar-title">{getPageTitle()}</h1>
                </div>
                
                <div className="topbar-right">
                    {/* User Profile removed from here */}
                    
                    <button className="icon-btn" onClick={() => navigate('/change-password')} title="Settings">
                        <Icons.Settings />
                    </button>
                    
                    <button className="icon-btn logout" onClick={() => setIsLogoutModalOpen(true)} title="Logout">
                        <Icons.LogOut />
                    </button>
                </div>
            </div>

            {/* Logout Modal */}
            {isLogoutModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-box">
                        <span className="modal-icon">👋</span>
                        <h2 style={{margin: '0 0 8px 0', fontSize: '20px', fontWeight: 700}}>Confirm Logout</h2>
                        <p style={{margin: 0, color: 'var(--text-muted)', fontSize: '14px'}}>
                            Are you sure you want to log out of your account?
                        </p>
                        <div className="modal-actions">
                            <button className="btn-modal btn-cancel" onClick={() => setIsLogoutModalOpen(false)}>
                                Cancel
                            </button>
                            <button className="btn-modal btn-confirm" onClick={handleLogout}>
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// --- Icons ---
const Icons = {
    Settings: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    LogOut: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    ArrowLeft: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
};

export default Topbar;