// frontend/src/modules/HomePage/HomePage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/HomePage.css';

const HomePage = () => {
    return (
        <div className="home-page">
            <div className="home-content">
                <div className="welcome-section">
                    <h1>Welcome to Murti Dashboard</h1>
                    <p>Your payment tracking and management system</p>
                </div>

                <div className="dashboard-cards">
                    <div className="dashboard-card">
                        <div className="card-icon">💰</div>
                        <h3>Payment Records</h3>
                        <p>Track and manage all your payment records</p>
                        <Link to="/payments" className="card-link">Go to Payments →</Link>
                    </div>

                    <div className="dashboard-card">
                        <div className="card-icon">📊</div>
                        <h3>Statistics</h3>
                        <p>View analytics and insights</p>
                        <span className="card-coming-soon">Coming Soon</span>
                    </div>

                    <div className="dashboard-card">
                        <div className="card-icon">📈</div>
                        <h3>Reports</h3>
                        <p>Generate and download reports</p>
                        <span className="card-coming-soon">Coming Soon</span>
                    </div>

                    <div className="dashboard-card">
                        <div className="card-icon">⚙️</div>
                        <h3>Settings</h3>
                        <p>Manage your account settings</p>
                        <Link to="/change-password" className="card-link">Change Password →</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
