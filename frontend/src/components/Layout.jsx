import React from 'react';
import Topbar from './Topbar';
import Sidebar from './Sidebar';

const Layout = ({ children }) => {
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
            `}</style>

            <Sidebar />
            <div className="main-layout">
                <Topbar />
                <main className="main-content">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default Layout;