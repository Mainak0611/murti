// frontend/src/components/Sidebar.jsx
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/Sidebar.css';

const Sidebar = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const location = useLocation();

    const menuItems = [
        {
            id: 1,
            title: 'Payment Records',
            path: '/payments',
            icon: '💰'
        },
        // Add more modules here in the future
        // {
        //     id: 2,
        //     title: 'Reports',
        //     path: '/reports',
        //     icon: '📊'
        // },
    ];

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    return (
        <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
                {!isCollapsed && <h2 className="sidebar-logo">Murti</h2>}
                <button className="toggle-btn" onClick={toggleSidebar}>
                    {isCollapsed ? '☰' : '✕'}
                </button>
            </div>
            
            <nav className="sidebar-nav">
                <ul className="sidebar-menu">
                    {menuItems.map((item) => (
                        <li key={item.id} className="sidebar-item">
                            <Link 
                                to={item.path} 
                                className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
                                title={item.title}
                            >
                                <span className="sidebar-icon">{item.icon}</span>
                                {!isCollapsed && <span className="sidebar-text">{item.title}</span>}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>
        </div>
    );
};

export default Sidebar;
