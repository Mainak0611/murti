
// import React, { useState } from 'react';
// import api from '../../lib/api';

// const PartyEnquiryTable = ({ data, loading, fetchData, showToast }) => {
//   const [editingId, setEditingId] = useState(null);
//   const [editForm, setEditForm] = useState({});
//   const [viewItem, setViewItem] = useState(null);

//   // --- DELETE CONFIRMATION STATE ---
//   const [deleteTargetId, setDeleteTargetId] = useState(null); 
  
//   const isToday = (dateString) => {
//     if (!dateString) return false;
//     const d = new Date(dateString);
//     const today = new Date();
//     return d.getDate() === today.getDate() &&
//            d.getMonth() === today.getMonth() &&
//            d.getFullYear() === today.getFullYear();
//   };

//   const formatDate = (dateString) => {
//     if (!dateString) return '-';
//     return new Date(dateString).toLocaleDateString('en-GB', {
//       day: '2-digit', month: 'short', year: 'numeric'
//     });
//   };

//   const createRipple = (event) => {
//     if (event.target.closest('button') || event.target.closest('input')) return; 
    
//     const cell = event.currentTarget; 
//     const existing = cell.getElementsByClassName("ripple")[0];
//     if (existing) existing.remove();
    
//     const circle = document.createElement("span");
//     const diameter = Math.max(cell.clientWidth, cell.clientHeight);
//     const radius = diameter / 2;
//     const rect = cell.getBoundingClientRect();
    
//     circle.style.width = circle.style.height = `${diameter}px`;
//     circle.style.left = `${event.clientX - rect.left - radius}px`;
//     circle.style.top = `${event.clientY - rect.top - radius}px`;
//     circle.classList.add("ripple");
    
//     cell.appendChild(circle);
//     setTimeout(() => circle.remove(), 600);
//   };

//   // --- DELETE LOGIC ---
//   const initiateDelete = (e, id) => {
//     e.stopPropagation();
//     setDeleteTargetId(id);
//   };

//   const confirmDelete = async () => {
//     if (!deleteTargetId) return;
//     try {
//       await api.delete(`/api/party-enquiries/${deleteTargetId}`);
//       showToast("Enquiry deleted", "success");
//       setDeleteTargetId(null);
//       fetchData(true); 
//     } catch (err) {
//       console.error(err);
//       showToast("Failed to delete", "error");
//       setDeleteTargetId(null);
//     }
//   };

//   const cancelDelete = () => {
//     setDeleteTargetId(null);
//   };

//   // --- EDIT LOGIC ---
//   const handleEditStart = (e, item) => {
//     e.stopPropagation();
//     setEditingId(item.id);
//     let dateForInput = '';
//     if (item.enquiry_date) {
//       dateForInput = new Date(item.enquiry_date).toLocaleDateString('en-CA'); 
//     }
//     setEditForm({
//       partyName: item.party_name,
//       contactNo: item.contact_no,
//       reference: item.reference,
//       remark: item.remark,
//       enquiryDate: dateForInput
//     });
//   };

//   const handleEditSave = async (e) => {
//     e.stopPropagation();
//     try {
//       const payload = {
//         party_name: editForm.partyName,
//         contact_no: editForm.contactNo,
//         reference: editForm.reference,
//         remark: editForm.remark,
//         enquiry_date: editForm.enquiryDate
//       };
//       await api.put(`/api/party-enquiries/${editingId}`, payload);
//       showToast("Enquiry updated", "success");
//       setEditingId(null);
//       fetchData(true); 
//     } catch (err) {
//       console.error(err);
//       showToast("Failed to update", "error");
//     }
//   };

//   const handleEditCancel = (e) => {
//     e.stopPropagation();
//     setEditingId(null);
//   };

//   const handleRowClick = (item) => {
//     if (editingId !== item.id) {
//       setViewItem(item);
//     }
//   };

//   return (
//     <>
//       <style>{`
//         /* CONFIRM DELETE MODAL */
//         .confirm-modal-content {
//           background: white; padding: 32px; border-radius: 16px;
//           width: 400px; max-width: 90%; text-align: center;
//           box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
//           animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
//         }
//         .confirm-icon-wrapper {
//           width: 48px; height: 48px; background: #fee2e2; color: #ef4444;
//           border-radius: 50%; display: flex; align-items: center; justify-content: center;
//           margin: 0 auto 16px auto;
//         }
//         .confirm-title { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 8px; }
//         .confirm-desc { font-size: 14px; color: #6b7280; margin-bottom: 24px; }
//         .confirm-actions { display: flex; gap: 12px; justify-content: center; }
//         .btn-modal {
//           flex: 1; padding: 10px 16px; border-radius: 8px; font-weight: 600; font-size: 14px;
//           cursor: pointer; border: 1px solid transparent; transition: all 0.2s;
//         }
//         .btn-modal-cancel { background: white; border: 1px solid #e5e7eb; color: #374151; }
//         .btn-modal-cancel:hover { background: #f9fafb; }
//         .btn-modal-delete { background: #ef4444; color: white; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2); }
//         .btn-modal-delete:hover { background: #dc2626; transform: translateY(-1px); }

//         /* VIEW DETAILS MODAL - REDESIGNED */
//         .view-modal-content {
//           background: white;
//           width: 550px; /* Wider like the screenshot */
//           max-width: 95%;
//           border-radius: 12px;
//           padding: 24px;
//           box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
//           animation: popIn 0.2s ease-out;
//           position: relative;
//         }
        
//         .view-header {
//           display: flex; justify-content: space-between; align-items: flex-start;
//           margin-bottom: 24px;
//         }
//         .view-title {
//           font-size: 20px; font-weight: 800; color: #1e293b;
//           margin: 0; line-height: 1.2; text-transform: uppercase; letter-spacing: 0.5px;
//         }
//         .view-close-btn {
//           background: transparent; border: none; cursor: pointer;
//           color: #94a3b8; padding: 4px; display: flex; align-items: center; justify-content: center;
//           border-radius: 4px; transition: all 0.2s;
//         }
//         .view-close-btn:hover { background: #f1f5f9; color: #64748b; }

//         .view-grid {
//           display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;
//         }
//         .view-group { display: flex; flex-direction: column; gap: 6px; }
        
//         /* Mimics the "Input" look from the screenshot */
//         .view-label {
//           font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;
//         }
//         .view-value-box {
//           background: #f8fafc;
//           border: 1px solid #e2e8f0;
//           border-radius: 6px;
//           padding: 10px 12px;
//           font-size: 14px;
//           font-weight: 500;
//           color: #334155;
//           min-height: 42px; /* Ensure consistency */
//           display: flex; align-items: center;
//         }
//         .view-value-box.textarea {
//           align-items: flex-start;
//           min-height: 80px;
//           line-height: 1.5;
//         }

//         @keyframes popIn {
//           from { transform: scale(0.95); opacity: 0; }
//           to { transform: scale(1); opacity: 1; }
//         }
//       `}</style>

//       <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
//         <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
//           <table className="data-table">
//             <thead>
//               <tr>
//                 <th>Party Name</th>
//                 <th style={{width:'130px'}}>Requirement Date</th>
//                 <th>Contact</th>
//                 <th>Remark</th>
//                 <th>Reference</th>
//                 <th style={{width:'100px'}}>Action</th>
//               </tr>
//             </thead>
//             <tbody>
//               {loading ? (
//                 <tr><td colSpan="6" style={{textAlign:'center', padding: '40px'}}>Loading...</td></tr>
//               ) : data.length === 0 ? (
//                 <tr><td colSpan="6" style={{textAlign:'center', padding: '40px', color: '#94a3b8'}}>No enquiries found.</td></tr>
//               ) : (
//                 data.map((item) => {
//                   const isRowToday = isToday(item.enquiry_date);
//                   const isEditing = editingId === item.id;

//                   return (
//                     <tr 
//                       key={item.id} 
//                       className={isRowToday ? 'row-highlight' : ''}
//                       onClick={() => handleRowClick(item)}
//                       style={{ cursor: isEditing ? 'default' : 'pointer' }}
//                     >
//                       {isEditing ? (
//                         <>
//                           <td><input className="form-input" value={editForm.partyName} onChange={e=>setEditForm({...editForm, partyName: e.target.value})} onClick={e=>e.stopPropagation()} /></td>
//                           <td><input type="date" className="form-input" value={editForm.enquiryDate} onChange={e=>setEditForm({...editForm, enquiryDate: e.target.value})} onClick={e=>e.stopPropagation()} /></td>
//                           <td><input className="form-input" value={editForm.contactNo} onChange={e=>setEditForm({...editForm, contactNo: e.target.value})} onClick={e=>e.stopPropagation()} /></td>
//                           <td><input className="form-input" value={editForm.remark} onChange={e=>setEditForm({...editForm, remark: e.target.value})} onClick={e=>e.stopPropagation()} /></td>
//                           <td><input className="form-input" value={editForm.reference} onChange={e=>setEditForm({...editForm, reference: e.target.value})} onClick={e=>e.stopPropagation()} /></td>
//                           <td>
//                             <div style={{display:'flex', gap: 6}}>
//                               <button className="icon-btn success" onClick={handleEditSave}><Icons.Save /></button>
//                               <button className="icon-btn danger" onClick={handleEditCancel}><Icons.X /></button>
//                             </div>
//                           </td>
//                         </>
//                       ) : (
//                         <>
//                           <td onClick={createRipple} style={{fontWeight: 600}}>{item.party_name}</td>
//                           <td onClick={createRipple}>{formatDate(item.enquiry_date)}</td>
//                           <td onClick={createRipple}>{item.contact_no || '-'}</td>
//                           <td 
//                             onClick={createRipple}
//                             title={item.remark}
//                             style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
//                           >
//                             {item.remark || '-'}
//                           </td>
//                           <td onClick={createRipple}>{item.reference || '-'}</td>
//                           <td>
//                             <div style={{display:'flex', gap: '8px', alignItems: 'center'}}>
//                               <button className="icon-btn" onClick={(e) => handleEditStart(e, item)} title="Edit"><Icons.Pencil /></button>
//                               <button className="icon-btn danger" onClick={(e) => initiateDelete(e, item.id)} title="Delete"><Icons.Trash /></button>
//                             </div>
//                           </td>
//                         </>
//                       )}
//                     </tr>
//                   );
//                 })
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       {/* --- CONFIRM DELETE MODAL --- */}
//       {deleteTargetId && (
//         <div className="modal-overlay" style={{background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)'}} onClick={cancelDelete}>
//           <div className="confirm-modal-content" onClick={e => e.stopPropagation()}>
//             <div className="confirm-icon-wrapper">
//                <Icons.TrashLarge />
//             </div>
//             <h3 className="confirm-title">Confirm Delete</h3>
//             <p className="confirm-desc">Are you sure you want to permanently delete this enquiry? This action cannot be undone.</p>
//             <div className="confirm-actions">
//               <button className="btn-modal btn-modal-cancel" onClick={cancelDelete}>Cancel</button>
//               <button className="btn-modal btn-modal-delete" onClick={confirmDelete}>Delete</button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* --- VIEW DETAILS MODAL (FIXED) --- */}
//       {viewItem && (
//         <div className="modal-overlay" style={{background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)'}} onClick={() => setViewItem(null)}>
//           <div className="view-modal-content" onClick={(e) => e.stopPropagation()}>
             
//              {/* Header */}
//              <div className="view-header">
//               <h2 className="view-title">{viewItem.party_name}</h2>
//               <button onClick={() => setViewItem(null)} className="view-close-btn">
//                 <Icons.XLarge />
//               </button>
//             </div>

//             {/* Grid for details */}
//             <div className="view-grid">
//               <div className="view-group">
//                 <span className="view-label">Requirement Date</span>
//                 <div className="view-value-box">
//                   <Icons.Calendar style={{marginRight: 8, color: '#94a3b8'}} />
//                   {formatDate(viewItem.enquiry_date)}
//                 </div>
//               </div>

//               <div className="view-group">
//                 <span className="view-label">Contact No</span>
//                 <div className="view-value-box">
//                    {viewItem.contact_no || '-'}
//                 </div>
//               </div>
//             </div>

//             {/* Full Width Reference */}
//             <div className="view-group" style={{marginBottom: 16}}>
//               <span className="view-label">Reference</span>
//               <div className="view-value-box">
//                 {viewItem.reference || '-'}
//               </div>
//             </div>

//             {/* Full Width Remark */}
//             <div className="view-group">
//               <span className="view-label">Remark</span>
//               <div className="view-value-box textarea">
//                 {viewItem.remark || 'No remarks provided.'}
//               </div>
//             </div>

//           </div>
//         </div>
//       )}
//     </>
//   );
// };

// const Icons = {
//   Pencil: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
//   Trash: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
//   TrashLarge: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
//   Save: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>,
//   X: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
//   XLarge: () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
//   Calendar: (props) => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>,
// };

// export default PartyEnquiryTable;

import React, { useState } from 'react';
import api from '../../lib/api';

// Accepts viewItem and setViewItem from parent for the modal logic
const PartyEnquiryTable = ({ data, loading, fetchData, showToast, viewItem, setViewItem }) => {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // --- DELETE CONFIRMATION STATE ---
  const [deleteTargetId, setDeleteTargetId] = useState(null); 
  
  const isToday = (dateString) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
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

  // --- DELETE LOGIC ---
  const initiateDelete = (e, id) => {
    e.stopPropagation();
    setDeleteTargetId(id);
  };

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

  const cancelDelete = () => {
    setDeleteTargetId(null);
  };

  // --- EDIT LOGIC ---
  const handleEditStart = (e, item) => {
    e.stopPropagation();
    setEditingId(item.id);
    let dateForInput = '';
    if (item.enquiry_date) {
      dateForInput = new Date(item.enquiry_date).toLocaleDateString('en-CA'); 
    }
    setEditForm({
      partyName: item.party_name,
      contactNo: item.contact_no,
      reference: item.reference,
      remark: item.remark,
      enquiryDate: dateForInput
    });
  };

  const handleEditSave = async (e) => {
    e.stopPropagation();
    try {
      const payload = {
        party_name: editForm.partyName,
        contact_no: editForm.contactNo,
        reference: editForm.reference,
        remark: editForm.remark,
        enquiry_date: editForm.enquiryDate
      };
      await api.put(`/api/party-enquiries/${editingId}`, payload);
      showToast("Enquiry updated", "success");
      setEditingId(null);
      fetchData(true); 
    } catch (err) {
      console.error(err);
      showToast("Failed to update", "error");
    }
  };

  const handleEditCancel = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleRowClick = (item) => {
    if (editingId !== item.id) {
      setViewItem(item);
    }
  };

  return (
    <>
      <style>{`
        /* --- ROW STYLES --- */
        .row-highlight { background: #f0f9ff; }
        .row-editing {
          background-color: #ecfdf5 !important;
          box-shadow: inset 4px 0 0 #10b981;
        }
        .row-editing td {
          border-top: 1px solid #a7f3d0;
          border-bottom: 1px solid #a7f3d0;
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

        /* --- VIEW DETAILS MODAL --- */
        .view-modal-content {
          background: white;
          width: 600px;
          max-width: 95%;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          animation: popIn 0.2s ease-out;
          position: relative;
        }
        
        .view-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 24px;
        }
        .view-title {
          font-size: 18px; font-weight: 800; color: #1e293b;
          margin: 0; text-transform: uppercase; letter-spacing: 0.5px;
        }
        
        /* CLOSE BUTTON STYLE */
        .view-close-btn {
          width: 36px; height: 36px;
          background: white;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          color: #334155;
          padding: 0; /* Fix centering */
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .view-close-btn:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
          transform: translateY(-1px);
        }

        .view-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;
        }
        .view-group { display: flex; flex-direction: column; gap: 6px; }
        
        .view-label {
          font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;
        }
        
        .view-value-box {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 10px 12px;
          font-size: 14px;
          font-weight: 500;
          color: #334155;
          min-height: 42px;
          display: flex; align-items: center;
        }
        .view-value-box.textarea {
          align-items: flex-start;
          min-height: 80px;
          line-height: 1.5;
        }

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
                <th>Party Name</th>
                <th style={{width:'130px'}}>Requirement Date</th>
                <th>Contact</th>
                <th>Remark</th>
                <th>Reference</th>
                <th style={{width:'100px'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{textAlign:'center', padding: '40px'}}>Loading...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan="6" style={{textAlign:'center', padding: '40px', color: '#94a3b8'}}>No enquiries found.</td></tr>
              ) : (
                data.map((item) => {
                  const isRowToday = isToday(item.enquiry_date);
                  const isEditing = editingId === item.id;
                  const rowClassName = isEditing ? 'row-editing' : (isRowToday ? 'row-highlight' : '');

                  return (
                    <tr 
                      key={item.id} 
                      className={rowClassName}
                      onClick={() => handleRowClick(item)}
                      style={{ cursor: isEditing ? 'default' : 'pointer' }}
                    >
                      {isEditing ? (
                        <>
                          <td><input className="form-input" value={editForm.partyName} onChange={e=>setEditForm({...editForm, partyName: e.target.value})} onClick={e=>e.stopPropagation()} /></td>
                          <td><input type="date" className="form-input" value={editForm.enquiryDate} onChange={e=>setEditForm({...editForm, enquiryDate: e.target.value})} onClick={e=>e.stopPropagation()} /></td>
                          <td><input className="form-input" value={editForm.contactNo} onChange={e=>setEditForm({...editForm, contactNo: e.target.value})} onClick={e=>e.stopPropagation()} /></td>
                          <td><input className="form-input" value={editForm.remark} onChange={e=>setEditForm({...editForm, remark: e.target.value})} onClick={e=>e.stopPropagation()} /></td>
                          <td><input className="form-input" value={editForm.reference} onChange={e=>setEditForm({...editForm, reference: e.target.value})} onClick={e=>e.stopPropagation()} /></td>
                          <td>
                            <div style={{display:'flex', gap: 6}}>
                              <button className="icon-btn success" onClick={handleEditSave}><Icons.Save /></button>
                              <button className="icon-btn danger" onClick={handleEditCancel}><Icons.X /></button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td onClick={createRipple} style={{fontWeight: 600}}>{item.party_name}</td>
                          <td onClick={createRipple}>{formatDate(item.enquiry_date)}</td>
                          <td onClick={createRipple}>{item.contact_no || '-'}</td>
                          <td 
                            onClick={createRipple}
                            title={item.remark}
                            style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            {item.remark || '-'}
                          </td>
                          <td onClick={createRipple}>{item.reference || '-'}</td>
                          <td>
                            <div style={{display:'flex', gap: '8px', alignItems: 'center'}}>
                              <button className="icon-btn" onClick={(e) => handleEditStart(e, item)} title="Edit"><Icons.Pencil /></button>
                              <button className="icon-btn danger" onClick={(e) => initiateDelete(e, item.id)} title="Delete"><Icons.Trash /></button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- CONFIRM DELETE MODAL --- */}
      {deleteTargetId && (
        <div className="modal-overlay" style={{background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', zIndex: 3000}} onClick={cancelDelete}>
          <div className="confirm-modal-content" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon-wrapper">
               <Icons.TrashLarge />
            </div>
            <h3 className="confirm-title">Confirm Delete</h3>
            <p className="confirm-desc">Are you sure you want to permanently delete this enquiry? This action cannot be undone.</p>
            <div className="confirm-actions">
              <button className="btn-modal btn-modal-cancel" onClick={cancelDelete}>Cancel</button>
              <button className="btn-modal btn-modal-delete" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* --- VIEW DETAILS MODAL --- */}
      {viewItem && (
        <div className="modal-overlay" style={{background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 3000}} onClick={() => setViewItem(null)}>
          <div className="view-modal-content" onClick={(e) => e.stopPropagation()}>
             
             {/* Header */}
             <div className="view-header">
              <h2 className="view-title">{viewItem.party_name}</h2>
              <button onClick={() => setViewItem(null)} className="view-close-btn" title="Close">
                <Icons.Close />
              </button>
            </div>

            {/* Grid for details */}
            <div className="view-grid">
              <div className="view-group">
                <span className="view-label">Requirement Date</span>
                <div className="view-value-box">
                  <Icons.Calendar style={{marginRight: 8, color: '#94a3b8'}} />
                  {formatDate(viewItem.enquiry_date)}
                </div>
              </div>

              <div className="view-group">
                <span className="view-label">Contact No</span>
                <div className="view-value-box">
                   {viewItem.contact_no || '-'}
                </div>
              </div>
            </div>

            {/* Full Width Reference */}
            <div className="view-group" style={{marginBottom: 16}}>
              <span className="view-label">Reference</span>
              <div className="view-value-box">
                {viewItem.reference || '-'}
              </div>
            </div>

            {/* Full Width Remark */}
            <div className="view-group">
              <span className="view-label">Remark</span>
              <div className="view-value-box textarea">
                {viewItem.remark || 'No remarks provided.'}
              </div>
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
  
  // FIX: Hardcoded stroke color to #1e293b (Slate-800) to ensure visibility
  Close: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 6L6 18M6 6L18 18" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  
  Calendar: (props) => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>,
};

export default PartyEnquiryTable;