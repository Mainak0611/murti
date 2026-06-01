import React, { useState } from 'react';
import Topbar from './Topbar';
import Sidebar from './Sidebar';

const Layout = ({ children }) => {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    return (
        <div className="app-layout">
            <style>{`
                :root {
                    --bg-body: #f8fafc;
                }
                .app-layout {
                    display: flex;
                    min-height: 100vh;
                    background-color: var(--bg-body);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }
                .main-layout {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    min-width: 0; /* Prevents flex items from overflowing */
                    height: 100vh;
                    overflow-y: auto; /* Allows the main content to scroll while sidebar stays sticky */
                }
                .main-content {
                    flex: 1;
                    /* Padding is handled by individual pages (HomePage/PaymentTracker) 
                       to allow full-width banners if needed */
                    position: relative;
                }

                /* Mobile sidebar backdrop */
                .sidebar-backdrop {
                    display: none;
                }

                @media (max-width: 768px) {
                    .sidebar-backdrop {
                        display: block;
                        position: fixed;
                        inset: 0;
                        background-color: rgba(15, 23, 42, 0.4);
                        backdrop-filter: blur(2px);
                        z-index: 45;
                    }
                }
            `}</style>

            {isMobileSidebarOpen && (
                <div 
                    className="sidebar-backdrop" 
                    onClick={() => setIsMobileSidebarOpen(false)}
                />
            )}

            <Sidebar isMobileOpen={isMobileSidebarOpen} setIsMobileOpen={setIsMobileSidebarOpen} />
            <div className="main-layout">
                <Topbar onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)} />
                <main className="main-content">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default Layout;