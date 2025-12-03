import React from 'react';
import { Icons } from './DashboardIcons';

export default function StatsOverview({ stats, loading }) {
  return (
    <div className="card">
      <div className="hero-content">
        <div className="hero-icon">
          <Icons.Chart size={24} />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Performance Overview</h2>
         
          
          <div className="stats-grid">
            {stats.map((s) => (
              <div key={s.id} className="stat-box">
                <div className="stat-val">{s.value}</div>
                <div className="stat-lbl">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}