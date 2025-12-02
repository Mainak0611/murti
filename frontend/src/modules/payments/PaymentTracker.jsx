// frontend/src/modules/PaymentTracker.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import api from "../../lib/api";
import {
  formatDateForDisplay,
  getStatusDisplay
} from "./PaymentUtils.js";

function PaymentTracker() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState({ type: null, text: '' });

  // --- FILTER STATES ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('none');

  // ref for quick focusing the search input
  const searchInputRef = useRef(null);

  // --- MERGE STATES ---
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showMergeConfirmModal, setShowMergeConfirmModal] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  // --- EDIT MODAL STATE (Main Details) ---
  const [editingPayment, setEditingPayment] = useState(null);
  const [editForm, setEditForm] = useState({ party: '', contact_no: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // --- MANAGE MODAL STATE ---
  const [managePaymentId, setManagePaymentId] = useState(null);
  const [managePaymentIndex, setManagePaymentIndex] = useState(null);
  const [trackingHistory, setTrackingHistory] = useState([]);
  const [newRemark, setNewRemark] = useState('');
  const [newDate, setNewDate] = useState('');

  // --- MERGED ACCOUNTS MODAL STATE ---
  const [mergedParentId, setMergedParentId] = useState(null);
  const [mergedAccounts, setMergedAccounts] = useState([]);
  const [isMergedModalOpen, setIsMergedModalOpen] = useState(false);
  const [editingMergedId, setEditingMergedId] = useState(null);
  const [editMergedForm, setEditMergedForm] = useState({ party: '', contact_no: '' });
  const [isSavingMerged, setIsSavingMerged] = useState(false);

  // --- NEW: HISTORY EDIT STATE ---
  const [editingHistoryId, setEditingHistoryId] = useState(null);
  const [editHistoryForm, setEditHistoryForm] = useState({ date: '', remark: '' });
  const [isHistoryActionLoading, setIsHistoryActionLoading] = useState(false);

  // --- Button Loading & Toast State ---
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // --- CONFIRM MODAL STATE (replaces window.confirm) ---
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: '',
    description: '',
    onConfirm: null,
    confirmLabel: 'Yes',
    cancelLabel: 'No'
  });

  // --- HEADERS ---
  const baseHeaders = ["ID", "Party","Last Activity",  "Remark","Dates","Contact", "Status",   "Action"];
  const baseKeys = ["id", "party", "latest_payment", "latest_remark", "date_count", "contact_no", "payment_status", "Action"];

  // --- TOAST HELPER ---
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  // --- CONFIRM HELPER ---
  const showConfirm = ({ title = "Confirm", description = "", onConfirm = () => {}, confirmLabel = "Yes", cancelLabel = "No" }) => {
    setConfirmModal({ open: true, title, description, onConfirm, confirmLabel, cancelLabel });
  };
  const closeConfirm = () => setConfirmModal({ open: false, title: '', description: '', onConfirm: null, confirmLabel: 'Yes', cancelLabel: 'No' });
  const handleConfirm = async () => {
    if (confirmModal.onConfirm) {
      try {
        await confirmModal.onConfirm();
      } catch (err) {
        // errors handled by caller typically
      }
    }
    closeConfirm();
  };

  // --- HELPER: Format Date for Input ---
  const getInputValueDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
  };

  // --- RIPPLE EFFECT ---
  const createRipple = (event) => {
    if (event.target.closest('button') || event.target.closest('input')) return; 
    const cell = event.currentTarget; 
    const existing = cell.getElementsByClassName("ripple")[0];
    if (existing) existing.remove();
    const circle = document.createElement("span");
    const diameter = Math.max(cell.clientWidth, cell.clientHeight);
    const radius = diameter / 2;
    const rect = cell.getBoundingClientRect();
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - rect.left - radius}px`;
    circle.style.top = `${event.clientY - rect.top - radius}px`;
    circle.classList.add("ripple");
    cell.appendChild(circle);
    setTimeout(() => circle.remove(), 600);
  };
  
  const normalizePaymentItem = (item) => {
     let latest = item.latest_payment ?? null;
     let latestDate = null;
     if (latest) {
       try {
         if (typeof latest === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(latest)) {
           latestDate = new Date(`${latest}T00:00:00`);
           if (Number.isNaN(latestDate.getTime())) latestDate = null;
         } else {
           const parsed = new Date(latest);
           latestDate = Number.isNaN(parsed.getTime()) ? null : parsed;
         }
       } catch (e) { latestDate = null; }
     }
     let rawStatus = (item.payment_status || '').toString().trim().toUpperCase();
     if (rawStatus === 'NO RESPONSE') rawStatus = 'NO_RESPONSE';
     if (rawStatus === 'CLOSE PARTY') rawStatus = 'CLOSE_PARTY';
     return {
       ...item,
       latest_payment: latestDate,
       payment_status: rawStatus,
       contact_no: item.contact_no != null ? String(item.contact_no) : '',
       merged_into_id: item.merged_into_id ?? null
     };
  };

  const isSameDay = (a, b) => {
      if (!a || !b) return false;
      try {
        const da = (a instanceof Date) ? a : new Date(a);
        const db = (b instanceof Date) ? b : new Date(b);
        if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
        return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
      } catch (e) { return false; }
  };
  const isToday = (dateLike) => isSameDay(dateLike, new Date());


  const fetchPayments = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await api.get("/api/payments");
      let payload = [];
      if (Array.isArray(res.data)) payload = res.data;
      else if (Array.isArray(res.data?.data)) payload = res.data.data;
      else if (res.data?.rows && Array.isArray(res.data.rows)) payload = res.data.rows;
      else {
         const values = Object.values(res.data || {});
         const arr = values.find(v => Array.isArray(v));
         payload = arr || [];
      }
      const normalized = payload.map(normalizePaymentItem);
      setPayments(normalized);
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Error fetching payments:", err);
      setPayments([]);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  // Set the default filterMonth to the current month and year
  useEffect(() => {
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
    const currentYear = currentDate.getFullYear();
    setFilterMonth(`${currentMonth} ${currentYear}`);
  }, []);

  const availableMonths = useMemo(() => {
    const unique = new Set();
    payments.forEach(p => { if (p.month && p.year) unique.add(`${p.month} ${p.year}`); });
    return Array.from(unique);
  }, [payments]);

  const dateRangeDisplay = useMemo(() => {
      if (filterMonth !== 'ALL') return filterMonth;
      if (availableMonths.length === 0) return 'No Data';
      const parseMonthYear = (str) => { const [m, y] = str.split(' '); return new Date(`${m} 1, ${y}`); };
      const sorted = availableMonths.map(s => ({ str: s, date: parseMonthYear(s) })).sort((a, b) => a.date - b.date);
      if (sorted.length === 0) return '';
      if (sorted.length === 1) return sorted[0].str;
      return `${sorted[0].str} - ${sorted[sorted.length - 1].str}`;
  }, [filterMonth, availableMonths]);

  // --- NEW: Calculate Merged Counts ---
  const mergedCounts = useMemo(() => {
    const counts = {};
    payments.forEach(p => {
      if (p.merged_into_id) {
        counts[p.merged_into_id] = (counts[p.merged_into_id] || 0) + 1;
      }
    });
    return counts;
  }, [payments]);

  const filteredPayments = useMemo(() => {
    let list = payments;
    const getStatus = (p) => (p && p.payment_status ? String(p.payment_status).trim().toUpperCase() : '');

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(p =>
        (p.party && String(p.party).toLowerCase().includes(term)) ||
        (p.contact_no && String(p.contact_no).toLowerCase().includes(term))
      );
    }

    if (filterMonth !== 'ALL') {
      list = list.filter(p => `${p.month} ${p.year}` === filterMonth);
    }

    if (filterStatus !== 'ALL') {
      const desired = String(filterStatus).trim().toUpperCase();
      if (desired === 'PENDING') {
        list = list.filter(p => { const s = getStatus(p); return s === 'PENDING' || s === 'PARTIAL'; });
      } else {
        list = list.filter(p => getStatus(p) === desired);
      }
    }

    if (sortOrder !== 'none') {
      list = [...list].sort((a, b) => {
        const dateA = a.latest_payment; const dateB = b.latest_payment;
        if (!dateA && !dateB) return 0; if (!dateA) return 1; if (!dateB) return -1;
        const timeA = new Date(dateA).getTime(); const timeB = new Date(dateB).getTime();
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      });
    } else {
      list = [...list].sort((a, b) => {
        const ida = Number(a?.id ?? 0); const idb = Number(b?.id ?? 0);
        return ida - idb;
      });
    }
    return list;
  }, [payments, searchTerm, filterMonth, filterStatus, sortOrder]);

  // --- NEW: remove merged records from main table view ---
  const displayPayments = useMemo(() => {
    return filteredPayments.filter(p => !p.merged_into_id);
  }, [filteredPayments]);

  const fetchTrackingHistory = async (paymentId) => {
    try {
      const res = await api.get(`/api/payments/tracking/${paymentId}`);
      let payload = [];
      if (Array.isArray(res.data)) payload = res.data;
      else if (Array.isArray(res.data?.data)) payload = res.data.data;
      else payload = Array.isArray(res.data) ? res.data : [];
      setTrackingHistory(payload);
    } catch (err) { console.error("Failed to fetch tracking history:", err); setTrackingHistory([]); }
  };

  const openManageModal = (paymentId, displayIndex) => {
    setManagePaymentId(paymentId); setManagePaymentIndex(displayIndex); fetchTrackingHistory(paymentId); setNewRemark(''); setNewDate('');
  };
  
  const closeManageModal = () => { 
    setManagePaymentId(null); 
    setManagePaymentIndex(null); 
    setTrackingHistory([]);
    // Clear new edit states
    setEditingHistoryId(null);
    setEditHistoryForm({ date: '', remark: '' });
  };

  // --- MERGED ACCOUNTS HANDLERS ---
  const openMergedModal = async (paymentId) => {
    setMergedParentId(paymentId);
    setIsMergedModalOpen(true);
    try {
      const res = await api.get(`/api/payments/${paymentId}/merged`);
      let payload = [];
      if (Array.isArray(res.data)) payload = res.data;
      else if (Array.isArray(res.data?.data)) payload = res.data.data;
      else payload = Array.isArray(res.data) ? res.data : [];
      setMergedAccounts(payload);
      setEditingMergedId(null);
      setEditMergedForm({ party: '', contact_no: '' });
    } catch (err) {
      console.error("Failed to fetch merged accounts:", err);
      setMergedAccounts([]);
    }
  };

  const closeMergedModal = () => {
    setIsMergedModalOpen(false);
    setMergedParentId(null);
    setMergedAccounts([]);
    setEditingMergedId(null);
    setEditMergedForm({ party: '', contact_no: '' });
  };

  const startEditMerged = (record) => {
    setEditingMergedId(record.id);
    setEditMergedForm({ party: record.party || '', contact_no: record.contact_no || '' });
  };

  const cancelEditMerged = () => {
    setEditingMergedId(null);
    setEditMergedForm({ party: '', contact_no: '' });
  };

  const saveMergedEdit = async (id) => {
    setIsSavingMerged(true);
    try {
      await api.patch(`/api/payments/${id}/details`, editMergedForm);
      showToast("Merged record updated", "success");
      // refresh both payments list and merged accounts list
      await fetchPayments(true);
      await openMergedModal(mergedParentId);
      setEditingMergedId(null);
    } catch (err) {
      console.error("Failed to save merged edit:", err);
      showToast("Failed to save merged record", "error");
    } finally {
      setIsSavingMerged(false);
    }
  };

  const unmergeRecord = async (id) => {
    // replaced window.confirm with in-app confirm modal
    showConfirm({
      title: "Unmerge Record",
      description: "Unmerge this record (remove merged link)?",
      confirmLabel: "Unmerge",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        try {
          await api.patch(`/api/payments/${id}/unmerge`);
          showToast("Record unmerged", "success");
          await fetchPayments(true);
          await openMergedModal(mergedParentId);
        } catch (err) {
          console.error("Failed to unmerge:", err);
          showToast("Failed to unmerge", "error");
        }
      }
    });
  };

  // --- HISTORY CRUD HANDLERS ---

  const handleStartEditHistory = (entry) => {
    setEditingHistoryId(entry.id);
    const rawDate = entry.actual_payment || entry.entry_date;
    setEditHistoryForm({
      date: getInputValueDate(rawDate),
      remark: entry.remark || ''
    });
  };

  const handleCancelEditHistory = () => {
    setEditingHistoryId(null);
    setEditHistoryForm({ date: '', remark: '' });
  };

  const handleSaveHistoryEntry = async (entryId) => {
    if (!editHistoryForm.date) {
        showToast("Date is required", 'error');
        return;
    }
    setIsHistoryActionLoading(true);
    try {
      await api.patch(`/api/payments/tracking/entry/${entryId}`, {
        entry_date: editHistoryForm.date,
        remark: editHistoryForm.remark
      });
      showToast("Entry updated", 'success');
      setEditingHistoryId(null);
      await fetchTrackingHistory(managePaymentId); 
      await fetchPayments(true); 
    } catch (err) {
      console.error("Update history failed", err);
      showToast("Failed to update entry", 'error');
    } finally {
      setIsHistoryActionLoading(false);
    }
  };

  const handleDeleteHistoryEntry = async (entryId) => {
    // replaced window.confirm with in-app confirm modal
    showConfirm({
      title: "Delete History Entry",
      description: "Are you sure you want to delete this history entry? This action cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        setIsHistoryActionLoading(true);
        try {
          await api.delete(`/api/payments/tracking/entry/${entryId}`);
          showToast("Entry deleted", "success");
          await fetchTrackingHistory(managePaymentId);
          await fetchPayments(true);
        } catch (err) {
          console.error("Delete history failed", err);
          showToast("Failed to delete entry", "error");
        } finally {
          setIsHistoryActionLoading(false);
        }
      }
    });
  };

  const handleAddTrackingEntry = async (e) => {
      e.preventDefault();
      if (!newDate) { showToast("Please enter a date first.", 'error'); return; }
      setIsAddingEntry(true);
      try {
        await api.post(`/api/payments/tracking/${managePaymentId}`, { entry_date: newDate, remark: newRemark || null });
        await fetchTrackingHistory(managePaymentId); await fetchPayments(true);
        setNewRemark(''); setNewDate(''); showToast("Tracking entry added successfully!", 'success');
      } catch (err) { console.error("Failed to add tracking entry:", err); showToast("Failed to save entry.", 'error'); } finally { setIsAddingEntry(false); }
  };

  const handleUpdatePaymentStatus = async (newStatus) => {
      if (!newStatus || !managePaymentId) return;
      const normalizedNewStatus = String(newStatus).trim().toUpperCase();
      try {
        await api.patch(`/api/payments/${managePaymentId}/status`, { newStatus: normalizedNewStatus });
        setPayments(prev => prev.map(p => p.id === managePaymentId ? { ...p, payment_status: normalizedNewStatus } : p));
        await fetchPayments(true);
      } catch (err) { console.error("Failed to update status", err); showToast("Failed to update payment status.", 'error'); }
  };

  const handleUpload = async (e) => {
      e.preventDefault();
      if (!file) { setUploadMessage({ type: 'error', text: 'Please select a file first.' }); return; }
      setUploadMessage({ type: 'info', text: 'Uploading & creating monthly reminders...' });
      const formData = new FormData(); formData.append('csvFile', file);
      try {
        const token = localStorage.getItem('userToken'); if (!token) return;
        const res = await api.post("/api/payments/upload", formData, { headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${token}` } });
        setUploadMessage({ type: 'success', text: res.data?.message || 'Uploaded successfully' }); setFile(null); const fileInput = document.getElementById('file-input'); if (fileInput) fileInput.value = null; await fetchPayments();
      } catch (err) { console.error("Upload error:", err); const msg = err.response?.data?.error || 'Upload failed.'; setUploadMessage({ type: 'error', text: msg }); }
  };

  const handleDeleteAll = async () => {
      setIsDeleteModalOpen(false); setUploadMessage({ type: 'info', text: 'Deleting all history...' });
      try {
        const res = await api.delete("/api/payments"); setUploadMessage({ type: 'success', text: res.data?.message || 'Deleted all payments' }); await fetchPayments();
      } catch (err) { console.error("Delete all error:", err); const msg = err.response?.data?.error || 'Delete failed.'; setUploadMessage({ type: 'error', text: msg }); }
  };

  // --- MERGE LOGIC ---

  const toggleMergeMode = () => {
    const newMode = !isMergeMode;
    setIsMergeMode(newMode);
    if (!newMode) {
      setSelectedIds(new Set()); // Clear selection if turning off
    }
  };

  const toggleSelection = (id) => {
    if (!isMergeMode) return;
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const initiateMerge = () => {
    if (selectedIds.size < 2) return;
    setShowMergeConfirmModal(true);
  };

  const executeMerge = async (masterId) => {
    setIsMerging(true);
    const sourceIds = Array.from(selectedIds).filter(id => id !== masterId).map(id => Number(id));
    const safeTargetId = Number(masterId);

    try {
      await api.post('/api/payments/merge', {
        targetId: safeTargetId,
        sourceIds
      });
      showToast('Records merged successfully!', 'success');
      setShowMergeConfirmModal(false);
      setIsMergeMode(false); 
      setSelectedIds(new Set());
      await fetchPayments(); 
    } catch (err) {
      console.error("Merge failed", err);
      showToast(err.response?.data?.error || 'Merge failed', 'error');
    } finally {
      setIsMerging(false);
    }
  };

  // --- EDIT LOGIC (Main Details) ---
  const openEditModal = (payment) => {
    setEditingPayment(payment);
    setEditForm({
      party: payment.party || '',
      contact_no: payment.contact_no || ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingPayment) return;
    setIsSavingEdit(true);
    try {
      await api.patch(`/api/payments/${editingPayment.id}/details`, editForm);
      showToast('Details updated successfully!', 'success');
      setEditingPayment(null);
      await fetchPayments(true);
    } catch (err) {
      console.error("Edit failed", err);
      showToast('Failed to update details', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };


  return (
    <div className="dashboard-container">
      <style>{`
        /* ... existing styles ... */
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
          --partial-bg: #00f2ff7c;
          --partial-text: #00bbd7ff;
          --partial-active: #00eeffff;
          --no-response-bg: #f3e8ff;
          --no-response-text: #7e22ce;
          --close-party-bg: #e2e8f0;
          --close-party-text: #1e293b;
          --row-hover: #f1f5f9;
          --row-hover-highlight: #bbf7d0; 
          --ripple-color: rgba(5, 150, 105, 0.4);
        }
        .dashboard-container { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: var(--bg-body); min-height: 100vh; padding: 40px 20px; padding-bottom: 100px; color: var(--text-main); }
        .page-title { font-size: 32px; font-weight: 800; margin-bottom: 8px; }
        .range-subtitle { font-size: 16px; color: var(--text-muted); font-weight: 500; margin-bottom: 24px; }
        .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .upload-area { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .file-input { padding: 8px; border: 1px solid var(--border); border-radius: 6px; background: #f8fafc; }
        .btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; transition: opacity 0.2s, background-color 0.2s; }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-primary { background: var(--primary); color: white; }
        .btn-danger { background: #fff1f2; color: var(--danger); border: 1px solid #fecdd3; }
        .btn-outline { background: white; border: 1px solid var(--border); color: var(--text-main); }
        .filter-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; align-items: end; }
        .form-label { font-size: 13px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
        .form-input, .form-select { padding: 10px; border: 1px solid var(--border); border-radius: 6px; width: 100%; }
        .table-container { overflow-x: auto; border-radius: 8px; border: 1px solid var(--border); }
        .data-table { width: 100%; border-collapse: collapse; font-size: 15px; text-align: left; }
        .data-table th { background: #f8fafc; color: var(--text-muted); font-weight: 600; padding: 12px 16px; font-size: 12px; text-transform: uppercase; }
        .data-table td { padding: 8px 16px; border-bottom: 1px solid var(--border); position: relative; overflow: hidden; cursor: pointer; transition: background-color 0.2s; }
        .data-table tbody tr { transition: background-color 0.15s; }
        .data-table tbody tr:hover { background-color: var(--row-hover); }
        .data-table tbody tr:active { background-color: #cbd5e1; }
        .row-highlight:hover { background-color: var(--row-hover-highlight) !important; }
        span.ripple { position: absolute; border-radius: 50%; transform: scale(0); animation: ripple 600ms linear; background-color: var(--ripple-color); pointer-events: none; }
        @keyframes ripple { to { transform: scale(4); opacity: 0; } }
        .status-pill { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; }
        .modal-content { background: white; padding: 32px; border-radius: 16px; width: 90%; max-width: 600px; position: relative; }
        .modal-close-btn { width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid var(--border); background: #ffffff; color: var(--text-main); cursor: pointer; box-shadow: 0 1px 4px rgba(2,6,23,0.06); }
        .row-highlight { background: var(--highlight-bg); }
        .toast-notification { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 8px; color: white; font-weight: 600; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 2000; animation: slideIn 0.3s ease-out; display: flex; align-items: center; gap: 10px; }
        .toast-success { background-color: var(--primary); }
        .toast-error { background-color: var(--danger); }
        .merge-active-bar {
            position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
            background: #1e293b; color: white; padding: 12px 24px; border-radius: 50px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            display: flex; align-items: center; gap: 20px; z-index: 900; animation: slideUp 0.3s ease-out;
        }
        @keyframes slideUp { from { transform: translate(-50%, 100%); } to { transform: translate(-50%, 0); } }
        .checkbox-cell { width: 40px; text-align: center; }
        .custom-checkbox { width: 18px; height: 18px; cursor: pointer; accent-color: var(--primary); pointer-events: none; }
        .merge-card-option { border: 2px solid var(--border); border-radius: 8px; padding: 12px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 12px; }
        .merge-card-option:hover { border-color: var(--primary); background: #f0fdf4; }
        .merge-mode-btn-active { background-color: #4f46e5; color: white; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.3); }
        .icon-btn {
          border: 1px solid var(--border);
          background: white;
          border-radius: 6px;
          padding: 6px;
          cursor: pointer;
          color: var(--text-muted);
          transition: all 0.2s;
        }
        .icon-btn:hover { background: #f1f5f9; color: var(--text-main); border-color: #cbd5e1; }

        .merged-count-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background-color: #e2e8f0;
            color: #475569;
            font-size: 11px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 12px;
            margin-left: 8px;
            vertical-align: middle;
        }

        /* Sticky filter card so search/selects remain visible while scrolling */
        .filter-card {
          position: sticky;
          top: 16px; /* adjust if you have a fixed header */
          z-index: 800;
          margin-bottom: 18px;
          background: var(--bg-card);
          /* keep inner padding consistent with .card */
          padding: 20px;
        }

        /* Floating FAB for quick search focus */
        .fab-search {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          border: none;
          box-shadow: 0 6px 20px rgba(2,6,23,0.15);
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1200;
          cursor: pointer;
        }
      `}</style>

      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div>
           <h1 className="page-title">Payment Reminders</h1>
           <div className="range-subtitle">
             Showing data for: <span style={{ color: 'var(--primary)' }}>{dateRangeDisplay}</span>
           </div>
        </div>
        <button 
          onClick={toggleMergeMode} 
          className={`btn ${isMergeMode ? 'merge-mode-btn-active' : 'btn-outline'}`}
        >
          {isMergeMode ? 'Exit Merge Mode' : 'Merge Records'}
        </button>
      </div>

      {/* Upload */}
      <div className="card">
         <form onSubmit={handleUpload} className="upload-area">
          <div style={{ flex: 1, display: 'flex', gap: '12px', alignItems: 'center' }}>
            <label className="form-label" style={{ marginRight: 8 }}>New Month Sheet</label>
            <input id="file-input" type="file" accept=".csv, .xlsx" onChange={(e) => setFile(e.target.files[0])} className="file-input" />
            <button type="submit" disabled={!file || uploadMessage.type === 'info'} className="btn btn-primary">
              <Icons.Upload /> {uploadMessage.type === 'info' ? 'Processing...' : 'Upload & Append'}
            </button>
          </div>
          <button type="button" onClick={() => setIsDeleteModalOpen(true)} className="btn btn-danger">
            <Icons.Trash /> Clear All History
          </button>
        </form>
        {uploadMessage.text && (
          <div style={{ marginTop: '16px', padding: '12px', borderRadius: '6px', fontSize: '14px', background: uploadMessage.type === 'error' ? '#fef2f2' : '#ecfdf5', color: uploadMessage.type === 'error' ? '#b91c1c' : '#047857' }}>
            {uploadMessage.text}
          </div>
        )}
      </div>

      {/* Filters (sticky) */}
      <div className="card filter-card">
        <div className="filter-bar">
          <div className="form-group">
            <label className="form-label">Search Party</label>
            <input
              ref={searchInputRef}
              type="text"
              className="form-input"
              placeholder="Name or Contact..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Filter Month</label>
            <select className="form-select" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
              <option value="ALL">All Months</option>
              {availableMonths.map(m => (<option key={m} value={m}>{m}</option>))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
              <option value="NO_RESPONSE">No Response</option>
              <option value="CLOSE_PARTY">Close Party</option>
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">Sort</label>
            <select className="form-select" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
              <option value="none">Default</option>
              <option value="asc">Last Pay (Oldest)</option>
              <option value="desc">Last Pay (Newest)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Merge bar */}
      {isMergeMode && (
        <div className="merge-active-bar">
          <span style={{ fontWeight: 600 }}>{selectedIds.size} Selected</span>
          <div style={{ height: '20px', width: '1px', background: '#475569' }}></div>
          <button 
            onClick={initiateMerge} 
            disabled={selectedIds.size < 2}
            style={{ 
              background: selectedIds.size < 2 ? '#475569' : '#fff', 
              color: selectedIds.size < 2 ? '#94a3b8' : '#1e293b',
              border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', cursor: selectedIds.size < 2 ? 'not-allowed' : 'pointer'
            }}
          >
            Merge Records
          </button>
          <button 
            onClick={toggleMergeMode}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', marginLeft: '8px' }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>
        ) : (
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                    {isMergeMode && <th style={{width: '50px'}}>Select</th>}
                    {baseHeaders.map((header, index) => (<th key={index}>{header}</th>))}
                </tr>
              </thead>
              <tbody>
                {displayPayments.map((p, index) => {
                  const highlight = isToday(p.latest_payment);
                  const isChecked = selectedIds.has(p.id);

                  // Decide row click behavior:
                  // - if in merge mode: select/unselect row
                  // - else: open merged accounts modal for that payment
                  const onRowClick = (e) => {
                    if (isMergeMode) {
                      toggleSelection(p.id);
                    } else {
                      // If click originated from a button (edit/manage) we already stopPropagation there.
                      openMergedModal(p.id);
                    }
                  };

                  return (
                    <tr 
                      key={p.id ?? index} 
                      className={highlight ? 'row-highlight' : ''} 
                      style={{
                          backgroundColor: isChecked ? '#e0e7ff' : undefined,
                          cursor: isMergeMode ? 'pointer' : 'pointer'
                      }}
                      onClick={onRowClick}
                    >
                      {isMergeMode && (
                          <td className="checkbox-cell">
                              <input 
                                 type="checkbox" 
                                 className="custom-checkbox"
                                 checked={isChecked}
                                 readOnly 
                               />
                          </td>
                      )}

                      {baseKeys.map((key) => {
                        if (key === 'id') return <td key={key} onClick={!isMergeMode ? createRipple : undefined} style={{ color: '#94a3b8' }}>#{index + 1}</td>;
                        
                        if (key === 'payment_status') {
                          let statusData = getStatusDisplay(p[key]);
                          if (p[key] === 'PARTIAL') statusData = { ...statusData, bgColor: 'var(--partial-bg)', color: 'var(--partial-text)' };
                          else if (p[key] === 'NO_RESPONSE') statusData = { text: 'NO RESPONSE', bgColor: 'var(--no-response-bg)', color: 'var(--no-response-text)' };
                          else if (p[key] === 'CLOSE_PARTY') statusData = { text: 'CLOSE PARTY', bgColor: 'var(--close-party-bg)', color: 'var(--close-party-text)' };
                          return (<td key={key} onClick={!isMergeMode ? createRipple : undefined}><span className="status-pill" style={{ backgroundColor: statusData.bgColor, color: statusData.color }}>{statusData.text}</span></td>);
                        }
                        
                        // --- PARTY COLUMN WITH MERGE COUNT BADGE ---
                        if (key === 'party') {
                          const count = mergedCounts[p.id] || 0;
                          return (
                            <td key={key} onClick={!isMergeMode ? createRipple : undefined}>
                                {p[key]}
                                {count > 0 && <span className="merged-count-badge">+{count}</span>}
                            </td>
                          );
                        }

                        // --- ACTION ---
                        if (key === 'Action') {
                            if (isMergeMode) return <td key={key}><span style={{color: '#ccc'}}>--</span></td>;
                            return (
                              <td key={key}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  {/* EDIT BUTTON (PENCIL) */}
                                  <button 
                                    className="icon-btn"
                                    onClick={(e) => { e.stopPropagation(); openEditModal(p); }}
                                    title="Edit Details"
                                  >
                                    <Icons.Pencil />
                                  </button>

                                  {/* MANAGE BUTTON */}
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); openManageModal(p.id, index + 1); }} 
                                    className="btn btn-outline" 
                                    style={{ padding: '4px 12px', fontSize: '12px' }}
                                  >
                                    Manage
                                  </button>
                                </div>
                              </td>
                            );
                        }

                        if (key === 'latest_payment') return <td key={key} onClick={!isMergeMode ? createRipple : undefined}>{formatDateForDisplay(p[key] instanceof Date ? p[key] : p[key])}</td>;
                        if (key === 'latest_remark') return <td key={key} onClick={!isMergeMode ? createRipple : undefined} style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p[key] || '-'}</td>;
                        // We no longer show merged records here, so no "(merged)" marker needed
                        return <td key={key} onClick={!isMergeMode ? createRipple : undefined}>{p[key] != null && p[key] !== '' ? p[key] : '-'}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {editingPayment && (
        <div className="modal-overlay">
          <div className="modal-content">
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
              <h2>Edit Details</h2>
              <button onClick={() => setEditingPayment(null)} className="modal-close-btn">&times;</button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div style={{marginBottom: '16px'}}>
                <label className="form-label">Party Name</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={editForm.party}
                  onChange={(e) => setEditForm({...editForm, party: e.target.value})}
                  required
                />
              </div>
              <div style={{marginBottom: '24px'}}>
                <label className="form-label">Contact No</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={editForm.contact_no}
                  onChange={(e) => setEditForm({...editForm, contact_no: e.target.value})}
                />
              </div>
              <div style={{display:'flex', gap: '10px', justifyContent:'flex-end'}}>
                 <button type="button" className="btn btn-outline" onClick={() => setEditingPayment(null)}>Cancel</button>
                 <button type="submit" className="btn btn-primary" disabled={isSavingEdit}>
                    {isSavingEdit ? 'Saving...' : 'Save Changes'}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MERGE CONFIRM MODAL (select master) */}
      {showMergeConfirmModal && (
          <div className="modal-overlay">
              <div className="modal-content" style={{maxWidth: '500px'}}>
                  <h2 style={{fontSize: '20px', marginBottom: '16px'}}>Merge Records</h2>
                  <p style={{color: '#64748b', marginBottom: '24px'}}>
                      Select the <strong>Master Record</strong>. 
                      This record's Status, Name, and Contact will be kept. 
                      History from the other selected records will be moved to this one.
                  </p>
                  
                  <div style={{maxHeight: '300px', overflowY: 'auto', marginBottom: '24px'}}>
                      {Array.from(selectedIds).map(id => {
                          const record = payments.find(p => p.id === id);
                          if (!record) return null;
                          return (
                              <div key={id} className="merge-card-option" onClick={() => executeMerge(id)}>
                                  <div style={{width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center'}}></div>
                                  <div style={{flex: 1}}>
                                      <div style={{fontWeight: 600}}>{record.party}</div>
                                      <div style={{fontSize: '12px', color: '#64748b'}}>Status: {record.payment_status} | Contact: {record.contact_no || 'N/A'}</div>
                                  </div>
                                  <div style={{fontSize: '12px', fontWeight: 600, color: 'var(--primary)'}}>Keep This</div>
                              </div>
                          );
                      })}
                  </div>
                  <div style={{textAlign: 'right'}}>
                      <button className="btn btn-outline" onClick={() => setShowMergeConfirmModal(false)} disabled={isMerging}>Cancel</button>
                  </div>
              </div>
          </div>
      )}

      {/* MANAGE MODAL */}
      {managePaymentId !== null && (
        <div className="modal-overlay">
          <div className="modal-content">
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
              <h2 style={{ fontSize: '22px' }}>{payments.find(p => p.id === managePaymentId)?.party || 'Manage Payment'}</h2>
              <button onClick={closeManageModal} className="modal-close-btn">&times;</button>
            </div>
            <form onSubmit={handleAddTrackingEntry} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="form-input" required />
              <input type="text" value={newRemark} onChange={(e) => setNewRemark(e.target.value)} placeholder="Remark" className="form-input" />
              <button type="submit" className="btn btn-primary" disabled={isAddingEntry}>{isAddingEntry ? <span>...</span> : <Icons.Plus />}</button>
            </form>
            <div style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Mark Status</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['PENDING', 'PARTIAL', 'PAID', 'NO_RESPONSE', 'CLOSE_PARTY'].map(status => {
                  const currently = payments.find(p => p.id === managePaymentId)?.payment_status;
                  const isActive = currently === status;
                  let displayText = status.replace('_', ' '); 
                  return (
                    <button key={status} type="button" onClick={() => handleUpdatePaymentStatus(status)} className="btn" style={{ flex: '1 0 30%', background: isActive ? 'var(--primary)' : '#f1f5f9', color: isActive ? 'white' : 'black', fontSize: '12px', padding: '8px 4px', justifyContent: 'center' }}>{displayText}</button>
                  );
                })}
              </div>
            </div>
            
            {/* UPDATED HISTORY LIST */}
            <div style={{ maxHeight: '300px', overflowY: 'auto', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
              {trackingHistory.length === 0 ? (
                <div style={{ color: '#64748b' }}>No tracking history yet.</div>
              ) : (
                trackingHistory.map((entry) => {
                  const isEditing = editingHistoryId === entry.id;

                  return (
                    <div key={entry.id ?? `${entry.entry_date}-${entry.remark}`} style={{ 
                        padding: '10px', 
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: isEditing ? '#f8fafc' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px'
                    }}>
                      
                      {isEditing ? (
                        /* EDIT MODE */
                        <div style={{ display: 'flex', gap: '8px', flex: 1, alignItems: 'center' }}>
                          <input 
                            type="date" 
                            className="form-input" 
                            style={{ width: '130px', padding: '6px' }}
                            value={editHistoryForm.date}
                            onChange={(e) => setEditHistoryForm({ ...editHistoryForm, date: e.target.value })}
                          />
                          <input 
                            type="text" 
                            className="form-input" 
                            style={{ flex: 1, padding: '6px' }}
                            value={editHistoryForm.remark}
                            onChange={(e) => setEditHistoryForm({ ...editHistoryForm, remark: e.target.value })}
                            placeholder="Remark"
                          />
                          <button 
                            onClick={() => handleSaveHistoryEntry(entry.id)} 
                            className="icon-btn" 
                            style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
                            disabled={isHistoryActionLoading}
                          >
                            <Icons.Save />
                          </button>
                          <button 
                            onClick={handleCancelEditHistory} 
                            className="icon-btn"
                            style={{ color: '#ef4444', borderColor: '#ef4444' }}
                            disabled={isHistoryActionLoading}
                          >
                            <Icons.X />
                          </button>
                        </div>
                      ) : (
                        /* VIEW MODE */
                        <>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, fontSize: '14px' }}>{entry.remark || '-'}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                              {formatDateForDisplay(entry.actual_payment || entry.entry_date)}
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button 
                              onClick={() => handleStartEditHistory(entry)} 
                              className="icon-btn" 
                              title="Edit Entry"
                            >
                              <Icons.Pencil />
                            </button>
                            <button 
                              onClick={() => handleDeleteHistoryEntry(entry.id)} 
                              className="icon-btn" 
                              style={{ color: '#ef4444' }} 
                              title="Delete Entry"
                            >
                              <Icons.TrashSmall />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      )}

      {/* MERGED ACCOUNTS MODAL */}
      {isMergedModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 700 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2>Merged Accounts</h2>
              <button className="modal-close-btn" onClick={closeMergedModal}>&times;</button>
            </div>

            <div style={{ marginBottom: 12, color: '#64748b' }}>
              These are records linked (merged) into this master account.
            </div>

            <div style={{ maxHeight: 360, overflowY: 'auto', borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
              {mergedAccounts.length === 0 ? (
                <div style={{ color: '#64748b' }}>No merged accounts.</div>
              ) : (
                mergedAccounts.map((rec) => (
                  <div key={rec.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 10, borderBottom: '1px solid #f1f5f9' }}>
                    {editingMergedId === rec.id ? (
                      <>
                        <input className="form-input" value={editMergedForm.party} onChange={(e)=> setEditMergedForm({...editMergedForm, party: e.target.value})} style={{ width: 220 }} />
                        <input className="form-input" value={editMergedForm.contact_no} onChange={(e)=> setEditMergedForm({...editMergedForm, contact_no: e.target.value})} style={{ width: 160 }} />
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                          <button className="icon-btn" onClick={() => saveMergedEdit(rec.id)} disabled={isSavingMerged}><Icons.Save /></button>
                          <button className="icon-btn" onClick={cancelEditMerged}><Icons.X /></button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{rec.party}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>Contact: {rec.contact_no || '-' } • Status: {rec.payment_status || '-'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="icon-btn" onClick={() => startEditMerged(rec)} title="Edit merged record"><Icons.Pencil /></button>
                          <button className="icon-btn" onClick={() => unmergeRecord(rec.id)} title="Unmerge (remove link)" style={{ color: '#ef4444' }}><Icons.TrashSmall /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={{ textAlign: 'right', marginTop: 12 }}>
              <button className="btn btn-outline" onClick={closeMergedModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ALL MODAL */}
      {isDeleteModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center', maxWidth: '400px' }}>
            <h2 style={{ color: '#ef4444' }}>Warning</h2>
            <p>This will permanently delete ALL payment history for all months.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
              <button className="btn btn-outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteAll}>Confirm Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* GENERIC CONFIRM MODAL (replaces window.confirm) */}
      {confirmModal.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>{confirmModal.title}</h3>
            <p style={{ color: '#64748b' }}>{confirmModal.description}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn btn-outline" onClick={closeConfirm}>{confirmModal.cancelLabel}</button>
              <button className="btn btn-danger" onClick={handleConfirm}>{confirmModal.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Search FAB */}
      <button
        aria-label="Quick search"
        onClick={() => {
          if (searchInputRef.current) {
            searchInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            searchInputRef.current.focus({ preventScroll: true });
          }
        }}
        className="fab-search"
        style={{
          position: 'fixed',
          right: 20,
          bottom: 28
        }}
        title="Focus search"
      >
        🔎
      </button>

      {toast.show && (<div className={`toast-notification ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}><span>{toast.message}</span></div>)}
    </div>
  );
}

const Icons = {
  Upload: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Trash: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Plus: () => <svg width="36" height="16" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Pencil: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
  Save: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>,
  X: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  TrashSmall: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
};

export default PaymentTracker;