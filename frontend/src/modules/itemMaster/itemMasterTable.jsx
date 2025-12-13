// frontend/src/components/tables/ItemMasterTable.jsx
import React, { useState } from 'react';
import api from '../../lib/api';

const ItemMasterTable = ({ data, loading, fetchData, showToast, viewItem, setViewItem }) => {
  // --- EDIT MODAL STATE ---
  const [editTarget, setEditTarget] = useState(null); // Stores the item currently being edited
  const [editForm, setEditForm] = useState({
    item_name: '',
    size: '',
    hsn_code: '',
    weight: '',
    price: '',
    minimum_stock: '',
    remarks: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // --- DELETE CONFIRMATION STATE ---
  const [deleteTargetId, setDeleteTargetId] = useState(null); 

  // --- RIPPLE EFFECT ---
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

  // --- DELETE LOGIC ---
  const initiateDelete = (e, id) => {
    e.stopPropagation();
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await api.delete(`/api/items/${deleteTargetId}`);
      showToast("Item deleted", "success");
      setDeleteTargetId(null);
      fetchData(true); 
    } catch (err) {
      console.error(err);
      showToast("Failed to delete", "error");
      setDeleteTargetId(null);
    }
  };

  // --- EDIT LOGIC ---
  const initiateEdit = (e, item) => {
    e.stopPropagation();
    setEditTarget(item);
    // Pre-fill form
    setEditForm({
      item_name: item.item_name || '',
      size: item.size || '',
      hsn_code: item.hsn_code || '',
      weight: item.weight || '',
      price: item.price || '',
      minimum_stock: item.minimum_stock || '',
      remarks: item.remarks || ''
    });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editTarget) return;

    setIsSaving(true);
    try {
      const payload = {
        ...editForm,
        price: parseFloat(editForm.price) || 0,
        minimum_stock: parseInt(editForm.minimum_stock) || 0
      };

      await api.put(`/api/items/${editTarget.id}`, payload);
      
      showToast("Item updated successfully", "success");
      setEditTarget(null); // Close modal
      fetchData(true);     // Refresh table
    } catch (err) {
      console.error(err);
      showToast("Failed to update item", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRowClick = (item) => {
    if (!editTarget && !deleteTargetId) {
      setViewItem(item);
    }
  };

  return (
    <>
      <style>{`
        /* --- ROW STYLES --- */
        .row-highlight { background: #f0f9ff; }
        
        /* --- MODAL BASES --- */
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);
          z-index: 3000; display: flex; align-items: center; justify-content: center;
        }

        /* --- CONFIRM DELETE MODAL --- */
        .confirm-modal-content {
          background: white; padding: 32px; border-radius: 16px;
          width: 400px; max-width: 90%; text-align: center;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .confirm-icon-wrapper {
          width: 48px; height: 48px; background: #fee2e2; color: #ef4444;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px auto;
        }
        .confirm-title { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 8px; }
        .confirm-desc { font-size: 14px; color: #6b7280; margin-bottom: 24px; }
        .confirm-actions { display: flex; gap: 12px; justify-content: center; }
        .btn-modal {
          flex: 1; padding: 10px 16px; border-radius: 8px; font-weight: 600; font-size: 14px;
          cursor: pointer; border: 1px solid transparent; transition: all 0.2s;
        }
        .btn-modal-cancel { background: white; border: 1px solid #e5e7eb; color: #374151; }
        .btn-modal-cancel:hover { background: #f9fafb; }
        .btn-modal-delete { background: #ef4444; color: white; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2); }
        .btn-modal-delete:hover { background: #dc2626; transform: translateY(-1px); }

        /* --- VIEW & EDIT MODAL CONTENT --- */
        .large-modal-content {
          background: white;
          width: 700px;
          max-width: 95%;
          max-height: 90vh;
          overflow-y: auto;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          animation: popIn 0.2s ease-out;
          position: relative;
        }
        
        .modal-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 24px;
        }
        .modal-title {
          font-size: 18px; font-weight: 800; color: #1e293b;
          margin: 0; text-transform: uppercase; letter-spacing: 0.5px;
        }
        
        .close-btn {
          width: 36px; height: 36px;
          background: white; border: 1px solid #cbd5e1;
          border-radius: 8px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #334155; padding: 0; transition: all 0.2s; flex-shrink: 0;
        }
        .close-btn:hover { background: #f8fafc; border-color: #94a3b8; color: #0f172a; transform: translateY(-1px); }

        /* --- EDIT FORM GRID --- */
        .edit-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
        }
        .edit-group { display: flex; flex-direction: column; gap: 6px; }
        .edit-label { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; }
        .edit-input {
          padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px;
          font-size: 14px; width: 100%; box-sizing: border-box;
        }
        .edit-input:focus { outline: 2px solid #059669; border-color: transparent; }
        .full-width { grid-column: 1 / -1; }

        .edit-actions {
           margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px;
        }

        /* --- VIEW GRID --- */
        .view-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .view-group { display: flex; flex-direction: column; gap: 6px; }
        .view-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        .view-value-box {
          background: white; border: 1px solid #e2e8f0; border-radius: 6px;
          padding: 10px 12px; font-size: 14px; font-weight: 500; color: #334155;
          min-height: 42px; display: flex; align-items: center;
        }
        .view-value-box.textarea { align-items: flex-start; min-height: 80px; line-height: 1.5; }

        @keyframes popIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{width: '60px'}}>ID</th>
                <th>Item Name</th>
                <th>Size</th> {/* Added Size Column */}
                <th>Weight</th>
                <th>Price</th>
                <th style={{width:'100px'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{textAlign:'center', padding: '40px'}}>Loading...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan="6" style={{textAlign:'center', padding: '40px', color: '#94a3b8'}}>No items found.</td></tr>
              ) : (
                data.map((item, index) => (
                  <tr 
                    key={item.id} 
                    onClick={() => handleRowClick(item)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td onClick={createRipple} style={{color: '#64748b', fontSize:'0.85em'}}>
                       #{index + 1}
                    </td>

                    <td onClick={createRipple} style={{fontWeight: 600}}>{item.item_name}</td>
                    
                    {/* Added Size Data */}
                    <td onClick={createRipple}>{item.size || '-'}</td>
                    
                    <td onClick={createRipple}>{item.weight || '-'}</td>
                    <td onClick={createRipple}>{item.price ? `₹${item.price}` : '-'}</td>
                    <td>
                      <div style={{display:'flex', gap: '8px', alignItems: 'center'}}>
                        <button className="icon-btn" onClick={(e) => initiateEdit(e, item)} title="Edit"><Icons.Pencil /></button>
                        <button className="icon-btn danger" onClick={(e) => initiateDelete(e, item.id)} title="Delete"><Icons.Trash /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- CONFIRM DELETE MODAL --- */}
      {deleteTargetId && (
        <div className="modal-overlay" onClick={() => setDeleteTargetId(null)}>
          <div className="confirm-modal-content" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon-wrapper"><Icons.TrashLarge /></div>
            <h3 className="confirm-title">Confirm Delete</h3>
            <p className="confirm-desc">Are you sure you want to permanently delete this item? This action cannot be undone.</p>
            <div className="confirm-actions">
              <button className="btn-modal btn-modal-cancel" onClick={() => setDeleteTargetId(null)}>Cancel</button>
              <button className="btn-modal btn-modal-delete" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT MODAL (With All Fields) --- */}
      {editTarget && (
        <div className="modal-overlay" onClick={() => setEditTarget(null)}>
          <div className="large-modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Item #{editTarget.id}</h2>
              <button onClick={() => setEditTarget(null)} className="close-btn" title="Close"><Icons.Close /></button>
            </div>

            <form onSubmit={saveEdit}>
              <div className="edit-grid">
                <div className="edit-group">
                  <label className="edit-label">Item Name</label>
                  <input className="edit-input" value={editForm.item_name} onChange={e => setEditForm({...editForm, item_name: e.target.value})} required />
                </div>
                <div className="edit-group">
                  <label className="edit-label">Size</label>
                  <input className="edit-input" value={editForm.size} onChange={e => setEditForm({...editForm, size: e.target.value})} />
                </div>
                <div className="edit-group">
                  <label className="edit-label">HSN Code</label>
                  <input className="edit-input" value={editForm.hsn_code} onChange={e => setEditForm({...editForm, hsn_code: e.target.value})} />
                </div>
                <div className="edit-group">
                  <label className="edit-label">Weight</label>
                  <input className="edit-input" value={editForm.weight} onChange={e => setEditForm({...editForm, weight: e.target.value})} />
                </div>
                <div className="edit-group">
                  <label className="edit-label">Price</label>
                  <input type="number" step="0.01" className="edit-input" value={editForm.price} onChange={e => setEditForm({...editForm, price: e.target.value})} />
                </div>
                <div className="edit-group">
                  <label className="edit-label">Min Stock</label>
                  <input type="number" className="edit-input" value={editForm.minimum_stock} onChange={e => setEditForm({...editForm, minimum_stock: e.target.value})} />
                </div>
                <div className="edit-group full-width">
                  <label className="edit-label">Remarks</label>
                  <input className="edit-input" value={editForm.remarks} onChange={e => setEditForm({...editForm, remarks: e.target.value})} />
                </div>
              </div>

              <div className="edit-actions">
                <button type="button" className="btn-modal btn-modal-cancel" style={{flex: '0 0 100px'}} onClick={() => setEditTarget(null)}>Cancel</button>
                <button type="submit" className="btn-modal" style={{flex: '0 0 140px', background: '#059669', color: 'white'}} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Update Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- VIEW DETAILS MODAL --- */}
      {viewItem && (
        <div className="modal-overlay" onClick={() => setViewItem(null)}>
          <div className="large-modal-content" onClick={(e) => e.stopPropagation()}>
             <div className="modal-header">
              <h2 className="modal-title">{viewItem.item_name}</h2>
              <button onClick={() => setViewItem(null)} className="close-btn" title="Close"><Icons.Close /></button>
            </div>
            <div className="view-grid">

              <div className="view-group">
                <span className="view-label">Price</span>
                <div className="view-value-box">{viewItem.price ? `₹${viewItem.price}` : '-'}</div>
              </div>
              <div className="view-group">
                <span className="view-label">Size</span>
                <div className="view-value-box">{viewItem.size || '-'}</div>
              </div>
              <div className="view-group">
                <span className="view-label">HSN Code</span>
                <div className="view-value-box">{viewItem.hsn_code || '-'}</div>
              </div>
              <div className="view-group">
                <span className="view-label">Weight</span>
                <div className="view-value-box">{viewItem.weight || '-'}</div>
              </div>
              <div className="view-group">
                <span className="view-label">Min Stock</span>
                <div className="view-value-box">{viewItem.minimum_stock || '0'}</div>
              </div>
            </div>
            <div className="view-group">
              <span className="view-label">Remarks</span>
              <div className="view-value-box textarea">{viewItem.remarks || 'No remarks provided.'}</div>
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
  Close: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 6L6 18M6 6L18 18" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

export default ItemMasterTable;