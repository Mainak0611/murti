import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../lib/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- SEARCHABLE SELECT COMPONENT (With Keyboard Support) ---
const SearchableSelect = ({ options, value, onChange, placeholder, labelKey = 'displayName', valueKey = 'id' }) => {
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
          if (e.target.value === '') onChange('');
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

// --- FUZZY SCORING MATCHING FUNCTION FOR SCANNED ITEMS ---
const cleanString = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const getBaseName = (name, size) => {
  const cName = cleanString(name);
  const cSize = cleanString(size);
  if (cSize && cName.includes(cSize)) {
    return cName.replace(cSize, '').trim();
  }
  return cName;
};

const parseNumbers = (sizeStr) => {
  if (!sizeStr) return [];
  const matches = sizeStr.match(/\d+(?:\.\d+)?/g);
  if (!matches) return [];
  return matches.map(Number);
};

const getLevenshteinSimilarity = (s1, s2) => {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const len1 = s1.length;
  const len2 = s2.length;
  const maxLen = Math.max(len1, len2);
  if (maxLen === 0) return 1.0;

  const matrix = [];
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
    }
  }

  return 1.0 - matrix[len1][len2] / maxLen;
};

const matchExtractedItem = (extItem, targetItems) => {
  const extBaseName = cleanString(extItem.item);
  const extSize = extItem.size || '';
  const extNums = parseNumbers(extSize);

  let bestMatchIdx = -1;
  let highestScore = 0;

  for (let idx = 0; idx < targetItems.length; idx++) {
    const targetItem = targetItems[idx];
    const targetFullName = targetItem.item_name || targetItem.displayName || '';
    const targetSize = targetItem.size || '';

    const targetBaseName = getBaseName(targetFullName, targetSize);
    const targetNums = parseNumbers(targetSize);

    // Name check
    const nameSimilarity = getLevenshteinSimilarity(extBaseName, targetBaseName);
    if (nameSimilarity < 0.7) {
      continue;
    }

    // Size check
    let sizeMatched = false;
    let sizeBonus = 0;

    if (extNums.length === 0 && targetNums.length === 0) {
      sizeMatched = true;
      sizeBonus = 5;
    } else if (extNums.length > 0 && targetNums.length > 0) {
      if (extNums.length === targetNums.length) {
        const allEqual = extNums.every((val, index) => val === targetNums[index]);
        if (allEqual) {
          sizeMatched = true;
          sizeBonus = 10;
        }
      }
    }

    if (!sizeMatched) {
      continue;
    }

    const score = nameSimilarity * 10 + sizeBonus;
    if (score > highestScore) {
      highestScore = score;
      bestMatchIdx = idx;
    }
  }

  return bestMatchIdx;
};

const DispatchItems = () => {
  // --- STATE ---
  const [parties, setParties] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [recentDispatches, setRecentDispatches] = useState([]);

  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [selectedPartyName, setSelectedPartyName] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [challanNo, setChallanNo] = useState('');

  // Rows state: each row contains { id, itemId, quantity, availableStock, unitWeight, totalWeight }
  const [rows, setRows] = useState([
    { id: Math.random(), itemId: '', quantity: '', availableStock: 0, unitWeight: 0, totalWeight: 0 }
  ]);

  // --- ESTIMATES NEW STATE ---
  const [activeTab, setActiveTab] = useState('dispatch'); // 'dispatch' or 'estimates'
  const [estimates, setEstimates] = useState([]);
  const [estPartyId, setEstPartyId] = useState('');
  const [estPartyName, setEstPartyName] = useState('');
  const [estDate, setEstDate] = useState(new Date().toISOString().split('T')[0]);
  const [estChallanNo, setEstChallanNo] = useState('');
  const [estRows, setEstRows] = useState([
    { id: Math.random(), itemId: '', quantity: '', unitWeight: 0, totalWeight: 0 }
  ]);
  const [estIsSubmitting, setEstIsSubmitting] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState(null); // When not null, estimate edit popup is open
  const [editEstPartyId, setEditEstPartyId] = useState('');
  const [editEstPartyName, setEditEstPartyName] = useState('');
  const [editEstDate, setEditEstDate] = useState('');
  const [editEstChallanNo, setEditEstChallanNo] = useState('');
  const [editEstRows, setEditEstRows] = useState([]);
  const [isEditEstChallanAvailable, setIsEditEstChallanAvailable] = useState(true);
  const [isCheckingEditEstChallan, setIsCheckingEditEstChallan] = useState(false);
  const [isEditEstSaving, setIsEditEstSaving] = useState(false);
  const [estSearchTerm, setEstSearchTerm] = useState('');
  const [estFilterDate, setEstFilterDate] = useState('');

  // Challan uniqueness check status
  const [isChallanAvailable, setIsChallanAvailable] = useState(true);
  const [isCheckingChallan, setIsCheckingChallan] = useState(false);
  const [isEstChallanAvailable, setIsEstChallanAvailable] = useState(true);
  const [isCheckingEstChallan, setIsCheckingEstChallan] = useState(false);

  // Loading and alerts
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // OCR state
  const [scanning, setScanning] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [progressIndex, setProgressIndex] = useState(0);
  const [extractedRows, setExtractedRows] = useState([]);
  const [showReviewCard, setShowReviewCard] = useState(false);
  const [isApplyingExtracted, setIsApplyingExtracted] = useState(false);

  // Edit / Delete Dispatches state
  const [deleteTarget, setDeleteTarget] = useState(null); // { order_id, challan_no }
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingDispatch, setEditingDispatch] = useState(null); // { order_id, challan_no, dispatch_date, items }
  const [editForm, setEditForm] = useState({ dispatchDate: '', challanNo: '', items: [] });
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Table filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [activeDetailDispatch, setActiveDetailDispatch] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  // --- INITIAL DATA FETCHING ---
  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [partiesRes, itemsRes] = await Promise.all([
        api.get('/api/parties'),
        api.get('/api/items')
      ]);

      const partiesData = Array.isArray(partiesRes.data) ? partiesRes.data : (partiesRes.data.data || []);
      const formattedParties = partiesData.map(p => ({
        ...p,
        displayName: `${p.party_name} ${p.firm_name ? `(${p.firm_name})` : ''}`
      }));
      setParties(formattedParties);

      const itemsData = Array.isArray(itemsRes.data) ? itemsRes.data : (itemsRes.data.data || []);
      const formattedItems = itemsData.map(i => ({
        ...i,
        displayName: `${i.item_name} ${i.size ? `(${i.size})` : ''}`
      }));
      setAvailableItems(formattedItems);

      await fetchDispatches(true);
      await fetchEstimates();
    } catch (err) {
      console.error(err);
      showToast("Failed to load initial data", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchDispatches = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await api.get('/api/orders/dispatches');
      const data = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setRecentDispatches(data);
    } catch (err) {
      console.error("Fetch dispatches error:", err);
      if (!isBackground) showToast("Failed to load dispatches history", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchEstimates = async () => {
    try {
      const res = await api.get('/api/orders/estimates');
      setEstimates(res.data.data || []);
    } catch (err) {
      console.error("Fetch estimates error:", err);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // --- PARTY CHANGES ---
  const handlePartyChange = async (partyId) => {
    setScanning(false);
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setExtractedRows([]);
    setShowReviewCard(false);
    setRows([{ id: Math.random(), itemId: '', quantity: '', availableStock: 0, unitWeight: 0, totalWeight: 0 }]);

    const party = parties.find(p => String(p.id) === String(partyId));
    if (party) {
      setSelectedPartyId(partyId);
      setSelectedPartyName(party.party_name);
    } else {
      setSelectedPartyId('');
      setSelectedPartyName('');
    }
  };

  const handleEstPartyChange = (partyId) => {
    const party = parties.find(p => String(p.id) === String(partyId));
    if (party) {
      setEstPartyId(partyId);
      setEstPartyName(party.party_name);
    } else {
      setEstPartyId('');
      setEstPartyName('');
    }
  };

  // --- CHALLAN UNIQUENESS & AUTOFILL EFFECTS ---
  useEffect(() => {
    if (!challanNo || challanNo.trim() === '') {
      setIsChallanAvailable(true);
      return;
    }
    const checkChallan = async () => {
      setIsCheckingChallan(true);
      try {
        const res = await api.get(`/api/orders/estimates/check-challan/${encodeURIComponent(challanNo)}`);

        // Check if there's an active/pending estimate for this challan
        const estRes = await api.get(`/api/orders/estimates/challan/${encodeURIComponent(challanNo)}`).catch(() => null);
        if (estRes && estRes.data && estRes.data.data) {
          const est = estRes.data.data;
          if (est.status === 'Pending' || est.status === 'Approved') {
            setIsChallanAvailable(true);
            showToast(`Estimate found for Challan No: ${challanNo}. Autofilling details...`, 'success');

            // Map party
            const party = parties.find(p => String(p.party_name) === String(est.party_name));
            if (party) {
              setSelectedPartyId(party.id);
              setSelectedPartyName(party.party_name);
            }

            // Map items
            if (est.items && est.items.length > 0) {
              const mappedRows = est.items.map(item => {
                const dbItem = availableItems.find(i => String(i.id) === String(item.item_id));
                return {
                  id: Math.random(),
                  itemId: item.item_id,
                  quantity: item.quantity,
                  availableStock: dbItem ? dbItem.current_stock || 0 : 0,
                  unitWeight: parseFloat(item.unit_weight) || 0,
                  totalWeight: parseFloat(item.total_weight) || 0
                };
              });
              setRows(mappedRows);
            }
            return;
          }
        }

        setIsChallanAvailable(res.data.available);
        if (!res.data.available) {
          showToast(`Challan number ${challanNo} is already in use, enter different challan`, 'error');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsCheckingChallan(false);
      }
    };

    const timer = setTimeout(checkChallan, 500);
    return () => clearTimeout(timer);
  }, [challanNo, parties, availableItems]);

  useEffect(() => {
    if (!estChallanNo || estChallanNo.trim() === '') {
      setIsEstChallanAvailable(true);
      return;
    }
    const checkEstChallan = async () => {
      setIsCheckingEstChallan(true);
      try {
        const res = await api.get(`/api/orders/estimates/check-challan/${encodeURIComponent(estChallanNo)}`);
        setIsEstChallanAvailable(res.data.available);
        if (!res.data.available) {
          showToast(`Challan number ${estChallanNo} is already in use, enter different challan`, 'error');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsCheckingEstChallan(false);
      }
    };

    const timer = setTimeout(checkEstChallan, 500);
    return () => clearTimeout(timer);
  }, [estChallanNo]);

  useEffect(() => {
    if (!editEstChallanNo || editEstChallanNo.trim() === '') {
      setIsEditEstChallanAvailable(true);
      return;
    }
    const checkEditEstChallan = async () => {
      setIsCheckingEditEstChallan(true);
      try {
        const res = await api.get(`/api/orders/estimates/check-challan/${encodeURIComponent(editEstChallanNo)}${editingEstimate ? `?excludeEstimateId=${editingEstimate.id}` : ''}`);
        setIsEditEstChallanAvailable(res.data.available);
        if (!res.data.available) {
          showToast(`Challan number ${editEstChallanNo} is already in use, enter different challan`, 'error');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsCheckingEditEstChallan(false);
      }
    };

    const timer = setTimeout(checkEditEstChallan, 500);
    return () => clearTimeout(timer);
  }, [editEstChallanNo, editingEstimate]);

  // --- ESTIMATE DYNAMIC ROWS HANDLERS ---
  const handleEstRowChange = (index, field, value) => {
    const updated = [...estRows];
    if (field === 'itemId') {
      updated[index].itemId = value;
      const item = availableItems.find(i => String(i.id) === String(value));
      if (item) {
        updated[index].unitWeight = parseFloat(item.weight) || 0;
        const qty = parseFloat(updated[index].quantity) || 0;
        updated[index].totalWeight = qty * (parseFloat(item.weight) || 0);
      } else {
        updated[index].unitWeight = 0;
        updated[index].totalWeight = 0;
      }
    } else if (field === 'quantity') {
      updated[index].quantity = value;
      const qty = parseFloat(value) || 0;
      const unitW = parseFloat(updated[index].unitWeight) || 0;
      updated[index].totalWeight = qty * unitW;
    }
    setEstRows(updated);
  };

  const addEstRow = () => {
    setEstRows([
      ...estRows,
      { id: Math.random(), itemId: '', quantity: '', unitWeight: 0, totalWeight: 0 }
    ]);
  };

  const deleteEstRow = (idToDelete) => {
    if (estRows.length === 1) {
      setEstRows([{ id: Math.random(), itemId: '', quantity: '', unitWeight: 0, totalWeight: 0 }]);
    } else {
      setEstRows(estRows.filter(r => r.id !== idToDelete));
    }
  };

  const estGrandTotalWeight = useMemo(() => {
    return estRows.reduce((sum, r) => sum + (parseFloat(r.totalWeight) || 0), 0);
  }, [estRows]);

  // --- ESTIMATE SUBMIT & ACTIONS ---
  const handleEstSubmit = async (e) => {
    e.preventDefault();

    if (!estPartyId) {
      showToast("Please select a party", "error");
      return;
    }

    if (!estChallanNo || estChallanNo.trim() === '') {
      showToast("Challan No. is required", "error");
      return;
    }

    if (!isEstChallanAvailable) {
      showToast("Challan number is already in use in this branch", "error");
      return;
    }

    const validRows = estRows.filter(r => r.itemId && parseFloat(r.quantity) > 0);
    if (validRows.length === 0) {
      showToast("Please select at least one item and enter a quantity", "error");
      return;
    }

    setEstIsSubmitting(true);
    try {
      const payload = {
        party_name: estPartyName,
        party_id: estPartyId,
        challan_no: estChallanNo,
        estimate_date: estDate,
        items: validRows.map(r => ({
          itemId: r.itemId,
          quantity: parseInt(r.quantity)
        }))
      };

      await api.post('/api/orders/estimates', payload);
      showToast("Estimate created successfully!", "success");

      // Reset Estimate Form
      setEstPartyId('');
      setEstPartyName('');
      setEstChallanNo('');
      setEstDate(new Date().toISOString().split('T')[0]);
      setEstRows([{ id: Math.random(), itemId: '', quantity: '', unitWeight: 0, totalWeight: 0 }]);
      fetchEstimates();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || "Failed to save estimate", "error");
    } finally {
      setEstIsSubmitting(false);
    }
  };

  const handleEditEstSubmit = async (e) => {
    e.preventDefault();

    if (!editEstPartyId) {
      showToast("Please select a party", "error");
      return;
    }

    if (!editEstChallanNo || editEstChallanNo.trim() === '') {
      showToast("Challan No. is required", "error");
      return;
    }

    if (!isEditEstChallanAvailable) {
      showToast("Challan number is already in use in this branch", "error");
      return;
    }

    const validRows = editEstRows.filter(r => r.itemId && parseFloat(r.quantity) > 0);
    if (validRows.length === 0) {
      showToast("Please select at least one item and enter a quantity", "error");
      return;
    }

    setIsEditEstSaving(true);
    try {
      const payload = {
        party_name: editEstPartyName,
        party_id: editEstPartyId,
        challan_no: editEstChallanNo,
        estimate_date: editEstDate,
        items: validRows.map(r => ({
          itemId: r.itemId,
          quantity: parseInt(r.quantity)
        }))
      };

      await api.put(`/api/orders/estimates/${editingEstimate.id}`, payload);
      showToast("Estimate updated successfully!", "success");
      setEditingEstimate(null);
      fetchEstimates();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.error || "Failed to update estimate", "error");
    } finally {
      setIsEditEstSaving(false);
    }
  };

  const handleInitiateEditEstimate = (est) => {
    setEditingEstimate(est);

    const party = parties.find(p => String(p.party_name) === String(est.party_name));
    setEditEstPartyId(party ? party.id : '');
    setEditEstPartyName(est.party_name);
    setEditEstDate(est.estimate_date.split('T')[0]);
    setEditEstChallanNo(est.challan_no);

    if (est.items && est.items.length > 0) {
      setEditEstRows(est.items.map(item => ({
        id: Math.random(),
        itemId: item.item_id,
        quantity: item.quantity,
        unitWeight: parseFloat(item.unit_weight) || 0,
        totalWeight: parseFloat(item.total_weight) || 0
      })));
    } else {
      setEditEstRows([{ id: Math.random(), itemId: '', quantity: '', unitWeight: 0, totalWeight: 0 }]);
    }
  };

  const handleEditEstPartyChange = (partyId) => {
    setEditEstPartyId(partyId);
    const party = parties.find(p => String(p.id) === String(partyId));
    setEditEstPartyName(party ? party.party_name : '');
  };

  const handleEditEstRowChange = (index, field, value) => {
    const updated = [...editEstRows];
    if (field === 'itemId') {
      updated[index].itemId = value;
      const item = availableItems.find(i => String(i.id) === String(value));
      if (item) {
        updated[index].unitWeight = parseFloat(item.weight) || 0;
        const qty = parseFloat(updated[index].quantity) || 0;
        updated[index].totalWeight = qty * (parseFloat(item.weight) || 0);
      } else {
        updated[index].unitWeight = 0;
        updated[index].totalWeight = 0;
      }
    } else if (field === 'quantity') {
      updated[index].quantity = value;
      const qty = parseFloat(value) || 0;
      const unitW = parseFloat(updated[index].unitWeight) || 0;
      updated[index].totalWeight = qty * unitW;
    }
    setEditEstRows(updated);
  };

  const addEditEstRow = () => {
    setEditEstRows([
      ...editEstRows,
      { id: Math.random(), itemId: '', quantity: '', unitWeight: 0, totalWeight: 0 }
    ]);
  };

  const deleteEditEstRow = (idToDelete) => {
    if (editEstRows.length === 1) {
      setEditEstRows([{ id: Math.random(), itemId: '', quantity: '', unitWeight: 0, totalWeight: 0 }]);
    } else {
      setEditEstRows(editEstRows.filter(r => r.id !== idToDelete));
    }
  };

  const editEstGrandTotalWeight = useMemo(() => {
    return editEstRows.reduce((sum, r) => sum + (parseFloat(r.totalWeight) || 0), 0);
  }, [editEstRows]);

  const handleDeleteEstimate = async (id) => {
    if (!window.confirm("Are you sure you want to delete this estimate?")) return;
    try {
      await api.delete(`/api/orders/estimates/${id}`);
      showToast("Estimate deleted successfully", "success");
      fetchEstimates();
    } catch (err) {
      console.error(err);
      showToast("Failed to delete estimate", "error");
    }
  };

  const generateEstimatePDF = (est) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    let currentY = 15;

    // Header
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(5, 150, 105);
    doc.text("ESTIMATE / CHALLAN PROPOSAL", 14, currentY);

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    doc.text(`Challan No: ${est.challan_no}`, 14, currentY + 6);
    doc.text(`Date: ${formatDate(est.estimate_date)}`, pageWidth - 14 - doc.getTextWidth(`Date: ${formatDate(est.estimate_date)}`), currentY + 6);

    currentY += 15;

    // Party Details Box
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.rect(14, currentY, pageWidth - 28, 20, 'F');
    doc.rect(14, currentY, pageWidth - 28, 20);

    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(15);
    doc.text("Party Information:", 18, currentY + 6);

    doc.setFont(undefined, 'normal');
    doc.text(est.party_name, 18, currentY + 13);

    currentY += 28;

    // Table
    const tableHeaders = ["SR #", "ITEM DESCRIPTION", "SIZE", "QTY", "UNIT WT", "TOTAL WT"];
    const tableBody = (est.items || []).map((item, idx) => [
      idx + 1,
      item.item_name,
      item.size || '-',
      `${item.quantity} units`,
      `${parseFloat(item.unit_weight || 0).toFixed(2)} kg`,
      `${parseFloat(item.total_weight || 0).toFixed(2)} kg`
    ]);

    tableBody.push([
      "",
      "GRAND TOTAL",
      "",
      "",
      "",
      `${parseFloat(est.total_weight || 0).toFixed(2)} kg`
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [tableHeaders],
      body: tableBody,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        halign: 'center',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [5, 150, 105],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      columnStyles: {
        1: { halign: 'left', fontStyle: 'bold' }
      },
      didParseCell: (data) => {
        if (data.row.index === tableBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 253, 244];
          data.cell.styles.textColor = [22, 101, 52];
        }
      }
    });

    const fileName = `Estimate_${est.challan_no}_${est.party_name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    doc.save(fileName);
    showToast(`PDF generated: ${fileName}`, 'success');
  };

  // --- DYNAMIC ROWS HANDLERS ---
  const handleRowChange = (index, field, value) => {
    const updated = [...rows];

    if (field === 'itemId') {
      updated[index].itemId = value;
      const item = availableItems.find(i => String(i.id) === String(value));
      if (item) {
        updated[index].unitWeight = parseFloat(item.weight) || 0;
        updated[index].availableStock = item.current_stock || 0;

        const qty = parseFloat(updated[index].quantity) || 0;
        updated[index].totalWeight = qty * (parseFloat(item.weight) || 0);
      } else {
        updated[index].unitWeight = 0;
        updated[index].availableStock = 0;
        updated[index].totalWeight = 0;
      }
    } else if (field === 'quantity') {
      updated[index].quantity = value;
      const qty = parseFloat(value) || 0;
      const unitW = parseFloat(updated[index].unitWeight) || 0;
      updated[index].totalWeight = qty * unitW;

      // Realtime warning if exceeds stock
      if (updated[index].availableStock && qty > updated[index].availableStock) {
        showToast(`Warning: Quantity exceeds available stock (${updated[index].availableStock})`, 'error');
      }
    }

    setRows(updated);
  };

  const addRow = () => {
    setRows([
      ...rows,
      { id: Math.random(), itemId: '', quantity: '', availableStock: 0, unitWeight: 0, totalWeight: 0 }
    ]);
  };

  const deleteRow = (idToDelete) => {
    if (rows.length === 1) {
      setRows([{ id: Math.random(), itemId: '', quantity: '', availableStock: 0, unitWeight: 0, totalWeight: 0 }]);
    } else {
      setRows(rows.filter(r => r.id !== idToDelete));
    }
  };

  // Sum weight of current rows
  const grandTotalWeight = useMemo(() => {
    return rows.reduce((sum, r) => sum + (parseFloat(r.totalWeight) || 0), 0);
  }, [rows]);

  // --- SUBMIT DISPATCH LOGIC ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedPartyId) {
      showToast("Please select a party", "error");
      return;
    }

    if (!challanNo || challanNo.trim() === '') {
      showToast("Challan No. is required", "error");
      return;
    }

    const validRows = rows.filter(r => r.itemId && parseFloat(r.quantity) > 0);
    if (validRows.length === 0) {
      showToast("Please enter quantities for at least one item", "error");
      return;
    }

    // Verify stock
    const exceedsStock = validRows.some(r => parseFloat(r.quantity) > r.availableStock);
    if (exceedsStock) {
      showToast("One or more items exceed available stock", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Fetch active orders for the selected party behind the scenes
      const activeOrdersRes = await api.get(`/api/orders/by-party?partyName=${encodeURIComponent(selectedPartyName)}`);
      const orders = Array.isArray(activeOrdersRes.data) ? activeOrdersRes.data : (activeOrdersRes.data.data || []);
      const active = orders.filter(o => o.status !== 'Completed');

      // Group dispatches by orderId
      const dispatchesByOrder = {}; // { [orderId]: [ { id: order_item_id, quantity_sent } ] }
      const newItemsToInsertByOrder = {}; // { [orderId]: [ { itemId, quantity } ] }

      // Let's decide which order ID to target for new items (if any exist)
      let targetOrderId = active.length > 0 ? active[0].id : null;

      // Loop through each dispatch row and match
      for (const r of validRows) {
        let remainingQty = parseInt(r.quantity);
        const itemId = parseInt(r.itemId);

        // Try to match pending items in active orders
        for (const order of active) {
          if (remainingQty <= 0) break;

          // Find if this order contains this item
          const orderItem = (order.items || []).find(oi => oi.item_id === itemId);
          if (orderItem) {
            const pendingQty = (orderItem.ordered_quantity || 0) - (orderItem.dispatched_quantity || 0);
            if (pendingQty > 0) {
              const sendQty = Math.min(remainingQty, pendingQty);
              if (!dispatchesByOrder[order.id]) {
                dispatchesByOrder[order.id] = [];
              }
              dispatchesByOrder[order.id].push({
                id: orderItem.id, // order_items.id
                quantity_sent: sendQty
              });
              remainingQty -= sendQty;
            }
          }
        }

        // If we still have remaining quantity (not matched to any pending orders)
        if (remainingQty > 0) {
          if (!targetOrderId) {
            // No active order exists for this party at all, we will create a new order containing all remaining items!
            if (!newItemsToInsertByOrder['new']) {
              newItemsToInsertByOrder['new'] = [];
            }
            newItemsToInsertByOrder['new'].push({
              itemId: itemId,
              quantity: remainingQty
            });
          } else {
            // Add remaining quantity to the targetOrderId order
            if (!newItemsToInsertByOrder[targetOrderId]) {
              newItemsToInsertByOrder[targetOrderId] = [];
            }
            newItemsToInsertByOrder[targetOrderId].push({
              itemId: itemId,
              quantity: remainingQty
            });
          }
        }
      }

      // Now process new order creation if needed
      if (newItemsToInsertByOrder['new']) {
        const createRes = await api.post('/api/orders', {
          party_name: selectedPartyName,
          order_date: dispatchDate,
          reference: 'Auto-Created for Direct Dispatch',
          items: newItemsToInsertByOrder['new'].map(item => ({
            itemId: item.itemId,
            ordered_quantity: item.quantity
          }))
        });
        targetOrderId = createRes.data.data.id;

        // Fetch the newly created order details to get item primary key IDs
        const orderDetailsRes = await api.get(`/api/orders/${targetOrderId}`);
        const updatedOrder = orderDetailsRes.data.data;

        if (!dispatchesByOrder[targetOrderId]) {
          dispatchesByOrder[targetOrderId] = [];
        }
        newItemsToInsertByOrder['new'].forEach(item => {
          const matchedItem = updatedOrder.items.find(i => String(i.item_id) === String(item.itemId));
          if (matchedItem) {
            dispatchesByOrder[targetOrderId].push({
              id: matchedItem.id, // order_items.id
              quantity_sent: item.quantity
            });
          }
        });
      }

      // Process new items added to existing orders
      for (const orderId of Object.keys(newItemsToInsertByOrder)) {
        if (orderId === 'new') continue;

        const itemsToAdd = newItemsToInsertByOrder[orderId];
        if (itemsToAdd.length > 0) {
          // Fetch order detail
          const orderRes = await api.get(`/api/orders/${orderId}`);
          const order = orderRes.data.data;
          const existingItems = (order.items || []).map(item => ({
            itemId: item.item_id,
            ordered_quantity: item.ordered_quantity
          }));

          itemsToAdd.forEach(item => {
            const matchedItem = existingItems.find(ei => String(ei.itemId) === String(item.itemId));
            if (matchedItem) {
              matchedItem.ordered_quantity += item.quantity;
            } else {
              existingItems.push({
                itemId: item.itemId,
                ordered_quantity: item.quantity
              });
            }
          });

          // Call PUT API to update the order
          await api.put(`/api/orders/${orderId}`, {
            party_name: order.party_name,
            order_date: order.order_date,
            reference: order.reference,
            contact_no: order.contact_no,
            remark: order.remark,
            items: existingItems
          });

          // Fetch updated details to map to order_items.id
          const orderDetailsRes = await api.get(`/api/orders/${orderId}`);
          const updatedOrder = orderDetailsRes.data.data;

          if (!dispatchesByOrder[orderId]) {
            dispatchesByOrder[orderId] = [];
          }
          itemsToAdd.forEach(item => {
            const matchedItem = updatedOrder.items.find(i => String(i.item_id) === String(item.itemId));
            if (matchedItem) {
              dispatchesByOrder[orderId].push({
                id: matchedItem.id, // order_items.id
                quantity_sent: item.quantity
              });
            }
          });
        }
      }

      // Now execute dispatches
      for (const orderId of Object.keys(dispatchesByOrder)) {
        const itemsToDispatch = dispatchesByOrder[orderId];
        if (itemsToDispatch.length > 0) {
          await api.put(`/api/orders/${orderId}/dispatch`, {
            dispatch_date: dispatchDate,
            challan_no: challanNo,
            items: itemsToDispatch
          });
        }
      }

      showToast("Dispatch recorded and stock updated successfully!", "success");

      // Reset form
      setRows([{ id: Math.random(), itemId: '', quantity: '', availableStock: 0, unitWeight: 0, totalWeight: 0 }]);
      setChallanNo('');
      setDispatchDate(new Date().toISOString().split('T')[0]);
      setSelectedPartyId('');
      setSelectedPartyName('');
      setSelectedFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setExtractedRows([]);
      setShowReviewCard(false);

      // Refresh dispatches log
      fetchDispatches(true);

    } catch (err) {
      console.error("Submit dispatch error:", err);
      showToast(err.response?.data?.error || "Failed to record dispatch", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- SCANNER / OCR LOGIC ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setExtractedRows([]);
    setShowReviewCard(false);
  };

  useEffect(() => {
    let intervalId;
    if (scanning) {
      setProgressIndex(0);
      intervalId = setInterval(() => {
        setProgressIndex((prev) => (prev + 1) % 3);
      }, 2000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [scanning]);

  const progressMessages = [
    "Uploading image...",
    "Reading gate pass...",
    "Extracting items..."
  ];

  const handleExtract = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('moduleType', 'DISPATCH');

    setScanning(true);
    setExtractedRows([]);
    setShowReviewCard(false);

    try {
      const response = await api.post('/api/gate-pass/extract', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const extItems = response.data.items || [];
      const reviewRows = extItems.map(ext => {
        // Try to match extracted item to the select party's available database items
        const matchIdx = matchExtractedItem(ext, availableItems);
        const matchedItem = matchIdx !== -1 ? availableItems[matchIdx] : null;

        return {
          tempId: Date.now() + Math.random(),
          extractedName: ext.item || '',
          extractedSize: ext.size || '',
          qty: ext.qty !== null && ext.qty !== undefined ? ext.qty : '',
          matchedItemId: matchedItem ? matchedItem.id : ''
        };
      });

      setExtractedRows(reviewRows);
      setShowReviewCard(true);
      showToast('Gate pass scanned! Please review the extracted items.', 'success');
    } catch (err) {
      console.error('Scan error:', err);
      showToast(err.response?.data?.error || 'Failed to extract items from image', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleExtractedRowChange = (index, field, value) => {
    const updated = [...extractedRows];
    updated[index][field] = value;
    setExtractedRows(updated);
  };

  const handleApplyExtractedItems = () => {
    setIsApplyingExtracted(true);
    try {
      const appliedRows = extractedRows.map(row => {
        const item = availableItems.find(opt => String(opt.id) === String(row.matchedItemId));
        if (!item) return null;

        const qty = parseInt(row.qty) || 0;
        return {
          id: Math.random(),
          itemId: item.id,
          availableStock: item.current_stock || 0,
          unitWeight: parseFloat(item.weight) || 0,
          quantity: qty > 0 ? qty : '',
          totalWeight: qty * (parseFloat(item.weight) || 0)
        };
      }).filter(Boolean);

      if (appliedRows.length > 0) {
        setRows(appliedRows);
        showToast("Scanned items applied to the dispatch form!", "success");
      } else {
        showToast("No valid mapped items to apply", "error");
      }

      setExtractedRows([]);
      setShowReviewCard(false);
    } catch (err) {
      console.error(err);
      showToast("Failed to apply scanned items", "error");
    } finally {
      setIsApplyingExtracted(false);
    }
  };

  // --- DELETE DISPATCH RECORD LOGIC ---
  const handleInitiateDelete = (dispatch) => {
    setDeleteTarget({ order_id: dispatch.order_id, challan_no: dispatch.challan_no });
    setShowDeleteConfirm(true);
  };

  const handleDeleteDispatch = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/orders/${deleteTarget.order_id}/dispatch/${deleteTarget.challan_no}`);
      showToast("Dispatch record deleted successfully", "success");
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      fetchDispatches(true);
    } catch (err) {
      console.error("Delete error:", err);
      showToast(err.response?.data?.error || "Failed to delete dispatch log", "error");
    }
  };

  // --- EDIT DISPATCH LOGIC (Modal) ---
  const handleInitiateEdit = async (dispatch) => {
    setEditError('');
    setIsEditSaving(false);

    try {
      // Fetch full order to map details
      const res = await api.get(`/api/orders/${dispatch.order_id}`);
      const order = res.data.data;

      // Filter dispatch logs matching this specific challan
      const challanLogs = (order.history || []).filter(h => h.challan_no === dispatch.challan_no);

      // Map dispatch items to the editing form
      const items = challanLogs.map(log => {
        const orderItem = (order.items || []).find(oi => oi.item_name === log.item_name && oi.size === log.size);
        return {
          item_name: log.item_name,
          size: log.size,
          quantity_sent: log.quantity_sent,
          original_qty: log.quantity_sent,
          available_stock: orderItem ? orderItem.current_stock || 0 : 0
        };
      });

      setEditingDispatch(dispatch);
      setEditForm({
        dispatchDate: dispatch.dispatch_date.split('T')[0],
        challanNo: dispatch.challan_no,
        items
      });
    } catch (err) {
      console.error("Failed to load details for edit", err);
      showToast("Failed to load dispatch details for edit", "error");
    }
  };

  const handleEditItemChange = (index, value) => {
    const updatedItems = [...editForm.items];
    const newQty = parseInt(value) || 0;
    updatedItems[index].quantity_sent = newQty;

    // Realtime stock check: net increase must not exceed available stock
    const originalQty = updatedItems[index].original_qty || 0;
    const netDeduction = newQty - originalQty;
    const stockAvailable = updatedItems[index].available_stock || 0;

    if (netDeduction > 0 && netDeduction > stockAvailable) {
      setEditError(`Quantity exceeds available stock by ${netDeduction - stockAvailable} units.`);
    } else {
      setEditError('');
    }

    setEditForm({ ...editForm, items: updatedItems });
  };

  const handleSaveEditDispatch = async (e) => {
    e.preventDefault();
    if (!editingDispatch) return;

    const hasInvalidStock = editForm.items.some(item => {
      const netDeduction = (parseInt(item.quantity_sent) || 0) - (item.original_qty || 0);
      return netDeduction > 0 && netDeduction > item.available_stock;
    });

    if (hasInvalidStock) {
      setEditError("Cannot save: One or more item quantities exceed available stock.");
      return;
    }

    setIsEditSaving(true);
    try {
      await api.put(`/api/orders/${editingDispatch.order_id}/dispatch/${editingDispatch.challan_no}`, {
        dispatch_date: editForm.dispatchDate,
        challan_no: editForm.challanNo,
        items: editForm.items.map(i => ({
          item_name: i.item_name,
          size: i.size,
          quantity_sent: i.quantity_sent
        }))
      });

      showToast("Dispatch updated successfully", "success");
      setEditingDispatch(null);
      fetchDispatches(true);
    } catch (err) {
      console.error("Save edit dispatch error:", err);
      setEditError(err.response?.data?.error || "Failed to update dispatch record");
    } finally {
      setIsEditSaving(false);
    }
  };

  // --- FILTERED DISPATCH HISTORY LOGIC ---
  const filteredDispatches = useMemo(() => {
    let result = [...recentDispatches];

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(d =>
        (d.party_name && d.party_name.toLowerCase().includes(lower)) ||
        (d.challan_no && d.challan_no.toLowerCase().includes(lower)) ||
        (d.item_name && d.item_name.toLowerCase().includes(lower))
      );
    }

    if (filterDate) {
      result = result.filter(d => d.dispatch_date && d.dispatch_date.startsWith(filterDate));
    }

    result.sort((a, b) => {
      const dateA = new Date(a.dispatch_date || 0).getTime();
      const dateB = new Date(b.dispatch_date || 0).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    return result;
  }, [recentDispatches, searchTerm, filterDate, sortOrder]);

  // --- CLUBBED DISPATCHES (Grouped by Party and Challan No) ---
  const clubbedDispatches = useMemo(() => {
    const groups = {};
    filteredDispatches.forEach(d => {
      const challan = d.challan_no || '-';
      const key = `${d.party_name || ''}|||${challan}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          dispatch_date: d.dispatch_date,
          party_name: d.party_name,
          challan_no: d.challan_no,
          order_id: d.order_id,
          order_ids: [d.order_id],
          items: [],
          total_quantity: 0,
          total_weight: 0
        };
      }
      groups[key].items.push({
        id: d.id,
        item_name: d.item_name,
        size: d.size,
        quantity_sent: d.quantity_sent,
        total_weight: parseFloat(d.total_weight) || 0,
        order_id: d.order_id
      });
      groups[key].total_quantity += parseInt(d.quantity_sent) || 0;
      groups[key].total_weight += parseFloat(d.total_weight) || 0;
      if (!groups[key].order_ids.includes(d.order_id)) {
        groups[key].order_ids.push(d.order_id);
      }
    });
    return Object.values(groups);
  }, [filteredDispatches]);

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
        .page-title { 
          font-size: 32px; 
          font-weight: 800; 
          margin-bottom: 24px; 
        }
        .card { 
          background: var(--bg-card); 
          border: 1px solid var(--border); 
          border-radius: 12px; 
          padding: 24px; 
          margin-bottom: 24px; 
          box-shadow: 0 1px 3px rgba(0,0,0,0.05); 
          width: 100%; 
          box-sizing: border-box; 
          overflow: visible; 
        }
        .section-title { 
          font-size: 18px; 
          margin-bottom: 16px; 
          margin-top: 0; 
          font-weight: 700; 
        }
        .hover-row { 
          transition: background-color 0.2s ease; 
        }
        .hover-row:hover { 
          background-color: var(--row-hover) !important; 
        }
        .form-grid { 
          display: grid; 
          grid-template-columns: repeat(3, 1fr); 
          gap: 16px; 
          align-items: end; 
          margin-bottom: 20px;
        }
        .form-group { 
          display: flex; 
          flex-direction: column; 
          gap: 6px; 
        }
        .form-label { 
          font-size: 13px; 
          font-weight: 600; 
          color: var(--text-muted); 
          text-transform: uppercase; 
        }
        .form-input { 
          padding: 10px; 
          border: 1px solid var(--border); 
          border-radius: 6px; 
          width: 100%; 
          font-size: 14px; 
          box-sizing: border-box;
        }
        .form-input:focus { 
          outline: 2px solid var(--primary); 
          border-color: transparent; 
        }
        .btn { 
          padding: 10px 20px; 
          border-radius: 8px; 
          font-weight: 600; 
          cursor: pointer; 
          border: none; 
          transition: all 0.2s; 
          white-space: nowrap; 
          display: inline-flex; 
          align-items: center; 
          gap: 6px; 
          justify-content: center; 
        }
        .btn-primary { 
          background: var(--primary); 
          color: white; 
        }
        .btn-primary:hover { 
          background: var(--primary-hover); 
        }
        .btn-primary:disabled { 
          background: #cbd5e1; 
          color: #64748b; 
          cursor: not-allowed; 
        }
        .btn-secondary { 
          background: #f1f5f9; 
          color: var(--text-muted); 
          border: 1px solid var(--border); 
        }
        .btn-secondary:hover { 
          background: #e2e8f0; 
          color: var(--text-main); 
        }
        .btn-danger {
          background: var(--danger);
          color: white;
        }
        .btn-danger:hover {
          background: #dc2626;
        }
        .table-container { 
          overflow-x: auto; 
          border-radius: 8px; 
          border: 1px solid var(--border); 
        }
        .data-table { 
          width: 100%; 
          border-collapse: collapse; 
          font-size: 15px; 
          text-align: left; 
        }
        .data-table th { 
          background: #f8fafc; 
          color: var(--text-muted); 
          font-weight: 600; 
          padding: 12px 16px; 
          font-size: 12px; 
          text-transform: uppercase; 
          border-bottom: 2px solid var(--border);
        }
        .data-table td { 
          padding: 10px 16px; 
          border-bottom: 1px solid var(--border); 
        }
        .toast-notification { 
          position: fixed; 
          bottom: 24px; 
          right: 24px; 
          padding: 12px 20px; 
          border-radius: 8px; 
          color: white; 
          font-weight: 600; 
          box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
          z-index: 4000; 
          animation: slideIn 0.3s ease-out; 
        }
        .toast-success { background-color: var(--primary); }
        .toast-error { background-color: var(--danger); }
        .scanner-container {
          background: #f8fafc;
          border: 2px dashed #cbd5e1;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .scanner-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }
        .scanner-actions {
          display: flex;
          gap: 8px;
        }
        .modal-overlay { 
          position: fixed; 
          top: 0; 
          left: 0; 
          right: 0; 
          bottom: 0; 
          background: rgba(0,0,0,0.5); 
          backdrop-filter: blur(2px); 
          z-index: 3000; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
        }
        .modal-box { 
          background: white; 
          border-radius: 12px; 
          padding: 24px; 
          max-width: 500px; 
          width: 90%; 
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); 
        }
        .modal-actions { 
          display: flex; 
          justify-content: flex-end; 
          gap: 12px; 
          margin-top: 20px; 
        }
        @keyframes slideIn { 
          from { transform: translateY(100%); opacity: 0; } 
          to { transform: translateY(0); opacity: 1; } 
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid var(--primary);
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .loading-dots span {
          animation-name: loading-dots;
          animation-duration: 1.4s;
          animation-iteration-count: infinite;
          animation-fill-mode: both;
        }
        .loading-dots span:nth-child(2) { animation-delay: .2s; }
        .loading-dots span:nth-child(3) { animation-delay: .4s; }
        @keyframes loading-dots {
          0% { opacity: .2; }
          20% { opacity: 1; }
          100% { opacity: .2; }
        }
        .fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .weight-badge {
          background-color: #ecfdf5;
          color: #065f46;
          padding: 4px 8px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 14px;
        }
        .tabs-container {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 8px;
        }
        .tab-btn {
          padding: 10px 20px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          background: transparent;
          border: none;
          color: var(--text-muted);
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }
        .tab-btn:hover {
          color: var(--text-main);
        }
        .tab-btn.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
        }
        .status-badge {
          padding: 4px 8px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 12px;
          display: inline-block;
        }
        .status-pending {
          background-color: #fef3c7;
          color: #d97706;
        }
        .status-approved {
          background-color: #e0f2fe;
          color: #0369a1;
        }
        .status-dispatched {
          background-color: #d1fae5;
          color: #059669;
        }
      `}</style>

      <div style={{ width: '100%', margin: '0 auto' }}>
        <h1 className="page-title">Manage Dispatch</h1>

        <div className="tabs-container">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'dispatch' ? 'active' : ''}`}
            onClick={() => setActiveTab('dispatch')}
          >
            🚀 Record Dispatch
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'estimates' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('estimates');
              setEditingEstimate(null);
            }}
          >
            📋 Manage Estimates
          </button>
        </div>

        {activeTab === 'dispatch' ? (
          <>
            {/* --- MAIN DISPATCH INPUT FORM --- */}
            <div className="card" style={{ overflow: 'visible' }}>
              <h3 className="section-title">Record Dispatch Items</h3>

              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Party Name</label>
                    <SearchableSelect
                      options={parties}
                      value={selectedPartyId}
                      onChange={handlePartyChange}
                      placeholder="Search and select party..."
                      labelKey="displayName"
                      valueKey="id"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Dispatch Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={dispatchDate}
                      onChange={(e) => setDispatchDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Challan No. <span style={{ color: 'red' }}>*</span> &nbsp;
                      {isCheckingChallan && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Checking...</span>}
                      {!isChallanAvailable && !isCheckingChallan && <span style={{ fontSize: '11px', color: 'var(--danger)' }}>⚠️ Unavailable</span>}
                      {isChallanAvailable && challanNo && !isCheckingChallan && <span style={{ fontSize: '11px', color: 'var(--primary)' }}>✓ Available</span>}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter Challan number"
                      value={challanNo}
                      onChange={(e) => setChallanNo(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* --- IMAGE OCR SCANNER --- */}
                <div className="scanner-container">
                  <div className="scanner-header">
                    <div>
                      <h5 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#334155' }}>
                        📷 Scan Dispatch Gate Pass
                      </h5>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                        Upload gate pass photos to automatically extract items and prefill dispatch quantities.
                      </p>
                    </div>
                    <div className="scanner-actions">
                      <label className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0, fontSize: '13px' }}>
                        📷 Take Photo
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleFileChange}
                          style={{ display: 'none' }}
                          disabled={scanning}
                        />
                      </label>
                      <label className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0, fontSize: '13px' }}>
                        📁 Select File
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          style={{ display: 'none' }}
                          disabled={scanning}
                        />
                      </label>
                    </div>
                  </div>

                  {previewUrl && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <img
                        src={previewUrl}
                        alt="Gate pass preview"
                        style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '4px', objectFit: 'contain' }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleExtract}
                        disabled={scanning}
                      >
                        {scanning ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            ⏳ Extracting
                            <span className="loading-dots">
                              <span>.</span><span>.</span><span>.</span>
                            </span>
                          </span>
                        ) : (
                          '🔍 Extract Text'
                        )}
                      </button>
                    </div>
                  )}

                  {scanning && (
                    <div style={{ color: '#059669', fontWeight: '600', fontSize: '14px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <span className="spinner" />
                      <span>⏳ {progressMessages[progressIndex]}</span>
                    </div>
                  )}
                </div>

                {/* --- OCR REVIEW CARD --- */}
                {showReviewCard && (
                  <div className="card fade-in" style={{ border: '2px solid var(--primary)', background: '#f0fdf4', padding: '20px' }}>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#166534' }}>
                      📋 Review Extracted Items
                    </h4>
                    <p style={{ margin: '4px 0 16px 0', fontSize: '13px', color: '#1b5e20' }}>
                      Verify and map extracted items to database items.
                    </p>

                    <div className="table-container" style={{ background: 'white' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Extracted text</th>
                            <th>Scan Qty</th>
                            <th>Mapped Item</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {extractedRows.map((row, idx) => (
                            <tr key={row.tempId}>
                              <td>{row.extractedName} {row.extractedSize ? `(${row.extractedSize})` : ''}</td>
                              <td>
                                <input
                                  type="number"
                                  className="form-input"
                                  style={{ width: 80, padding: 6 }}
                                  value={row.qty}
                                  onChange={(e) => handleExtractedRowChange(idx, 'qty', e.target.value)}
                                />
                              </td>
                              <td>
                                <select
                                  className="form-input"
                                  style={{ padding: 6 }}
                                  value={row.matchedItemId}
                                  onChange={(e) => handleExtractedRowChange(idx, 'matchedItemId', e.target.value)}
                                >
                                  <option value="">-- Match item --</option>
                                  {availableItems.map(item => (
                                    <option key={item.id} value={item.id}>{item.displayName}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', color: 'red' }}
                                  onClick={() => setExtractedRows(extractedRows.filter(r => r.tempId !== row.tempId))}
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ marginTop: 15, display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleApplyExtractedItems}
                        disabled={isApplyingExtracted}
                      >
                        Apply Scanned Quantities
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => { setShowReviewCard(false); setExtractedRows([]); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* --- DYNAMIC ROWS ITEMS SECTION --- */}
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#334155', marginBottom: 12 }}>Items Dispatch List</h4>

                  <div className="table-container" style={{ border: 'none', background: 'white' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '45%' }}>Select Item</th>
                          <th style={{ width: '15%', textAlign: 'center' }}>Available Stock</th>
                          <th style={{ width: '15%', textAlign: 'center' }}>Dispatch Qty</th>
                          <th style={{ width: '15%', textAlign: 'center' }}>Total Weight</th>
                          <th style={{ width: '10%', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, index) => {
                          return (
                            <tr key={row.id}>
                              <td>
                                <select
                                  className="form-input"
                                  value={row.itemId}
                                  onChange={(e) => handleRowChange(index, 'itemId', e.target.value)}
                                >
                                  <option value="">-- Choose item --</option>
                                  {availableItems.map(item => (
                                    <option key={item.id} value={item.id}>{item.displayName}</option>
                                  ))}
                                </select>
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: '600', color: '#475569' }}>
                                {row.itemId ? `${row.availableStock} units` : '-'}
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-input"
                                  placeholder="Qty"
                                  style={{ textAlign: 'center' }}
                                  value={row.quantity}
                                  onChange={(e) => handleRowChange(index, 'quantity', e.target.value)}
                                  disabled={!row.itemId}
                                />
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="weight-badge">
                                  {row.itemId ? `${(row.totalWeight || 0).toFixed(2)} kg` : '-'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '6px 12px', color: 'red' }}
                                  onClick={() => deleteRow(row.id)}
                                >
                                  🗑️ Remove
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={addRow}
                    >
                      ➕ Add Item Row
                    </button>

                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                      Grand Total Weight: <span style={{ color: 'var(--primary)', fontSize: '18px' }}>{grandTotalWeight.toFixed(2)} kg</span>
                    </div>
                  </div>

                  <div style={{ marginTop: 24, borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ padding: '12px 24px', fontSize: '15px' }}
                      disabled={isSubmitting || (!isChallanAvailable && !isCheckingChallan)}
                    >
                      {isSubmitting ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="spinner" style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                          Submitting Dispatch...
                        </span>
                      ) : (
                        '🚀 Submit Dispatch'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* --- DISPATCH LOGS HISTORY TABLE --- */}
            <div className="card">
              <h3 className="section-title">Recent Dispatches Log</h3>

              {/* Filters */}
              <div className="form-grid" style={{ marginBottom: 20 }}>
                <div className="form-group">
                  <label className="form-label">Search</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Party, Challan, or Item..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Dispatch Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Sort Date</label>
                  <select className="form-input" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                    <option value="desc">Newest First</option>
                    <option value="asc">Oldest First</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Party Name</th>
                      <th>Challan No.</th>
                      <th style={{ textAlign: 'center' }}>No. of Items</th>
                      <th style={{ textAlign: 'center' }}>Total Qty</th>
                      <th style={{ textAlign: 'center' }}>Total Weight</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clubbedDispatches.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                          No recent dispatches found.
                        </td>
                      </tr>
                    ) : (
                      clubbedDispatches.map(dispatch => (
                        <tr
                          key={dispatch.key}
                          onClick={() => setActiveDetailDispatch(dispatch)}
                          style={{ cursor: 'pointer' }}
                          className="hover-row"
                        >
                          <td style={{ fontWeight: '500' }}>{formatDate(dispatch.dispatch_date)}</td>
                          <td style={{ fontWeight: '600' }}>{dispatch.party_name}</td>
                          <td style={{ fontStyle: 'italic', color: '#475569' }}>{dispatch.challan_no || '-'}</td>
                          <td style={{ textAlign: 'center' }}>{dispatch.items.length} items</td>
                          <td style={{ textAlign: 'center', fontWeight: '600' }}>{dispatch.total_quantity} units</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="weight-badge">
                              {(dispatch.total_weight || 0).toFixed(2)} kg
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '13px' }}
                                onClick={() => handleInitiateEdit(dispatch)}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '13px', color: 'red' }}
                                onClick={() => handleInitiateDelete(dispatch)}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* --- ESTIMATES INPUT FORM --- */}
            <div className="card" style={{ overflow: 'visible' }}>
              <h3 className="section-title">
                📋 Create New Estimate
              </h3>

              <form onSubmit={handleEstSubmit}>
                <div className="form-grid">
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Party Name</label>
                    <SearchableSelect
                      options={parties}
                      value={estPartyId}
                      onChange={handleEstPartyChange}
                      placeholder="Search and select party..."
                      labelKey="displayName"
                      valueKey="id"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Estimate Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={estDate}
                      onChange={(e) => setEstDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Challan No. <span style={{ color: 'red' }}>*</span> &nbsp;
                      {isCheckingEstChallan && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Checking...</span>}
                      {!isEstChallanAvailable && !isCheckingEstChallan && <span style={{ fontSize: '11px', color: 'var(--danger)' }}>⚠️ Unavailable</span>}
                      {isEstChallanAvailable && estChallanNo && !isCheckingEstChallan && <span style={{ fontSize: '11px', color: 'var(--primary)' }}>✓ Available</span>}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Assign Challan number"
                      value={estChallanNo}
                      onChange={(e) => setEstChallanNo(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* --- ESTIMATE ITEMS LIST --- */}
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#334155', marginBottom: 12 }}>Items List</h4>

                  <div className="table-container" style={{ border: 'none', background: 'white' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '50%' }}>Select Item</th>
                          <th style={{ width: '20%', textAlign: 'center' }}>Qty</th>
                          <th style={{ width: '20%', textAlign: 'center' }}>Total Weight</th>
                          <th style={{ width: '10%', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {estRows.map((row, index) => (
                          <tr key={row.id}>
                            <td>
                              <select
                                className="form-input"
                                value={row.itemId}
                                onChange={(e) => handleEstRowChange(index, 'itemId', e.target.value)}
                              >
                                <option value="">-- Choose item --</option>
                                {availableItems.map(item => (
                                  <option key={item.id} value={item.id}>{item.displayName}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-input"
                                placeholder="Qty"
                                style={{ textAlign: 'center' }}
                                value={row.quantity}
                                onChange={(e) => handleEstRowChange(index, 'quantity', e.target.value)}
                                disabled={!row.itemId}
                                required
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="weight-badge">
                                {row.itemId ? `${(row.totalWeight || 0).toFixed(2)} kg` : '-'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '6px 12px', color: 'red' }}
                                onClick={() => deleteEstRow(row.id)}
                              >
                                🗑️ Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={addEstRow}
                    >
                      ➕ Add Item Row
                    </button>

                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                      Grand Total Weight: <span style={{ color: 'var(--primary)', fontSize: '18px' }}>{estGrandTotalWeight.toFixed(2)} kg</span>
                    </div>
                  </div>

                  <div style={{ marginTop: 24, borderTop: '1px solid #e2e8f0', paddingTop: 20, display: 'flex', gap: 12 }}>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ padding: '12px 24px', fontSize: '15px' }}
                      disabled={estIsSubmitting || (!isEstChallanAvailable && !isCheckingEstChallan)}
                    >
                      {estIsSubmitting ? 'Saving Estimate...' : '🚀 Save Estimate'}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* --- ESTIMATES LOG HISTORY TABLE --- */}
            <div className="card">
              <h3 className="section-title">Estimates & Challan Proposals Log</h3>

              <div className="form-grid" style={{ marginBottom: 20 }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Search</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search by party name or challan number..."
                    value={estSearchTerm}
                    onChange={(e) => setEstSearchTerm(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Estimate Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={estFilterDate}
                    onChange={(e) => setEstFilterDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Party Name</th>
                      <th>Challan No.</th>
                      <th style={{ textAlign: 'center' }}>Items Count</th>
                      <th style={{ textAlign: 'center' }}>Total Weight</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimates
                      .filter(est => {
                        let matches = true;
                        if (estSearchTerm) {
                          const term = estSearchTerm.toLowerCase();
                          matches =
                            est.party_name.toLowerCase().includes(term) ||
                            est.challan_no.toLowerCase().includes(term);
                        }
                        if (estFilterDate) {
                          matches = matches && est.estimate_date.startsWith(estFilterDate);
                        }
                        return matches;
                      })
                      .length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                          No estimates found.
                        </td>
                      </tr>
                    ) : (
                      estimates
                        .filter(est => {
                          let matches = true;
                          if (estSearchTerm) {
                            const term = estSearchTerm.toLowerCase();
                            matches =
                              est.party_name.toLowerCase().includes(term) ||
                              est.challan_no.toLowerCase().includes(term);
                          }
                          if (estFilterDate) {
                            matches = matches && est.estimate_date.startsWith(estFilterDate);
                          }
                          return matches;
                        })
                        .map(est => (
                          <tr key={est.id} className="hover-row">
                            <td style={{ fontWeight: '500' }}>{formatDate(est.estimate_date)}</td>
                            <td style={{ fontWeight: '600' }}>{est.party_name}</td>
                            <td style={{ fontStyle: 'italic', color: '#475569' }}>{est.challan_no}</td>
                            <td style={{ textAlign: 'center' }}>{(est.items || []).length} items</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="weight-badge">
                                {parseFloat(est.total_weight || 0).toFixed(2)} kg
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`status-badge status-${est.status.toLowerCase()}`}>
                                {est.status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '13px' }}
                                  onClick={() => generateEstimatePDF(est)}
                                >
                                  📄 PDF
                                </button>
                                {est.status !== 'Dispatched' && (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 8px', fontSize: '13px' }}
                                      onClick={() => handleInitiateEditEstimate(est)}
                                    >
                                      ✏️ Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 8px', fontSize: '13px', color: 'red' }}
                                      onClick={() => handleDeleteEstimate(est.id)}
                                    >
                                      🗑️ Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Confirm Delete</h3>
            <p style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: '14px' }}>
              Are you sure you want to delete this dispatch log? This will restore the dispatched quantities to the order items and add the stock back to the inventory.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteDispatch}
              >
                Delete Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT DISPATCH MODAL --- */}
      {editingDispatch && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '600px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Edit Dispatch Details</h3>
            <p style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: '13px' }}>
              Party: <strong>{editingDispatch.party_name}</strong>
            </p>

            <form onSubmit={handleSaveEditDispatch} style={{ marginTop: 15 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '15px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '12px' }}>Dispatch Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editForm.dispatchDate}
                    onChange={(e) => setEditForm({ ...editForm, dispatchDate: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '12px' }}>Challan No.</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.challanNo}
                    onChange={(e) => setEditForm({ ...editForm, challanNo: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', background: '#f8fafc' }}>
                <span className="form-label" style={{ fontSize: '11px', display: 'block', marginBottom: '6px' }}>Dispatch Quantities</span>

                {editForm.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>
                      {item.item_name} {item.size ? `(${item.size})` : ''}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Stock: {item.available_stock}</span>
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '80px', padding: '4px', textAlign: 'center' }}
                        value={item.quantity_sent}
                        onChange={(e) => handleEditItemChange(idx, e.target.value)}
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>

              {editError && (
                <div style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: '600', marginTop: '10px' }}>
                  ⚠️ {editError}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingDispatch(null)}
                  disabled={isEditSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isEditSaving || !!editError}
                >
                  {isEditSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT ESTIMATE POPUP MODAL --- */}
      {editingEstimate && (
        <div className="modal-overlay" onClick={() => {
          setEditingEstimate(null);
        }}>
          <div className="modal-box" style={{ maxWidth: '850px', width: '90%', overflow: 'visible' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>✏️ Edit Estimate</h3>
            <p style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: '13px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '15px' }}>
              Estimate ID: <strong>{editingEstimate.id}</strong> &nbsp;|&nbsp; Current Status: <strong>{editingEstimate.status}</strong>
            </p>

            <form onSubmit={handleEditEstSubmit}>
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Party Name</label>
                  <SearchableSelect
                    options={parties}
                    value={editEstPartyId}
                    onChange={handleEditEstPartyChange}
                    placeholder="Search and select party..."
                    labelKey="displayName"
                    valueKey="id"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Estimate Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editEstDate}
                    onChange={(e) => setEditEstDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Challan No. <span style={{ color: 'red' }}>*</span> &nbsp;
                    {isCheckingEditEstChallan && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Checking...</span>}
                    {!isEditEstChallanAvailable && !isCheckingEditEstChallan && <span style={{ fontSize: '11px', color: 'var(--danger)' }}>⚠️ Unavailable</span>}
                    {isEditEstChallanAvailable && editEstChallanNo && !isCheckingEditEstChallan && <span style={{ fontSize: '11px', color: 'var(--primary)' }}>✓ Available</span>}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Assign Challan number"
                    value={editEstChallanNo}
                    onChange={(e) => setEditEstChallanNo(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* --- ESTIMATE ITEMS LIST --- */}
              <div style={{ marginTop: 24 }}>
                <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#334155', marginBottom: 12 }}>Items List</h4>

                <div className="table-container" style={{ border: 'none', background: 'white', maxHeight: '350px', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '50%' }}>Select Item</th>
                        <th style={{ width: '20%', textAlign: 'center' }}>Qty</th>
                        <th style={{ width: '20%', textAlign: 'center' }}>Total Weight</th>
                        <th style={{ width: '10%', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editEstRows.map((row, index) => (
                        <tr key={row.id}>
                          <td>
                            <select
                              className="form-input"
                              value={row.itemId}
                              onChange={(e) => handleEditEstRowChange(index, 'itemId', e.target.value)}
                            >
                              <option value="">-- Choose item --</option>
                              {availableItems.map(item => (
                                <option key={item.id} value={item.id}>{item.displayName}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-input"
                              placeholder="Qty"
                              style={{ textAlign: 'center' }}
                              value={row.quantity}
                              onChange={(e) => handleEditEstRowChange(index, 'quantity', e.target.value)}
                              disabled={!row.itemId}
                              required
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="weight-badge">
                              {row.itemId ? `${(row.totalWeight || 0).toFixed(2)} kg` : '-'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '6px 12px', color: 'red' }}
                              onClick={() => deleteEditEstRow(row.id)}
                            >
                              🗑️ Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={addEditEstRow}
                  >
                    ➕ Add Item Row
                  </button>

                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                    Grand Total Weight: <span style={{ color: 'var(--primary)', fontSize: '18px' }}>{editEstGrandTotalWeight.toFixed(2)} kg</span>
                  </div>
                </div>

                <div className="modal-actions" style={{ marginTop: 24, borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditingEstimate(null);
                    }}
                    disabled={isEditEstSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isEditEstSaving || (!isEditEstChallanAvailable && !isCheckingEditEstChallan)}
                  >
                    {isEditEstSaving ? 'Updating...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DETAIL DISPATCH POPUP MODAL --- */}
      {activeDetailDispatch && (
        <div className="modal-overlay" onClick={() => setActiveDetailDispatch(null)}>
          <div className="modal-box" style={{ maxWidth: '900px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Dispatch Items Detail</h3>
            <p style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: '13px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              Party: <strong>{activeDetailDispatch.party_name}</strong> &nbsp;|&nbsp;
              Challan No.: <strong>{activeDetailDispatch.challan_no || '-'}</strong> &nbsp;|&nbsp;
              Date: <strong>{formatDate(activeDetailDispatch.dispatch_date)}</strong>
            </p>

            <div style={{ maxHeight: '550px', overflowY: 'auto', margin: '15px 0', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Size</th>
                    <th style={{ textAlign: 'center' }}>Quantity</th>
                    <th style={{ textAlign: 'center' }}>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDetailDispatch.items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: '600' }}>{item.item_name}</td>
                      <td>{item.size || '-'}</td>
                      <td style={{ textAlign: 'center', fontWeight: '600' }}>{item.quantity_sent} units</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="weight-badge">{(item.total_weight || 0).toFixed(2)} kg</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #e2e8f0', fontWeight: '700' }}>
                    <td style={{ padding: '10px 8px', color: '#334155', fontWeight: '700' }}>TOTAL</td>
                    <td style={{ padding: '10px 8px', color: '#475569', fontWeight: '700' }}>-</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px', color: '#334155', fontWeight: '700' }}>
                      {activeDetailDispatch.items.reduce((sum, item) => sum + (item.quantity_sent || 0), 0)} units
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                      <span className="weight-badge" style={{ backgroundColor: '#d1fae5', color: '#065f46', fontWeight: '700' }}>
                        {activeDetailDispatch.items.reduce((sum, item) => sum + (parseFloat(item.total_weight) || 0), 0).toFixed(2)} kg
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveDetailDispatch(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      {toast.show && (
        <div className={`toast-notification ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default DispatchItems;
