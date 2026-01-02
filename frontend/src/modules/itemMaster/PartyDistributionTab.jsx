// frontend/src/modules/itemMaster/PartyDistributionTab.jsx
import React, { useState, useEffect } from 'react';
import api from '../../lib/api';

// ==========================================
// MODAL: PARTY DISTRIBUTION DETAILS
// ==========================================
const PartyDistributionModal = ({ item, onClose }) => {
  const [distribution, setDistribution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch real party distribution data
    api.get(`/api/items/${item.id}/distribution/parties`)
      .then(res => {
        setDistribution(res.data.data);
        setError(null);
      })
      .catch(err => {
        console.error("Failed to load party distribution", err);
        setError("Failed to load distribution details");
      })
      .finally(() => setLoading(false));
  }, [item.id]);

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ width: '600px' }}>
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>
              {distribution?.item_name} Distribution
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              Item: {distribution?.item_name} {distribution?.item_size ? `(${distribution.item_size})` : ''}
            </p>
          </div>
          <button onClick={onClose} className="close-btn">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <div className="modal-body" style={{ padding: '16px 24px' }}>
          {/* Stock Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#15803d', fontWeight: '500' }}>Godown Stock</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#166534' }}>
                {distribution?.godown_stock || 0}
              </p>
            </div>
            <div style={{ padding: '12px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
              <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#1e40af', fontWeight: '500' }}>Total With Parties</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#1d4ed8' }}>
                {distribution?.total_party_stock || 0}
              </p>
            </div>
          </div>

          {/* Party Distribution Table */}
          <div style={{ overflowY: 'auto', maxHeight: '50vh' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>Loading distribution...</div>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#dc2626' }}>{error}</div>
            ) : !distribution || distribution.parties.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                No party distribution found. Item not yet dispatched to any party.
              </div>
            ) : (
              <table className="data-table" style={{ borderTop: 'none' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                  <tr>
                    <th style={{ paddingLeft: '24px', textAlign: 'left' }}>Party Name</th>
                    <th style={{ textAlign: 'center' }}>Contact</th>
                    <th style={{ paddingRight: '24px', textAlign: 'right' }}>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {distribution.parties.map((party, idx) => (
                    <tr key={party.id || idx}>
                      <td style={{ paddingLeft: '24px' }} className="text-slate-700 font-medium">
                        {party.party_name}
                      </td>
                      <td style={{ textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                        {party.contact_no || '-'}
                      </td>
                      <td style={{ paddingRight: '24px', textAlign: 'right' }}>
                        <span style={{ 
                          background: '#dbeafe', 
                          color: '#1e40af', 
                          padding: '4px 10px', 
                          borderRadius: '20px', 
                          fontSize: '13px', 
                          fontWeight: '600' 
                        }}>
                          {party.quantity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// MAIN COMPONENT: PARTY DISTRIBUTION TAB
// ==========================================
const PartyDistributionTab = ({ data, loading }) => {
    const [selectedItem, setSelectedItem] = useState(null);

    return (
        <>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#334155' }}>Item Distribution Overview</h3>
                </div>

                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                <th>Size</th>
                                <th className="text-center">Total With Parties</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="3" style={{textAlign:'center', padding: '40px'}}>Loading...</td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan="3" style={{textAlign:'center', padding: '40px', color: '#94a3b8'}}>No items found.</td></tr>
                            ) : (
                                data.map(item => (
                                    <tr 
                                        key={item.id} 
                                        className="hover:bg-slate-50"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => setSelectedItem(item)}
                                        title="Click to view party distribution"
                                    >
                                        <td className="p-4 font-semibold text-slate-700">{item.item_name}</td>
                                        <td className="p-4 text-slate-600">{item.size || '-'}</td>
                                        <td className="p-4 text-center">
                                            <span style={{ 
                                                background: '#eff6ff', color: '#1d4ed8', 
                                                padding: '4px 10px', borderRadius: '20px', fontSize: '13px', fontWeight: '700' 
                                            }}>
                                                {item.party_stock || 0}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedItem && (
                <PartyDistributionModal 
                    item={selectedItem} 
                    onClose={() => setSelectedItem(null)} 
                />
            )}
        </>
    );
};

export default PartyDistributionTab;