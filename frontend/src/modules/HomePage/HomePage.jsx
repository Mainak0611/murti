import React, { useEffect, useState } from "react";
import api from "../../lib/api"; 

// Sub Components
import StatsOverview from "./StatsOverview";
import TodaysEnquiries from "./TodaysEnquiries"; 
import PaymentTables from "./PaymentTables";

// Styles
import "./HomePage.css";

// --- 1. Helper to try Local Storage first (Optimization) ---
const getStoredUser = () => {
    try {
        const potentialKeys = ['userInfo', 'user', 'userData', 'profile'];
        for (const key of potentialKeys) {
            const stored = localStorage.getItem(key);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Return if it looks like a user object
                if (parsed.role || parsed.permissions) return parsed;
                if (parsed.user && parsed.user.role) return parsed.user;
            }
        }
    } catch (e) { return null; }
    return null;
};

export default function HomePage() {
  // --- STATE ---
  const [user, setUser] = useState(getStoredUser()); // Initialize with storage if available
  const [loading, setLoading] = useState(true);
  
  // Dashboard Data State
  const [stats, setStats] = useState([]);
  const [todaysPayments, setTodaysPayments] = useState([]);
  const [pastDuePayments, setPastDuePayments] = useState([]);
  const [todaysEnquiries, setTodaysEnquiries] = useState([]); 

  // --- DERIVED PERMISSIONS ---
  const perms = user?.permissions || [];
  const role = user?.role || '';

  const showPayments = role === 'super_admin' || perms.includes('payment_records');
  const salesModules = ['party_enquiries', 'confirmed_orders', 'returns_module'];
  const showEnquiries = role === 'super_admin' || perms.some(p => salesModules.includes(p));
  
  const isSingleCol = (showPayments && !showEnquiries) || (!showPayments && showEnquiries);

  // --- HELPERS ---
  const extractDateString = (val) => {
    if (!val) return null;
    const date = new Date(val);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  };

  // --- MAIN EFFECT ---
  useEffect(() => {
    const initDashboard = async () => {
      setLoading(true);
      try {
        // 1. FETCH USER (If not already loaded from storage)
        let currentUser = user;
        if (!currentUser) {
            // Call the new backend route
            try {
                const { data } = await api.get('/api/users/me');
                currentUser = data;
                setUser(currentUser); // Update state
            } catch (err) {
                console.error("Critical: Could not load user profile.", err);
                setLoading(false);
                return; // Stop here if we can't identify the user
            }
        }

        // Recalculate permissions with the fresh user object
        const currentPerms = currentUser.permissions || [];
        const currentRole = currentUser.role || '';
        
        const canViewPay = currentRole === 'super_admin' || currentPerms.includes('payment_records');
        const canViewEnq = currentRole === 'super_admin' || currentPerms.some(p => salesModules.includes(p));

        const now = new Date();
        const todayStr = extractDateString(now); 

        // 2. FETCH DASHBOARD DATA (Parallel)
        const promises = [];
        
        if (canViewPay) promises.push(api.get("/api/payments"));
        if (canViewEnq) promises.push(api.get("/api/party-enquiries/parties"));

        const results = await Promise.allSettled(promises);
        
        // Extract Results safely
        let payData = [];
        let enqData = [];

        // If both were requested, results[0] is payments, results[1] is enquiries.
        // If only one was requested, results[0] is that one.
        let resultIndex = 0;

        if (canViewPay) {
            if (results[resultIndex]?.status === 'fulfilled') {
                const res = results[resultIndex].value;
                // Normalize data structure
                if (Array.isArray(res.data)) payData = res.data;
                else if (Array.isArray(res.data?.data)) payData = res.data.data;
                else if (res.data?.rows) payData = res.data.rows;
                else {
                    const vals = Object.values(res.data || {});
                    payData = vals.find(v => Array.isArray(v)) || [];
                }
            }
            resultIndex++;
        }

        if (canViewEnq) {
            if (results[resultIndex]?.status === 'fulfilled') {
                const res = results[resultIndex].value;
                // Normalize data structure
                if (Array.isArray(res.data)) enqData = res.data;
                else if (Array.isArray(res.data?.data)) enqData = res.data.data;
            }
        }

        // 3. PROCESS DATA
        if (canViewPay) {
            const currentMonthName = now.toLocaleString('default', { month: 'long' });
            const currentYear = now.getFullYear();

            const currentMonthRecords = payData.filter(p => p.month === currentMonthName && Number(p.year) === currentYear);
            const pendingCount = currentMonthRecords.filter(p => (p.payment_status || "").toString().toUpperCase() === 'PENDING').length;

            const dueToday = [];
            const pastDue = [];
            
            payData.forEach(p => {
                const dStr = extractDateString(p.latest_payment);
                if (!dStr) return;
                
                if (dStr === todayStr) dueToday.push(p);
                else if (new Date(dStr) < new Date(todayStr)) pastDue.push(p);
            });

            setStats([
                { id: 1, label: "Records (This Month)", value: String(currentMonthRecords.length) },
                { id: 2, label: "Pending (This Month)", value: String(pendingCount) },
            ]);
            setTodaysPayments(dueToday);
            setPastDuePayments(pastDue);
        }

        if (canViewEnq) {
            const todaysEnqList = enqData.filter(e => extractDateString(e.enquiry_date) === todayStr);
            setTodaysEnquiries(todaysEnqList);
        }

      } catch (err) {
        console.error("Dashboard Error:", err);
      } finally {
        setLoading(false);
      }
    };

    initDashboard();
  }, []); // Run once on mount

  // --- RENDER ---
  if (loading && !user) return <div className="dashboard-container"><div className="wrapper">Loading User Profile...</div></div>;

  return (
    <div className="dashboard-container">
      <div className="wrapper">
        <header className="header">
          <div><h1>Murti Dashboard</h1></div>
        </header>

        {(!showPayments && !showEnquiries) ? (
             <div className="empty-state">
                <h3>Welcome!</h3>
                <p>No dashboard widgets are enabled for your role.</p>
            </div>
        ) : (
            <>
                <div className={`main-grid ${isSingleCol ? 'single-col' : ''}`}>
                  {showPayments && <StatsOverview stats={stats} loading={loading} />}
                  {showEnquiries && <TodaysEnquiries enquiries={todaysEnquiries} loading={loading} />}
                </div>

                {showPayments && (
                    <PaymentTables 
                      todaysPayments={todaysPayments} 
                      pastDuePayments={pastDuePayments} 
                    />
                )}
            </>
        )}
      </div>
    </div>
  );
}