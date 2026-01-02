// frontend/src/modules/ItemMasterIndex.jsx
import React, { useEffect, useState, useMemo, useRef, useLayoutEffect } from 'react';
import api from '../../lib/api';
import ItemMasterForm from './itemMasterForm';
import ItemMasterTable from './itemMasterTable';
import StockManagementTab from './StockManagementTab';
import PartyDistributionTab from './partyDistributionTab'; // NEW IMPORT
import StockSummaryTab from './StockSummaryTab'; // NEW IMPORT

const ItemMasterIndex = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // --- TAB STATE ---
  // Options: 'master', 'stock', 'distribution', 'summary'
  const [activeTab, setActiveTab] = useState('master'); 

  // --- MODAL STATES (Master List Only) ---
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
    } catch (err) {
      console.error("Fetch error:", err);
      showToast("Failed to load items", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

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

  const isModalOpen = !!viewItem;

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
        }

        .dashboard-container {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background-color: var(--bg-body);
          min-height: 100vh;
          padding: 40px 20px;
          padding-bottom: 100px;
          color: var(--text-main);
        }
        .page-title { font-size: 28px; font-weight: 800; margin-bottom: 24px; letter-spacing: -0.5px; }

        .card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          width: 100%;
          transition: filter 0.3s ease;
          overflow: visible;
        }

        /* --- MODERN FORM INPUTS --- */
        .enquiry-form-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; align-items: end; }
        .form-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
        .form-label { font-size: 13px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .form-input { 
            padding: 12px 16px; 
            border: 1px solid #cbd5e1; 
            border-radius: 8px; 
            width: 100%; 
            font-size: 15px; 
            color: #1e293b;
            transition: all 0.2s ease;
            background: #fff;
        }
        .form-input:focus { 
            outline: none; 
            border-color: var(--primary); 
            box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
        }
        .form-input::placeholder { color: #94a3b8; }

        /* --- TABS --- */
        .tab-container { 
          display: flex; 
          gap: 8px; 
          margin-bottom: 20px; 
          margin-top: 8px;
          overflow: visible;
          overflow-x: auto; 
          padding-bottom: 8px;
          padding-top: 8px;
          padding-left: 4px;
          padding-right: 4px;
          flex-wrap: wrap;
          width: 100%;
          align-items: center;
        }
        .tab-btn {
            padding: 12px 24px; 
            border-radius: 8px; 
            font-weight: 600; 
            font-size: 14px; 
            cursor: pointer; 
            border: none; 
            background: #e2e8f0; 
            color: #64748b;
            transition: all 0.2s; 
            white-space: nowrap;
            flex-shrink: 0;
            height: auto;
            min-height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1.5;
            box-sizing: border-box;
            overflow: visible;
            margin: 2px;
        }
        .tab-btn:hover { 
            background: #cbd5e1; 
            transform: translateY(-1px);
        }
        .tab-btn.active { 
            background: var(--primary); 
            color: white; 
            box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.3); 
        }
        .tab-btn.active:hover {
            background: var(--primary-hover);
        }

        /* --- TABLE STYLES --- */
        .table-container { overflow-x: auto; border-radius: 8px; border: none; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 15px; text-align: left; }
        .data-table th { background: #f8fafc; color: var(--text-muted); font-weight: 600; padding: 12px 16px; font-size: 12px; text-transform: uppercase; }
        .data-table td { padding: 8px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .hover\:bg-slate-50:hover { background-color: #f8fafc; }

        /* --- CLEAN TABLE ACTION BUTTONS (WITH TEXT) --- */
        .action-btn-group { display: flex; gap: 8px; justify-content: flex-end; }
        
        .action-text-btn {
            padding: 6px 12px;
            border-radius: 6px; 
            display: flex; alignItems: center; justifyContent: center; gap: 6px;
            border: 1px solid transparent; 
            cursor: pointer; 
            transition: all 0.2s; 
            font-size: 12px;
            font-weight: 600;
            background: white;
            white-space: nowrap;
        }
        
        .btn-add { color: #059669; border-color: #a7f3d0; background: #ecfdf5; }
        .btn-add:hover { background: #059669; color: white; border-color: #059669; }
        
        .btn-loss { color: #ef4444; border-color: #fecaca; background: #fef2f2; }
        .btn-loss:hover { background: #ef4444; color: white; border-color: #ef4444; }

        .btn-history { color: #64748b; border-color: #cbd5e1; background: #f8fafc; }
        .btn-history:hover { background: #64748b; color: white; border-color: #64748b; }

        /* --- BUTTONS --- */
        .btn { padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; border: none; transition: all 0.2s; white-space: nowrap; }
        .btn-secondary { background: white; color: #64748b; border: 1px solid #cbd5e1; }
        .btn-secondary:hover { background: #f8fafc; border-color: #94a3b8; color: #334155; }
        .btn-primary { background: var(--primary); color: white; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
        .btn-primary:hover { filter: brightness(110%); }

        /* --- POLISHED MODAL --- */
        .modal-overlay { 
            position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
            background-color: rgba(15, 23, 42, 0.6); 
            backdrop-filter: blur(4px);
            display: flex; alignItems: center; justifyContent: center; 
            z-index: 3000; 
            animation: fadeIn 0.2s ease-out;
        }
        
        .modal-card { 
            background: white;
            width: 500px; 
            border-radius: 16px; 
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            display: flex; flex-direction: column; 
            overflow: hidden;
            animation: scaleIn 0.2s ease-out;
            border: 1px solid #e2e8f0;
        }

        .modal-header { 
            padding: 20px 24px; 
            border-bottom: 1px solid #f1f5f9; 
            display: flex; justify-content: space-between; align-items: flex-start; 
            background: #ffffff;
        }
        
        .modal-body { padding: 24px; }
        
        .modal-footer { 
            padding: 20px 24px; 
            background: #f8fafc; 
            border-top: 1px solid #f1f5f9; 
            display: flex; justify-content: flex-end; gap: 12px;
        }

        .close-btn { border: none; background: transparent; color: #94a3b8; cursor: pointer; padding: 4px; border-radius: 4px; transition: all 0.2s; }
        .close-btn:hover { background: #f1f5f9; color: #475569; }

        /* Utility */
        .text-muted { color: var(--text-muted); }
        .text-sm { font-size: 13px; }
        .text-xs { font-size: 11px; }
        .text-center { text-align: center; }
        .fw-bold { font-weight: 600; }
        .italic { font-style: italic; }
        .text-danger { color: var(--danger); }
        .capitalized { text-transform: capitalize; }

        .toast-notification { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 8px; color: white; font-weight: 600; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 4000; animation: slideIn 0.3s ease-out; }
        .toast-success { background-color: var(--primary); }
        .toast-error { background-color: var(--danger); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slideIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      <div style={{width: '100%', margin: '0 auto'}}>
        <h1 className="page-title">Item Master & Inventory</h1>

        {/* --- TABS --- */}
        <div className="tab-container">
            <button className={`tab-btn ${activeTab === 'master' ? 'active' : ''}`} onClick={() => setActiveTab('master')}>
                Master List
            </button>
            <button className={`tab-btn ${activeTab === 'stock' ? 'active' : ''}`} onClick={() => setActiveTab('stock')}>
                Godown Management
            </button>
            <button className={`tab-btn ${activeTab === 'distribution' ? 'active' : ''}`} onClick={() => setActiveTab('distribution')}>
                Party Distribution
            </button>
            <button className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`} onClick={() => setActiveTab('summary')}>
                Stock Summary
            </button>
        </div>

        {/* --- SHOW FORM ONLY IN MASTER TAB --- */}
        {activeTab === 'master' && (
            <ItemMasterForm onSuccess={() => fetchItems(false)} showToast={showToast} />
        )}

        <div ref={sentinelRef} style={{ height: '1px', marginBottom: '-1px' }} />

        {/* --- STICKY FILTER CARD (GLOBAL) --- */}
        {/* Render filters for all tabs to ensure consistent searching */}
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
                margin: 0, filter: isModalOpen ? 'blur(5px)' : 'none', pointerEvents: isModalOpen ? 'none' : 'auto'
            } : {
                margin: 0, filter: isModalOpen ? 'blur(5px)' : 'none', pointerEvents: isModalOpen ? 'none' : 'auto'
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

        {/* --- CONTENT AREA SWITCHER --- */}
        {activeTab === 'master' && (
            <ItemMasterTable
                data={filteredData}
                loading={loading}
                fetchData={fetchItems}
                showToast={showToast}
                viewItem={viewItem}
                setViewItem={setViewItem}
            />
        )}
        
        {activeTab === 'stock' && (
            <StockManagementTab 
                data={filteredData} 
                loading={loading} 
                onRefresh={() => fetchItems(true)} 
                showToast={showToast}
            />
        )}

        {activeTab === 'distribution' && (
            <PartyDistributionTab 
                data={filteredData}
                loading={loading}
            />
        )}

        {activeTab === 'summary' && (
            <StockSummaryTab 
                data={filteredData}
                loading={loading}
            />
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