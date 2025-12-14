// frontend/src/modules/ReturnItemTable.jsx
import React from 'react';

const ReturnItemTable = ({ data, loading }) => {
  
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Party Name</th>
              <th>Item Name</th>
              <th>Size</th>
              <th style={{textAlign: 'center'}}>Qty Returned</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{textAlign:'center', padding: '40px'}}>Loading...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan="6" style={{textAlign:'center', padding: '40px', color: '#94a3b8'}}>No return logs found.</td></tr>
            ) : (
              data.map((item, index) => (
                <tr key={item.id || index}>
                  <td>{formatDate(item.return_date)}</td>
                  <td style={{fontWeight: 600}}>{item.party_name}</td>
                  <td>{item.item_name}</td>
                  <td>{item.size || '-'}</td>
                  <td style={{textAlign: 'center', fontWeight: 600, color: '#059669'}}>+{item.quantity}</td>
                  <td style={{color: '#64748b'}}>{item.remark || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReturnItemTable;