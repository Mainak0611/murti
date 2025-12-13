// frontend/src/modules/ItemMasterIndex.jsx
import React, { useEffect, useState, useMemo, useRef, useLayoutEffect } from 'react';
import api from '../../lib/api';
import ItemMasterForm from './itemMasterForm';
import ItemMasterTable from './itemMasterTable';

const ItemMasterIndex = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // --- LIFTED STATE (For Modal/Blur) ---
  const [viewItem, setViewItem] = useState(null);

  // --- FILTER & SORT STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  
  // CHANGED: Split sorting into "Field" and "Order"
  const [sortBy, setSortBy] = useState('id'); // Options: 'id', 'weight', 'size', 'price'
  const [sortOrder, setSortOrder] = useState('asc'); // Options: 'asc', 'desc'

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
    if (!isBackground) {
      setLoading(true);
    }
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

  useEffect(() => {
    fetchItems(); 
  }, []);

  // --- FILTER & SORT LOGIC ---
  const filteredData = useMemo(() => {
    let result = [...items];

    // 1. Search Filter
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(item =>
        (item.item_name && item.item_name.toLowerCase().includes(lowerTerm)) ||
        (item.hsn_code && item.hsn_code.toLowerCase().includes(lowerTerm)) ||
        (item.remarks && item.remarks.toLowerCase().includes(lowerTerm))
      );
    }

    // 2. Dynamic Sorting
    result.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      // Handle nulls/undefined safely
      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      // Numeric Parsing for Weight/Price/ID to ensure "10" comes after "2"
      // (Tries to parse "10kg" -> 10, "Rs. 500" -> 500)
      const numA = parseFloat(String(valA).replace(/[^0-9.-]+/g,""));
      const numB = parseFloat(String(valB).replace(/[^0-9.-]+/g,""));

      const isNumeric = !isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '';

      if (isNumeric && (sortBy === 'weight' || sortBy === 'price' || sortBy === 'id')) {
         return sortOrder === 'asc' ? numA - numB : numB - numA;
      }

      // Fallback to String comparison (e.g. for Size "L", "XL", "M")
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
      {/* GLOBAL STYLES */}
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
          --row-hover-highlight: #bbf7d0;
          --ripple-color: rgba(5, 150, 105, 0.4);
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
          box-sizing: border-box; 
          transition: filter 0.3s ease;
        }
        .section-title { font-size: 18px; margin-bottom: 16px; margin-top: 0; font-weight: 700; }

        .enquiry-form-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          align-items: end;
        }
        .full-width { grid-column: 1 / -1; }

        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-label { font-size: 13px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
        .form-input { padding: 10px; border: 1px solid var(--border); border-radius: 6px; width: 100%; font-size: 14px; }
        .form-input:focus { outline: 2px solid var(--primary); border-color: transparent; }

        .btn { padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; white-space: nowrap; }
        .btn-primary { background: var(--primary); color: white; }
        .btn-primary:hover { background: var(--primary-hover); }
        .btn-secondary { background: #f1f5f9; color: var(--text-muted); border: 1px solid var(--border); }
        .btn-secondary:hover { background: #e2e8f0; color: var(--text-main); }

        .table-container { overflow-x: auto; border-radius: 8px; border: none; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 15px; text-align: left; }
        .data-table th { background: #f8fafc; color: var(--text-muted); font-weight: 600; padding: 12px 16px; font-size: 12px; text-transform: uppercase; }
        .data-table td { padding: 8px 16px; border-bottom: 1px solid var(--border); position: relative; overflow: hidden; cursor: pointer; transition: background-color 0.2s; vertical-align: middle; }

        .data-table tbody tr { transition: background-color 0.15s; }
        .data-table tbody tr:hover { background-color: var(--row-hover); }
        .data-table tbody tr:active { background-color: #cbd5e1; }

        .row-highlight { background: var(--highlight-bg) !important; }
        .row-highlight:hover { background-color: var(--row-hover-highlight) !important; }

        .toast-notification { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 8px; color: white; font-weight: 600; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 2000; animation: slideIn 0.3s ease-out; }
        .toast-success { background-color: var(--primary); }
        .toast-error { background-color: var(--danger); }
        @keyframes slideIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        @media (max-width: 1024px) {
          .enquiry-form-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .enquiry-form-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={{width: '100%', margin: '0 auto'}}>
        <h1 className="page-title">Item Master</h1>

        <ItemMasterForm onSuccess={() => fetchItems(false)} showToast={showToast} />

        <div ref={sentinelRef} style={{ height: '1px', marginBottom: '-1px' }} />

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
              margin: 0, transition: 'none',
              filter: viewItem ? 'blur(5px)' : 'none', pointerEvents: viewItem ? 'none' : 'auto'
            } : {
              margin: 0, transition: 'none',
              filter: viewItem ? 'blur(5px)' : 'none', pointerEvents: viewItem ? 'none' : 'auto'
            }}
          >
            <div className="enquiry-form-grid">
              {/* 1. Search (Reduced to 1 column width) */}
              <div className="form-group">
                <label className="form-label">Search</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Name / HSN"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* 2. Sort Field (New) */}
              <div className="form-group">
                <label className="form-label">Sort By</label>
                <select
                  className="form-input"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="id">ID</option>
                  <option value="weight">Weight</option>
                  <option value="size">Size</option>
                  <option value="price">Price</option>
                </select>
              </div>

              {/* 3. Sort Order (Renamed) */}
              <div className="form-group">
                <label className="form-label">Order</label>
                <select
                  className="form-input"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  <option value="asc">Ascending (A-Z)</option>
                  <option value="desc">Descending (Z-A)</option>
                </select>
              </div>

              {/* 4. Clear Button */}
              <div className="form-group">
                <label className="form-label">&nbsp;</label>
                <button
                  className="btn btn-secondary"
                  style={{width: '100%'}}
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        <ItemMasterTable
          data={filteredData}
          loading={loading}
          fetchData={fetchItems}
          showToast={showToast}
          viewItem={viewItem}
          setViewItem={setViewItem}
        />
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