// frontend/src/modules/OrdersIndex.jsx
import React, { useEffect, useState, useMemo } from 'react';
import api from '../../lib/api';

const OrdersIndex = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // --- MODAL STATE ---
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dispatchForm, setDispatchForm] = useState([]); 
  const [isSaving, setIsSaving] = useState(false);

  // --- FILTER & SORT STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  // --- HELPERS ---
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  // --- DATA FETCHING ---
  const fetchOrders = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await api.get('/api/orders'); 
      const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setOrders(data);
    } catch (err) {
      console.error("Fetch error:", err);
      showToast("Failed to load orders", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(); 
  }, []);

  // --- FILTER LOGIC ---
  const filteredData = useMemo(() => {
    let result = [...orders];

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(item =>
        (item.party_name && item.party_name.toLowerCase().includes(lowerTerm)) ||
        (item.reference && item.reference.toLowerCase().includes(lowerTerm))
      );
    }

    result.sort((a, b) => {
      const dateA = new Date(a.order_date || 0).getTime();
      const dateB = new Date(b.order_date || 0).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    return result;
  }, [orders, searchTerm, sortOrder]);

  // --- MODAL & DISPATCH LOGIC ---
  
  const handleRowClick = async (order) => {
    setSelectedOrder(order);
    
    try {
        const res = await api.get(`/api/orders/${order.id}`);
        const fullOrder = res.data.data;
        
        setSelectedOrder(fullOrder);
        
        if (fullOrder.items) {
            setDispatchForm(fullOrder.items.map(item => ({
                id: item.id, 
                item_name: item.item_name,
                size: item.size,
                ordered_quantity: item.ordered_quantity,
                prev_dispatched: item.dispatched_quantity || 0,
                available_stock: item.current_stock || 0,
                current_dispatch: 0 
            })));
        }
    } catch (err) {
        console.error("Error fetching order details", err);
        showToast("Failed to fetch order details", "error");
    }
  };

  const handleDispatchChange = (index, value) => {
    const updated = [...dispatchForm];
    const val = value === '' ? '' : parseInt(value);
    
    // LOGIC CORRECTION: Compare CURRENT input vs AVAILABLE stock
    const currentItem = updated[index];
    const qtyToSend = val || 0;
    
    if (qtyToSend > currentItem.available_stock) {
        showToast(`Quantity (${qtyToSend}) exceeds available stock (${currentItem.available_stock})!`, 'error');
    }

    updated[index].current_dispatch = val;
    setDispatchForm(updated);
  };

  // VALIDATION: Check if ANY item input exceeds available stock
  const isFormInvalid = useMemo(() => {
    return dispatchForm.some(item => {
      const qty = parseInt(item.current_dispatch) || 0;
      // LOGIC CORRECTION: Direct comparison
      return qty > item.available_stock;
    });
  }, [dispatchForm]);

  const handleSaveDispatch = async () => {
    // Safety check
    if (isFormInvalid) {
        showToast("Cannot save: One or more items exceed available stock.", "error");
        return;
    }

    setIsSaving(true);
    try {
        const payload = {
            items: dispatchForm.map(i => ({
                id: i.id, 
                // Backend expects the TOTAL dispatched count (Old + New)
                dispatched_quantity: i.prev_dispatched + (parseInt(i.current_dispatch) || 0)
            }))
        };
        
        await api.put(`/api/orders/${selectedOrder.id}/dispatch`, payload);
        
        showToast("Dispatch details updated successfully", "success");
        setSelectedOrder(null); 
        fetchOrders(true); 
    } catch (err) {
        console.error(err);
        showToast("Failed to save dispatch details", "error");
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* GLOBAL STYLES */}
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
          --row-hover: #f1f5f9;
        }

        .dashboard-container {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background-color: var(--bg-body);
          min-height: 100vh;
          padding: 40px 20px;
          padding-bottom: 100px;
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

        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-label { font-size: 13px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
        .form-input { padding: 10px; border: 1px solid var(--border); border-radius: 6px; width: 100%; font-size: 14px; }
        .form-input:focus { outline: 2px solid var(--primary); border-color: transparent; }

        .btn { padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; white-space: nowrap; }
        .btn-primary { background: var(--primary); color: white; }
        .btn-primary:hover { background: var(--primary-hover); }
        /* Disabled state styling */
        .btn-primary:disabled { background: #cbd5e1; color: #64748b; cursor: not-allowed; opacity: 1; }
        
        .btn-secondary { background: #f1f5f9; color: var(--text-muted); border: 1px solid var(--border); }

        .table-container { overflow-x: auto; border-radius: 8px; border: none; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 15px; text-align: left; }
        .data-table th { background: #f8fafc; color: var(--text-muted); font-weight: 600; padding: 12px 16px; font-size: 12px; text-transform: uppercase; }
        .data-table td { padding: 8px 16px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background-color 0.2s; }
        .data-table tbody tr:hover { background-color: var(--row-hover); }

        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);
          z-index: 3000; display: flex; align-items: center; justify-content: center;
        }
        .large-modal {
            background: white; width: 950px; max-width: 95%; max-height: 90vh;
            overflow-y: auto; border-radius: 12px; padding: 24px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            animation: popIn 0.2s ease-out;
        }
        
        .view-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        .view-value-box {
          background: white; border: 1px solid #e2e8f0; border-radius: 6px;
          padding: 10px 12px; font-size: 14px; font-weight: 500; color: #334155;
          min-height: 42px; display: flex; align-items: center;
        }

        .items-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
        .items-table th { text-align: left; background: #f8fafc; padding: 8px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 12px; text-transform: uppercase; }
        .items-table td { border-bottom: 1px solid #e2e8f0; padding: 8px; color: #334155; vertical-align: middle; }

        .dispatch-input {
            width: 80px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; 
            text-align: center; font-weight: 600;
        }
        .dispatch-input:focus { outline: 2px solid var(--primary); border-color: transparent; }
        
        /* Error state for input */
        .dispatch-input.error {
            border-color: #ef4444;
            background-color: #fef2f2;
            color: #b91c1c;
        }
        .dispatch-input.error:focus { outline: 2px solid #ef4444; }

        .error-text {
            font-size: 10px; color: #ef4444; display: block; margin-top: 4px; font-weight: 600;
        }

        .stock-tag { padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: 600; background: #e2e8f0; color: #475569; }
        .stock-low { background: #fee2e2; color: #991b1b; }

        .toast-notification { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 8px; color: white; font-weight: 600; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 4000; animation: slideIn 0.3s ease-out; }
        .toast-success { background-color: var(--primary); }
        .toast-error { background-color: var(--danger); }
        @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slideIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      <div style={{width: '100%', margin: '0 auto'}}>
        <h1 className="page-title">Confirmed Orders</h1>

        <div className="card">
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', alignItems: 'end'}}>
            <div className="form-group">
              <label className="form-label">Search</label>
              <input type="text" className="form-input" placeholder="Party Name or Reference" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Sort Date</label>
              <select className="form-input" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
            <div className="form-group"></div>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Party Name</th>
                  <th>Order Date</th>
                  <th>Status</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" style={{textAlign:'center', padding: '40px'}}>Loading...</td></tr>
                ) : filteredData.length === 0 ? (
                  <tr><td colSpan="5" style={{textAlign:'center', padding: '40px', color: '#94a3b8'}}>No confirmed orders found.</td></tr>
                ) : (
                  filteredData.map((order, index) => {
                    // --- ID LOGIC (Counts based on sort order) ---
                    const displayId = sortOrder === 'asc' 
                        ? filteredData.length - index 
                        : index + 1;

                    return (
                        <tr key={order.id} onClick={() => handleRowClick(order)}>
                          <td style={{color: '#64748b'}}>#{displayId}</td>
                          <td style={{fontWeight: 600}}>{order.party_name}</td>
                          <td>{formatDate(order.order_date)}</td>
                          <td>
                            <span style={{
                                padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
                                backgroundColor: order.status === 'Completed' ? '#dcfce7' : '#fef9c3',
                                color: order.status === 'Completed' ? '#166534' : '#854d0e'
                            }}>
                                {order.status || 'Pending'}
                            </span>
                          </td>
                          <td>{order.contact_no || '-'}</td>
                        </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedOrder && (
        <div className="modal-overlay" onClick={() => !isSaving && setSelectedOrder(null)}>
          <div className="large-modal" onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom: 20}}>
              <div>
                  <h2 style={{fontSize: 20, fontWeight: 800, margin:0}}>{selectedOrder.party_name}</h2>
                  <p style={{fontSize: 13, color: '#64748b', margin: '4px 0 0 0'}}>Order Detail • {formatDate(selectedOrder.order_date)}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{background:'none', border:'none', cursor:'pointer'}}><Icons.Close /></button>
            </div>

            <div className="view-grid">
              <div><span style={{fontSize:11, fontWeight:700, color:'#64748b'}}>Contact No</span><div className="view-value-box">{selectedOrder.contact_no || '-'}</div></div>
              <div><span style={{fontSize:11, fontWeight:700, color:'#64748b'}}>Reference</span><div className="view-value-box">{selectedOrder.reference || '-'}</div></div>
            </div>
            
            <div style={{marginBottom: 20}}>
                <span style={{fontSize:11, fontWeight:700, color:'#64748b'}}>Remark</span>
                <div className="view-value-box" style={{minHeight: 50}}>{selectedOrder.remark || '-'}</div>
            </div>

            <hr style={{margin: '20px 0', borderTop: '1px solid #e2e8f0'}} />

            <h4 style={{fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#334155'}}>Dispatch Management</h4>
            
            {dispatchForm.length === 0 ? (
                <p style={{fontStyle: 'italic', color: '#94a3b8'}}>No items found for this order.</p>
            ) : (
                <table className="items-table">
                    <thead>
                        <tr>
                            <th>Item Name</th>
                            <th>Size</th>
                            <th style={{textAlign: 'center'}}>Ordered</th>
                            <th style={{textAlign: 'center'}}>Avail. Stock</th>
                            <th style={{textAlign: 'center', color: '#64748b'}}>Prev. Sent</th>
                            <th style={{textAlign: 'center', width: '120px'}}>Send Now</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dispatchForm.map((item, index) => {
                            const qty = parseInt(item.current_dispatch) || 0;
                            
                            // LOGIC CORRECTION: Only compare current vs available
                            const isStockExceeded = qty > item.available_stock;

                            return (
                                <tr key={item.id || index}>
                                    <td>{item.item_name}</td>
                                    <td>{item.size || '-'}</td>
                                    <td style={{textAlign: 'center', fontWeight: 600}}>{item.ordered_quantity}</td>
                                    
                                    <td style={{textAlign: 'center'}}>
                                        <span className={`stock-tag ${item.available_stock === 0 ? 'stock-low' : ''}`}>
                                            {item.available_stock}
                                        </span>
                                    </td>

                                    <td style={{textAlign: 'center', color: '#64748b', backgroundColor: '#f8fafc'}}>
                                        {item.prev_dispatched}
                                    </td>
                                    <td style={{textAlign: 'center'}}>
                                        <input 
                                            type="number"
                                            className={`dispatch-input ${isStockExceeded ? 'error' : ''}`}
                                            value={item.current_dispatch}
                                            onChange={(e) => handleDispatchChange(index, e.target.value)}
                                            min="0"
                                            placeholder="0"
                                        />
                                        {isStockExceeded && (
                                            <span className="error-text">Exceeds Stock</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}

            <div style={{marginTop: 30, display: 'flex', justifyContent: 'flex-end', gap: 10}}>
                <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)} disabled={isSaving}>Cancel</button>
                <button 
                    className="btn btn-primary" 
                    onClick={handleSaveDispatch} 
                    disabled={isSaving || dispatchForm.length === 0 || isFormInvalid}
                >
                    {isSaving ? 'Saving...' : 'Update Dispatch'}
                </button>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div className={`toast-notification ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

const Icons = {
  Close: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

export default OrdersIndex;