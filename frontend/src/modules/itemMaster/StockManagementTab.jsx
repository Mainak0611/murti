// frontend/src/modules/StockManagementTab.jsx
import React, { useState, useEffect } from 'react';
import api from '../../lib/api'; // Adjust path based on your structure

// ==========================================
// INTERNAL COMPONENT: STOCK HISTORY MODAL
// ==========================================
const StockHistoryModal = ({ item, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!item) return;
    api.get(`/api/items/${item.id}/logs`)
      .then(res => setLogs(res.data.data || []))
      .catch(err => console.error("Failed to load logs", err))
      .finally(() => setLoading(false));
  }, [item]);

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ width: '600px' }}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>Stock History</h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                Transaction log for: <b>{item.item_name}</b>
            </p>
          </div>
          <button onClick={onClose} className="close-btn">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <div className="modal-body" style={{ padding: 0, overflowY: 'auto', maxHeight: '60vh' }}>
          <table className="data-table" style={{ borderTop: 'none' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
              <tr>
                <th style={{ paddingLeft: '24px' }}>Date</th>
                <th>Type</th>
                <th>Change</th>
                <th style={{ paddingRight: '24px' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" className="text-center p-4">Loading history...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="4" className="text-center p-4 text-muted">No transactions found.</td></tr>
              ) : (
                logs.map((log, idx) => (
                  <tr key={log.id || idx}>
                    <td className="text-sm" style={{ paddingLeft: '24px' }}>
                      {new Date(log.created_at).toLocaleDateString()} <br/>
                      <span className="text-muted text-xs">{new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </td>
                    <td className="text-sm capitalized">
                        {log.transaction_type === 'loss' ? <span className="text-danger fw-bold">LOSS</span> : log.transaction_type?.replace(/_/g, ' ')}
                        {log.remarks && <div className="text-xs text-muted italic" style={{ marginTop: '4px' }}>"{log.remarks}"</div>}
                    </td>
                    <td style={{ color: log.change_amount > 0 ? '#059669' : '#ef4444', fontWeight: 'bold' }}>
                      {log.change_amount > 0 ? `+${log.change_amount}` : log.change_amount}
                    </td>
                    <td className="fw-bold" style={{ paddingRight: '24px' }}>{log.new_stock}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// INTERNAL COMPONENT: STOCK ACTION MODAL
// ==========================================
const StockActionModal = ({ item, mode, onClose, onSuccess, showToast }) => {
    const [qty, setQty] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
  
    const isLoss = mode === 'loss';
    const title = isLoss ? 'Report Material Loss' : 'Add Stock';
    const themeColor = isLoss ? '#ef4444' : '#059669'; 
  
    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!qty || qty <= 0) return showToast('Please enter a valid quantity', 'error');
      
      setSubmitting(true);
      try {
        const endpoint = isLoss ? `/api/items/${item.id}/loss` : `/api/items/${item.id}/add-stock`;
        const payload = isLoss ? { qty, reason } : { qty }; 
  
        await api.post(endpoint, payload);
        
        showToast(isLoss ? 'Loss reported successfully' : 'Stock added successfully', 'success');
        onSuccess(); 
        onClose();
      } catch (err) {
        console.error(err);
        showToast('Operation failed', 'error');
      } finally {
        setSubmitting(false);
      }
    };
  
    return (
      <div className="modal-overlay">
        <div className="modal-card">
          <div className="modal-header">
            <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>{title}</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                    Updating: <b>{item.item_name}</b> (Current: {item.current_stock})
                </p>
            </div>
            <button onClick={onClose} className="close-btn">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"></path></svg>
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{isLoss ? 'Quantity Lost' : 'Quantity to Add'}</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={qty} 
                    onChange={e => setQty(e.target.value)} 
                    placeholder="0"
                    autoFocus
                    min="1"
                  />
                </div>
                {isLoss && (
                    <div className="form-group">
                    <label className="form-label">Reason / Remarks (Optional)</label>
                    <textarea 
                        className="form-input" 
                        rows="3"
                        value={reason} 
                        onChange={e => setReason(e.target.value)} 
                        placeholder="e.g. Damaged in transit..."
                        style={{ resize: 'none' }}
                    />
                    </div>
                )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ background: themeColor, border: 'none' }} 
                disabled={submitting}
              >
                {submitting ? 'Processing...' : (isLoss ? 'Confirm Loss' : 'Add Stock')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
};

// ==========================================
// MAIN EXPORT: STOCK MANAGEMENT TAB
// ==========================================
const StockManagementTab = ({ data, loading, onRefresh, showToast }) => {
    // Local state for modals specific to this tab
    const [historyItem, setHistoryItem] = useState(null); 
    const [actionItem, setActionItem] = useState(null); 

    return (
        <>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#334155' }}>Current Inventory & Actions</h3>
                </div>

                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                <th>HSN Code</th>
                                <th>Size</th>
                                <th className="text-center">Current Stock</th>
                                <th style={{ width: '280px', textAlign: 'right', paddingRight: '24px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" style={{textAlign:'center', padding: '40px'}}>Loading...</td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan="5" style={{textAlign:'center', padding: '40px', color: '#94a3b8'}}>No items found.</td></tr>
                            ) : (
                                data.map(item => {
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50">
                                            <td className="p-4 font-semibold text-slate-700">{item.item_name}</td>
                                            <td className="p-4 text-slate-600">{item.hsn_code || '-'}</td>
                                            <td className="p-4 text-slate-600">{item.size || '-'}</td>
                                            
                                            <td className="p-4 text-center">
                                                <span style={{ 
                                                    background: '#f1f5f9', padding: '6px 12px', borderRadius: '6px', 
                                                    fontWeight: '700', color: '#334155' 
                                                }}>
                                                    {item.current_stock || 0}
                                                </span>
                                            </td>

                                            <td className="p-4">
                                                <div className="action-btn-group">
                                                    <button 
                                                        className="action-text-btn btn-add" 
                                                        title="Add Stock"
                                                        onClick={() => setActionItem({ item, mode: 'add' })}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                            <line x1="12" y1="5" x2="12" y2="19"></line>
                                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                                        </svg>
                                                        Add New
                                                    </button>

                                                    <button 
                                                        className="action-text-btn btn-loss" 
                                                        title="Report Loss"
                                                        onClick={() => setActionItem({ item, mode: 'loss' })}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                                        </svg>
                                                        Add Loss
                                                    </button>

                                                    <button 
                                                        className="action-text-btn btn-history" 
                                                        title="View Log"
                                                        onClick={() => setHistoryItem(item)}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="12" cy="12" r="10"></circle>
                                                            <polyline points="12 6 12 12 16 14"></polyline>
                                                        </svg>
                                                        History
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Render Modals Locally */}
            {actionItem && (
                <StockActionModal 
                    item={actionItem.item} 
                    mode={actionItem.mode}
                    onClose={() => setActionItem(null)} 
                    onSuccess={onRefresh} // Refreshes parent data
                    showToast={showToast}
                />
            )}

            {historyItem && (
                <StockHistoryModal 
                    item={historyItem} 
                    onClose={() => setHistoryItem(null)} 
                />
            )}
        </>
    );
};

export default StockManagementTab;