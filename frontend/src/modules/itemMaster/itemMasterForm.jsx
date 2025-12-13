// frontend/src/modules/ItemMasterForm.jsx
import React, { useState } from 'react';
import api from '../../lib/api';

const ItemMasterForm = ({ onSuccess, showToast }) => {
  const [formData, setFormData] = useState({
    itemName: '',
    size: '',
    hsnCode: '',
    weight: '',
    price: '',
    minimumStock: '',
    remarks: ''
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.itemName) {
      showToast('Item Name is required', 'error');
      return;
    }

    setLoading(true);
    try {
      // payload using snake_case keys for backend
      const payload = {
        item_name: formData.itemName,
        size: formData.size,
        hsn_code: formData.hsnCode,
        weight: formData.weight,
        price: formData.price ? parseFloat(formData.price) : 0,
        minimum_stock: formData.minimumStock ? parseInt(formData.minimumStock) : 0,
        remarks: formData.remarks
      };

      // Adjust the endpoint as per your backend route
      await api.post('/api/items', payload);

      showToast('Item added successfully!', 'success');

      // reset form
      setFormData({
        itemName: '',
        size: '',
        hsnCode: '',
        weight: '',
        price: '',
        minimumStock: '',
        remarks: ''
      });

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      console.log('Server Error:', err.response?.data);
      showToast(err.response?.data?.error || 'Failed to add item', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3 className="section-title">New Item Master</h3>
      {/* Reusing existing grid class for consistent layout */}
      <form onSubmit={handleSubmit} className="enquiry-form-grid">
        
        <div className="form-group">
          <label className="form-label">Item Name</label>
          <input
            type="text"
            className="form-input"
            placeholder="Enter item name"
            value={formData.itemName}
            onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Size</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. 10x10, L, XL"
            value={formData.size}
            onChange={(e) => setFormData({ ...formData, size: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">HSN Code</label>
          <input
            type="text"
            className="form-input"
            placeholder="HSN Code"
            value={formData.hsnCode}
            onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Weight</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. 15kg"
            value={formData.weight}
            onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Price</label>
          <input
            type="number"
            step="0.01"
            className="form-input"
            placeholder="0.00"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Minimum Stock</label>
          <input
            type="number"
            className="form-input"
            placeholder="Min qty"
            value={formData.minimumStock}
            onChange={(e) => setFormData({ ...formData, minimumStock: e.target.value })}
          />
        </div>

        <div className="form-group full-width">
          <label className="form-label">Remarks</label>
          <input
            type="text"
            className="form-input"
            placeholder="Additional details..."
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
          />
        </div>

        <div className="form-actions full-width">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Add Item'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ItemMasterForm;