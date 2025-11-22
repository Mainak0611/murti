import { useEffect, useState, useMemo } from "react";
import api from "../../lib/api";
// Removed external CSS import to use internal styled-system
import { 
    formatDateForDisplay, 
    getStatusDisplay 
} from "./PaymentUtils.js";

function PaymentTracker() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState({ type: null, text: '' });
  
  // State for search and filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState(''); 
  const [sortOrder, setSortOrder] = useState('none'); 
  
  // State for the tracking modal
  const [managePaymentId, setManagePaymentId] = useState(null);
  const [managePaymentIndex, setManagePaymentIndex] = useState(null);
  const [trackingHistory, setTrackingHistory] = useState([]);
  const [newRemark, setNewRemark] = useState('');
  const [newDate, setNewDate] = useState('');
  
  // Delete Confirmation Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Headers and Keys
  const ALL_HEADERS = ["ID", "Party", "Contact No", "Status", "Latest Date", "Latest Remark", "Action"];
  const DATA_KEYS = ["id", "party", "contact_no", "payment_status", "latest_payment", "latest_remark", "Action"];

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

  // --- FILTERING LOGIC ---
  const filteredPayments = useMemo(() => {
    let list = payments;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(p => 
        (p.party && String(p.party).toLowerCase().includes(term)) ||
        (p.contact_no && String(p.contact_no).toLowerCase().includes(term))
      );
    }

    if (filterDate) {
      const filterDay = new Date(filterDate);
      filterDay.setHours(0, 0, 0, 0);

      list = list.filter(p => {
        if (!p.latest_payment) return false;
        const paymentDay = new Date(p.latest_payment);
        paymentDay.setHours(0, 0, 0, 0);
        return paymentDay.getTime() === filterDay.getTime();
      });
    }

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
  }, [payments, searchTerm, filterDate, sortOrder]);

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
      setNewRemark('');
      setNewDate('');
      fetchPayments(); 
    } catch (err) {
      console.error("Failed to add tracking entry:", err);
      alert("Failed to save entry.");
    }
  };
  
  const handleUpdatePaymentStatus = async (newStatus) => {
    if (!newStatus || !managePaymentId) return;
    try {
        await api.patch(`/api/payments/${managePaymentId}/status`, { newStatus: newStatus });
        fetchPayments(); 
    } catch (err) {
        console.error("Failed to update status:", err);
        alert("Failed to update payment status.");
    }
  };

  // --- HELPER FUNCTIONS ---
  const shouldHighlightRow = (latestPaymentDate) => {
    if (!latestPaymentDate) return false;
    const targetDate = new Date(latestPaymentDate);
    targetDate.setHours(0, 0, 0, 0); 
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    return targetDate.getTime() === today.getTime();
  };
  
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setUploadMessage({ type: 'error', text: 'Please select a file first.' });
      return;
    }
    setUploadMessage({ type: 'info', text: 'Uploading...' });
    const formData = new FormData();
    formData.append('csvFile', file); 

    try {
      const token = localStorage.getItem('userToken');
      if (!token) {
        setUploadMessage({ type: 'error', text: 'Authentication token missing.' });
        return; 
      }
      const res = await api.post("/api/payments/upload", formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${token}` }
      });
      setUploadMessage({ type: 'success', text: res.data.message || 'Upload successful!' });
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
    setUploadMessage({ type: 'info', text: 'Deleting all records...' });
    try {
      const res = await api.delete("/api/payments"); 
      setUploadMessage({ type: 'success', text: res.data.message || 'All records deleted!' });
      fetchPayments(); 
    } catch (err) {
      const msg = err.response?.data?.error || 'Delete failed.';
      setUploadMessage({ type: 'error', text: msg });
    }
  };

  return (
    <div className="dashboard-container">
      {/* --- INTERNAL CSS FOR PROFESSIONAL DASHBOARD LOOK --- */}
      <style>{`
        :root {
          --bg-body: #f8fafc;
          --bg-card: #ffffff;
          --text-main: #0f172a;
          --text-muted: #64748b;
          --primary: #059669;
          --primary-hover: #047857;
          --danger: #ef4444;
          --danger-hover: #dc2626;
          --border: #e2e8f0;
          --highlight-bg: #f0fdf4;
          --highlight-border: #bbf7d0;
        }
        .dashboard-container {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background-color: var(--bg-body);
          min-height: 100vh;
          padding: 40px 20px;
          color: var(--text-main);
        }
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .page-title {
          font-size: 28px;
          font-weight: 800;
          color: var(--text-main);
          margin: 0;
        }
        
        /* Card Styling */
        .card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        
        /* Upload Section */
        .upload-area {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .file-input {
          padding: 8px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: #f8fafc;
          font-size: 14px;
        }
        
        /* Buttons */
        .btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 16px; border-radius: 8px;
          font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s;
        }
        .btn-primary { background: var(--primary); color: white; }
        .btn-primary:hover { background: var(--primary-hover); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        
        .btn-danger { background: #fff1f2; color: var(--danger); border: 1px solid #fecdd3; }
        .btn-danger:hover { background: #fee2e2; }

        .btn-outline { background: white; border: 1px solid var(--border); color: var(--text-main); }
        .btn-outline:hover { background: #f8fafc; }
        
        /* Filters */
        .filter-bar {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          align-items: end;
        }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-label { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
        .form-input, .form-select {
          padding: 10px; border: 1px solid var(--border); border-radius: 6px;
          font-size: 14px; width: 100%;
        }
        .form-input:focus { outline: 2px solid var(--primary); border-color: transparent; }

        /* Messages */
        .alert { padding: 12px; border-radius: 6px; font-size: 14px; margin-bottom: 16px; font-weight: 500; }
        .alert.info { background: #eff6ff; color: #1d4ed8; border: 1px solid #dbeafe; }
        .alert.success { background: #ecfdf5; color: #047857; border: 1px solid #d1fae5; }
        .alert.error { background: #fef2f2; color: #b91c1c; border: 1px solid #fee2e2; }

        /* Table */
        .table-container { overflow-x: auto; border-radius: 8px; border: 1px solid var(--border); }
        .data-table { width: 100%; border-collapse: collapse; font-size: 14px; text-align: left; }
        .data-table th { 
          background: #f8fafc; color: var(--text-muted); 
          font-weight: 600; padding: 12px 16px; 
          text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;
          border-bottom: 1px solid var(--border);
        }
        .data-table td { padding: 14px 16px; border-bottom: 1px solid var(--border); color: var(--text-main); }
        .data-table tr:last-child td { border-bottom: none; }
        .data-table tr:hover { background: #f8fafc; }
        
        .highlight-row { background-color: var(--highlight-bg) !important; }
        .highlight-row td { font-weight: 500; color: #064e3b; }

        /* Status Pills */
        .status-pill {
          display: inline-block; padding: 4px 10px; border-radius: 20px;
          font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
        }

        /* Modal */
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px);
          display: flex; justify-content: center; align-items: center; z-index: 1000;
        }
        .modal-content {
          background: white; padding: 32px; border-radius: 16px;
          width: 90%; max-width: 600px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          position: relative;
        }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .modal-title { font-size: 20px; font-weight: 700; margin: 0; }
        .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted); }
        
        .tracking-form { display: flex; gap: 12px; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
        .history-list { max-height: 300px; overflow-y: auto; }
        .history-item { 
          padding: 12px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 12px;
          display: flex; justify-content: space-between; align-items: flex-start;
        }
        .history-meta { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
        .history-remark { font-weight: 500; color: var(--text-main); }
        
        /* Delete Modal Specifics */
        .delete-content { text-align: center; max-width: 400px; }
        .warning-icon { font-size: 48px; margin-bottom: 16px; display: block; }
        .delete-actions { display: flex; justify-content: center; gap: 12px; margin-top: 24px; }
      `}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">Payment Records</h1>
          <p style={{color: 'var(--text-muted)', margin: '4px 0 0'}}>Manage, track and update all transaction records.</p>
        </div>
      </div>

      {/* --- ACTION CARD: Upload & Global Actions --- */}
      <div className="card">
        <form onSubmit={handleUpload} className="upload-area">
          <div style={{flex: 1, display: 'flex', gap: '12px', alignItems: 'center'}}>
            <label className="form-label">Import Data</label>
            <input 
              id="file-input"
              type="file" 
              accept=".csv, .xlsx" 
              onChange={(e) => setFile(e.target.files[0])} 
              className="file-input"
            />
            <button type="submit" disabled={!file || uploadMessage.type === 'info'} className="btn btn-primary">
              <Icons.Upload /> {uploadMessage.type === 'info' ? 'Processing...' : 'Upload File'}
            </button>
          </div>
          
          <button type="button" onClick={() => setIsDeleteModalOpen(true)} className="btn btn-danger">
            <Icons.Trash /> Delete All Records
          </button>
        </form>

        {uploadMessage.text && (
          <div className={`alert ${uploadMessage.type}`} style={{marginTop: '16px', marginBottom: 0}}>
            {uploadMessage.text}
          </div>
        )}
      </div>

      {/* --- FILTER CARD --- */}
      <div className="card">
        <div className="filter-bar">
          <div className="form-group">
            <label className="form-label">Search</label>
            <div style={{position: 'relative'}}>
              <input
                type="text"
                className="form-input"
                placeholder="Party Name or Contact..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{paddingLeft: '32px'}}
              />
              <span style={{position: 'absolute', left: '10px', top: '10px', color: '#94a3b8'}}><Icons.Search /></span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Filter by Date</label>
            <input
              type="date"
              className="form-input"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Sort Order</label>
            <select
              className="form-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="none">Default (No Sort)</option>
              <option value="asc">Oldest First</option>
              <option value="desc">Newest First</option>
            </select>
          </div>

          {filterDate && (
            <button onClick={() => setFilterDate('')} className="btn btn-outline">
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* --- TABLE CARD --- */}
      <div className="card" style={{padding: 0, overflow: 'hidden'}}>
        {loading ? (
          <div style={{padding: '40px', textAlign: 'center', color: 'var(--text-muted)'}}>Loading records...</div>
        ) : payments.length === 0 ? (
          <div style={{padding: '40px', textAlign: 'center', color: 'var(--text-muted)'}}>
            No payment records found. Upload a file to begin.
          </div>
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
                {filteredPayments.map((p, index) => { 
                  const isHighlighted = shouldHighlightRow(p.latest_payment);
                  
                  return (
                    <tr key={p.id} className={isHighlighted ? 'highlight-row' : ''}>
                      {DATA_KEYS.map((key) => {
                        // Index Column
                        if (key === 'id') return <td key={key} style={{color: 'var(--text-muted)'}}>#{index + 1}</td>;
                        
                        // Status Column - Styled as Pill
                        if (key === 'payment_status') {
                          const statusData = getStatusDisplay(p[key]);
                          return (
                            <td key={key}>
                              <span 
                                className="status-pill"
                                style={{ 
                                  backgroundColor: statusData.bgColor, 
                                  color: statusData.color || 'white',
                                  opacity: 0.9
                                }}
                              >
                                {statusData.text}
                              </span>
                            </td>
                          );
                        }
                        
                        // Action Column
                        if (key === 'Action') {
                          return (
                            <td key={key}>
                              <button onClick={() => openManageModal(p.id, index + 1)} className="btn btn-outline" style={{padding: '6px 12px', fontSize: '12px'}}>
                                Manage
                              </button>
                            </td>
                          );
                        }
                        
                        // Date Column
                        if (key === 'latest_payment') return <td key={key}>{formatDateForDisplay(p[key])}</td>;
                        
                        // Remark Column
                        if (key === 'latest_remark') return <td key={key} style={{maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{p[key] || '-'}</td>;

                        // Standard Columns
                        return <td key={key}>{p[key]}</td>;
                      })}
                    </tr>
                  );
                })}
                {filteredPayments.length === 0 && payments.length > 0 && (
                  <tr>
                    <td colSpan={ALL_HEADERS.length} style={{textAlign: 'center', padding: '30px', color: 'var(--text-muted)'}}>
                      No records match the current search/filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- TRACKING MODAL --- */}
      {managePaymentId !== null && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title">Update History <span style={{fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8em'}}>#{managePaymentIndex}</span></h2>
              <button className="modal-close" onClick={closeManageModal}>&times;</button>
            </div>
            
            {/* Add New Entry Form */}
            <form onSubmit={handleAddTrackingEntry} className="tracking-form">
              <div style={{flex: 1}}>
                <input 
                  type="date" 
                  value={newDate} 
                  onChange={(e) => setNewDate(e.target.value)} 
                  className="form-input"
                  required 
                />
              </div>
              <div style={{flex: 2}}>
                <input 
                  type="text" 
                  value={newRemark} 
                  onChange={(e) => setNewRemark(e.target.value)} 
                  placeholder="Enter Remark (Optional)"
                  className="form-input" 
                />
              </div>
              <button type="submit" className="btn btn-primary"><Icons.Plus /></button>
            </form>

            {/* History List */}
            <div className="history-list">
              <div style={{marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <span style={{fontSize: '14px', fontWeight: 600}}>Status:</span>
                <select 
                  className="form-select" 
                  style={{width: 'auto', padding: '4px 8px'}}
                  onChange={(e) => handleUpdatePaymentStatus(e.target.value)}
                  value={payments.find(p => p.id === managePaymentId)?.payment_status || 'PENDING'}
                >
                  <option value="PENDING">Pending</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="PAID">Paid</option>
                </select>
              </div>
              
              {trackingHistory.length === 0 ? (
                <p style={{textAlign: 'center', color: 'var(--text-muted)', padding: '20px'}}>No history found.</p>
              ) : (
                trackingHistory.map((entry) => (
                  <div key={entry.id} className="history-item">
                    <div>
                      <div className="history-remark">{entry.remark || 'No remark'}</div>
                      <div className="history-meta">
                        Entry Date: {entry.actual_payment ? formatDateForDisplay(entry.actual_payment) : 'N/A'}
                      </div>
                    </div>
                    <div style={{fontSize: '11px', color: 'var(--text-muted)'}}>
                      Logged: {formatDateForDisplay(entry.created_at)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* --- DELETE CONFIRMATION MODAL --- */}
      {isDeleteModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content delete-content">
            <span className="warning-icon">⚠️</span>
            <h2 className="modal-title" style={{marginBottom: '12px'}}>Confirm Deletion</h2>
            <p style={{color: 'var(--text-muted)', lineHeight: 1.5}}>
              Are you absolutely sure you want to <strong>DELETE ALL</strong> records? <br/>
              This action cannot be undone.
            </p>
            <div className="delete-actions">
              <button className="btn btn-outline" onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteAll}>
                Yes, Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Icons Components (Simple SVG) ---
const Icons = {
  Upload: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Trash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
};

export default PaymentTracker;