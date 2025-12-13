// frontend/src/modules/PartyEnquiryForm.jsx
import React, { useState, useEffect } from 'react';
import api from '../../lib/api';

/**
 * Return today's date as YYYY-MM-DD using the user's LOCAL timezone.
 */
const getTodayLocal = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const PartyEnquiryForm = ({ onSuccess, showToast }) => {
  // --- FORM STATE ---
  const [formData, setFormData] = useState({
    partyName: '',
    contactNo: '',
    reference: '',
    remark: '',
    enquiryDate: getTodayLocal()
  });

  // --- ITEM SELECTION STATE ---
  const [availableItems, setAvailableItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([
    { itemId: '', quantity: '' } 
  ]);

  const [loading, setLoading] = useState(false);

  // --- FETCH ITEM MASTER ON MOUNT ---
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await api.get('/api/items');
        const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
        setAvailableItems(data);
      } catch (err) {
        console.error("Failed to load items", err);
      }
    };
    fetchItems();
  }, []);

  // --- ITEM ROW HANDLERS ---
  const handleItemChange = (index, field, value) => {
    const updated = [...selectedItems];
    updated[index][field] = value;
    setSelectedItems(updated);
  };

  const addItemRow = () => {
    setSelectedItems([...selectedItems, { itemId: '', quantity: '' }]);
  };

  const removeItemRow = (index) => {
    const updated = selectedItems.filter((_, i) => i !== index);
    setSelectedItems(updated);
  };

  // --- SUBMIT HANDLER ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.partyName) {
      showToast('Party Name is required', 'error');
      return;
    }

    // Filter out empty rows
    const validItems = selectedItems.filter(i => i.itemId && i.quantity);

    setLoading(true);
    try {
      const payload = {
        party_name: formData.partyName,
        contact_no: formData.contactNo,
        reference: formData.reference,
        remark: formData.remark,
        enquiry_date: formData.enquiryDate,
        items: validItems.map(i => ({
          item_id: parseInt(i.itemId), 
          quantity: parseInt(i.quantity) || 0
        }))
      };

      await api.post('/api/party-enquiries', payload);

      showToast('Enquiry added successfully!', 'success');

      // Reset Form
      setFormData({
        partyName: '',
        contactNo: '',
        reference: '',
        remark: '',
        enquiryDate: getTodayLocal()
      });
      setSelectedItems([{ itemId: '', quantity: '' }]); 

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || 'Failed to add enquiry', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3 className="section-title">New Enquiry</h3>
      <form onSubmit={handleSubmit}>
        
        {/* --- MAIN DETAILS --- */}
        <div className="enquiry-form-grid">
          <div className="form-group">
            <label className="form-label">Required Date</label>
            <input
              type="date"
              className="form-input"
              value={formData.enquiryDate}
              onChange={(e) => setFormData({ ...formData, enquiryDate: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Party Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter party name"
              value={formData.partyName}
              onChange={(e) => setFormData({ ...formData, partyName: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contact No</label>
            <input
              type="text"
              className="form-input"
              placeholder="Phone number"
              value={formData.contactNo}
              onChange={(e) => setFormData({ ...formData, contactNo: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Reference</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ref by..."
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label">Remark</label>
            <input
              type="text"
              className="form-input"
              placeholder="Discussion details..."
              value={formData.remark}
              onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
            />
          </div>
        </div>

        <hr style={{margin: '20px 0', border: 'none', borderTop: '1px solid #e2e8f0'}} />

        {/* --- ITEM SELECTION SECTION --- */}
        <div style={{marginBottom: '20px'}}>
            <label className="form-label" style={{marginBottom: '10px', display: 'block'}}>Required Items</label>
            
            {selectedItems.map((row, index) => (
                <div key={index} style={{display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center'}}>
                    {/* Item Dropdown */}
                    <div style={{flex: 2}}>
                        <select 
                            className="form-input" 
                            value={row.itemId}
                            onChange={(e) => handleItemChange(index, 'itemId', e.target.value)}
                        >
                            <option value="">-- Select Item --</option>
                            {availableItems.map(item => (
                                <option key={item.id} value={item.id}>
                                    {item.item_name} {item.size ? `(${item.size})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Quantity Input */}
                    <div style={{flex: 1}}>
                        <input
                            type="number"
                            className="form-input"
                            placeholder="Qty"
                            value={row.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            min="1"
                        />
                    </div>

                    {/* Remove Button */}
                    <button 
                        type="button" 
                        onClick={() => removeItemRow(index)}
                        style={{
                            background: '#fee2e2', color: '#ef4444', 
                            border: '1px solid #fecaca', borderRadius: '6px',
                            width: '36px', height: '38px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                        title="Remove Item"
                    >
                        &times;
                    </button>
                </div>
            ))}

            <button 
                type="button" 
                onClick={addItemRow} 
                className="btn btn-secondary" 
                style={{fontSize: '13px', padding: '6px 12px'}}
            >
                + Add Another Item
            </button>
        </div>

        {/* CHANGE: Added flex display and removed width: 100% from button */}
        <div className="form-actions full-width" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ minWidth: '140px' }} /* Optional: keeps it from being too small */
          >
            {loading ? 'Saving...' : 'Create Enquiry'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PartyEnquiryForm;