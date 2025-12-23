import React, { useState, useEffect } from 'react';
import api from '../../lib/api';

const AccessControlTab = () => {
    const [employees, setEmployees] = useState([]);
    const [selectedEmpId, setSelectedEmpId] = useState('');
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);

    // --- UPDATED MODULES LIST ---
    // Added keys for 'party_enquiries' and 'payment_records' to match backend routes
    const modules = [
        { key: 'dashboard', label: 'Dashboard', desc: 'View analytics and daily summary' },
        { key: 'confirmed_orders', label: 'Confirmed Orders', desc: 'Manage and dispatch orders' },
        { key: 'completed_orders', label: 'Completed Orders', desc: 'View and review completed orders' },
        { key: 'party_enquiries', label: 'Party Enquiries', desc: 'Manage incoming enquiries and create orders' },
        { key: 'payment_records', label: 'Payment Records', desc: 'Track payments and merge records' },
        { key: 'returns_module', label: 'Return Items', desc: 'Log and track returned goods' },
        { key: 'item_master', label: 'Item Master', desc: 'Add or edit inventory items' },
        { key: 'party_master', label: 'Party Master', desc: 'Manage clients and suppliers' }
    ];

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/users/employees'); 
            const data = res.data.data || [];
            setEmployees(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (moduleKey, currentStatus) => {
        if (!selectedEmpId) return;

        // 1. Optimistic UI Update
        const updatedEmployees = employees.map(emp => {
            if (String(emp.id) === String(selectedEmpId)) {
                const perms = emp.permissions || [];
                const newPerms = currentStatus 
                    ? perms.filter(p => p !== moduleKey) // Remove
                    : [...perms, moduleKey]; // Add
                return { ...emp, permissions: newPerms };
            }
            return emp;
        });
        setEmployees(updatedEmployees);

        // 2. API Call
        try {
            await api.put(`/api/users/${selectedEmpId}/permissions`, { 
                moduleKey, 
                action: currentStatus ? 'remove' : 'add' 
            });
        } catch (err) {
            console.error("Failed to update permission", err);
            setToast({ type: 'error', msg: 'Failed to save changes. Reverting...' });
            fetchEmployees(); // Revert on error
        }
    };

    const selectedEmployee = employees.find(e => String(e.id) === String(selectedEmpId));

    return (
        <div>
            <style>{`
                .selection-area { margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #e2e8f0; }
                .user-select { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 14px; background: white; }
                
                .permissions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                .perm-card { 
                    border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; 
                    display: flex; justify-content: space-between; align-items: center;
                    background: #f8fafc; transition: all 0.2s;
                }
                .perm-card:hover { border-color: #cbd5e1; background: white; }
                
                .perm-info h4 { margin: 0 0 4px 0; font-size: 14px; color: #0f172a; }
                .perm-info p { margin: 0; font-size: 12px; color: #64748b; }

                .empty-state { text-align: center; padding: 40px; color: #94a3b8; font-style: italic; border: 1px dashed #e2e8f0; border-radius: 8px; }

                .switch { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
                .switch input { opacity: 0; width: 0; height: 0; }
                .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; transition: .4s; border-radius: 22px; }
                .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
                input:checked + .slider { background-color: #059669; }
                input:checked + .slider:before { transform: translateX(18px); }
                
                @media (max-width: 600px) { .permissions-grid { grid-template-columns: 1fr; } }
            `}</style>

            <h2>Access Control</h2>
            <p className="info-text">Select an employee to configure their module access rights.</p>
            
            {toast && <div className={`msg ${toast.type === 'error' ? 'msg-error' : 'msg-success'}`}>{toast.msg}</div>}

            <div className="selection-area">
                <label className="form-label">Select Employee</label>
                <select 
                    className="user-select" 
                    value={selectedEmpId} 
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    disabled={loading}
                >
                    <option value="">-- Choose a team member --</option>
                    {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                            {emp.name} ({emp.email || emp.username})
                        </option>
                    ))}
                </select>
            </div>

            {loading ? (
                <p>Loading...</p>
            ) : !selectedEmpId ? (
                <div className="empty-state">
                    Please select an employee above to view and edit permissions.
                </div>
            ) : (
                <div>
                    <h3 style={{fontSize: '16px', margin: '0 0 16px 0'}}>
                        Permissions for <span style={{color: '#059669'}}>{selectedEmployee?.name}</span>
                    </h3>
                    
                    <div className="permissions-grid">
                        {modules.map(mod => {
                            const hasAccess = selectedEmployee?.permissions?.includes(mod.key);
                            return (
                                <div key={mod.key} className="perm-card">
                                    <div className="perm-info">
                                        <h4>{mod.label}</h4>
                                        <p>{mod.desc}</p>
                                    </div>
                                    <label className="switch">
                                        <input 
                                            type="checkbox" 
                                            checked={hasAccess || false} 
                                            onChange={() => handleToggle(mod.key, hasAccess)} 
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccessControlTab;