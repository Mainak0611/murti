import React from 'react';
import { Link } from 'react-router-dom';
import { Icons } from './DashboardIcons';

const TableSection = ({ title, data, type }) => {
  if (data.length === 0) {
    return (
      <div className="table-wrapper">
         <div className="empty-state">No {type === 'today' ? 'payments scheduled for today' : 'past due records'}.</div>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Party</th>
            <th>Contact</th>
            <th>{type === 'today' ? 'Remark' : 'Latest Date'}</th>
            <th>Status</th>
            <th style={{textAlign: 'right'}}>Action</th>
          </tr>
        </thead>
        <tbody>
          {data.map(p => (
            <tr key={p.id}>
              <td style={{ fontWeight: 600 }}>{p.party}</td>
              <td>{p.contact_no || '-'}</td>
              {type === 'today' ? (
                <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-muted)' }}>
                  {p.latest_remark || '-'}
                </td>
              ) : (
                <td style={{ color: 'var(--text-muted)' }}>
                  { (p.latest_payment ? String(p.latest_payment).substring(0,10) : '-') }
                </td>
              )}
              <td>
                <span className="status-pill" style={{
                  backgroundColor: p.payment_status === 'PAID' ? '#d1fae5' : p.payment_status === 'PARTIAL' ? '#ffedd5' : '#fee2e2',
                  color: p.payment_status === 'PAID' ? '#065f46' : p.payment_status === 'PARTIAL' ? '#9a3412' : '#991b1b'
                }}>
                  {p.payment_status}
                </span>
              </td>
              <td style={{ textAlign: 'right' }}>
                <Link to="/payments" className="btn-sm-outline" style={{ textDecoration: 'none' }}>View</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function PaymentTables({ todaysPayments, pastDuePayments }) {
  return (
    <div className="card">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap'}}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Icon Container */}
          <div style={{
            width: '42px', height: '42px',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white',
            boxShadow: '0 2px 5px rgba(217, 119, 6, 0.2)',
            flexShrink: 0
          }}>
            <Icons.Clock size={20} />
          </div>
          
          <div>
            <h3 style={{ fontSize: '18px', margin: 0, fontWeight: 700 }}>Due Today</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Records scheduled for {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {todaysPayments.length > 0 && (
            <span className="status-pill" style={{background: '#dbeafe', color: '#1e40af'}}>
              {todaysPayments.length} Record{todaysPayments.length !== 1 ? 's' : ''}
            </span>
          )}
          {pastDuePayments.length > 0 && (
            <span className="status-pill" style={{background: '#fee2e2', color: '#991b1b'}}>
              {pastDuePayments.length} Past Due
            </span>
          )}
          
          {/* View All Button Added Here */}
          <Link to="/payments" style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap', marginLeft: '4px' }}>
            View All
          </Link>
        </div>
      </div>

      <div className="two-col">
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Today</div>
          <TableSection data={todaysPayments} type="today" />
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Past Due</div>
          <TableSection data={pastDuePayments} type="pastDue" />
        </div>
      </div>
    </div>
  );
}