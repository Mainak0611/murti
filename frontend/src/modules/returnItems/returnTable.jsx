// frontend/src/modules/ReturnItemTable.jsx
import React, { useState, useMemo } from 'react';
import api from '../../lib/api';

const Icons = {
  Pencil: () => (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  ),
};

const ReturnItemTable = ({ data, loading, onRefresh, showToast }) => {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  // Group returns: with challan by challan_number, without challan by date
  const groupedReturns = useMemo(() => {
    const grouped = {};
    
    data.forEach(item => {
      let key;
      if (item.challan_number) {
        // Group by challan number
        key = `challan_${item.challan_number}`;
      } else {
        // Group by date for items without challan
        key = `date_${item.return_date}`;
      }
      
      if (!grouped[key]) {
        grouped[key] = {
          order_id: item.order_id,
          return_date: item.return_date,
          party_name: item.party_name,
          challan_number: item.challan_number,
          order_reference: item.order_reference,
          order_date: item.order_date,
          items: [],
          totalQuantity: 0,
          totalWeight: 0,
          isChallanGroup: !!item.challan_number
        };
      }
      
      grouped[key].items.push(item);
      grouped[key].totalQuantity += parseInt(item.quantity) || 0;
      // Calculate total weight
      const itemWeight = (parseFloat(item.weight) || 0) * (parseInt(item.quantity) || 0);
      grouped[key].totalWeight += itemWeight;
    });
    
    return Object.values(grouped).sort((a, b) => {
      // Challan groups first, then by challan number
      if (a.isChallanGroup && !b.isChallanGroup) return -1;
      if (!a.isChallanGroup && b.isChallanGroup) return 1;
      if (a.isChallanGroup && b.isChallanGroup) {
        return String(b.challan_number).localeCompare(String(a.challan_number));
      }
      // Date groups sorted by date descending
      return new Date(b.return_date) - new Date(a.return_date);
    });
  }, [data]);

  const openModal = (group) => {
    setSelectedOrder(group);
  };

  const closeModal = () => {
    setSelectedOrder(null);
  };

  const handleEdit = (group, e) => {
    e.stopPropagation();
    setEditingGroup(group);
    // Pre-fill edit form with current item data
    setEditForm({
      challan_number: group.challan_number || '',
      items: group.items.map(item => ({
        id: item.id,
        item_name: item.item_name,
        weight: item.weight || 0,
        quantity: item.quantity,
        remark: item.remark || ''
      }))
    });
  };

  const handleEditChange = (itemIndex, field, value) => {
    setEditForm(prev => {
      const updated = { ...prev };
      updated.items[itemIndex][field] = value;
      return updated;
    });
  };

  const saveEdit = async () => {
    if (!editingGroup) return;

    if (!editForm.challan_number || !editForm.challan_number.trim()) {
      showToast('Challan Number is required', 'error');
      return;
    }

    setIsSaving(true);
    try {
      // Check if challan number changed
      const challanChanged = editForm.challan_number !== (editingGroup.challan_number || '');
      
      // Update each item in the group
      for (let i = 0; i < editingGroup.items.length; i++) {
        const original = editingGroup.items[i];
        const updated = editForm.items[i];
        
        const quantityChanged = updated.quantity !== original.quantity;
        const remarkChanged = updated.remark !== original.remark;
        
        // Update if quantity, remark, or challan changed
        if (quantityChanged || remarkChanged || challanChanged) {
          const quantityDiff = quantityChanged ? parseInt(updated.quantity) - parseInt(original.quantity) : 0;
          
          // Update return entry
          await api.put(`/api/returns/${updated.id}`, {
            quantity: parseInt(updated.quantity),
            remark: updated.remark,
            challan_number: editForm.challan_number || null,
            quantityDiff: quantityDiff // For stock adjustment
          });
        }
      }
      
      if (showToast) showToast('Return entries updated successfully!', 'success');
      setEditingGroup(null);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error updating return:', error);
      if (showToast) showToast(error.response?.data?.error || 'Failed to update return entries', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (group, e) => {
    e.stopPropagation();
    setDeleteConfirm(group);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    setIsDeleting(true);
    try {
      // Delete all items in this return group
      for (const item of deleteConfirm.items) {
        await api.delete(`/api/returns/${item.id}`);
      }
      
      if (showToast) showToast('Return entries deleted successfully!', 'success');
      setDeleteConfirm(null);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error deleting return:', error);
      if (showToast) showToast(error.response?.data?.error || 'Failed to delete return entries', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  const handleDelete = handleDeleteClick; // Alias for consistency

  return (
    <>
      <style>{`
        .icon-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: white;
          color: #64748b;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          padding: 0;
        }
        .icon-btn:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #334155;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .icon-btn:active {
          transform: translateY(0);
        }
        .icon-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
        .icon-btn.danger {
          border-color: #e2e8f0;
          color: #64748b;
        }
        .icon-btn.danger:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #334155;
        }
      `}</style>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Challan Number</th>
                <th>Party Name</th>
                <th>Order Date</th>
                <th style={{textAlign: 'center'}}>Total Qty Returned</th>
                <th style={{textAlign: 'center'}}>Total Weight</th>
                <th style={{textAlign: 'center'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{textAlign:'center', padding: '40px'}}>Loading...</td></tr>
              ) : groupedReturns.length === 0 ? (
                <tr><td colSpan="8" style={{textAlign:'center', padding: '40px', color: '#94a3b8'}}>No return logs found.</td></tr>
              ) : (
                groupedReturns.map((group, idx) => {
                  const groupKey = group.challan_number ? `challan_${group.challan_number}` : `date_${group.return_date}_${idx}`;
                  
                  return (
                    <tr 
                      key={groupKey}
                      onClick={() => openModal(group)}
                      style={{
                        cursor: 'pointer',
                        opacity: isDeleting ? 0.5 : 1,
                        pointerEvents: isDeleting ? 'none' : 'auto'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td>{formatDate(group.return_date)}</td>
                      <td style={{fontWeight: 600, color: '#0891b2'}}>
                        {group.challan_number ? (
                          group.challan_number
                        ) : (
                          <span style={{color: '#ef4444', fontSize: '12px'}}>No Challan</span>
                        )}
                      </td>
                      <td style={{fontWeight: 600}}>{group.party_name}</td>
                      <td style={{color: '#64748b'}}>{formatDate(group.order_date)}</td>
                      <td style={{textAlign: 'center', fontWeight: 600, color: '#059669'}}>+{group.totalQuantity}</td>
                      <td style={{textAlign: 'center', fontWeight: 600, color: '#0891b2', fontSize: '13px'}}>{group.totalWeight.toFixed(2)} kg</td>
                      <td style={{textAlign: 'center'}}>
                        <div style={{display: 'flex', gap: '8px', justifyContent: 'center'}}>
                          <button
                            className="icon-btn"
                            onClick={(e) => handleEdit(group, e)}
                            disabled={isDeleting}
                            title="Edit"
                          >
                            <Icons.Pencil />
                          </button>
                          <button
                            className="icon-btn danger"
                            onClick={(e) => handleDelete(group, e)}
                            disabled={isDeleting}
                            title="Delete"
                          >
                            <Icons.Trash />
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

      {/* Modal Popup */}
      {selectedOrder && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={closeModal}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{marginBottom: '20px', paddingBottom: '16px', borderBottom: '2px solid #e2e8f0'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start'}}>
                <div>
                  <h3 style={{margin: '0 0 8px 0', fontSize: '20px', fontWeight: 600, color: '#1e293b'}}>
                    Return Details
                  </h3>
                  <div style={{fontSize: '14px', color: '#64748b'}}>
                    <span style={{fontWeight: 600, color: '#334155'}}>{selectedOrder.party_name}</span>
                    <span style={{margin: '0 8px'}}>•</span>
                    <span>{formatDate(selectedOrder.return_date)}</span>
                    {selectedOrder.challan_number && (
                      <>
                        <span style={{margin: '0 8px'}}>•</span>
                        <span style={{color: '#0891b2', fontWeight: 600}}>Challan: {selectedOrder.challan_number}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '0',
                    lineHeight: 1,
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                    e.currentTarget.style.color = '#1e293b';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#64748b';
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Content - Items Table */}
            <div style={{overflowX: 'auto'}}>
              <table style={{width: '100%', fontSize: '14px', borderCollapse: 'collapse'}}>
                <thead>
                  <tr style={{borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc'}}>
                    <th style={{padding: '12px', textAlign: 'left', fontWeight: 600, color: '#475569'}}>Item Name</th>
                    <th style={{padding: '12px', textAlign: 'left', fontWeight: 600, color: '#475569'}}>Size</th>
                    <th style={{padding: '12px', textAlign: 'center', fontWeight: 600, color: '#475569'}}>Qty Returned</th>
<th style={{padding: '12px', textAlign: 'center', fontWeight: 600, color: '#475569'}}>Weight</th>
<th style={{padding: '12px', textAlign: 'left', fontWeight: 600, color: '#475569'}}>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map((item, idx) => {
                    const itemWeight = (parseFloat(item.weight) || 0) * (parseInt(item.quantity) || 0);
                    return (
                      <tr 
                        key={idx} 
                        style={{
                          borderBottom: idx < selectedOrder.items.length - 1 ? '1px solid #f1f5f9' : 'none',
                          backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb'
                        }}
                      >
                        <td style={{padding: '12px', color: '#334155', fontWeight: 500}}>{item.item_name}</td>
                        <td style={{padding: '12px', color: '#64748b'}}>{item.size || '-'}</td>
                        <td style={{padding: '12px', textAlign: 'center', fontWeight: 600, color: '#059669'}}>+{item.quantity}</td>
                        <td style={{padding: '12px', textAlign: 'center', fontWeight: 600, color: '#0891b2', fontSize: '13px'}}>{itemWeight.toFixed(2)} kg</td>
                        <td style={{padding: '12px', color: '#64748b'}}>{item.remark || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{borderTop: '2px solid #e2e8f0', backgroundColor: '#f8fafc'}}>
                    <td colSpan="2" style={{padding: '12px', fontWeight: 600, color: '#1e293b'}}>Total</td>
                    <td style={{padding: '12px', textAlign: 'center', fontWeight: 700, color: '#059669', fontSize: '15px'}}>+{selectedOrder.totalQuantity}</td>
                    <td style={{padding: '12px', textAlign: 'center', fontWeight: 700, color: '#0891b2', fontSize: '15px'}}>{selectedOrder.totalWeight.toFixed(2)} kg</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingGroup && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => !isSaving && setEditingGroup(null)}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{marginBottom: '20px', paddingBottom: '16px', borderBottom: '2px solid #e2e8f0'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start'}}>
                <div>
                  <h3 style={{margin: '0 0 8px 0', fontSize: '20px', fontWeight: 600, color: '#1e293b'}}>
                    Edit Return
                  </h3>
                  <div style={{fontSize: '14px', color: '#64748b'}}>
                    <span style={{fontWeight: 600, color: '#334155'}}>{editingGroup.party_name}</span>
                    <span style={{margin: '0 8px'}}>•</span>
                    <span>{formatDate(editingGroup.return_date)}</span>
                  </div>
                </div>
                <button
                  onClick={() => !isSaving && setEditingGroup(null)}
                  disabled={isSaving}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    color: '#64748b',
                    padding: '0',
                    lineHeight: 1,
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    transition: 'all 0.2s',
                    opacity: isSaving ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => !isSaving && (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Challan Number Field */}
            <div style={{marginBottom: '20px'}}>
              <label style={{display: 'block', fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px'}}>
                Challan Number <span style={{color: '#ef4444'}}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., CHL-001"
                value={editForm.challan_number || ''}
                onChange={(e) => setEditForm({...editForm, challan_number: e.target.value})}
                disabled={isSaving}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#334155',
                  boxSizing: 'border-box',
                  opacity: isSaving ? 0.6 : 1,
                  cursor: isSaving ? 'not-allowed' : 'auto'
                }}
              />
            </div>

            {/* Edit Items Table */}
            <div style={{overflowX: 'auto', marginBottom: '20px'}}>
              <table style={{width: '100%', fontSize: '14px', borderCollapse: 'collapse'}}>
                <thead>
                  <tr style={{borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc'}}>
                    <th style={{padding: '12px', textAlign: 'left', fontWeight: 600, color: '#475569'}}>Item Name</th>
                    <th style={{padding: '12px', textAlign: 'center', fontWeight: 600, color: '#475569'}}>Quantity</th>
                    <th style={{padding: '12px', textAlign: 'center', fontWeight: 600, color: '#475569'}}>Weight</th>
                    <th style={{padding: '12px', textAlign: 'left', fontWeight: 600, color: '#475569'}}>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {editForm.items && editForm.items.map((item, idx) => {
                    const itemWeight = (parseFloat(item.weight) || 0) * (parseInt(item.quantity) || 0);
                    return (
                      <tr key={idx} style={{borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb'}}>
                        <td style={{padding: '12px', color: '#334155', fontWeight: 500}}>{item.item_name}</td>
                        <td style={{padding: '12px', textAlign: 'center'}}>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleEditChange(idx, 'quantity', e.target.value)}
                            disabled={isSaving}
                            style={{
                              width: '70px',
                              padding: '8px',
                              textAlign: 'center',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              fontSize: '14px',
                              opacity: isSaving ? 0.6 : 1,
                              cursor: isSaving ? 'not-allowed' : 'auto'
                            }}
                          />
                        </td>
                        <td style={{padding: '12px', textAlign: 'center', fontWeight: 600, color: '#0891b2', fontSize: '13px'}}>
                          {itemWeight.toFixed(2)} kg
                        </td>
                        <td style={{padding: '12px'}}>
                          <input
                            type="text"
                            placeholder="Add remark"
                            value={item.remark}
                            onChange={(e) => handleEditChange(idx, 'remark', e.target.value)}
                            disabled={isSaving}
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              fontSize: '14px',
                              opacity: isSaving ? 0.6 : 1,
                              cursor: isSaving ? 'not-allowed' : 'auto'
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Actions */}
            <div style={{display: 'flex', gap: '12px', justifyContent: 'flex-end'}}>
              <button
                onClick={() => setEditingGroup(null)}
                disabled={isSaving}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: 'white',
                  color: '#334155',
                  fontWeight: 600,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={isSaving}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#059669',
                  color: 'white',
                  fontWeight: 600,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={cancelDelete}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '32px',
              width: '400px',
              maxWidth: '90%',
              textAlign: 'center',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              width: '48px',
              height: '48px',
              background: '#fee2e2',
              color: '#ef4444',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </div>
            <h3 style={{fontSize: '20px', fontWeight: 700, color: '#111827', margin: '0 0 8px 0'}}>Delete Returns?</h3>
            <p style={{fontSize: '14px', color: '#6b7280', margin: '0 0 24px 0'}}>
              Are you sure you want to delete all returns for {deleteConfirm.party_name}? This will reduce the stock accordingly and cannot be undone.
            </p>
            <div style={{display: 'flex', gap: '12px', justifyContent: 'center'}}>
              <button
                onClick={cancelDelete}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  color: '#374151',
                  transition: 'all 0.2s',
                  opacity: isDeleting ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  transition: 'all 0.2s',
                  opacity: isDeleting ? 0.6 : 1
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
     </>
  );
}

export default ReturnItemTable;