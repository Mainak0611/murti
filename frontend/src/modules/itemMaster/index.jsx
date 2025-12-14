// frontend/src/modules/ItemMasterIndex.jsx
import React, { useEffect, useState, useMemo, useRef, useLayoutEffect } from 'react';
import api from '../../lib/api';
import ItemMasterForm from './itemMasterForm';
import ItemMasterTable from './itemMasterTable';

const ItemMasterIndex = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // --- TAB STATE ---
  const [activeTab, setActiveTab] = useState('master'); // 'master' or 'stock'

  // --- STOCK MANAGEMENT STATE (NEW) ---
  const [stockChanges, setStockChanges] = useState({}); // Stores { itemId: newQty }
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // --- LIFTED STATE (For Modal/Blur) ---
  const [viewItem, setViewItem] = useState(null);

  // --- FILTER & SORT STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState('asc');

  // --- STICKY STATE ---
  const [isPinned, setIsPinned] = useState(false);
  const [cardMetrics, setCardMetrics] = useState({ width: 'auto', left: 0, height: 0 });
  
  // Refs
  const wrapperRef = useRef(null); 
  const sentinelRef = useRef(null); 
  const cardRef = useRef(null); 

  // Toast Helper
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const fetchItems = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await api.get('/api/items');
      const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setItems(data);
      setStockChanges({}); // Clear unsaved changes on refresh
    } catch (err) {
      console.error("Fetch error:", err);
      showToast("Failed to load items", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  // --- HANDLE INDIVIDUAL INPUT CHANGE ---
  const handleStockInputChange = (id, newVal) => {
    setStockChanges(prev => ({
      ...prev,
      [id]: newVal
    }));
  };

  // --- HANDLE BULK SAVE ---
  const handleBulkSave = async () => {
    const idsToUpdate = Object.keys(stockChanges);
    if (idsToUpdate.length === 0) return;

    setIsBulkSaving(true);
    try {
      // Create an array of API promises
      const updatePromises = idsToUpdate.map(id => {
        const newQty = parseInt(stockChanges[id]);
        // Only update if it's a valid number
        if (isNaN(newQty)) return Promise.resolve(); 
        return api.put(`/api/items/${id}`, { current_stock: newQty });
      });

      // Execute all updates in parallel
      await Promise.all(updatePromises);

      showToast(`Successfully updated ${idsToUpdate.length} items`, 'success');
      
      // Refresh data to sync and clear changes
      await fetchItems(true); 
      setStockChanges({}); 

    } catch (err) {
      console.error(err);
      showToast('Failed to update some items', 'error');
    } finally {
      setIsBulkSaving(false);
    }
  };

  // --- FILTER & SORT LOGIC ---
  const filteredData = useMemo(() => {
    let result = [...items];

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(item =>
        (item.item_name && item.item_name.toLowerCase().includes(lowerTerm)) ||
        (item.hsn_code && item.hsn_code.toLowerCase().includes(lowerTerm))
      );
    }

    result.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];
      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      const numA = parseFloat(String(valA).replace(/[^0-9.-]+/g,""));
      const numB = parseFloat(String(valB).replace(/[^0-9.-]+/g,""));
      const isNumeric = !isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '';

      if (isNumeric && (sortBy === 'weight' || sortBy === 'price' || sortBy === 'id')) {
         return sortOrder === 'asc' ? numA - numB : numB - numA;
      }
      
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortOrder === 'asc' ? -1 : 1;
      if (strA > strB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [items, searchTerm, sortBy, sortOrder]);

  const clearFilters = () => {
    setSearchTerm('');
    setSortBy('id');
    setSortOrder('asc');
  };

  // --- PINNING LOGIC ---
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { setIsPinned(!entry.isIntersecting); },
      { threshold: 0, rootMargin: "-10px 0px 0px 0px" } 
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, []);

  // --- GEOMETRY TRACKING ---
  useLayoutEffect(() => {
    if (!wrapperRef.current) return;
    const measure = () => {
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        setCardMetrics({
          width: `${rect.width}px`,
          left: rect.left,
          height: cardRef.current ? cardRef.current.offsetHeight : 'auto'
        });
      }
    };
    measure();
    const resizeObserver = new ResizeObserver(() => measure());
    resizeObserver.observe(wrapperRef.current);
    window.addEventListener('scroll', measure);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('scroll', measure);
    };
  }, []);

  return (
    <div className="dashboard-container">
      <style>{`
        :root {
          --bg-body: #f8fafc;
          --bg-card: #ffffff;
          --text-main: #0f172a;
          --text-muted: #64748b;
          --primary: #059669;
          --primary-hover: #047857;
          --danger: #ef4444;
          --border: #e2e8f0;
          --highlight-bg: #d1fae5;
          --row-hover: #f1f5f9;
        }

        .dashboard-container {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background-color: var(--bg-body);
          min-height: 100vh;
          padding: 40px 20px;
          padding-bottom: 100px;
          color: var(--text-main);
        }
        .page-title { font-size: 32px; font-weight: 800; margin-bottom: 24px; }

        .card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          width: 100%;
          transition: filter 0.3s ease;
        }

        .enquiry-form-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; align-items: end; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-label { font-size: 13px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
        .form-input { padding: 10px; border: 1px solid var(--border); border-radius: 6px; width: 100%; font-size: 14px; }
        .form-input:focus { outline: 2px solid var(--primary); border-color: transparent; }

        .btn { padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; white-space: nowrap; }
        .btn-primary { background: var(--primary); color: white; }
        .btn-primary:hover { background: var(--primary-hover); }
        .btn-secondary { background: #f1f5f9; color: var(--text-muted); border: 1px solid var(--border); }
        .btn-secondary:hover { background: #e2e8f0; color: var(--text-main); }

        .tab-container { display: flex; gap: 10px; margin-bottom: 20px; }
        .tab-btn {
            padding: 10px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; background: #e2e8f0; color: #64748b;
            transition: all 0.2s;
        }
        .tab-btn.active { background: var(--primary); color: white; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.3); }

        .table-container { overflow-x: auto; border-radius: 8px; border: none; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 15px; text-align: left; }
        .data-table th { background: #f8fafc; color: var(--text-muted); font-weight: 600; padding: 12px 16px; font-size: 12px; text-transform: uppercase; }
        .data-table td { padding: 8px 16px; border-bottom: 1px solid var(--border); }

        .stock-input-changed {
            background-color: #ecfdf5; /* light green bg */
            border-color: #34d399; /* green border */
            color: #065f46;
        }

        .toast-notification { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 8px; color: white; font-weight: 600; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 2000; animation: slideIn 0.3s ease-out; }
        .toast-success { background-color: var(--primary); }
        .toast-error { background-color: var(--danger); }
        @keyframes slideIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      <div style={{width: '100%', margin: '0 auto'}}>
        <h1 className="page-title">Item Master</h1>

        {/* --- TABS --- */}
        <div className="tab-container">
            <button 
                className={`tab-btn ${activeTab === 'master' ? 'active' : ''}`} 
                onClick={() => setActiveTab('master')}
            >
                Master List
            </button>
            <button 
                className={`tab-btn ${activeTab === 'stock' ? 'active' : ''}`} 
                onClick={() => setActiveTab('stock')}
            >
                Stock Management
            </button>
        </div>

        {/* --- SHOW FORM ONLY IN MASTER TAB --- */}
        {activeTab === 'master' && (
            <ItemMasterForm onSuccess={() => fetchItems(false)} showToast={showToast} />
        )}

        <div ref={sentinelRef} style={{ height: '1px', marginBottom: '-1px' }} />

        {/* --- STICKY FILTER CARD --- */}
        <div 
          ref={wrapperRef} 
          style={{ 
            height: isPinned ? cardMetrics.height : 'auto',
            marginBottom: '24px',
            position: 'relative'
          }}
        >
          <div 
            ref={cardRef}
            className="card" 
            style={isPinned ? {
              position: 'fixed', top: 0, left: cardMetrics.left, width: cardMetrics.width, 
              zIndex: 1000, borderRadius: '0 0 12px 12px', 
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
              margin: 0, filter: viewItem ? 'blur(5px)' : 'none', pointerEvents: viewItem ? 'none' : 'auto'
            } : {
              margin: 0, filter: viewItem ? 'blur(5px)' : 'none', pointerEvents: viewItem ? 'none' : 'auto'
            }}
          >
            <div className="enquiry-form-grid">
              <div className="form-group">
                <label className="form-label">Search</label>
                <input type="text" className="form-input" placeholder="Name / HSN" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Sort By</label>
                <select className="form-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="id">ID</option>
                  <option value="weight">Weight</option>
                  <option value="size">Size</option>
                  <option value="price">Price</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Order</label>
                <select className="form-input" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                  <option value="asc">Ascending (A-Z)</option>
                  <option value="desc">Descending (Z-A)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">&nbsp;</label>
                <button className="btn btn-secondary" style={{width: '100%'}} onClick={clearFilters}>Clear Filters</button>
              </div>
            </div>
          </div>
        </div>

        {/* --- CONTENT AREA --- */}
        {activeTab === 'master' ? (
            // Tab 1: Standard Table
            <ItemMasterTable
                data={filteredData}
                loading={loading}
                fetchData={fetchItems}
                showToast={showToast}
                viewItem={viewItem}
                setViewItem={setViewItem}
            />
        ) : (
            // Tab 2: Stock Management Table
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                
                {/* --- BULK SAVE HEADER --- */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#334155' }}>Update Stock Inventory</h3>
                    
                    <button 
                        onClick={handleBulkSave} 
                        disabled={isBulkSaving || Object.keys(stockChanges).length === 0}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: Object.keys(stockChanges).length === 0 ? 0.6 : 1 }}
                    >
                        {isBulkSaving ? (
                            <>Saving...</>
                        ) : (
                            <>
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                Save Changes ({Object.keys(stockChanges).length})
                            </>
                        )}
                    </button>
                </div>

                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                <th>HSN Code</th>
                                <th>Size</th>
                                <th>Current Stock</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="4" style={{textAlign:'center', padding: '40px'}}>Loading...</td></tr>
                            ) : filteredData.length === 0 ? (
                                <tr><td colSpan="4" style={{textAlign:'center', padding: '40px', color: '#94a3b8'}}>No items found.</td></tr>
                            ) : (
                                filteredData.map(item => {
                                    // Determine current value: Either from change state OR original data
                                    const currentValue = stockChanges[item.id] !== undefined 
                                        ? stockChanges[item.id] 
                                        : (item.current_stock || 0);
                                    
                                    // Check if this row has unsaved changes for styling
                                    const hasChanged = stockChanges[item.id] !== undefined;

                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50">
                                            <td className="p-4 font-semibold text-slate-700">{item.item_name}</td>
                                            <td className="p-4 text-slate-600">{item.hsn_code || '-'}</td>
                                            <td className="p-4 text-slate-600">{item.size || '-'}</td>
                                            <td className="p-4">
                                                <input
                                                    type="number"
                                                    value={currentValue}
                                                    onChange={(e) => handleStockInputChange(item.id, e.target.value)}
                                                    className={`form-input ${hasChanged ? 'stock-input-changed' : ''}`}
                                                    style={{ width: '120px', textAlign: 'center', fontWeight: 'bold' }}
                                                    min="0"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </div>

      {toast.show && (
        <div className={`toast-notification ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default ItemMasterIndex;