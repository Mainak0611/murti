import { useEffect, useState, useMemo } from "react";
import api from "../../lib/api";
import '../../styles/PaymentTracker.css';
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
  
  // 🛑 NEW STATE FOR DELETE CONFIRMATION MODAL 🛑
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Headers and Keys
  const ALL_HEADERS = [
    "ID", "Party", "Contact No", 
    "Status", 
    "Latest Date", 
    "Latest Remark", 
    "Action"
  ];
  
  const DATA_KEYS = [
    "id", "party", "contact_no", 
    "payment_status", 
    "latest_payment", 
    "latest_remark",       
    "Action"
  ];

  // Function to fetch payments
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

  // --- FILTERING LOGIC (useMemo for performance) ---
  const filteredPayments = useMemo(() => {
    let list = payments;
    
    // 1. Search Filter (by party or contact_no)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(p => 
        (p.party && String(p.party).toLowerCase().includes(term)) ||
        (p.contact_no && String(p.contact_no).toLowerCase().includes(term))
      );
    }

    // 2. Date Filter (by latest_payment)
    if (filterDate) {
      // Normalize filter date for comparison
      const filterDay = new Date(filterDate);
      filterDay.setHours(0, 0, 0, 0);

      list = list.filter(p => {
        if (!p.latest_payment) return false;
        
        // Normalize payment date for comparison
        const paymentDay = new Date(p.latest_payment);
        paymentDay.setHours(0, 0, 0, 0);
        
        // Compare timestamps
        return paymentDay.getTime() === filterDay.getTime();
      });
    }

    // 3. Sort by latest_payment (if sortOrder is not 'none')
    if (sortOrder !== 'none') {
      list = [...list].sort((a, b) => {
        const dateA = a.latest_payment;
        const dateB = b.latest_payment;
        
        // Records without dates always go to the bottom
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1; // a goes to bottom
        if (!dateB) return -1; // b goes to bottom
        
        const timeA = new Date(dateA).getTime();
        const timeB = new Date(dateB).getTime();
        
        if (sortOrder === 'asc') {
          return timeA - timeB; // Oldest first
        } else if (sortOrder === 'desc') {
          return timeB - timeA; // Newest first
        }
        return 0;
      });
    }

    return list;
  }, [payments, searchTerm, filterDate, sortOrder]); // Re-calculate only when these change


  // --- TRACKING MANAGEMENT FUNCTIONS ---

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
    setManagePaymentIndex(displayIndex); // Store the display index
    fetchTrackingHistory(paymentId);
    setNewRemark('');
    setNewDate('');
  };

  const closeManageModal = () => {
    setManagePaymentId(null);
    setManagePaymentIndex(null);
    setTrackingHistory([]);
  };
  
  // 🛑 FIX: handleAddTrackingEntry now sends date and remark separately. 
  // Assume backend uses `newDate` to update the main record's `latest_payment`.
  const handleAddTrackingEntry = async (e) => {
    e.preventDefault();
    if (!newDate) {
      alert("Please enter a date for the new entry.");
      return;
    }

    try {
      await api.post(`/api/payments/tracking/${managePaymentId}`, { 
        // 🛑 Sending newDate and newRemark separately 🛑
        entry_date: newDate, 
        remark: newRemark || null
      });
      // Refresh history and inputs
      await fetchTrackingHistory(managePaymentId); 
      setNewRemark('');
      setNewDate('');
      // Refresh main table to show updated LATEST DATE and LATEST REMARK
      fetchPayments(); 
    } catch (err) {
      console.error("Failed to add tracking entry:", err);
      alert("Failed to save entry.");
    }
  };
  
  // Function to update the main payment status from the history list 
  const handleUpdatePaymentStatus = async (newStatus) => {
    if (!newStatus || !managePaymentId) return;

    try {
        // Use the new dedicated PATCH route
        await api.patch(`/api/payments/${managePaymentId}/status`, { 
            newStatus: newStatus
        });
        
        // Refresh the main payments list to show the new status immediately
        fetchPayments(); 
    } catch (err) {
        console.error("Failed to update status:", err);
        alert("Failed to update payment status.");
    }
  };


  // --- HELPER FUNCTIONS ---

  // Function to determine if a row should be highlighted 
  const shouldHighlightRow = (latestPaymentDate) => {
    if (!latestPaymentDate) return false;
    
    const targetDate = new Date(latestPaymentDate);
    targetDate.setHours(0, 0, 0, 0); 
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    return targetDate.getTime() === today.getTime();
  };
  
  // File Upload and Delete functions
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setUploadMessage({ type: 'error', text: 'Please select a file first.' });
      return;
    }

    setUploadMessage({ type: 'info', text: 'Uploading and processing data...' });
    const formData = new FormData();
    formData.append('csvFile', file); 

    try {
      // Explicitly retrieve and send the Authorization token
      const token = localStorage.getItem('userToken');

      if (!token) {
        setUploadMessage({ type: 'error', text: 'Authentication token missing. Please log in.' });
        return; 
      }

      const res = await api.post("/api/payments/upload", formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}` // Send the token
        }
      });

      setUploadMessage({ type: 'success', text: res.data.message || 'Upload successful!' });
      setFile(null); 
      document.getElementById('file-input').value = null; 
      fetchPayments(); 
    } catch (err) {
      // Improved error message for unauthorized issues
      const msg = err.response?.status === 401 
        ? 'Upload failed: Your session expired or you are not logged in.'
        : err.response?.data?.error || 'Upload failed due to a server error.';

      console.error("Upload error:", err.response || err);
      setUploadMessage({ type: 'error', text: msg });
    }
  };

  // 🛑 NEW: Function to open delete modal 🛑
  const openDeleteModal = () => {
      setIsDeleteModalOpen(true);
  };
  
  // 🛑 NEW: Function to close delete modal 🛑
  const closeDeleteModal = () => {
      setIsDeleteModalOpen(false);
  };

  const handleDeleteAll = async () => {
    // 🛑 Execute deletion and close modal 🛑
    closeDeleteModal(); 

    setUploadMessage({ type: 'info', text: 'Deleting all records...' });
    try {
      const res = await api.delete("/api/payments"); 
      setUploadMessage({ type: 'success', text: res.data.message || 'All records deleted!' });
      fetchPayments(); 
    } catch (err) {
      const msg = err.response?.data?.error || 'Delete failed.';
      console.error("Delete error:", err);
      setUploadMessage({ type: 'error', text: msg });
    }
  };


  return (
    <div className="payment-container">
      <h1 className="payment-title">Payment Records</h1>
        
        {/* Upload & Delete Form */}
        <form onSubmit={handleUpload} className="upload-form">
          <input 
            id="file-input"
            type="file" 
            accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
            onChange={(e) => setFile(e.target.files[0])} 
            className="upload-input"
          />
          <button type="submit" disabled={!file || uploadMessage.type === 'info'} 
            className="upload-button"
          >
            {uploadMessage.type === 'info' ? 'Uploading...' : 'Upload File (.csv or .xlsx)'}
          </button>
          <button 
            type="button" 
            onClick={openDeleteModal} // 🛑 CALL NEW OPEN MODAL FUNCTION 🛑
            className="upload-button delete-button"
            disabled={uploadMessage.type === 'info'}
          >
            Delete All Records
          </button>
        </form>
        
        {/* MODIFIED: SEARCH AND FILTER CONTROLS */}
        <div className="filter-controls">
          <input
            type="text"
            placeholder="Search by Party or Contact No..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
          <button 
              onClick={() => setFilterDate('')} 
              className="upload-button"
              disabled={!filterDate}
          >
              Clear Date Filter
          </button>
          
          {/* Sort by Date Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label>Sort by Date:</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="none">Default (No Sort)</option>
              <option value="asc">Oldest First</option>
              <option value="desc">Newest First</option>
            </select>
          </div>
        </div>


        {/* Upload Message */}
        {uploadMessage.text && (
          <div className={`message ${uploadMessage.type}`}>
            {uploadMessage.text}
          </div>
        )}

        {/* Payment Table */}
        {loading ? (
          <p className="payment-loading">Loading payment records...</p>
        ) : payments.length === 0 ? (
          <p className="payment-loading">No payment records found. Upload a file to begin.</p>
        ) : (
          <div className="table-wrapper">
            <table className="payment-table">
              <thead>
                <tr>
                  {ALL_HEADERS.map((header, index) => (
                    <th key={index} className="table-th">{header}</th> 
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* RENDER filteredPayments INSTEAD OF payments */}
                {filteredPayments.map((p, index) => { 
                  const isEven = index % 2 === 1;
                  let rowClassName = isEven ? 'table-tr even' : 'table-tr';
                  
                  // Highlight logic uses the LATEST DATE fetched from the DB join
                  if (shouldHighlightRow(p.latest_payment)) {
                    rowClassName += ' highlight-row';
                  }

                  return (
                    <tr key={p.id} className={rowClassName}>
                      {DATA_KEYS.map((key) => {
                        
                        // 🛑 FIX: Intercept the ID column and display index + 1 🛑
                        if (key === 'id') {
                            return (
                                <td key={key} className="table-td">
                                    {index + 1} 
                                </td>
                            );
                        }
                        
                        // Status Column Rendering 
                        if (key === 'payment_status') {
                          const statusData = getStatusDisplay(p[key]);
                          return (
                              <td key={key} className="table-td" 
                                  style={{
                                      backgroundColor: statusData.bgColor,
                                      color: statusData.color || 'white', 
                                      fontWeight: '700',
                                      textAlign: 'center',
                                      padding: '16px 8px'
                                  }}
                              >
                                  {statusData.text}
                              </td>
                          );
                        }
                        
                        // Action button column
                        if (key === 'Action') {
                          return (
                            <td key={key} className="table-td action-cell">
                              <button onClick={() => openManageModal(p.id, index + 1)} className="manage-button">
                                Manage
                              </button>
                            </td>
                          );
                        }
                        
                        // Latest Date column - format for display (This is the column that needed the fix)
                        if (key === 'latest_payment') {
                          return (
                            <td key={key} className="table-td">
                              {/* This now correctly displays the date if the backend updates it */}
                              {formatDateForDisplay(p[key])}
                            </td>
                          );
                        }
                        
                        // Latest Remark column
                        if (key === 'latest_remark') {
                          return (
                            <td key={key} className="table-td">
                              {p[key] || 'None'}
                            </td>
                          );
                        }

                        // Render standard cells: Party, Contact No
                        return (
                          <td key={key} className="table-td">{p[key]}</td>
                        );
                      })}
                    </tr>
                  );
                })}
                {/* Display message if no results after filtering */}
                {filteredPayments.length === 0 && payments.length > 0 && (
                  <tr>
                      <td colSpan={ALL_HEADERS.length} className="table-td" style={{textAlign: 'center', fontWeight: '600', padding: '30px', fontSize: '15px', color: '#7f8c8d'}}>
                          No records match the current filters.
                      </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TRACKING MODAL */}
        {managePaymentId !== null && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Tracking History for Payment #{managePaymentIndex}</h2>
              <button className="modal-close" onClick={closeManageModal}>&times;</button>
              
              {/* Form to Add New Entry */}
              <form onSubmit={handleAddTrackingEntry} className="tracking-form">
                  <input 
                      type="date" 
                      value={newDate} 
                      onChange={(e) => setNewDate(e.target.value)} 
                      required // Date is required for a log entry
                  />
                  <input 
                      type="text" 
                      value={newRemark} 
                      onChange={(e) => setNewRemark(e.target.value)} 
                      placeholder="Enter Remark (Optional)" 
                  />
                  <button type="submit" className="upload-button">Add New Entry</button>
              </form>

              {/* History List */}
              <div className="history-list">
                  <h3>Current Status: <span style={{color: getStatusDisplay(payments.find(p => p.id === managePaymentId)?.payment_status || 'PENDING').color, fontWeight: 'bold'}}>{getStatusDisplay(payments.find(p => p.id === managePaymentId)?.payment_status || 'PENDING').text}</span></h3>
                  
                  {trackingHistory.length === 0 ? (
                      <p>No history found. Add the first date/remark above.</p>
                  ) : (
                      <ul>
                          {trackingHistory.map((entry) => (
                              <li key={entry.id}>
                                  <div>
                                      {entry.actual_payment && (
                                        <>
                                          <strong>Date:</strong> {formatDateForDisplay(entry.actual_payment)}
                                          <br />
                                        </>
                                      )}
                                      <strong>Remark:</strong> {entry.remark || 'No remark'}
                                      <br />
                                      <small>Logged on: {formatDateForDisplay(entry.created_at)}</small>
                                  </div>
                                  
                                  {/* Status Selector in History Item */}
                                  <select 
                                      onChange={(e) => handleUpdatePaymentStatus(e.target.value)}
                                      value={payments.find(p => p.id === managePaymentId)?.payment_status || 'PENDING'}
                                  >
                                      <option value="" disabled>Set Status</option>
                                      <option value="PARTIAL">Partial Payment Done</option>
                                      <option value="PAID">Full Payment Done</option>
                                      <option value="PENDING">Payment Not Done</option>
                                  </select>
                              </li>
                          ))}
                      </ul>
                  )}
              </div>
            </div>
          </div>
        )}
        
        {/* 🛑 DELETE CONFIRMATION MODAL 🛑 */}
        {isDeleteModalOpen && (
            <div className="modal-overlay">
                <div className="modal-content delete-modal">
                    <h2>⚠️ Confirm Deletion</h2>
                    <p>
                        Are you absolutely sure you want to DELETE ALL your payment records? 
                        <br />
                        This action cannot be undone.
                    </p>
                    <div className="modal-actions">
                        <button className="cancel-button" onClick={closeDeleteModal}>
                            Cancel
                        </button>
                        <button className="delete-confirm-button" onClick={handleDeleteAll}>
                            Yes, Delete All Records
                        </button>
                    </div>
                </div>
            </div>
        )}

      </div>
  );
}

export default PaymentTracker;