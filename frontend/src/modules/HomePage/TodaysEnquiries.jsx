import React from 'react';
import { Link } from 'react-router-dom';
import { Icons } from './DashboardIcons';

export default function TodaysEnquiries({ enquiries, loading }) {
  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Icon Container */}
          <div style={{
            width: '38px', height: '38px',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white',
            boxShadow: '0 2px 5px rgba(37, 99, 235, 0.2)'
          }}>
            <Icons.File size={18} />
          </div>
          <h3 style={{ fontSize: '16px', margin: 0, fontWeight: 700 }}>Today's Enquiries</h3>
        </div>
        
        <Link to="/party-enquiries" style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
          View All
        </Link>
      </div>

      {/* Table Content */}
      <div style={{ overflowX: 'auto', flex: 1 }}>
        {loading ? (
          <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '14px' }}>Loading...</div>
        ) : enquiries.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            No enquiries found for today.
          </div>
        ) : (
          <table className="inner-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Party Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Contact</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Reference</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Remark</th>
              </tr>
            </thead>
            <tbody>
              {enquiries.map((item, index) => (
                <tr key={item.id || index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
                    {item.party_name}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '15px', color: '#64748b' }}>
                    {item.contact_no || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '15px', color: '#64748b' }}>
                    {item.reference || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '15px', color: '#64748b', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.remark || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}