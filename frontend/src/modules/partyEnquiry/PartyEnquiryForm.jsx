// frontend/src/modules/PartyEnquiryForm.jsx
import React, { useState } from 'react';
import api from '../../lib/api';

/**
 * Return today's date as YYYY-MM-DD using the user's LOCAL timezone.
 * (Avoids the UTC-shift problem from toISOString()).
 */
const getTodayLocal = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0'); // months are 0-indexed
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const PartyEnquiryForm = ({ onSuccess, showToast }) => {
  const [formData, setFormData] = useState({
    partyName: '',
    contactNo: '',
    reference: '',
    remark: '',
    enquiryDate: getTodayLocal()
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.partyName) {
      showToast('Party Name is required', 'error');
      return;
    }

    setLoading(true);
    try {
      // payload using snake_case keys for backend
      const payload = {
        party_name: formData.partyName,
        contact_no: formData.contactNo,
        reference: formData.reference,
        remark: formData.remark,
        enquiry_date: formData.enquiryDate
      };

      await api.post('/api/party-enquiries', payload);

      showToast('Enquiry added successfully!', 'success');

      // reset form and ensure date is recalculated as "today" in local tz
      setFormData({
        partyName: '',
        contactNo: '',
        reference: '',
        remark: '',
        enquiryDate: getTodayLocal()
      });

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      console.log('Server Error:', err.response?.data);
      showToast(err.response?.data?.error || 'Failed to add enquiry', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3 className="section-title">New Enquiry</h3>
      <form onSubmit={handleSubmit} className="enquiry-form-grid">
        <div className="form-group">
          <label className="form-label">Required Date</label>
          <input
            type="date"
            className="form-input"
            value={formData.enquiryDate}
            onChange={(e) => setFormData({ ...formData, enquiryDate: e.target.value })}
            required
            /* If you want to prevent past dates, uncomment the next line:
               min={getTodayLocal()} */
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

        <div className="form-actions full-width">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Add Enquiry'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PartyEnquiryForm;
