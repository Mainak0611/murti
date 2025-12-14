// frontend/src/modules/ReturnItemForm.jsx
import React, { useState, useEffect } from 'react';
import api from '../../lib/api';

const getTodayLocal = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

const ReturnItemForm = ({ onSuccess, showToast }) => {
  // 1. General Info
  const [generalInfo, setGeneralInfo] = useState({
    partyName: '',
    returnDate: getTodayLocal(),
    // mainRemark removed
  });

  // 2. Items Array
  const [items, setItems] = useState([
    { itemId: '', quantity: '', remark: '' }
  ]);

  const [availableItems, setAvailableItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load Item Master
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await api.get('/api/items');
        setAvailableItems(Array.isArray(res.data) ? res.data : (res.data.data || []));
      } catch (err) {
        console.error("Failed to load items", err);
      }
    };
    fetchItems();
  }, []);

  // --- Row Handlers ---
  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const addItemRow = () => {
    setItems([...items, { itemId: '', quantity: '', remark: '' }]);
  };

  const removeItemRow = (index) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  // --- Submit Handler ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!generalInfo.partyName) {
      showToast('Party Name is required', 'error');
      return;
    }

    // Filter valid rows (must have item and quantity)
    const validItems = items.filter(i => i.itemId && i.quantity);
    
    if (validItems.length === 0) {
      showToast('Please add at least one item to return', 'error');
      return;
    }

    setLoading(true);
    try {
      // Send payload with array of items
      await api.post('/api/returns', {
        party_name: generalInfo.partyName,
        return_date: generalInfo.returnDate,
        // Map rows to backend format
        items: validItems.map(i => ({
            item_id: parseInt(i.itemId),
            quantity: parseInt(i.quantity),
            remark: i.remark // Only row remark
        }))
      });

      showToast('Returns logged & Stock updated successfully!', 'success');
      
      // Reset Form
      setGeneralInfo({
        partyName: '',
        returnDate: getTodayLocal(),
        // mainRemark removed
      });
      setItems([{ itemId: '', quantity: '', remark: '' }]);
      
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || 'Failed to log returns', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3 className="section-title">Log Returned Items</h3>
      <form onSubmit={handleSubmit}>
        
        {/* --- Header Section --- */}
        <div className="enquiry-form-grid" style={{ marginBottom: 20 }}>
          <div className="form-group">
            <label className="form-label">Return Date</label>
            <input 
                type="date" 
                className="form-input" 
                value={generalInfo.returnDate} 
                onChange={e => setGeneralInfo({...generalInfo, returnDate: e.target.value})} 
                required 
            />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Party Name</label>
            <input 
                type="text" 
                className="form-input" 
                placeholder="Enter Party Name" 
                value={generalInfo.partyName} 
                onChange={e => setGeneralInfo({...generalInfo, partyName: e.target.value})} 
                required 
            />
          </div>

        </div>

        <hr style={{margin: '20px 0', border: 'none', borderTop: '1px solid #e2e8f0'}} />

        {/* --- Items List Section --- */}
        <div style={{marginBottom: 20}}>
            <label className="form-label" style={{marginBottom: 10, display: 'block'}}>Items to Return</label>
            
            {items.map((row, index) => (
                <div key={index} style={{display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center'}}>
                    <div style={{flex: 2}}>
                        <select 
                            className="form-input" 
                            value={row.itemId} 
                            onChange={e => handleItemChange(index, 'itemId', e.target.value)}
                        >
                            <option value="">-- Select Item --</option>
                            {availableItems.map(item => (
                                <option key={item.id} value={item.id}>
                                    {item.item_name} {item.size ? `(${item.size})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div style={{flex: 1}}>
                        <input 
                            type="number" 
                            className="form-input" 
                            placeholder="Qty" 
                            value={row.quantity} 
                            onChange={e => handleItemChange(index, 'quantity', e.target.value)} 
                            min="1" 
                        />
                    </div>
                    <div style={{flex: 2}}>
                        <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Specific remark (optional)" 
                            value={row.remark} 
                            onChange={e => handleItemChange(index, 'remark', e.target.value)} 
                        />
                    </div>
                    <button 
                        type="button" 
                        onClick={() => removeItemRow(index)}
                        style={{
                            background: '#fee2e2', color: '#ef4444', 
                            border: 'none', borderRadius: 6,
                            width: 38, height: 38, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >
                        ✕
                    </button>
                </div>
            ))}

            <button 
                type="button" 
                onClick={addItemRow} 
                className="btn btn-secondary" 
                style={{fontSize: 13, padding: '6px 12px'}}
            >
                + Add Another Item
            </button>
        </div>
        
        <div style={{display: 'flex', justifyContent: 'flex-end'}}>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{minWidth: 140}}>
                {loading ? 'Saving...' : 'Submit Returns'}
            </button>
        </div>
      </form>
    </div>
  );
};

export default ReturnItemForm;