import { useEffect, useState, useMemo } from "react";
import api from "../../lib/api";
import { 
    formatDateForDisplay, 
    getStatusDisplay 
} from "./PaymentUtils.js";

function PaymentTracker() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState({ type: null, text: '' });
  
  // --- FILTER STATES ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('ALL'); // NEW: Month Filter
  const [filterStatus, setFilterStatus] = useState('ALL'); 
  const [sortOrder, setSortOrder] = useState('none'); 
  
  // State for the tracking modal
  const [managePaymentId, setManagePaymentId] = useState(null);
  const [managePaymentIndex, setManagePaymentIndex] = useState(null);
  const [trackingHistory, setTrackingHistory] = useState([]);
  const [newRemark, setNewRemark] = useState('');
  const [newDate, setNewDate] = useState('');
  
  // Delete Confirmation Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Headers and Keys - UPDATED with Month/Year
  const ALL_HEADERS = ["ID", "Party", "Month", "Year", "Contact", "Status", "Dates", "Last Activity", "Remark", "Action"];
  const DATA_KEYS = ["id", "party", "month", "year", "contact_no", "payment_status", "date_count", "latest_payment", "latest_remark", "Action"];

  // Fetch payments
  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/payments");
      setPayments(res.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  // --- DERIVE AVAILABLE MONTHS FOR DROPDOWN ---
  const availableMonths = useMemo(() => {
    const unique = new Set();
    payments.forEach(p => {
      if(p.month && p.year) {
        unique.add(`${p.month} ${p.year}`);
      }
    });
    return Array.from(unique);
  }, [payments]);

  // --- FILTERING LOGIC ---
  const filteredPayments = useMemo(() => {
    let list = payments;
    
    // 1. Search Term Filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(p => 
        (p.party && String(p.party).toLowerCase().includes(term)) ||
        (p.contact_no && String(p.contact_no).toLowerCase().includes(term))
      );
    }

    // 2. Month Filter (NEW)
    if (filterMonth !== 'ALL') {
      list = list.filter(p => `${p.month} ${p.year}` === filterMonth);
    }

    // 3. Status Filter
    if (filterStatus !== 'ALL') {
      list = list.filter(p => p.payment_status === filterStatus);
    }

    // 4. Manual Sorting Override (Backend already does basic sort)
    if (sortOrder !== 'none') {
      list = [...list].sort((a, b) => {
        const dateA = a.latest_payment;
        const dateB = b.latest_payment;
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1; 
        if (!dateB) return -1; 
        
        const timeA = new Date(dateA).getTime();
        const timeB = new Date(dateB).getTime();
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      });
    }
    return list;
  }, [payments, searchTerm, filterMonth, filterStatus, sortOrder]);

  // --- TRACKING MANAGEMENT ---
  const fetchTrackingHistory = async (paymentId) => {
    try {
      const res = await api.get(`/api/payments/tracking/${paymentId}`);
      setTrackingHistory(res.data);
    } catch (err) {
      console.error("Failed to fetch tracking history:", err);
    }
  };

  const openManageModal = (paymentId, displayIndex) => {
    setManagePaymentId(paymentId);
    setManagePaymentIndex(displayIndex); 
    fetchTrackingHistory(paymentId);
    setNewRemark('');
    setNewDate('');
  };

  const closeManageModal = () => {
    setManagePaymentId(null);
    setManagePaymentIndex(null);
    setTrackingHistory([]);
  };
  
  const handleAddTrackingEntry = async (e) => {
    e.preventDefault();
    if (!newDate) {
      alert("Please enter a date for the new entry.");
      return;
    }
    try {
      await api.post(`/api/payments/tracking/${managePaymentId}`, { 
        entry_date: newDate, 
        remark: newRemark || null
      });
      
      await fetchTrackingHistory(managePaymentId); 
      fetchPayments(); 
      
      setNewRemark('');
      setNewDate('');
    } catch (err) {
      console.error("Failed to add tracking entry:", err);
      alert("Failed to save entry.");
    }
  };
  
  const handleUpdatePaymentStatus = async (newStatus) => {
    if (!newStatus || !managePaymentId) return;
    try {
        await api.patch(`/api/payments/${managePaymentId}/status`, { newStatus: newStatus });
        
        setPayments(prev => prev.map(p => 
            p.id === managePaymentId ? { ...p, payment_status: newStatus } : p
        ));

        fetchPayments(); 
    } catch (err) {
        console.error("Failed to update status:", err);
        alert("Failed to update payment status.");
    }
  };

  // --- HELPER FUNCTIONS ---
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setUploadMessage({ type: 'error', text: 'Please select a file first.' });
      return;
    }
    setUploadMessage({ type: 'info', text: 'Uploading & creating monthly reminders...' });
    const formData = new FormData();
    formData.append('csvFile', file); 

    try {
      const token = localStorage.getItem('userToken');
      if (!token) return; 
      
      const res = await api.post("/api/payments/upload", formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${token}` }
      });
      setUploadMessage({ type: 'success', text: res.data.message });
      setFile(null); 
      document.getElementById('file-input').value = null; 
      fetchPayments(); 
    } catch (err) {
      const msg = err.response?.data?.error || 'Upload failed.';
      setUploadMessage({ type: 'error', text: msg });
    }
  };

  const handleDeleteAll = async () => {
    setIsDeleteModalOpen(false);
    setUploadMessage({ type: 'info', text: 'Deleting all history...' });
    try {
      const res = await api.delete("/api/payments"); 
      setUploadMessage({ type: 'success', text: res.data.message });
      fetchPayments(); 
    } catch (err) {
      const msg = err.response?.data?.error || 'Delete failed.';
      setUploadMessage({ type: 'error', text: msg });
    }
  };
  
  const clearAllFilters = () => {
    setSearchTerm('');
    setFilterMonth('ALL');
    setFilterStatus('ALL');
  };

  return (
    <div className="dashboard-container">
      <style>{`
        :root {
          --bg-body: #f8fafc;
          --bg-card: #ffffff;
          --text-main: #0f172a;
          --text-muted: #64748b;
          --primary: #059669;
          --primary-hover: #047857;
          --danger: #ef4444;
          --border: #e2e8f0;
          --highlight-bg: #d1fae5;
        }
        .dashboard-container {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background-color: var(--bg-body);
          min-height: 100vh;
          padding: 40px 20px;
          color: var(--text-main);
        }
        .page-title { font-size: 32px; font-weight: 800; margin-bottom: 24px; }
        .card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .upload-area { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .file-input { padding: 8px; border: 1px solid var(--border); border-radius: 6px; background: #f8fafc; }
        .btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; border: none;
        }
        .btn-primary { background: var(--primary); color: white; }
        .btn-danger { background: #fff1f2; color: var(--danger); border: 1px solid #fecdd3; }
        .btn-outline { background: white; border: 1px solid var(--border); color: var(--text-main); }
        
        .filter-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; align-items: end; }
        .form-label { font-size: 13px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
        .form-input, .form-select { padding: 10px; border: 1px solid var(--border); border-radius: 6px; width: 100%; }
        
        .table-container { overflow-x: auto; border-radius: 8px; border: 1px solid var(--border); }
        .data-table { width: 100%; border-collapse: collapse; font-size: 15px; text-align: left; }
        .data-table th { background: #f8fafc; color: var(--text-muted); font-weight: 600; padding: 12px 16px; font-size: 12px; text-transform: uppercase; }
        .data-table td { padding: 8px 16px; border-bottom: 1px solid var(--border); }
        .status-pill { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
        
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; }
        .modal-content { background: white; padding: 32px; border-radius: 16px; width: 90%; max-width: 600px; }
      `}</style>

      <h1 className="page-title">Payment Reminders</h1>

      {/* --- UPLOAD SECTION --- */}
      <div className="card">
        <form onSubmit={handleUpload} className="upload-area">
          <div style={{flex: 1, display: 'flex', gap: '12px', alignItems: 'center'}}>
            <label className="form-label">New Month Sheet</label>
            <input 
              id="file-input"
              type="file" 
              accept=".csv, .xlsx" 
              onChange={(e) => setFile(e.target.files[0])} 
              className="file-input"
            />
            <button type="submit" disabled={!file || uploadMessage.type === 'info'} className="btn btn-primary">
              <Icons.Upload /> {uploadMessage.type === 'info' ? 'Processing...' : 'Upload & Append'}
            </button>
          </div>
          
          <button type="button" onClick={() => setIsDeleteModalOpen(true)} className="btn btn-danger">
            <Icons.Trash /> Clear All History
          </button>
        </form>

        {uploadMessage.text && (
          <div style={{
            marginTop: '16px', padding: '12px', borderRadius: '6px', fontSize: '14px',
            background: uploadMessage.type === 'error' ? '#fef2f2' : '#ecfdf5',
            color: uploadMessage.type === 'error' ? '#b91c1c' : '#047857'
          }}>
            {uploadMessage.text}
          </div>
        )}
      </div>

      {/* --- FILTER SECTION --- */}
      <div className="card">
        <div className="filter-bar">
          <div className="form-group">
            <label className="form-label">Search Party</label>
            <input
              type="text"
              className="form-input"
              placeholder="Name or Contact..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* NEW MONTH FILTER */}
          <div className="form-group">
            <label className="form-label">Filter Month</label>
            <select
              className="form-select"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            >
              <option value="ALL">All Months (Show Carry Forward)</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Only</option>
              <option value="PAID">Paid Only</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Sort</label>
            <select
              className="form-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="none">Default (Pending First)</option>
              <option value="asc">Last Payment (Oldest)</option>
              <option value="desc">Last Payment (Newest)</option>
            </select>
          </div>
        </div>
      </div>

      {/* --- TABLE SECTION --- */}
      <div className="card" style={{padding: 0, overflow: 'hidden'}}>
        {loading ? (
          <div style={{padding: '40px', textAlign: 'center'}}>Loading...</div>
        ) : (
          <div className="table-container" style={{border: 'none', borderRadius: 0}}>
            <table className="data-table">
              <thead>
                <tr>
                  {ALL_HEADERS.map((header, index) => (
                    <th key={index}>{header}</th> 
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p, index) => (
                  <tr key={p.id}>
                    {DATA_KEYS.map((key) => {
                      if (key === 'id') return <td key={key} style={{color: '#94a3b8'}}>#{index + 1}</td>;
                      
                      // Month & Year Columns
                      if (key === 'month') return <td key={key} style={{fontWeight: 500}}>{p.month}</td>;
                      if (key === 'year') return <td key={key} style={{color: '#64748b'}}>{p.year}</td>;

                      if (key === 'payment_status') {
                        const statusData = getStatusDisplay(p[key]);
                        return (
                          <td key={key}>
                            <span className="status-pill" style={{backgroundColor: statusData.bgColor, color: statusData.color}}>
                              {statusData.text}
                            </span>
                          </td>
                        );
                      }
                      
                      if (key === 'Action') {
                        return (
                          <td key={key}>
                            <button onClick={() => openManageModal(p.id, index + 1)} className="btn btn-outline" style={{padding: '4px 12px', fontSize: '12px'}}>
                              Manage
                            </button>
                          </td>
                        );
                      }
                      
                      if (key === 'latest_payment') return <td key={key}>{formatDateForDisplay(p[key])}</td>;
                      if (key === 'latest_remark') return <td key={key} style={{maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{p[key] || '-'}</td>;

                      return <td key={key}>{p[key]}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- TRACKING MODAL (Same as before) --- */}
      {managePaymentId !== null && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
              <h2>Manage Payment</h2>
              <button onClick={closeManageModal} style={{background:'none', border:'none', fontSize:'24px', cursor:'pointer'}}>&times;</button>
            </div>
            
            <form onSubmit={handleAddTrackingEntry} style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="form-input" required />
              <input type="text" value={newRemark} onChange={(e) => setNewRemark(e.target.value)} placeholder="Remark" className="form-input" />
              <button type="submit" className="btn btn-primary"><Icons.Plus /></button>
            </form>

            <div style={{marginBottom:'20px'}}>
               <label className="form-label" style={{marginBottom:'8px', display:'block'}}>Mark Status</label>
               <div style={{display:'flex', gap:'10px'}}>
                  {['PENDING', 'PARTIAL', 'PAID'].map(status => (
                    <button 
                      key={status}
                      type="button"
                      onClick={() => handleUpdatePaymentStatus(status)}
                      className="btn"
                      style={{
                        flex: 1,
                        background: payments.find(p => p.id === managePaymentId)?.payment_status === status ? '#0f172a' : '#f1f5f9',
                        color: payments.find(p => p.id === managePaymentId)?.payment_status === status ? 'white' : 'black'
                      }}
                    >
                      {status}
                    </button>
                  ))}
               </div>
            </div>

            <div style={{maxHeight:'200px', overflowY:'auto', borderTop:'1px solid #e2e8f0', paddingTop:'10px'}}>
              {trackingHistory.map((entry) => (
                <div key={entry.id} style={{padding:'8px', borderBottom:'1px solid #f1f5f9'}}>
                  <div style={{fontWeight:500}}>{entry.remark || 'Update'}</div>
                  <div style={{fontSize:'12px', color:'#64748b'}}>
                     Date: {formatDateForDisplay(entry.actual_payment)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* --- DELETE CONFIRM MODAL --- */}
      {isDeleteModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{textAlign:'center', maxWidth:'400px'}}>
            <h2 style={{color: '#ef4444'}}>Warning</h2>
            <p>This will permanently delete ALL payment history for all months.</p>
            <div style={{display:'flex', gap:'10px', justifyContent:'center', marginTop:'20px'}}>
              <button className="btn btn-outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteAll}>Confirm Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Icons = {
  Upload: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Trash: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Plus: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
};

export default PaymentTracker;