import React, { useState } from 'react';
import api from '../../lib/api';

const PartyMasterTable = ({ data, loading, fetchData, showToast, viewParty, setViewParty }) => {
  
  // --- EDIT MODAL STATE ---
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({});
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
      await api.delete(`/api/parties/${deleteTargetId}`);
      showToast("Party deleted", "success");
      setDeleteTargetId(null);
      fetchData(true); 
    } catch (err) {
      console.error(err);
      const errorMessage = err.response?.data?.error || "Failed to delete";
      showToast(errorMessage, "error");
      setDeleteTargetId(null);
    }
  };

  // --- EDIT LOGIC ---
  const initiateEdit = (e, party) => {
    e.stopPropagation();
    setEditTarget(party);
    // Pre-fill form
    setEditForm({
      firm_name: party.firm_name || '',
      party_name: party.party_name || '',
      contact_no: party.contact_no || '',
      contact_no_2: party.contact_no_2 || '',
      email: party.email || '',
      billing_address: party.billing_address || '',
      gst_number: party.gst_number || '',
      pan_number: party.pan_number || '',
      reference_person: party.reference_person || '',
      reference_contact_no: party.reference_contact_no || ''
    });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editTarget) return;

    setIsSaving(true);
    try {
      await api.put(`/api/parties/${editTarget.id}`, editForm);
      
      showToast("Party updated successfully", "success");
      setEditTarget(null); // Close modal
      fetchData(true);     // Refresh table
    } catch (err) {
      console.error(err);
      showToast("Failed to update party", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRowClick = (party) => {
    if (!editTarget && !deleteTargetId) {
      setViewParty(party);
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
        
        .ripple {
          position: absolute; border-radius: 50%; transform: scale(0);
          animation: ripple 600ms linear; background-color: rgba(0, 0, 0, 0.05);
        }
        @keyframes ripple { to { transform: scale(4); opacity: 0; } }
      `}</style>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{width: '60px'}}>ID</th>
                <th>Firm Name</th>
                <th>Party Name</th>
                <th>Contact</th>
                <th>GSTIN</th>
                <th style={{width:'100px'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{textAlign:'center', padding: '40px'}}>Loading...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan="6" style={{textAlign:'center', padding: '40px', color: '#94a3b8'}}>No parties found.</td></tr>
              ) : (
                data.map((party, index) => (
                  <tr 
                    key={party.id} 
                    onClick={() => handleRowClick(party)}
                    style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                  >
                    <td onClick={createRipple} style={{color: '#64748b', fontSize:'0.85em'}}>
                       #{index + 1}
                    </td>

                    <td onClick={createRipple} style={{fontWeight: 600, color: '#0f172a'}}>
                        {party.firm_name || '-'}
                    </td>
                    
                    <td onClick={createRipple} style={{fontWeight: 500}}>
                        {party.party_name}
                    </td>
                    
                    <td onClick={createRipple}>{party.contact_no || '-'}</td>
                    <td onClick={createRipple} style={{fontFamily: 'monospace'}}>{party.gst_number || '-'}</td>
                    
                    <td>
                      <div style={{display:'flex', gap: '8px', alignItems: 'center'}}>
                        <button className="icon-btn" onClick={(e) => initiateEdit(e, party)} title="Edit"><Icons.Pencil /></button>
                        <button className="icon-btn danger" onClick={(e) => initiateDelete(e, party.id)} title="Delete"><Icons.Trash /></button>
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
            <p className="confirm-desc">Are you sure you want to permanently delete this party? This action cannot be undone.</p>
            <div className="confirm-actions">
              <button className="btn-modal btn-modal-cancel" onClick={() => setDeleteTargetId(null)}>Cancel</button>
              <button className="btn-modal btn-modal-delete" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT MODAL --- */}
      {editTarget && (
        <div className="modal-overlay" onClick={() => setEditTarget(null)}>
          <div className="large-modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Party #{editTarget.id}</h2>
              <button onClick={() => setEditTarget(null)} className="close-btn" title="Close"><Icons.Close /></button>
            </div>

            <form onSubmit={saveEdit}>
              <div className="edit-grid">
                <div className="edit-group">
                  <label className="edit-label">Firm Name</label>
                  <input className="edit-input" value={editForm.firm_name || ''} onChange={e => setEditForm({...editForm, firm_name: e.target.value})} />
                </div>
                <div className="edit-group">
                  <label className="edit-label">Party Name</label>
                  <input className="edit-input" value={editForm.party_name || ''} onChange={e => setEditForm({...editForm, party_name: e.target.value})} required />
                </div>
                <div className="edit-group">
                  <label className="edit-label">Contact No</label>
                  <input className="edit-input" value={editForm.contact_no || ''} onChange={e => setEditForm({...editForm, contact_no: e.target.value})} />
                </div>
                <div className="edit-group">
                  <label className="edit-label">Contact No 2</label>
                  <input className="edit-input" value={editForm.contact_no_2 || ''} onChange={e => setEditForm({...editForm, contact_no_2: e.target.value})} />
                </div>
                <div className="edit-group">
                  <label className="edit-label">Email</label>
                  <input className="edit-input" value={editForm.email || ''} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                </div>
                <div className="edit-group">
                  <label className="edit-label">GST Number</label>
                  <input className="edit-input" value={editForm.gst_number || ''} onChange={e => setEditForm({...editForm, gst_number: e.target.value})} />
                </div>
                <div className="edit-group">
                  <label className="edit-label">PAN Number</label>
                  <input className="edit-input" value={editForm.pan_number || ''} onChange={e => setEditForm({...editForm, pan_number: e.target.value})} />
                </div>
                <div className="edit-group">
                    <label className="edit-label">Reference Person</label>
                    <input className="edit-input" value={editForm.reference_person || ''} onChange={e => setEditForm({...editForm, reference_person: e.target.value})} />
                </div>
                <div className="edit-group full-width">
                  <label className="edit-label">Billing Address</label>
                  <input className="edit-input" value={editForm.billing_address || ''} onChange={e => setEditForm({...editForm, billing_address: e.target.value})} />
                </div>
              </div>

              <div className="edit-actions">
                <button type="button" className="btn-modal btn-modal-cancel" style={{flex: '0 0 100px'}} onClick={() => setEditTarget(null)}>Cancel</button>
                <button type="submit" className="btn-modal" style={{flex: '0 0 140px', background: '#059669', color: 'white'}} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Update Party'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- VIEW DETAILS MODAL --- */}
      {viewParty && (
        <div className="modal-overlay" onClick={() => setViewParty(null)}>
          <div className="large-modal-content" onClick={(e) => e.stopPropagation()}>
             <div className="modal-header">
              <h2 className="modal-title">{viewParty.party_name}</h2>
              <button onClick={() => setViewParty(null)} className="close-btn" title="Close"><Icons.Close /></button>
            </div>
            <div className="view-grid">

              <div className="view-group">
                <span className="view-label">Firm Name</span>
                <div className="view-value-box">{viewParty.firm_name || '-'}</div>
              </div>
              <div className="view-group">
                <span className="view-label">Contact Person</span>
                <div className="view-value-box">{viewParty.party_name}</div>
              </div>
              <div className="view-group">
                <span className="view-label">Primary Phone</span>
                <div className="view-value-box">{viewParty.contact_no || '-'}</div>
              </div>
              <div className="view-group">
                <span className="view-label">Alt Phone</span>
                <div className="view-value-box">{viewParty.contact_no_2 || '-'}</div>
              </div>
              <div className="view-group">
                <span className="view-label">Email</span>
                <div className="view-value-box">{viewParty.email || '-'}</div>
              </div>
              <div className="view-group">
                <span className="view-label">GST Number</span>
                <div className="view-value-box">{viewParty.gst_number || '-'}</div>
              </div>
              <div className="view-group">
                <span className="view-label">PAN Number</span>
                <div className="view-value-box">{viewParty.pan_number || '-'}</div>
              </div>
              <div className="view-group">
                <span className="view-label">Reference</span>
                <div className="view-value-box">
                    {viewParty.reference_person} {viewParty.reference_contact_no ? `(${viewParty.reference_contact_no})` : ''}
                    {!viewParty.reference_person && '-'}
                </div>
              </div>
            </div>
            <div className="view-group">
              <span className="view-label">Billing Address</span>
              <div className="view-value-box textarea">{viewParty.billing_address || 'No address provided.'}</div>
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
  Close: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 6L6 18M6 6L18 18" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

export default PartyMasterTable;