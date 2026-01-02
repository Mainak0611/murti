// frontend/src/modules/StockSummaryTab.jsx
import React, { useMemo } from 'react';

const KPICard = ({ title, value, color, icon }) => (
    <div style={{ 
        background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column', gap: '8px', flex: 1,
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
    }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{title}</span>
            <span style={{ color: color, background: `${color}15`, padding: '6px', borderRadius: '8px' }}>
                {icon}
            </span>
        </div>
        <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>
            {value.toLocaleString()}
        </div>
    </div>
);

const StockSummaryTab = ({ data, loading }) => {
    
    // Calculate Totals based on current filtered data
    const totals = useMemo(() => {
        return data.reduce((acc, item) => {
            const godown = Number(item.current_stock) || 0;
            const party = Number(item.party_stock) || 0;
            return {
                godown: acc.godown + godown,
                party: acc.party + party,
                total: acc.total + (godown + party)
            };
        }, { godown: 0, party: 0, total: 0 });
    }, [data]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* KPI SECTION */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <KPICard 
                    title="Godown Stock" 
                    value={totals.godown} 
                    color="#059669" // Green
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>}
                />
                <KPICard 
                    title="Party Stock" 
                    value={totals.party} 
                    color="#2563eb" // Blue
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
                />
                <KPICard 
                    title="Total Inventory" 
                    value={totals.total} 
                    color="#7c3aed" // Purple
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>}
                />
            </div>

            {/* TABLE SECTION */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', margin: 0 }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#334155' }}>Consolidated Stock Report</h3>
                </div>

                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                <th>Size</th>
                                <th className="text-center" style={{ color: '#059669' }}>Godown Stock</th>
                                <th className="text-center" style={{ color: '#2563eb' }}>Party Stock</th>
                                <th className="text-center" style={{ background: '#f8fafc', fontWeight: 800 }}>Total Stock</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" style={{textAlign:'center', padding: '40px'}}>Loading...</td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan="5" style={{textAlign:'center', padding: '40px', color: '#94a3b8'}}>No items found.</td></tr>
                            ) : (
                                data.map(item => {
                                    const godown = Number(item.current_stock) || 0;
                                    const party = Number(item.party_stock) || 0;
                                    const total = godown + party;

                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50">
                                            <td className="p-4 font-semibold text-slate-700">{item.item_name}</td>
                                            <td className="p-4 text-slate-600">{item.size || '-'}</td>
                                            
                                            <td className="p-4 text-center font-bold text-slate-600">
                                                {godown}
                                            </td>
                                            
                                            <td className="p-4 text-center font-bold text-slate-600">
                                                {party}
                                            </td>

                                            <td className="p-4 text-center" style={{ background: '#f8fafc' }}>
                                                <span style={{ 
                                                    background: '#7c3aed', color: 'white', 
                                                    padding: '4px 12px', borderRadius: '6px', fontSize: '14px', fontWeight: '700' 
                                                }}>
                                                    {total}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StockSummaryTab;