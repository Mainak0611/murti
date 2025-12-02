import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api"; // Ensure this path is correct

export default function HomePage() {
  // State for Stats
  const [stats, setStats] = useState([
    { id: 1, label: "Records (This Month)", value: "0" },
    { id: 2, label: "Pending (This Month)", value: "0" }, // Updated label
  ]);
  
  // State for "Due Today" and "Past Due" tables
  const [todaysPayments, setTodaysPayments] = useState([]);
  const [pastDuePayments, setPastDuePayments] = useState([]);
  
  const [loading, setLoading] = useState(true);

  // Robust helper to extract a YYYY-MM-DD string from incoming values
  const extractDateString = (val) => {
    if (!val) return null;
    if (val instanceof Date && !Number.isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const s = String(val).trim();
    const maybeDate = s.substring(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(maybeDate)) return maybeDate;
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return null;
  };

  // Fetch and Calculate Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get("/api/payments");
        let data = [];
        if (Array.isArray(res.data)) data = res.data;
        else if (Array.isArray(res.data?.data)) data = res.data.data;
        else if (res.data?.rows && Array.isArray(res.data.rows)) data = res.data.rows;
        else {
          const vals = Object.values(res.data || {});
          const arr = vals.find(v => Array.isArray(v));
          data = arr || [];
        }

        const now = new Date();
        
        // --- UPDATED LOGIC FOR CURRENT MONTH ---
        // Get full month name (e.g., "December") and Year (e.g., 2025)
        const currentMonthName = now.toLocaleString('default', { month: 'long' });
        const currentYear = now.getFullYear();

        // 1. Filter ALL records to get only this month's records
        const currentMonthRecords = data.filter(p => {
            // Ensure strict comparison for year, loose for month string
            return (
                p.month === currentMonthName && 
                Number(p.year) === currentYear
            );
        });
        
        // A. Total Records Count (This Month)
        const currentMonthCount = currentMonthRecords.length;

        // B. Pending Count (This Month)
        // We filter `currentMonthRecords` instead of `data`
        const pendingCount = currentMonthRecords.filter(p => {
          const s = (p.payment_status || "").toString().trim().toUpperCase();
          return s === 'PENDING';
        }).length;

        // 2. Build today's and past-due arrays (remains based on date comparison)
        const todayStr = extractDateString(now); // e.g. "2025-12-02"
        const dueToday = [];
        const pastDue = [];

        data.forEach(p => {
          const dateStr = extractDateString(p.latest_payment);
          if (!dateStr) return; 
          
          if (dateStr === todayStr) {
            dueToday.push(p);
          } else {
            const [y,m,d] = dateStr.split('-').map(Number);
            const dt = new Date(y, m - 1, d);
            const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (dt.getTime() < t.getTime()) {
              pastDue.push(p);
            }
          }
        });

        // Update States
        setStats([
          { id: 1, label: "Records (This Month)", value: currentMonthCount.toString() },
          { id: 2, label: "Pending (This Month)", value: pendingCount.toString() },
        ]);
        setTodaysPayments(dueToday);
        setPastDuePayments(pastDue);

      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const cards = [
    { id: "payments", title: "Payments", desc: "View & manage payments", icon: "dollar", to: "/payments" },
    { id: "settings", title: "Settings", desc: "Preferences", icon: "cog", to: "/change-password" },
  ];

  return (
    <div className="dashboard-container">
      {/* INTERNAL CSS */}
      <style>{`
        :root {
          --bg-body: #f8fafc;
          --bg-card: #ffffff;
          --text-main: #0f172a;
          --text-muted: #64748b;
          --primary: #059669;
          --primary-hover: #047857;
          --border: #e2e8f0;
        }

        .dashboard-container {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background-color: var(--bg-body);
          min-height: 100vh;
          color: var(--text-main);
          padding: 40px 24px;
          position: relative;
          overflow-y: auto;
        }

        .wrapper {
          width: 100%;
          max-width: none;
          margin: 0;
          position: relative;
          z-index: 1;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
          gap: 20px;
        }

        .header h1 {
          font-size: 32px;
          font-weight: 800;
          margin: 0 0 8px 0;
          letter-spacing: -0.02em;
        }

        .header p {
          color: var(--text-muted);
          margin: 0;
          font-size: 16px;
        }

        .btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 20px; border-radius: 8px;
          font-weight: 600; font-size: 14px; text-decoration: none;
          transition: all 0.2s ease; border: 1px solid transparent;
        }

        .btn-primary {
          background-color: var(--primary);
          color: white !important;
          box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);
        }
        
        .btn-primary:hover { 
            background-color: var(--primary-hover); 
            color: white !important;
            transform: translateY(-1px); 
            box-shadow: 0 4px 6px rgba(5, 150, 105, 0.3);
        }
        
        .btn-sm-outline {
            padding: 4px 12px; font-size: 12px; border: 1px solid var(--border); 
            background: white; color: var(--text-main); border-radius: 6px;
        }
        .btn-sm-outline:hover { background: #f8fafc; }

        .main-grid {
          display: grid; 
          grid-template-columns: 3fr 1fr;
          gap: 24px; 
          margin-bottom: 24px;
        }
        @media (max-width: 1024px) { .main-grid { grid-template-columns: 1fr; } }

        .card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          overflow: hidden;
        }

        .hero-content { display: flex; gap: 20px; }
        .hero-icon {
          width: 48px; height: 48px;
          background: linear-gradient(135deg, #10b981, #059669);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          color: white; flex-shrink: 0;
        }
        
        .stats-grid {
          display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 24px;
        }
        @media (max-width: 640px) { .stats-grid { grid-template-columns: 1fr; } }

        .stat-box {
          background: #f8fafc; border: 1px solid var(--border);
          padding: 16px; border-radius: 8px;
        }
        .stat-val { font-size: 20px; font-weight: 700; color: var(--text-main); }
        .stat-lbl { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }

        .action-list { display: flex; flex-direction: column; gap: 8px; }
        .action-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px; border-radius: 8px; text-decoration: none; transition: background 0.2s;
        }
        .action-item:hover { background-color: #f8fafc; }
        .action-item.disabled { opacity: 0.6; cursor: not-allowed; }
        
        .action-left { display: flex; align-items: center; gap: 12px; }
        .action-icon {
          width: 40px; height: 40px; background: #ecfdf5; color: var(--primary);
          border-radius: 8px; display: flex; align-items: center; justify-content: center;
        }
        .action-text h4 { margin: 0; font-size: 14px; font-weight: 600; color: var(--text-main); }
        .action-text p { margin: 0; font-size: 12px; color: var(--text-muted); }

        .two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-top: 16px;
        }
        @media (max-width: 900px) {
          .two-col { grid-template-columns: 1fr; }
        }

        .table-wrapper { 
            width: 100%; 
            margin-top: 12px;
            max-height: 520px; 
            overflow-y: auto;
            border: 1px solid var(--border);
            border-radius: 8px;
        }

        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        
        th { 
            text-align: left; 
            color: var(--text-muted); 
            font-size: 12px; 
            text-transform: uppercase; 
            padding: 12px 16px; 
            background: #f8fafc; 
            font-weight: 600;
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            z-index: 10;
        }

        td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; color: var(--text-main); vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        
        .status-pill {
            display: inline-block; padding: 3px 10px; border-radius: 20px;
            font-size: 11px; font-weight: 700; text-transform: uppercase;
        }
        .empty-state { text-align: center; padding: 40px; color: var(--text-muted); font-size: 14px; }
      `}</style>

      <div className="wrapper">
        {/* Header */}
        <header className="header">
          <div>
            <h1>Murti Dashboard</h1>
            <p>Payments made simple — clear, fast and secure tracking.</p>
          </div>
          <div className="header-actions">
            <Link to="/payments" className="btn btn-primary">
              <Icons.Plus /> New Payment
            </Link>
          </div>
        </header>

        {/* Top Section */}
        <div className="main-grid">
          {/* Overview Card */}
          <div className="card">
            <div className="hero-content">
              <div className="hero-icon">
                <Icons.Chart size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Performance Overview</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '4px 0 0 0' }}>
                  {loading ? 'Calculating data...' : 'Quick snapshot of your financial health.'}
                </p>
                
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

          {/* Quick Actions Sidebar */}
          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: '16px', margin: '0 0 16px 8px' }}>Quick Actions</h3>
            <div className="action-list">
              {cards.map((c) => (
                <Link key={c.id} to={c.to} className={`action-item ${c.soon ? 'disabled' : ''}`}>
                  <div className="action-left">
                    <div className="action-icon">{getIcon(c.icon)}</div>
                    <div className="action-text">
                      <h4>{c.title}</h4>
                      <p>{c.desc}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Icons.ChevronRight />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* --- NEW SECTION: DUE TODAY (left) & PAST DUE (right) --- */}
        <div className="card">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12}}>
            <div>
              <h3 style={{ fontSize: '18px', margin: 0, fontWeight: 700 }}>Due Today</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Records scheduled for {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {todaysPayments.length > 0 && (
                <span className="status-pill" style={{background: '#dbeafe', color: '#1e40af'}}>
                  {todaysPayments.length} Record{todaysPayments.length !== 1 ? 's' : ''}
                </span>
              )}
              {pastDuePayments.length > 0 && (
                <span className="status-pill" style={{background: '#fee2e2', color: '#991b1b'}}>
                  {pastDuePayments.length} Past Due
                </span>
              )}
            </div>
          </div>

          <div className="two-col">
            {/* Left: Due Today */}
            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Today</div>
              <div className="table-wrapper">
                {todaysPayments.length === 0 ? (
                  <div className="empty-state">No payments scheduled for today.</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Party</th>
                        <th>Contact</th>
                        <th>Remark</th>
                        <th>Status</th>
                        <th style={{textAlign: 'right'}}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todaysPayments.map(p => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 600 }}>{p.party}</td>
                          <td>{p.contact_no || '-'}</td>
                          <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-muted)' }}>
                            {p.latest_remark || '-'}
                          </td>
                          <td>
                            <span className="status-pill" style={{
                              backgroundColor: p.payment_status === 'PAID' ? '#d1fae5' : p.payment_status === 'PARTIAL' ? '#ffedd5' : '#fee2e2',
                              color: p.payment_status === 'PAID' ? '#065f46' : p.payment_status === 'PARTIAL' ? '#9a3412' : '#991b1b'
                            }}>
                              {p.payment_status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Link to="/payments" className="btn-sm-outline" style={{ textDecoration: 'none' }}>View</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Right: Past Due */}
            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Past Due</div>
              <div className="table-wrapper">
                {pastDuePayments.length === 0 ? (
                  <div className="empty-state">No past due records.</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Party</th>
                        <th>Contact</th>
                        <th>Latest Date</th>
                        <th>Status</th>
                        <th style={{textAlign: 'right'}}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pastDuePayments.map(p => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 600 }}>{p.party}</td>
                          <td>{p.contact_no || '-'}</td>
                          <td style={{ color: 'var(--text-muted)' }}>
                            { (p.latest_payment ? String(p.latest_payment).substring(0,10) : '-') }
                          </td>
                          <td>
                            <span className="status-pill" style={{
                              backgroundColor: p.payment_status === 'PAID' ? '#d1fae5' : p.payment_status === 'PARTIAL' ? '#ffedd5' : '#fee2e2',
                              color: p.payment_status === 'PAID' ? '#065f46' : p.payment_status === 'PARTIAL' ? '#9a3412' : '#991b1b'
                            }}>
                              {p.payment_status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Link to="/payments" className="btn-sm-outline" style={{ textDecoration: 'none' }}>View</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// --- Icons ---
const Icons = {
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  Chart: ({ size = 24 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22M17 5H9.5a3 3 0 0 0 0 6H14a3 3 0 0 1 0 6H7"/></svg>,
  ChevronRight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
};

function getIcon(name) {
  const props = { width: "20", height: "20", strokeWidth: 1.8 };
  switch (name) {
    case 'dollar': return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22M17 5H9.5a3 3 0 0 0 0 6H14a3 3 0 0 1 0 6H7"/></svg>;
    case 'file': return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
    case 'chart': return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
    case 'cog': return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    default: return null;
  }
}