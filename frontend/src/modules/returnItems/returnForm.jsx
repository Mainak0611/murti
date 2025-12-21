import React, { useState, useEffect, useRef } from 'react';
import api from '../../lib/api';

const getTodayLocal = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

// --- REUSABLE SEARCHABLE SELECT COMPONENT (With Keyboard Support) ---
const SearchableSelect = ({ options, value, onChange, placeholder, labelKey = 'name', valueKey = 'id' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0); 
  const wrapperRef = useRef(null);
  const listRef = useRef(null); 

  useEffect(() => {
    const selectedOption = options.find(opt => String(opt[valueKey]) === String(value));
    if (selectedOption) {
      setSearchTerm(selectedOption[labelKey]);
    } else {
      setSearchTerm('');
    }
  }, [value, options, labelKey, valueKey]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        const selectedOption = options.find(opt => String(opt[valueKey]) === String(value));
        setSearchTerm(selectedOption ? selectedOption[labelKey] : '');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, value, options, labelKey, valueKey]);

  const filteredOptions = options.filter(opt => 
    String(opt[labelKey]).toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  const handleSelect = (option) => {
    if (!option) return;
    onChange(option[valueKey]);
    setSearchTerm(option[labelKey]);
    setIsOpen(false);
  };

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
        scrollIntoView(highlightedIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
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
        onKeyDown={handleKeyDown}
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
                  backgroundColor: index === highlightedIndex ? '#e2e8f0' : '#fff'
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
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

const ReturnItemForm = ({ onSuccess, showToast }) => {
  // 1. General Info
  const [generalInfo, setGeneralInfo] = useState({
    partyId: '',
    partyName: '',
    returnDate: getTodayLocal(),
  });

  // 2. Items Array
  const [items, setItems] = useState([
    { itemId: '', quantity: '', remark: '' }
  ]);

  // --- Data Sources ---
  const [availableItems, setAvailableItems] = useState([]);
  const [availableParties, setAvailableParties] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load Master Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [itemsRes, partiesRes] = await Promise.all([
            api.get('/api/items'),
            api.get('/api/parties')
        ]);

        // Standardize Data
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

  // --- Handle Party Selection ---
  const handlePartyChange = (selectedId) => {
    const party = availableParties.find(p => String(p.id) === String(selectedId));

    if (party) {
        setGeneralInfo(prev => ({
            ...prev,
            partyId: selectedId,
            partyName: party.party_name 
        }));
    } else {
        setGeneralInfo(prev => ({
            ...prev,
            partyId: '',
            partyName: ''
        }));
    }
  };

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

    const validItems = items.filter(i => i.itemId && i.quantity);
    
    if (validItems.length === 0) {
      showToast('Please add at least one item to return', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/returns', {
        party_id: generalInfo.partyId,
        party_name: generalInfo.partyName,
        return_date: generalInfo.returnDate,
        items: validItems.map(i => ({
            item_id: parseInt(i.itemId),
            quantity: parseInt(i.quantity),
            remark: i.remark 
        }))
      });

      showToast('Returns logged & Stock updated successfully!', 'success');
      
      setGeneralInfo({
        partyId: '',
        partyName: '',
        returnDate: getTodayLocal(),
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
    <div className="card" style={{ overflow: 'visible' }}>
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
            <label className="form-label">Select Party</label>
            <SearchableSelect 
                options={availableParties}
                value={generalInfo.partyId}
                onChange={handlePartyChange}
                placeholder="Type to search party..."
                labelKey="displayName"
                valueKey="id"
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
                        title="Remove Item"
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