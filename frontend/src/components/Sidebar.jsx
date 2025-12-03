import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const location = useLocation();

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    // --- Logic to get User Name (Same as used previously) ---
    const getUserName = () => {
        // 1. Try getting from direct storage
        const storedUserName = localStorage.getItem('userName');
        if (storedUserName) return storedUserName;
        
        // 2. Fallback: Decode from token if available
        const token = localStorage.getItem('userToken');
        if (token) {
            try {
                if (token.split('.').length === 3) {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    return payload.userId || 'User';
                }
            } catch (e) {
                // ignore error
            }
        }
        return 'Admin User'; // Default fallback
    };

    const userName = getUserName();
    const userInitial = (userName && userName.charAt(0)) ? userName.charAt(0).toUpperCase() : 'A';

    // NOTE: Added party-enquiries route here
    const menuItems = [
        { id: 'home', title: 'Dashboard', path: '/', icon: 'home' },
        { id: 'payments', title: 'Payment Records', path: '/payments', icon: 'dollar' },
        { id: 'party-enquiries', title: 'Party Enquiries', path: '/party-enquiries', icon: 'file' },
        { id: 'settings', title: 'Settings', path: '/change-password', icon: 'cog' },
    ];

    // small helper to check active route (handles exact match, or root)
    const isActive = (path) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname === path;
    };

    return (
        <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            <style>{`
                :root {
                    --sidebar-bg: #0f172a;       /* Slate 900 */
                    --sidebar-text: #94a3b8;     /* Slate 400 */
                    --sidebar-hover: #1e293b;    /* Slate 800 */
                    --sidebar-active: #059669;   /* Emerald 600 */
                    --sidebar-active-text: #ffffff;
                    --sidebar-border: #1e293b;
                }

                .sidebar {
                    height: 100vh;
                    background-color: var(--sidebar-bg);
                    color: var(--sidebar-text);
                    width: 260px;
                    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    flex-direction: column;
                    border-right: 1px solid var(--sidebar-border);
                    position: sticky;
                    top: 0;
                    flex-shrink: 0;
                    z-index: 50;
                }

                .sidebar.collapsed {
                    width: 80px;
                }

                /* Header */
                .sidebar-header {
                    height: 72px; /* Match Topbar height */
                    min-height: 72px;
                    max-height: 72px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 20px;
                    border-bottom: 1px solid var(--sidebar-border);
                    flex-shrink: 0;
                }

                .sidebar-logo {
                    font-size: 20px;
                    font-weight: 800;
                    color: white;
                    letter-spacing: -0.5px;
                    margin: 0;
                    white-space: nowrap;
                    opacity: 1;
                    transition: opacity 0.2s;
                }

                .sidebar.collapsed .sidebar-logo {
                    display: none;
                }

                .toggle-btn {
                    background: transparent;
                    border: none;
                    color: var(--sidebar-text);
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }

                .toggle-btn:hover {
                    background-color: var(--sidebar-hover);
                    color: white;
                }

                /* Navigation */
                .sidebar-nav {
                    flex: 1;
                    padding: 20px 12px;
                    overflow-y: auto;
                }

                .sidebar-menu {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .sidebar-link {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    text-decoration: none;
                    color: var(--sidebar-text);
                    border-radius: 8px;
                    transition: all 0.2s ease;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    font-size: 14px;
                    font-weight: 500;
                    white-space: nowrap;
                    overflow: hidden;
                }

                .sidebar.collapsed .sidebar-link {
                    padding: 12px;
                    justify-content: center;
                }

                .sidebar-link:hover {
                    background-color: var(--sidebar-hover);
                    color: white;
                }

                .sidebar-link.active {
                    background-color: var(--sidebar-active);
                    color: var(--sidebar-active-text);
                    font-weight: 600;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                }

                .sidebar-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 24px;
                }

                .sidebar-text {
                    transition: opacity 0.2s;
                }
                
                .sidebar.collapsed .sidebar-text {
                    display: none;
                    opacity: 0;
                }

                /* Footer Profile Section */
                .sidebar-footer {
                    padding: 20px;
                    border-top: 1px solid var(--sidebar-border);
                }
                
                .user-profile-card {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    transition: all 0.2s;
                }
                
                .profile-avatar {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: #334155;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 14px;
                    border: 2px solid #1e293b;
                }
                
                .profile-info {
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .profile-name {
                    color: white;
                    font-size: 14px;
                    font-weight: 600;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .profile-sub {
                    color: #64748b;
                    font-size: 11px;
                    margin-top: 2px;
                }

                .sidebar.collapsed .user-profile-card {
                    justify-content: center;
                }
                .sidebar.collapsed .profile-info {
                    display: none;
                }
            `}</style>

            <div className="sidebar-header">
                {!isCollapsed && <h2 className="sidebar-logo">Murti</h2>}
                <button className="toggle-btn" onClick={toggleSidebar} aria-label="Toggle sidebar">
                    {isCollapsed ? <Icons.MenuOpen /> : <Icons.MenuClose />}
                </button>
            </div>
            
            <nav className="sidebar-nav">
                <ul className="sidebar-menu">
                    {menuItems.map((item) => (
                        <li key={item.id}>
                            <Link 
                                to={item.path} 
                                className={`sidebar-link ${isActive(item.path) ? 'active' : ''}`}
                                title={isCollapsed ? item.title : ''}
                            >
                                <span className="sidebar-icon">{getIcon(item.icon)}</span>
                                <span className="sidebar-text">{item.title}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* Dynamic Footer Area */}
            <div className="sidebar-footer">
                <div className="user-profile-card">
                    <div className="profile-avatar">
                        {userInitial}
                    </div>
                    {!isCollapsed && (
                        <div className="profile-info">
                            <span className="profile-name">{userName}</span>
                            <span className="profile-sub">View Profile</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- SVG Icon Components ---
const Icons = {
    MenuClose: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    MenuOpen: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
};

function getIcon(name) {
    const props = { width: "20", height: "20", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
    switch (name) {
        case 'home': return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
        case 'dollar': return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
        case 'file': return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
        case 'chart': return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
        case 'cog': return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
        default: return null;
    }
}

export default Sidebar;
