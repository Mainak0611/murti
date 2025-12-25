import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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

// --- REUSABLE SEARCHABLE SELECT COMPONENT (With Keyboard Support) ---
const SearchableSelect = ({ options, value, onChange, placeholder, labelKey = 'name', valueKey = 'id' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0); // Track keyboard focus
  const wrapperRef = useRef(null);
  const listRef = useRef(null); // Ref for scrolling

  // Sync internal search term with external selected value
  useEffect(() => {
    const selectedOption = options.find(opt => String(opt[valueKey]) === String(value));
    if (selectedOption) {
      setSearchTerm(selectedOption[labelKey]);
    } else {
      setSearchTerm('');
    }
  }, [value, options, labelKey, valueKey]);

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        // Revert text if no valid selection was made
        const selectedOption = options.find(opt => String(opt[valueKey]) === String(value));
        setSearchTerm(selectedOption ? selectedOption[labelKey] : '');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, value, options, labelKey, valueKey]);

  // Filter options
  const filteredOptions = options.filter(opt => 
    String(opt[labelKey]).toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  const handleSelect = (option) => {
    if (!option) return;
    onChange(option[valueKey]);
    setSearchTerm(option[labelKey]);
    setIsOpen(false);
  };

  // --- Keyboard Navigation Handler ---
  const handleKeyDown = (e) => {
    if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
            setIsOpen(true);
        }
        return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        // Auto-scroll logic
        scrollIntoView(highlightedIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        // Auto-scroll logic
        scrollIntoView(highlightedIndex - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'Tab': 
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  const scrollIntoView = (index) => {
    if (listRef.current && listRef.current.children[index]) {
        listRef.current.children[index].scrollIntoView({ block: 'nearest' });
    }
  };

  return (
    <div className="relative" ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        type="text"
        className="form-input"
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
          if(e.target.value === '') onChange(''); 
        }}
        onKeyDown={handleKeyDown} // <--- Added Key Handler
        onClick={() => setIsOpen(true)}
      />
      
      {isOpen && (
        <ul 
          ref={listRef} 
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: '200px',
            overflowY: 'auto',
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '0 0 6px 6px',
            zIndex: 1100,
            listStyle: 'none',
            padding: 0,
            margin: 0,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, index) => (
              <li
                key={opt[valueKey]}
                onClick={() => handleSelect(opt)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f1f5f9',
                  // Highlight based on index
                  backgroundColor: index === highlightedIndex ? '#e2e8f0' : '#fff'
                }}
                onMouseEnter={() => setHighlightedIndex(index)} // Sync mouse hover with key index
              >
                {opt[labelKey]}
              </li>
            ))
          ) : (
            <li style={{ padding: '8px 12px', color: '#94a3b8' }}>No results found</li>
          )}
        </ul>
      )}
    </div>
  );
};

const PartyEnquiryForm = ({ onSuccess, showToast }) => {
  // --- ROUTER ---
  const navigate = useNavigate();

  // --- FORM STATE ---
  const [formData, setFormData] = useState({
    partyId: '',   
    partyName: '', 
    contactNo: '',
    reference: '',
    remark: '',
    enquiryDate: getTodayLocal()
  });

  // --- DATA SOURCES ---
  const [availableItems, setAvailableItems] = useState([]);
  const [availableParties, setAvailableParties] = useState([]); 

  // --- ITEM SELECTION STATE ---
  const [selectedItems, setSelectedItems] = useState([
    { itemId: '', quantity: '' } 
  ]);

  const [loading, setLoading] = useState(false);
  const [confirmedOrders, setConfirmedOrders] = useState([]);
  const [confirmOrderMode, setConfirmOrderMode] = useState(false);

  // --- FETCH MASTER DATA ON MOUNT ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [itemsRes, partiesRes] = await Promise.all([
            api.get('/api/items'),
            api.get('/api/parties')
        ]);

        const itemsData = Array.isArray(itemsRes.data) ? itemsRes.data : (itemsRes.data.data || []);
        const formattedItems = itemsData.map(i => ({
            ...i,
            displayName: `${i.item_name} ${i.size ? `(${i.size})` : ''}`
        }));

        const partiesData = Array.isArray(partiesRes.data) ? partiesRes.data : (partiesRes.data.data || []);
        const formattedParties = partiesData.map(p => ({
            ...p,
            displayName: `${p.party_name} ${p.firm_name ? `(${p.firm_name})` : ''}`
        }));
        
        setAvailableItems(formattedItems);
        setAvailableParties(formattedParties);
      } catch (err) {
        console.error("Failed to load master data", err);
        showToast("Failed to load items or parties", "error");
      }
    };
    fetchData();
  }, []);

  // --- HANDLE PARTY CHANGE ---
  const handlePartyChange = async (selectedId) => {
    const party = availableParties.find(p => String(p.id) === String(selectedId));

    if (party) {
        setFormData(prev => ({
            ...prev,
            partyId: selectedId,
            partyName: party.party_name, 
            contactNo: party.contact_no || '', 
            reference: party.reference_person || '' 
        }));

        // Fetch confirmed orders for this party
        try {
          const res = await api.get('/api/orders');
          const allOrders = res.data.data || [];
          const partyOrders = allOrders.filter(order => String(order.party_id) === String(selectedId));
          setConfirmedOrders(partyOrders);
        } catch (err) {
          console.error('Failed to fetch confirmed orders', err);
          setConfirmedOrders([]);
        }
    } else {
        setFormData(prev => ({
            ...prev,
            partyId: '',
            partyName: '',
            contactNo: '',
            reference: ''
        }));
        setConfirmedOrders([]);
    }
  };

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

  // --- HELPER: Calculate Weight ---
  const calculateRowWeight = (itemId, qty) => {
    if (!itemId || !qty) return '';
    const item = availableItems.find(i => String(i.id) === String(itemId));
    if (!item || !item.weight) return '';
    const unitWeight = parseFloat(item.weight) || 0;
    const quantity = parseFloat(qty) || 0;
    const total = unitWeight * quantity;
    return total > 0 ? total.toFixed(2) : '';
  };

  // --- SUBMIT HANDLER ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.partyName) {
      showToast('Party selection is required', 'error');
      return;
    }

    const validItems = selectedItems.filter(i => i.itemId && i.quantity);

    if (validItems.length === 0) {
      showToast('Please add at least one item', 'error');
      return;
    }

    setLoading(true);
    try {
      if (confirmOrderMode) {
        // Direct order creation - skip enquiry
        const payload = {
          party_name: formData.partyName,
          contact_no: formData.contactNo,
          reference: formData.reference,
          remark: formData.remark,
          order_date: formData.enquiryDate,
          items: validItems.map(i => ({
            item_id: parseInt(i.itemId), 
            ordered_quantity: parseInt(i.quantity) || 0
          }))
        };

        await api.post('/api/orders', payload);
        showToast('Order confirmed successfully!', 'success');
        setConfirmOrderMode(false);
        navigate('/confirmed-orders');
      } else {
        // Create enquiry
        const enquiryPayload = {
          party_id: formData.partyId, 
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

        await api.post('/api/party-enquiries', enquiryPayload);
        showToast('Enquiry added successfully!', 'success');
      }

      setFormData({
        partyId: '',
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
      const errorMsg = confirmOrderMode ? 'Failed to confirm order' : 'Failed to add enquiry';
      showToast(err.response?.data?.error || errorMsg, 'error');
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
            <label className="form-label">Select Party</label>
            <SearchableSelect 
                options={availableParties}
                value={formData.partyId}
                onChange={handlePartyChange}
                placeholder="Type to search party..."
                labelKey="displayName"
                valueKey="id"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contact No</label>
            <input
              type="text"
              className="form-input"
              placeholder="Auto-filled..."
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
            <div style={{display: 'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '10px'}}>
               <label className="form-label" style={{marginBottom: 0}}>Required Items</label>
            </div>
            
            <div style={{display: 'flex', gap: '10px', marginBottom: '5px', fontSize: '12px', color: '#64748b', paddingLeft:'4px'}}>
                <div style={{flex: 3}}>Item Name</div>
                <div style={{flex: 1}}>Quantity</div>
                <div style={{flex: 1}}>Total Weight (kg)</div>
                <div style={{width: '36px'}}></div>
            </div>

            {selectedItems.map((row, index) => (
                <div key={index} style={{display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center'}}>
                    <div style={{flex: 3}}>
                        <SearchableSelect 
                            options={availableItems}
                            value={row.itemId}
                            onChange={(val) => handleItemChange(index, 'itemId', val)}
                            placeholder="Search item..."
                            labelKey="displayName"
                            valueKey="id"
                        />
                    </div>

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

                    <div style={{flex: 1}}>
                         <input
                            type="text"
                            className="form-input"
                            placeholder="Weight"
                            value={calculateRowWeight(row.itemId, row.quantity)}
                            readOnly
                            style={{ backgroundColor: '#f8fafc', cursor: 'not-allowed' }}
                        />
                    </div>

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

        <div className="form-actions full-width" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => {
              setConfirmOrderMode(true);
              setTimeout(() => {
                document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));
              }, 0);
            }}
            disabled={loading}
            style={{ minWidth: '140px' }}
          >
            {loading ? 'Confirming...' : 'Confirm Order'}
          </button>
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ minWidth: '140px' }}
          >
            {loading ? 'Saving...' : 'Create Enquiry'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PartyEnquiryForm;