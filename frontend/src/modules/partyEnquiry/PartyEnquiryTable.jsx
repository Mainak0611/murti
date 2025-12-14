// frontend/src/components/tables/PartyEnquiryTable.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import api from '../../lib/api';

const PartyEnquiryTable = ({ data, loading, fetchData, showToast, viewItem, setViewItem }) => {
  const navigate = useNavigate();
  
  // --- STATE FOR EDIT MODAL ---
  const [editItem, setEditItem] = useState(null); 
  const [availableItems, setAvailableItems] = useState([]); 
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  // State for Confirmation Loading
  const [isConfirming, setIsConfirming] = useState(false);

  // Form State for Editing
  const [editForm, setEditForm] = useState({
    partyName: '',
    contactNo: '',
    reference: '',
    remark: '',
    enquiryDate: '',
    items: [] 
  });

  // --- DELETE CONFIRMATION STATE ---
  const [deleteTargetId, setDeleteTargetId] = useState(null); 

  // --- HELPERS ---
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  const toInputDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-CA'); 
  };

  const isToday = (dateString) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  };

  const createRipple = (event) => {
    if (event.target.closest('button') || event.target.closest('input')) return; 
    const cell = event.currentTarget; 
    const existing = cell.getElementsByClassName("ripple")[0];
    if (existing) existing.remove();
    const circle = document.createElement("span");
    const diameter = Math.max(cell.clientWidth, cell.clientHeight);
    const radius = diameter / 2;
    const rect = cell.getBoundingClientRect();
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - rect.left - radius}px`;
    circle.style.top = `${event.clientY - rect.top - radius}px`;
    circle.classList.add("ripple");
    cell.appendChild(circle);
    setTimeout(() => circle.remove(), 600);
  };

  // --- FETCH AVAILABLE ITEMS ---
  useEffect(() => {
    const fetchMasterItems = async () => {
      try {
        const res = await api.get('/api/items');
        setAvailableItems(Array.isArray(res.data) ? res.data : (res.data.data || []));
      } catch (err) {
        console.error("Failed to load item master", err);
      }
    };
    fetchMasterItems();
  }, []);

  // --- DELETE LOGIC ---
  const initiateDelete = (e, id) => { e.stopPropagation(); setDeleteTargetId(id); };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await api.delete(`/api/party-enquiries/${deleteTargetId}`);
      showToast("Enquiry deleted", "success");
      setDeleteTargetId(null);
      fetchData(true); 
    } catch (err) {
      console.error(err);
      showToast("Failed to delete", "error");
      setDeleteTargetId(null);
    }
  };

  // --- CONFIRM ORDER LOGIC ---
  const handleConfirmOrder = async () => {
    if (!viewItem) return;
    setIsConfirming(true);
    try {
      await api.post(`/api/party-enquiries/${viewItem.id}/confirm`);
      
      showToast("Order Confirmed Successfully!", "success");
      setViewItem(null); 
      navigate('/confirmed-orders'); 
      
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || "Failed to confirm order", "error");
    } finally {
      setIsConfirming(false);
    }
  };

  // --- EDIT LOGIC ---
  const handleEditStart = async (e, item) => {
    e.stopPropagation();
    setEditItem(item);
    setIsLoadingDetails(true);

    try {
      const res = await api.get(`/api/party-enquiries/${item.id}`);
      const fullData = res.data.data;

      setEditForm({
        partyName: fullData.party_name,
        contactNo: fullData.contact_no || '',
        reference: fullData.reference || '',
        remark: fullData.remark || '',
        enquiryDate: toInputDate(fullData.enquiry_date),
        items: fullData.items ? fullData.items.map(i => ({
            itemId: i.item_id, 
            quantity: i.quantity,
            tempId: Math.random() 
        })) : []
      });
    } catch (err) {
        console.error(err);
        showToast("Failed to load details", "error");
        setEditItem(null);
    } finally {
        setIsLoadingDetails(false);
    }
  };

  const handleEditItemChange = (index, field, value) => {
    const updated = [...editForm.items];
    updated[index][field] = value;
    setEditForm({ ...editForm, items: updated });
  };

  const addEditItemRow = () => {
    setEditForm({
        ...editForm,
        items: [...editForm.items, { itemId: '', quantity: '', tempId: Math.random() }]
    });
  };

  const removeEditItemRow = (index) => {
    const updated = editForm.items.filter((_, i) => i !== index);
    setEditForm({ ...editForm, items: updated });
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editForm.partyName) return showToast("Party Name required", "error");

    setIsSaving(true);
    try {
      const payload = {
        party_name: editForm.partyName,
        contact_no: editForm.contactNo,
        reference: editForm.reference,
        remark: editForm.remark,
        enquiry_date: editForm.enquiryDate,
        items: editForm.items
            .filter(i => i.itemId && i.quantity)
            .map(i => ({
                item_id: parseInt(i.itemId),
                quantity: parseInt(i.quantity)
            }))
      };

      await api.put(`/api/party-enquiries/${editItem.id}`, payload);
      showToast("Enquiry updated successfully", "success");
      setEditItem(null);
      fetchData(true); 
    } catch (err) {
      console.error(err);
      showToast("Failed to update", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // --- VIEW LOGIC ---
  const handleViewClick = async (item) => {
    setViewItem(item); 
    try {
        const res = await api.get(`/api/party-enquiries/${item.id}`);
        setViewItem(res.data.data);
    } catch (err) {
        console.error("Fetch detail error", err);
    }
  };

  return (
    <>
      <style>{`
        .row-highlight { background: #f0f9ff; }
        
        /* Modal Styles */
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);
          z-index: 3000; display: flex; align-items: center; justify-content: center;
        }
        .large-modal {
            background: white; width: 800px; max-width: 95%; max-height: 90vh;
            overflow-y: auto; border-radius: 12px; padding: 24px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            animation: popIn 0.2s ease-out;
        }
        .confirm-modal {
             background: white; padding: 32px; border-radius: 16px; width: 400px; max-width: 90%; text-align: center;
        }
        
        .view-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        .edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        
        .view-value-box {
          background: white; border: 1px solid #e2e8f0; border-radius: 6px;
          padding: 10px 12px; font-size: 14px; font-weight: 500; color: #334155;
          min-height: 42px; display: flex; align-items: center;
        }
        
        .items-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
        .items-table th { text-align: left; background: #f8fafc; padding: 8px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 12px; text-transform: uppercase; }
        .items-table td { border-bottom: 1px solid #e2e8f0; padding: 8px; color: #334155; }
        
        /* Close Button Style Fix */
        .close-btn {
            background: none; border: none; cursor: pointer; padding: 0;
            display: flex; align-items: center; justify-content: center;
            border-radius: 6px; transition: background 0.2s;
            height: 32px; width: 32px; /* Fixed size */
        }
        .close-btn:hover { background: #f1f5f9; }

        @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>

      {/* --- TABLE --- */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Party Name</th>
                <th style={{width:'130px'}}>Requirement Date</th>
                <th>Contact</th>
                <th>Reference</th>
                <th style={{width:'100px'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{textAlign:'center', padding: '40px'}}>Loading...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan="5" style={{textAlign:'center', padding: '40px', color: '#94a3b8'}}>No enquiries found.</td></tr>
              ) : (
                data.map((item) => {
                    const isRowToday = isToday(item.enquiry_date);
                    return (
                        <tr 
                        key={item.id} 
                        onClick={() => handleViewClick(item)} 
                        style={{ cursor: 'pointer' }}
                        className={isRowToday ? 'row-highlight' : ''}
                        >
                        <td onClick={createRipple} style={{fontWeight: 600}}>{item.party_name}</td>
                        <td onClick={createRipple}>{formatDate(item.enquiry_date)}</td>
                        <td onClick={createRipple}>{item.contact_no || '-'}</td>
                        <td onClick={createRipple}>{item.reference || '-'}</td>
                        <td>
                            <div style={{display:'flex', gap: '8px', alignItems: 'center'}}>
                            <button className="icon-btn" onClick={(e) => handleEditStart(e, item)} title="Edit"><Icons.Pencil /></button>
                            <button className="icon-btn danger" onClick={(e) => initiateDelete(e, item.id)} title="Delete"><Icons.Trash /></button>
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

      {/* --- EDIT MODAL --- */}
      {editItem && (
        <div className="modal-overlay" onClick={() => !isSaving && setEditItem(null)}>
          <div className="large-modal" onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems: 'center', marginBottom: 20}}>
                <h2 style={{fontSize: 20, fontWeight: 800, margin:0}}>Edit Enquiry #{editItem.id}</h2>
                <button onClick={() => setEditItem(null)} className="close-btn"><Icons.Close /></button>
            </div>

            {isLoadingDetails ? (
                <div style={{textAlign:'center', padding: 40}}>Loading details...</div>
            ) : (
                <form onSubmit={handleEditSave}>
                    <div className="edit-grid">
                        <div>
                            <label className="form-label">Party Name</label>
                            <input className="form-input" value={editForm.partyName} onChange={e => setEditForm({...editForm, partyName: e.target.value})} required />
                        </div>
                        <div>
                            <label className="form-label">Requirement Date</label>
                            <input type="date" className="form-input" value={editForm.enquiryDate} onChange={e => setEditForm({...editForm, enquiryDate: e.target.value})} />
                        </div>
                        <div>
                            <label className="form-label">Contact No</label>
                            <input className="form-input" value={editForm.contactNo} onChange={e => setEditForm({...editForm, contactNo: e.target.value})} />
                        </div>
                        <div>
                            <label className="form-label">Reference</label>
                            <input className="form-input" value={editForm.reference} onChange={e => setEditForm({...editForm, reference: e.target.value})} />
                        </div>
                    </div>
                    
                    <div style={{marginBottom: 20}}>
                        <label className="form-label">Remark</label>
                        <input className="form-input" value={editForm.remark} onChange={e => setEditForm({...editForm, remark: e.target.value})} />
                    </div>

                    <hr style={{borderTop:'1px solid #eee', margin:'20px 0'}} />
                    
                    <h4 style={{fontSize: 14, fontWeight: 700, marginBottom: 10, color: '#334155'}}>Requested Items</h4>
                    {editForm.items.map((row, index) => (
                        <div key={row.tempId || index} style={{display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center'}}>
                            <div style={{flex: 2}}>
                                <select 
                                    className="form-input" 
                                    value={row.itemId}
                                    onChange={(e) => handleEditItemChange(index, 'itemId', e.target.value)}
                                >
                                    <option value="">-- Select Item --</option>
                                    {availableItems.map(i => (
                                        <option key={i.id} value={i.id}>{i.item_name} {i.size ? `(${i.size})` : ''}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{flex: 1}}>
                                <input type="number" className="form-input" placeholder="Qty" value={row.quantity} onChange={(e) => handleEditItemChange(index, 'quantity', e.target.value)} />
                            </div>
                            {/* FIX: Use Flexbox centering and Icon component */}
                            <button 
                                type="button" 
                                onClick={() => removeEditItemRow(index)} 
                                style={{
                                    background:'#fee2e2', 
                                    color:'#ef4444', 
                                    border:'none', 
                                    borderRadius: 4, 
                                    width: 36, 
                                    height: 36, 
                                    cursor:'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 0
                                }}
                            >
                                <Icons.X />
                            </button>
                        </div>
                    ))}
                    <button type="button" onClick={addEditItemRow} className="btn btn-secondary" style={{fontSize: 12, padding: '4px 10px'}}>+ Add Item</button>

                    <div style={{marginTop: 30, display:'flex', justifyContent:'flex-end', gap: 10}}>
                        <button type="button" className="btn btn-secondary" onClick={() => setEditItem(null)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? 'Saving...' : 'Update'}</button>
                    </div>
                </form>
            )}
          </div>
        </div>
      )}

      {/* --- VIEW MODAL --- */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="large-modal" onClick={(e) => e.stopPropagation()}>
             <div style={{display:'flex', justifyContent:'space-between', alignItems: 'center', marginBottom: 20}}>
              <h2 style={{fontSize: 20, fontWeight: 800, margin:0}}>{viewItem.party_name}</h2>
              <button onClick={() => setViewItem(null)} className="close-btn"><Icons.Close /></button>
            </div>

            <div className="view-grid">
              <div><span style={{fontSize:11, fontWeight:700, color:'#64748b'}}>Requirement Date</span><div className="view-value-box">{formatDate(viewItem.enquiry_date)}</div></div>
              <div><span style={{fontSize:11, fontWeight:700, color:'#64748b'}}>Contact No</span><div className="view-value-box">{viewItem.contact_no || '-'}</div></div>
              <div><span style={{fontSize:11, fontWeight:700, color:'#64748b'}}>Reference</span><div className="view-value-box">{viewItem.reference || '-'}</div></div>
            </div>

            <div style={{marginBottom: 20}}>
                <span style={{fontSize:11, fontWeight:700, color:'#64748b'}}>Remark</span>
                <div className="view-value-box" style={{minHeight: 60}}>{viewItem.remark || 'No remarks provided.'}</div>
            </div>

            {viewItem.items && viewItem.items.length > 0 ? (
                <>
                    <h4 style={{fontSize: 14, fontWeight: 700, marginBottom: 10, color: '#334155'}}>Requested Items</h4>
                    <table className="items-table">
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                <th>Size</th>
                                <th>Quantity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {viewItem.items.map((item, idx) => (
                                <tr key={idx}>
                                    <td>{item.item_name}</td>
                                    <td>{item.size || '-'}</td>
                                    <td style={{fontWeight: 600}}>{item.quantity}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            ) : (
                <p style={{fontSize: 13, color: '#94a3b8', fontStyle: 'italic'}}>No items linked to this enquiry.</p>
            )}

            {/* --- CONFIRM ORDER BUTTON --- */}
            <div style={{marginTop: 30, display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: 20}}>
                <button 
                  onClick={handleConfirmOrder} 
                  className="btn btn-primary"
                  style={{background: '#059669', color: 'white', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8}}
                  disabled={isConfirming}
                >
                  {isConfirming ? 'Processing...' : (
                    <>
                      <span>Confirm Order</span>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </>
                  )}
                </button>
            </div>

          </div>
        </div>
      )}

      {/* --- CONFIRM DELETE MODAL --- */}
      {deleteTargetId && (
        <div className="modal-overlay" onClick={() => setDeleteTargetId(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div style={{width: 48, height: 48, background: '#fee2e2', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'}}>
               <Icons.TrashLarge />
            </div>
            <h3 style={{fontSize: 20, fontWeight: 700, marginBottom: 8}}>Confirm Delete</h3>
            <p style={{color: '#6b7280', marginBottom: 24}}>Permanently delete this enquiry?</p>
            <div style={{display: 'flex', gap: 12, justifyContent: 'center'}}>
              <button className="btn btn-secondary" onClick={() => setDeleteTargetId(null)}>Cancel</button>
              <button className="btn btn-primary" style={{background: '#ef4444', border:'none'}} onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const Icons = {
  Pencil: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
  Trash: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  TrashLarge: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  Save: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>,
  X: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  Close: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Calendar: (props) => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>,
};

export default PartyEnquiryTable;