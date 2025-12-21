// frontend/src/modules/settings/EmployeeTab.jsx
import React, { useState, useEffect } from 'react';
import api from '../../lib/api';

const EmployeeTab = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [deleteTargetId, setDeleteTargetId] = useState(null);
    
    // Form State
    const [formData, setFormData] = useState({ name: '', email: '', username: '', password: '' });

    useEffect(() => {
        fetchEmployees();
    }, []);

    // Auto-dismiss toast
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/users/employees');
            setEmployees(res.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreate = () => {
        setEditingId(null);
        setFormData({ name: '', email: '', username: '', password: '' });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (emp) => {
        setEditingId(emp.id);
        setFormData({ 
            name: emp.name, 
            email: emp.email || '', 
            username: emp.username || '', 
            password: '' 
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/api/users/employees/${editingId}`, formData);
                setToast({ type: 'success', msg: 'Employee updated successfully' });
            } else {
                await api.post('/api/users/employees', formData);
                setToast({ type: 'success', msg: 'Employee created successfully' });
            }
            setIsModalOpen(false);
            fetchEmployees();
        } catch (err) {
            setToast({ type: 'error', msg: err.response?.data?.error || 'Operation failed' });
        }
    };

    const initiateDelete = (id) => {
        setDeleteTargetId(id);
    };

    const confirmDelete = async () => {
        if (!deleteTargetId) return;
        try {
            await api.delete(`/api/users/employees/${deleteTargetId}`);
            setToast({ type: 'success', msg: 'Employee deleted' });
            setDeleteTargetId(null);
            fetchEmployees();
        } catch (err) {
            setToast({ type: 'error', msg: 'Failed to delete' });
            setDeleteTargetId(null);
        }
    };

    return (
        <div>
            {/* --- STYLES (Copied & Adapted from Reference) --- */}
            <style>{`
                /* General Layout */
                .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                
                /* Toast Notification */
                .msg {
                    padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; font-size: 14px; font-weight: 500;
                    animation: slideDown 0.3s ease-out;
                }
                .msg-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
                .msg-error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
                @keyframes slideDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

                /* Table Styles */
                .card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
                .table-container { overflow-x: auto; }
                .data-table { width: 100%; border-collapse: collapse; }
                .data-table th { 
                    text-align: left; padding: 12px 16px; background: #f8fafc; 
                    border-bottom: 1px solid #e2e8f0; color: #64748b; 
                    font-size: 12px; font-weight: 600; text-transform: uppercase; 
                }
                .data-table td { 
                    padding: 12px 16px; border-bottom: 1px solid #e2e8f0; 
                    color: #334155; font-size: 14px; vertical-align: middle;
                }
                .data-table tr:last-child td { border-bottom: none; }
                .data-table tr:hover { background-color: #f8fafc; }

                /* Action Buttons */
                .icon-btn {
                    background: none; border: none; cursor: pointer; padding: 6px;
                    border-radius: 4px; color: #64748b; display: flex; align-items: center; justify-content: center;
                    transition: all 0.2s;
                }
                .icon-btn:hover { background: #e2e8f0; color: #0f172a; }
                .icon-btn.danger:hover { background: #fee2e2; color: #ef4444; }

                /* Buttons */
                .btn {
                    padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;
                    cursor: pointer; border: none; transition: all 0.2s;
                }
                .btn-primary { background: #059669; color: white; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
                .btn-primary:hover { background: #047857; }
                .btn-secondary { background: white; border: 1px solid #e2e8f0; color: #334155; }
                .btn-secondary:hover { background: #f8fafc; border-color: #cbd5e1; }
                
                /* Modal Styles */
                .modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);
                    z-index: 3000; display: flex; align-items: center; justify-content: center;
                }
                .large-modal {
                    background: white; width: 500px; max-width: 95%; 
                    border-radius: 12px; padding: 24px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    animation: popIn 0.2s ease-out;
                }
                .confirm-modal {
                     background: white; padding: 32px; border-radius: 16px; width: 400px; max-width: 90%; text-align: center;
                }
                .close-btn {
                    background: none; border: none; cursor: pointer; padding: 0;
                    display: flex; align-items: center; justify-content: center;
                    border-radius: 6px; transition: background 0.2s;
                    height: 32px; width: 32px;
                }
                .close-btn:hover { background: #f1f5f9; }

                /* Form Elements */
                .form-label { display: block; font-size: 13px; font-weight: 500; color: #334155; margin-bottom: 4px; }
                .form-input {
                    width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;
                    font-size: 14px; color: #0f172a; transition: border-color 0.15s;
                    box-sizing: border-box;
                }
                .form-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
                .form-group { margin-bottom: 16px; }

                @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            `}</style>

            <div className="header-row">
                <div>
                    <h2 style={{fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0}}>Employees</h2>
                    <p style={{color: '#64748b', margin: '4px 0 0 0', fontSize: 14}}>Add or remove team members.</p>
                </div>
                <button className="btn btn-primary" onClick={handleOpenCreate}>+ Add Employee</button>
            </div>

            {toast && <div className={`msg ${toast.type === 'error' ? 'msg-error' : 'msg-success'}`}>{toast.msg}</div>}

            <div className="card">
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Username / ID</th>
                                <th>Email</th>
                                <th style={{width: 100, textAlign:'center'}}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <tr><td colSpan={4} style={{textAlign:'center', padding: '40px'}}>Loading...</td></tr> : 
                            employees.length === 0 ? <tr><td colSpan={4} style={{textAlign:'center', padding: '40px', color:'#94a3b8'}}>No employees found.</td></tr> :
                            employees.map(emp => (
                                <tr key={emp.id}>
                                    <td style={{fontWeight: 600}}>{emp.name}</td>
                                    <td style={{fontFamily: 'monospace', color: '#059669', fontSize: 13}}>{emp.username || '-'}</td>
                                    <td>{emp.email || '-'}</td>
                                    <td>
                                        <div style={{display:'flex', gap: '8px', alignItems: 'center', justifyContent: 'center'}}>
                                            <button className="icon-btn" onClick={() => handleOpenEdit(emp)} title="Edit"><Icons.Pencil /></button>
                                            <button className="icon-btn danger" onClick={() => initiateDelete(emp.id)} title="Delete"><Icons.Trash /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CREATE / EDIT MODAL */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="large-modal" onClick={e => e.stopPropagation()}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems: 'center', marginBottom: 20}}>
                            <h3 style={{fontSize: 18, fontWeight: 700, margin:0}}>{editingId ? 'Edit Employee' : 'New Employee'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="close-btn"><Icons.Close /></button>
                        </div>
                        
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Full Name</label>
                                <input className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="e.g. John Doe" />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Login ID / Username</label>
                                <input 
                                    className="form-input" 
                                    placeholder="e.g. EMP001"
                                    value={formData.username} 
                                    onChange={e => setFormData({...formData, username: e.target.value})} 
                                    required 
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Email Address (Optional)</label>
                                <input type="email" className="form-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="john@company.com" />
                            </div>
                            
                            {!editingId && (
                                <div className="form-group">
                                    <label className="form-label">Password</label>
                                    <input type="password" className="form-input" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required minLength={6} placeholder="••••••" />
                                </div>
                            )}

                            <div style={{marginTop: 30, display:'flex', justifyContent:'flex-end', gap: 10}}>
                                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingId ? 'Save Changes' : 'Create Employee'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deleteTargetId && (
                <div className="modal-overlay" onClick={() => setDeleteTargetId(null)}>
                    <div className="confirm-modal" onClick={e => e.stopPropagation()}>
                        <div style={{width: 48, height: 48, background: '#fee2e2', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'}}>
                           <Icons.TrashLarge />
                        </div>
                        <h3 style={{fontSize: 20, fontWeight: 700, marginBottom: 8}}>Confirm Delete</h3>
                        <p style={{color: '#6b7280', marginBottom: 24, fontSize: 14}}>Are you sure you want to remove this employee? This action cannot be undone.</p>
                        <div style={{display: 'flex', gap: 12, justifyContent: 'center'}}>
                          <button className="btn btn-secondary" onClick={() => setDeleteTargetId(null)}>Cancel</button>
                          <button className="btn btn-primary" style={{background: '#ef4444', border:'none'}} onClick={confirmDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Simple SVG Icons Component
const Icons = {
  Pencil: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
  Trash: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  TrashLarge: () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  Close: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

export default EmployeeTab;