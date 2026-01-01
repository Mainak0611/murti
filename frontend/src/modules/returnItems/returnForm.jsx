import React, { useState, useEffect, useRef } from 'react';
import api from '../../lib/api';

const getTodayLocal = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
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
    orderId: '',
    returnDate: getTodayLocal(),
    challanNumber: '',
  });

  // 2. Items Array
  const [items, setItems] = useState([
    { itemId: '', quantity: '', remark: '' }
  ]);

  // --- Data Sources ---
  const [availableItems, setAvailableItems] = useState([]);
  const [availableParties, setAvailableParties] = useState([]);
  const [availableOrders, setAvailableOrders] = useState([]); // <--- NEW
  const [loading, setLoading] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false); // <--- NEW

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

  // --- Handle Party Selection & Load Orders ---
  const handlePartyChange = async (selectedId) => {
    const party = availableParties.find(p => String(p.id) === String(selectedId));

    if (party) {
        setGeneralInfo(prev => ({
            ...prev,
            partyId: selectedId,
            partyName: party.party_name,
            orderId: '' // <--- RESET ORDER WHEN PARTY CHANGES
        }));

        // <--- NEW: Fetch orders for this party
        setLoadingOrders(true);
        try {
            const res = await api.get(`/api/orders/by-party?partyName=${encodeURIComponent(party.party_name)}`);
            const ordersData = Array.isArray(res.data) ? res.data : (res.data.data || []);
            setAvailableOrders(ordersData);
            
            // Auto-select first order and populate items
            if (ordersData.length > 0) {
                const firstOrder = ordersData[0];
                setGeneralInfo(prev => ({
                    ...prev,
                    orderId: String(firstOrder.id)
                }));
                
                // Populate items with enhanced data from first order
                await populateItemsFromOrder(String(firstOrder.id), ordersData);
            } else {
                setItems([]);
            }
        } catch (err) {
            console.error("Failed to load orders for party", err);
            showToast("Failed to load orders for this party", "error");
            setAvailableOrders([]);
            setItems([]);
        } finally {
            setLoadingOrders(false);
        }
    } else {
        setGeneralInfo(prev => ({
            ...prev,
            partyId: '',
            partyName: '',
            orderId: ''
        }));
        setAvailableOrders([]);
        setItems([]);
    }
  };

  // Helper function to populate items from order
  const populateItemsFromOrder = async (selectedOrderId, orders) => {
    const selectedOrder = orders.find(o => String(o.id) === String(selectedOrderId));
    if (!selectedOrder || !selectedOrder.items) {
        setItems([]);
        return;
    }

    try {
        const returnsRes = await api.get(`/api/returns`);
        const allReturns = Array.isArray(returnsRes.data) ? returnsRes.data : (returnsRes.data.data || []);
        
        // Filter returns for this order - ensure proper type comparison
        const orderReturns = allReturns.filter(r => {
            return r.order_id && String(r.order_id) === String(selectedOrder.id);
        });
        
        // Create return map: item_id -> total_returned_quantity
        const returnMap = {};
        orderReturns.forEach(r => {
            const itemId = String(r.item_id);
            if (!returnMap[itemId]) {
                returnMap[itemId] = 0;
            }
            returnMap[itemId] += parseFloat(r.quantity) || 0;
        });
        
        const orderItems = selectedOrder.items.filter(i => i && i.item_id).map(item => {
            const itemDetail = availableItems.find(ai => String(ai.id) === String(item.item_id));
            const unitWeight = itemDetail ? parseFloat(itemDetail.weight) || 0 : 0;
            const orderedWeight = unitWeight * (parseFloat(item.ordered_quantity) || 0);
            const alreadyReturned = returnMap[String(item.item_id)] || 0;
            const pendingQty = (parseFloat(item.dispatched_quantity) || 0) - alreadyReturned;
            
            return {
                itemId: String(item.item_id),
                itemName: item.item_name || '',
                size: item.size || '',
                orderedQuantity: parseFloat(item.ordered_quantity) || 0,
                dispatchedQuantity: parseFloat(item.dispatched_quantity) || 0,
                alreadyReturnedQuantity: alreadyReturned,
                pendingQuantity: Math.max(0, pendingQty),
                unitWeight: unitWeight,
                orderedWeight: orderedWeight,
                quantity: '',
                returnWeight: 0,
                remark: ''
            };
        });
        
        if (orderItems.length > 0) {
            setItems(orderItems);
        } else {
            setItems([]);
        }
    } catch (err) {
        console.error("Failed to fetch return history", err);
        // Fallback: just show basic items
        const orderItems = selectedOrder.items.filter(i => i && i.item_id).map(item => {
            const itemDetail = availableItems.find(ai => String(ai.id) === String(item.item_id));
            const unitWeight = itemDetail ? parseFloat(itemDetail.weight) || 0 : 0;
            const orderedWeight = unitWeight * (parseFloat(item.ordered_quantity) || 0);
            
            return {
                itemId: String(item.item_id),
                itemName: item.item_name || '',
                size: item.size || '',
                orderedQuantity: parseFloat(item.ordered_quantity) || 0,
                dispatchedQuantity: parseFloat(item.dispatched_quantity) || 0,
                alreadyReturnedQuantity: 0,
                pendingQuantity: parseFloat(item.dispatched_quantity) || 0,
                unitWeight: unitWeight,
                orderedWeight: orderedWeight,
                quantity: '',
                returnWeight: 0,
                remark: ''
            };
        });
        setItems(orderItems);
    }
  };

  // <--- NEW: Handle Order Tab Selection & Pre-populate Items with Enhanced Data
  const handleOrderTabSelect = async (selectedOrderId) => {
    setGeneralInfo(prev => ({
        ...prev,
        orderId: selectedOrderId
    }));

    await populateItemsFromOrder(selectedOrderId, availableOrders);
  };

  // --- Row Handlers ---
  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    if (field === 'quantity') {
        updated[index][field] = value;
        // Calculate return weight
        const qty = parseFloat(value) || 0;
        updated[index].returnWeight = qty * updated[index].unitWeight;
    } else {
        updated[index][field] = value;
    }
    setItems(updated);
  };

  // --- Submit Handler ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!generalInfo.partyName) {
      showToast('Party Name is required', 'error');
      return;
    }

    if (!generalInfo.orderId) {
      showToast('Please select an order to create return', 'error');
      return;
    }

    if (!generalInfo.challanNumber || !generalInfo.challanNumber.trim()) {
      showToast('Challan Number is required', 'error');
      return;
    }

    const validItems = items.filter(i => i.quantity && parseInt(i.quantity) > 0);
    
    if (validItems.length === 0) {
      showToast('Please enter quantity for at least one item', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/returns', {
        party_id: generalInfo.partyId,
        party_name: generalInfo.partyName,
        order_id: parseInt(generalInfo.orderId), // <--- INCLUDE ORDER ID
        return_date: generalInfo.returnDate,
        challan_number: generalInfo.challanNumber,
        items: validItems.map(i => ({
            item_id: parseInt(i.itemId),
            quantity: parseInt(i.quantity),
            remark: i.remark 
        }))
      });

      showToast('Returns logged & Stock updated successfully!', 'success');
      
      // Silent refresh: refresh items to show updated "Already Returned" counts
      await populateItemsFromOrder(generalInfo.orderId, availableOrders);
      
      // Reset return date to today
      setGeneralInfo(prev => ({
        ...prev,
        returnDate: getTodayLocal(),
        challanNumber: ''
      }));
      
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

          <div className="form-group">
            <label className="form-label">Challan Number *</label>
            <input 
                type="text" 
                className="form-input" 
                placeholder="e.g., CHL-001" 
                value={generalInfo.challanNumber} 
                onChange={e => setGeneralInfo({...generalInfo, challanNumber: e.target.value})}
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

        {/* --- Order Selection as Tabs --- */}
        {generalInfo.partyId && (
          <div style={{ marginBottom: 20 }}>
            <label className="form-label" style={{marginBottom: 10, display: 'block'}}>Select Order</label>
            {loadingOrders ? (
              <div style={{ padding: '12px', color: '#64748b', fontStyle: 'italic' }}>Loading orders...</div>
            ) : availableOrders.length > 0 ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 15 }}>
                {availableOrders.map(order => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => handleOrderTabSelect(String(order.id))}
                    className={String(order.id) === generalInfo.orderId ? 'btn btn-primary' : 'btn btn-secondary'}
                    style={{fontSize: '14px', padding: '10px 16px'}}
                  >
                    {formatDate(order.order_date)}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ padding: '12px', color: '#ef4444', fontStyle: 'italic' }}>
                No confirmed orders found for this party
              </div>
            )}
          </div>
        )}

        <hr style={{margin: '20px 0', border: 'none', borderTop: '1px solid #e2e8f0'}} />

        {/* --- Items List Section (Table View) --- */}
        {generalInfo.partyId && items.length > 0 && (
          <div style={{marginBottom: 20}}>
            <label className="form-label" style={{marginBottom: 10, display: 'block'}}>Items to Return</label>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                fontSize: '15px', // Moderately increased font size
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '14px 11px', textAlign: 'left', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap', fontSize: '15px' }}>Item Name</th>
                    <th style={{ padding: '14px 9px', textAlign: 'center', fontWeight: '700', color: '#475569', fontSize: '15px' }}>Ordered Qty</th>
                    <th style={{ padding: '14px 9px', textAlign: 'center', fontWeight: '700', color: '#475569', fontSize: '15px' }}>Order Weight</th>
                    <th style={{ padding: '14px 9px', textAlign: 'center', fontWeight: '700', color: '#475569', fontSize: '15px' }}>Dispatched Qty</th>
                    <th style={{ padding: '14px 9px', textAlign: 'center', fontWeight: '700', color: '#ef4444', fontSize: '15px' }}>Returned</th>
                    <th style={{ padding: '14px 9px', textAlign: 'center', fontWeight: '700', color: '#059669', fontSize: '15px' }}>Pending Qty</th>
                    <th style={{ padding: '14px 9px', textAlign: 'center', fontWeight: '700', color: '#ef4444', fontSize: '15px' }}>Return Qty *</th>
                    <th style={{ padding: '14px 9px', textAlign: 'center', fontWeight: '700', color: '#475569', fontSize: '15px' }}>Return Weight</th>
                    <th style={{ padding: '14px 9px', textAlign: 'left', fontWeight: '700', color: '#475569', fontSize: '15px' }}>Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: index % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      <td style={{ padding: '14px 11px', color: '#334155', fontWeight: '600', whiteSpace: 'nowrap', fontSize: '15px' }}>
                        {row.itemName} {row.size ? `(${row.size})` : ''}
                      </td>
                      <td style={{ padding: '14px 9px', textAlign: 'center', color: '#475569', fontSize: '15px' }}>
                        {row.orderedQuantity}
                      </td>
                      <td style={{ padding: '14px 9px', textAlign: 'center', color: '#475569', fontSize: '15px' }}>
                        {(row.orderedWeight || 0).toFixed(2)} kg
                      </td>
                      <td style={{ padding: '14px 9px', textAlign: 'center', color: '#475569', fontSize: '15px' }}>
                        {row.dispatchedQuantity}
                      </td>
                      <td style={{ padding: '14px 9px', textAlign: 'center', color: '#ef4444', fontWeight: '700', fontSize: '15px' }}>
                        {row.alreadyReturnedQuantity}
                      </td>
                      <td style={{ padding: '14px 9px', textAlign: 'center', color: '#059669', fontWeight: '700', fontSize: '15px' }}>
                        {row.pendingQuantity}
                      </td>
                      <td style={{ padding: '14px 9px', textAlign: 'center' }}>
                        <input 
                          type="number" 
                          className="form-input" 
                          placeholder="0" 
                          value={row.quantity} 
                          onChange={e => handleItemChange(index, 'quantity', e.target.value)} 
                          min="0" 
                          max={row.pendingQuantity}
                          style={{ width: '80px', textAlign: 'center', padding: '8px 5px', fontSize: '15px' }}
                        />
                      </td>
                      <td style={{ padding: '14px 9px', textAlign: 'center', color: '#475569', fontSize: '15px' }}>
                        {(row.returnWeight || 0).toFixed(2)} kg
                      </td>
                      <td style={{ padding: '14px 9px', color: '#475569', fontSize: '15px' }}>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g., Damaged" 
                          value={row.remark} 
                          onChange={e => handleItemChange(index, 'remark', e.target.value)}
                          style={{ width: '100px', padding: '8px 5px', fontSize: '15px' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
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