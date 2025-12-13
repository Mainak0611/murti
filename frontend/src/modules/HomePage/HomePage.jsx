import React, { useEffect, useState } from "react";
import api from "../../lib/api"; // Ensure this path is correct

// Sub Components
import StatsOverview from "./StatsOverview";
import TodaysEnquiries from "./TodaysEnquiries"; 
import PaymentTables from "./PaymentTables";

// Styles
import "./HomePage.css";

export default function HomePage() {
  // --- State ---
  const [stats, setStats] = useState([
    { id: 1, label: "Records (This Month)", value: "0" },
    { id: 2, label: "Pending (This Month)", value: "0" },
  ]);
  
  const [todaysPayments, setTodaysPayments] = useState([]);
  const [pastDuePayments, setPastDuePayments] = useState([]);
  const [todaysEnquiries, setTodaysEnquiries] = useState([]); 
  const [loading, setLoading] = useState(true);

  // --- Helpers ---
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

  // --- Fetch Logic ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [paymentsRes, enquiriesRes] = await Promise.all([
            api.get("/api/payments"),
            api.get("/api/party-enquiries/parties")
        ]);

        let paymentData = [];
        if (Array.isArray(paymentsRes.data)) paymentData = paymentsRes.data;
        else if (Array.isArray(paymentsRes.data?.data)) paymentData = paymentsRes.data.data;
        else if (paymentsRes.data?.rows && Array.isArray(paymentsRes.data.rows)) paymentData = paymentsRes.data.rows;
        else {
          const vals = Object.values(paymentsRes.data || {});
          const arr = vals.find(v => Array.isArray(v));
          paymentData = arr || [];
        }

        const now = new Date();
        const currentMonthName = now.toLocaleString('default', { month: 'long' });
        const currentYear = now.getFullYear();
        const todayStr = extractDateString(now); 

        // Stats
        const currentMonthRecords = paymentData.filter(p => {
            return (p.month === currentMonthName && Number(p.year) === currentYear);
        });
        const currentMonthCount = currentMonthRecords.length;
        const pendingCount = currentMonthRecords.filter(p => {
          const s = (p.payment_status || "").toString().trim().toUpperCase();
          return s === 'PENDING';
        }).length;

        // Payments Table
        const dueToday = [];
        const pastDue = [];
        paymentData.forEach(p => {
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

        // Enquiries Table
        let enquiryData = [];
        if (Array.isArray(enquiriesRes.data)) enquiryData = enquiriesRes.data;
        else if (Array.isArray(enquiriesRes.data?.data)) enquiryData = enquiriesRes.data.data;

        const todaysEnqList = enquiryData.filter(e => {
            const eDate = extractDateString(e.enquiry_date);
            return eDate === todayStr;
        });

        setStats([
          { id: 1, label: "Records (This Month)", value: currentMonthCount.toString() },
          { id: 2, label: "Pending (This Month)", value: pendingCount.toString() },
        ]);
        setTodaysPayments(dueToday);
        setPastDuePayments(pastDue);
        setTodaysEnquiries(todaysEnqList);

      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="dashboard-container">
      <div className="wrapper">
        <header className="header">
          <div><h1>Murti Dashboard</h1></div>
          
        </header>

        <div className="main-grid">
          <StatsOverview stats={stats} loading={loading} />
          <TodaysEnquiries enquiries={todaysEnquiries} loading={loading} />
        </div>

        <PaymentTables 
          todaysPayments={todaysPayments} 
          pastDuePayments={pastDuePayments} 
        />
      </div>
    </div>
  );
}