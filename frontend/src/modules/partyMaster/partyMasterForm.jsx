// frontend/src/modules/PartyMasterForm.jsx
import React, { useState } from 'react';
import api from '../../lib/api';

const PartyMasterForm = ({ onSuccess, showToast }) => {
  const [formData, setFormData] = useState({
    firmName: '',
    partyName: '',
    contactNo: '',
    contactNo2: '',
    email: '',
    gstNumber: '',
    panNumber: '',
    refPerson: '',
    refContact: '',
    billingAddress: ''
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // specific validation: Party Name is usually the minimum requirement
    if (!formData.partyName) {
      showToast('Party Name (Contact Person) is required', 'error');
      return;
    }

    setLoading(true);
    try {
      // payload using snake_case keys to match database/backend
      const payload = {
        firm_name: formData.firmName,
        party_name: formData.partyName,
        contact_no: formData.contactNo,
        contact_no_2: formData.contactNo2,
        email: formData.email,
        gst_number: formData.gstNumber,
        pan_number: formData.panNumber,
        reference_person: formData.refPerson,
        reference_contact_no: formData.refContact,
        billing_address: formData.billingAddress
      };

      await api.post('/api/parties', payload);

      showToast('Party added successfully!', 'success');

      // reset form
      setFormData({
        firmName: '',
        partyName: '',
        contactNo: '',
        contactNo2: '',
        email: '',
        gstNumber: '',
        panNumber: '',
        refPerson: '',
        refContact: '',
        billingAddress: ''
      });

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      console.log('Server Error:', err.response?.data);
      showToast(err.response?.data?.error || 'Failed to add party', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Helper styles for grid spanning
  const span2 = { gridColumn: 'span 2' };
  const spanFull = { gridColumn: '1 / -1' };

  return (
    <div className="card">
      <h3 className="section-title">New Party Master</h3>
      
      <form onSubmit={handleSubmit} className="enquiry-form-grid">
        
        {/* --- ROW 1: Identity --- */}
        <div className="form-group" style={span2}>
          <label className="form-label">Firm Name</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Tata Enterprises"
            value={formData.firmName}
            onChange={(e) => setFormData({ ...formData, firmName: e.target.value })}
          />
        </div>

        <div className="form-group" style={span2}>
          <label className="form-label">Party Name (Contact Person)*</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Ramesh Gupta"
            value={formData.partyName}
            onChange={(e) => setFormData({ ...formData, partyName: e.target.value })}
            required
          />
        </div>

        {/* --- ROW 2: Contact Info --- */}
        <div className="form-group">
          <label className="form-label">Contact No</label>
          <input
            type="text"
            className="form-input"
            placeholder="Primary Phone"
            value={formData.contactNo}
            onChange={(e) => setFormData({ ...formData, contactNo: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Contact No 2</label>
          <input
            type="text"
            className="form-input"
            placeholder="Alt Phone"
            value={formData.contactNo2}
            onChange={(e) => setFormData({ ...formData, contactNo2: e.target.value })}
          />
        </div>

        <div className="form-group" style={span2}>
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-input"
            placeholder="email@company.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>

        {/* --- ROW 3: Tax Info --- */}
        <div className="form-group">
          <label className="form-label">GST Number</label>
          <input
            type="text"
            className="form-input"
            placeholder="GSTIN..."
            value={formData.gstNumber}
            onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">PAN Number</label>
          <input
            type="text"
            className="form-input"
            placeholder="PAN..."
            value={formData.panNumber}
            onChange={(e) => setFormData({ ...formData, panNumber: e.target.value })}
          />
        </div>

        {/* --- ROW 3b: References --- */}
        <div className="form-group">
          <label className="form-label">Ref. Person</label>
          <input
            type="text"
            className="form-input"
            placeholder="Referral Name"
            value={formData.refPerson}
            onChange={(e) => setFormData({ ...formData, refPerson: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Ref. Contact</label>
          <input
            type="text"
            className="form-input"
            placeholder="Referral Phone"
            value={formData.refContact}
            onChange={(e) => setFormData({ ...formData, refContact: e.target.value })}
          />
        </div>

        {/* --- ROW 4: Address --- */}
        <div className="form-group full-width" style={spanFull}>
          <label className="form-label">Billing Address</label>
          <input
            type="text"
            className="form-input"
            placeholder="Full billing address..."
            value={formData.billingAddress}
            onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
          />
        </div>

        <div className="form-actions full-width" style={spanFull}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Add Party'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PartyMasterForm;