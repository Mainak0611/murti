import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver'; 

// --- SEARCHABLE SELECT COMPONENT (With Keyboard Support) ---
const SearchableSelect = ({ options, value, onChange, placeholder, labelKey = 'name', valueKey = 'id' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);

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

  // Keyboard Navigation Handler
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

const OrdersIndex = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // --- MODAL STATE ---
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dispatchForm, setDispatchForm] = useState([]); 
  const [dispatchHistory, setDispatchHistory] = useState([]); 
  const [isSaving, setIsSaving] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  
  // State for Dispatch Date
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [challanNo, setChallanNo] = useState('');

  // --- FILTER & SORT STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  // --- EDIT/DELETE STATE ---
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'order' | 'dispatch', id, orderId? }
  const [editingDispatchId, setEditingDispatchId] = useState(null);
  const [editOrder, setEditOrder] = useState(null);
  const [editForm, setEditForm] = useState({
    partyName: '',
    orderDate: '',
    reference: '',
    contactNo: '',
    remark: '',
    items: []
  });
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [availableItems, setAvailableItems] = useState([]);

  // --- EDIT DISPATCH STATE (Inline) ---
  const [editingDispatchRow, setEditingDispatchRow] = useState(null); // { dispatch_date, challan_no, original_challan_no }
  const [editingDispatchData, setEditingDispatchData] = useState({});
  const [editingDispatchOriginalData, setEditingDispatchOriginalData] = useState({}); // Store original quantities for validation
  const [isEditDispatchSaving, setIsEditDispatchSaving] = useState(false);
  const [editDispatchError, setEditDispatchError] = useState('');

  // --- HELPERS ---
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

  // Helper to display weight nicely
  const formatWeight = (val) => {
    const num = parseFloat(val);
    return isNaN(num) ? '-' : `${num.toFixed(2)} kg`;
  };

  // --- DATA FETCHING ---
  const fetchOrders = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      // Assuming this endpoint returns all non-cancelled orders
      const res = await api.get('/api/orders?status=confirmed'); 
      const allData = Array.isArray(res.data) ? res.data : (res.data.data || []);
      
      // CHANGE: Filter OUT 'Completed' orders
      const activeOrders = allData.filter(order => order.status !== 'Completed');
      
      setOrders(activeOrders);
    } catch (err) {
      console.error("Fetch orders error:", err.response?.status, err.response?.data);
      // Don't show error toast for background fetches
      if (!isBackground) {
        if (err.response?.status === 401) {
          console.warn("Session expired during fetch orders");
        } else if (err.response?.status === 403) {
          showToast("You don't have permission to view orders", "error");
        } else {
          showToast("Failed to load orders", "error");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Fetch available items for dropdown
    const fetchItems = async () => {
      try {
        const res = await api.get('/api/items');
        const itemsData = Array.isArray(res.data) ? res.data : (res.data.data || []);
        const formattedItems = itemsData.map(i => ({
          ...i,
          displayName: `${i.item_name} ${i.size ? `(${i.size})` : ''}`
        }));
        setAvailableItems(formattedItems);
      } catch (err) {
        console.error("Failed to load items", err);
      }
    };
    fetchItems();
  }, []);

  // --- FILTER LOGIC ---
  const filteredData = useMemo(() => {
    let result = [...orders];

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(item =>
        (item.party_name && item.party_name.toLowerCase().includes(lowerTerm)) ||
        (item.reference && item.reference.toLowerCase().includes(lowerTerm))
      );
    }

    result.sort((a, b) => {
      const dateA = new Date(a.order_date || 0).getTime();
      const dateB = new Date(b.order_date || 0).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    return result;
  }, [orders, searchTerm, sortOrder]);

  // --- COMPUTE ITEM META FROM DISPATCH FORM ---
  const itemMeta = useMemo(() => {
    const meta = {};
    if (dispatchForm && Array.isArray(dispatchForm)) {
      dispatchForm.forEach(item => {
        const key = item.item_name + '|' + (item.size || '');
        if (!meta[key]) {
          meta[key] = { name: item.item_name, size: item.size };
        }
      });
    }
    return meta;
  }, [dispatchForm]);

// --- PDF GENERATION LOGIC ---
const generatePDF = (type) => {
    if (!selectedOrder) return;

    // --- 1. CONFIGURATION: COMPACT PORTRAIT MODE ---
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Logic: If columns > 8, use size 8, otherwise size 9
    const denseData = dispatchForm.length > 8;
    const baseFontSize = denseData ? 8 : 9; 
    const cellPadding = 2; 
    
    let currentY = 12; 

    // --- 2. HEADER SECTION ---
    doc.setFontSize(12);
    doc.setTextColor(100); 
    doc.text(`Dispatch Order - ${type === 'supervisor' ? 'Supervisor Copy' : 'Party Copy'}`, 14, currentY);
    
    currentY += 8;
    doc.setFontSize(16); 
    doc.setTextColor(0); 
    doc.setFont(undefined, 'bold');
    doc.text(selectedOrder.party_name, 14, currentY);
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    const dateText = formatDate(selectedOrder.order_date);
    const dateWidth = doc.getTextWidth(dateText);
    doc.text(dateText, pageWidth - 14 - dateWidth, currentY);
    
    currentY += 6; 

    // --- 3. DISPATCH MANAGEMENT TABLE ---
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Dispatch Management', 14, currentY);
    currentY += 4;

    const dmData = [];
    
    // Build Transposed Data
    dispatchForm.forEach((item, idx) => {
      // Calculate actual prev_dispatched from dispatch history
      const itemKey = item.item_name + '|' + (item.size || '');
      const actualPrevDispatched = dispatchHistory.reduce((sum, log) => {
        const logKey = log.item_name + '|' + (log.size || '');
        return logKey === itemKey ? sum + (log.quantity_sent || 0) : sum;
      }, 0);
      
      const balance = item.ordered_quantity - actualPrevDispatched;
      const balanceWeight = balance * (parseFloat(item.unit_weight) || 0);
      
      if (type === 'supervisor') {
        if (idx === 0) {
          dmData.push(['ITEM NAME', item.item_name]);
          dmData.push(['SIZE', item.size || '-']);
          dmData.push(['BALANCE', balance.toString()]);
          dmData.push(['BAL.\nWEIGHT', `${balanceWeight.toFixed(2)}`]);
        } else {
          dmData[0].push(item.item_name);
          dmData[1].push(item.size || '-');
          dmData[2].push(balance.toString());
          dmData[3].push(`${balanceWeight.toFixed(2)}`);
        }
      } else {
        if (idx === 0) {
          dmData.push(['ITEM NAME', item.item_name]);
          dmData.push(['SIZE', item.size || '-']);
          dmData.push(['ORDERED', item.ordered_quantity.toString()]);
          dmData.push(['TOT.\nWT', `${parseFloat(item.total_weight || 0).toFixed(2)}`]);
          dmData.push(['PREV.\nSENT', actualPrevDispatched.toString()]);
          dmData.push(['BALANCE', balance.toString()]);
          dmData.push(['BAL.\nWEIGHT', `${balanceWeight.toFixed(2)}`]);
        } else {
          dmData[0].push(item.item_name);
          dmData[1].push(item.size || '-');
          dmData[2].push(item.ordered_quantity.toString());
          dmData[3].push(`${parseFloat(item.total_weight || 0).toFixed(2)}`);
          dmData[4].push(actualPrevDispatched.toString());
          dmData[5].push(balance.toString());
          dmData[6].push(`${balanceWeight.toFixed(2)}`);
        }
      }
    });

    autoTable(doc, {
      startY: currentY,
      head: [],
      body: dmData,
      theme: 'grid',
      styles: { 
        fontSize: baseFontSize, 
        cellPadding: cellPadding,
        overflow: 'linebreak', 
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.1,
      },
      headStyles: { fillColor: [5, 150, 105], minCellHeight: 10 },
      columnStyles: { 
        0: { cellWidth: 28, fontStyle: 'bold', halign: 'left', fillColor: [248, 250, 252] } 
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const balanceRowIdx = type === 'supervisor' ? 2 : 5; 
          const balanceWeightRowIdx = type === 'supervisor' ? 3 : 6; 
          
          if (data.row.index === balanceRowIdx) {
            // Balance row - light blue background
            data.cell.styles.fillColor = [207, 236, 247];
            data.cell.styles.textColor = [3, 105, 161];
            data.cell.styles.fontStyle = 'bold';
          } else if (data.row.index === balanceWeightRowIdx) {
            // Balance Weight row - light coral background
            data.cell.styles.fillColor = [254, 230, 207];
            data.cell.styles.textColor = [153, 89, 29];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    currentY = doc.lastAutoTable.finalY + 6;

    // --- 3.5 TOTAL BALANCE WEIGHT BLOCK ---
    // Calculate total balance weight
    let totalBalanceWeight = 0;
    dispatchForm.forEach(item => {
      // Calculate actual prev_dispatched from dispatch history
      const itemKey = item.item_name + '|' + (item.size || '');
      const actualPrevDispatched = dispatchHistory.reduce((sum, log) => {
        const logKey = log.item_name + '|' + (log.size || '');
        return logKey === itemKey ? sum + (log.quantity_sent || 0) : sum;
      }, 0);
      const balance = item.ordered_quantity - actualPrevDispatched;
      const balanceWeight = balance * (parseFloat(item.unit_weight) || 0);
      totalBalanceWeight += balanceWeight;
    });

    // Add total balance weight section with background highlight
    const balanceWeightText = `Total Balance Weight: ${totalBalanceWeight.toFixed(2)} kg`;
    doc.setFontSize(15);
    doc.setFont(undefined, 'bold');
    const textWidth = doc.getTextWidth(balanceWeightText);
    const boxHeight = 9;
    const boxPadding = 2;
    const boxX = 12;
    const boxY = currentY - 5;
    
    // Draw background rectangle (light green color)
    doc.setFillColor(220, 252, 231);
    doc.rect(boxX, boxY, textWidth + 8, boxHeight, 'F');
    
    // Draw border rectangle
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(0.5);
    doc.rect(boxX, boxY, textWidth + 8, boxHeight);
    
    // Draw text
    doc.setTextColor(22, 101, 52); // Dark green text
    doc.text(balanceWeightText, boxX + 4, currentY + 1);

    currentY += 10;

    // --- 4. DISPATCH HISTORY TABLE ---
    if (dispatchHistory.length > 0 && type !== 'supervisor') {
      
      if (pageHeight - currentY < 60) {
        doc.addPage();
        currentY = 12;
      }

      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0);
      doc.text('Dispatch History', 14, currentY);
      currentY += 4;

      // Data Prep
      const itemKeys = [];
      const itemMeta = {};
      dispatchForm.forEach(item => {
        const key = item.item_name + '|' + (item.size || '');
        if (!itemMeta[key]) {
          itemKeys.push(key);
          itemMeta[key] = { name: item.item_name, size: item.size };
        }
      });

      // Group logs by date + challan (items sent together show in 1 row)
      const dispatchEntries = [];
      const dateChallainGroups = {};
      
      dispatchHistory.forEach(log => {
        const dateKey = log.dispatch_date;
        const challanKey = log.challan_no || 'no-challan';
        const groupKey = `${dateKey}_${challanKey}`;
        
        if (!dateChallainGroups[groupKey]) {
          dateChallainGroups[groupKey] = {
            dispatch_date: dateKey,
            challan_no: log.challan_no,
            entries: {}
          };
          dispatchEntries.push(dateChallainGroups[groupKey]);
        }
        
        const key = log.item_name + '|' + (log.size || '');
        dateChallainGroups[groupKey].entries[key] = log;
      });
      
      // Sort by date, then by challan for consistent ordering
      dispatchEntries.sort((a, b) => {
        const dateCompare = new Date(a.dispatch_date) - new Date(b.dispatch_date);
        if (dateCompare !== 0) return dateCompare;
        return (a.challan_no || '').localeCompare(b.challan_no || '');
      });

      // --- HEADERS ---
      // Added 'TOTAL' before 'TOTAL(Kg)'
      const historyHead = [
        'DATE', 
        'CHALLAN', 
        ...itemKeys.map(k => {
           const name = itemMeta[k].name.split(' ').join('\n'); 
           const size = itemMeta[k].size || '-';
           return `${name}\n(${size})`;
        }), 
        'TOTAL',       // New Quantity Column
        'TOTAL\n(Kg)'
      ];
      
      const historyBody = [];

      // --- BODY ROWS ---
      dispatchEntries.forEach(entry => {
        const row = [formatDate(entry.dispatch_date)];
        row.push(entry.challan_no || '-');

        let dateTotalQty = 0; // Track Qty
        let dateTotalWeight = 0; // Track Weight
        
        itemKeys.forEach(key => {
          const log = entry.entries[key];
          if (log) {
            row.push(log.quantity_sent.toString());
            dateTotalQty += log.quantity_sent;
            dateTotalWeight += parseFloat(log.total_weight || 0);
          } else {
            row.push('');
          }
        });
        
        row.push(dateTotalQty.toString()); // Push Total Qty
        row.push(dateTotalWeight.toFixed(2)); // Push Total Weight
        historyBody.push(row);
      });

      // --- TOTAL ROW ---
      const totalRow = ['TOTAL', '-'];
      let grandTotalQty = 0, grandTotalWeight = 0;
      
      itemKeys.forEach(key => {
        let colQty = 0, colWeight = 0;
        dispatchEntries.forEach(entry => {
          const log = entry.entries[key];
          if (log) { 
            colQty += (log.quantity_sent || 0); 
            colWeight += parseFloat(log.total_weight || 0); 
          }
        });
        totalRow.push(colQty.toString());
        grandTotalQty += colQty;
        grandTotalWeight += colWeight;
      });
      
      totalRow.push(grandTotalQty.toString()); // Grand Total Qty
      totalRow.push(grandTotalWeight.toFixed(2)); // Grand Total Weight
      historyBody.push(totalRow);

      // --- TOTAL KG ROW ---
      const totalKgRow = ['TOT(Kg)', '-'];
      let totalKgPerColSum = 0;
      
      itemKeys.forEach(key => {
        let colWeight = 0;
        dispatchEntries.forEach(entry => {
          const log = entry.entries[key];
          if (log) colWeight += parseFloat(log.total_weight || 0);
        });
        totalKgRow.push(colWeight.toFixed(2));
        totalKgPerColSum += colWeight;
      });
      
      totalKgRow.push('-'); // No quantity total for "Total Kg" row
      totalKgRow.push(totalKgPerColSum.toFixed(2));
      historyBody.push(totalKgRow);

      // --- PENDING ROW ---
      const pendingRow = ['PENDING', '-'];
      let pendingTotalQty = 0;
      let pendingTotalWeight = 0;
      
      itemKeys.forEach(key => {
        const matchingItem = dispatchForm.find(item => (item.item_name + '|' + (item.size || '')) === key);
        // Calculate actual prev_dispatched from dispatch history
        const actualPrevDispatched = dispatchHistory.reduce((sum, log) => {
          const logKey = log.item_name + '|' + (log.size || '');
          return logKey === key ? sum + (log.quantity_sent || 0) : sum;
        }, 0);
        const balance = matchingItem ? (matchingItem.ordered_quantity - actualPrevDispatched) : 0;
        pendingRow.push(balance.toString());
        
        pendingTotalQty += balance;
        if (matchingItem && balance > 0) {
            pendingTotalWeight += (balance * (parseFloat(matchingItem.unit_weight) || 0));
        }
      });
      
      pendingRow.push(pendingTotalQty.toString()); // Pending Total Qty
      pendingRow.push(pendingTotalWeight.toFixed(2)); // Pending Total Weight
      historyBody.push(pendingRow);

      autoTable(doc, {
        startY: currentY,
        head: [historyHead],
        body: historyBody,
        theme: 'grid',
        styles: { 
          fontSize: baseFontSize, 
          cellPadding: cellPadding,
          halign: 'center',
          valign: 'middle',
          lineWidth: 0.1,
        },
        headStyles: { 
          fillColor: [100, 116, 139], 
          valign: 'middle',
          minCellHeight: 12 
        },
        columnStyles: { 
          0: { cellWidth: 20, fontStyle: 'bold', halign: 'left' }, // Date
          1: { cellWidth: 18 }, // Challan
        },
        rowPageBreak: 'avoid', 
        didParseCell: (data) => {
           if (data.section === 'body' && data.row.index === historyBody.length - 1) {
             data.cell.styles.fillColor = [224, 242, 241];
             data.cell.styles.textColor = [13, 148, 136];
             data.cell.styles.fontStyle = 'bold';
           }
        }
      });
    }

    const fileName = `${selectedOrder.party_name}_${type}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  // --- EXCEL GENERATION LOGIC ---
const generateExcel = async (type) => {
    if (!selectedOrder) return;

    const workbook = new ExcelJS.Workbook();
    
    // Define the border style to be used everywhere
    const thinBorder = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };

    // Helper to apply borders to all cells in a standard row
    const applyBorderToRow = (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: 'center' }; // Optional: centers text nicely
      });
      // specific alignment for the first column (Labels)
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    };

    // --- Sheet 1: Dispatch Management ---
    const wsDispatch = workbook.addWorksheet('Dispatch Management');
    
    // Add header info (No borders for these top title rows)
    wsDispatch.addRow(['Party', selectedOrder.party_name]);
    wsDispatch.addRow(['Order Date', formatDate(selectedOrder.order_date)]);
    wsDispatch.addRow([]);
    wsDispatch.addRow(['Dispatch Management']).font = { bold: true, size: 14 };
    wsDispatch.addRow([]);
    
    // 1. Item Name Row
    const headerRow = wsDispatch.addRow(['Item Name', ...dispatchForm.map(i => i.item_name)]);
    applyBorderToRow(headerRow);
    // Make header bold
    headerRow.eachCell((cell) => { cell.font = { bold: true }; });
    
    // 2. Size Row
    const sizeRow = wsDispatch.addRow(['Size', ...dispatchForm.map(i => i.size || '-')]);
    applyBorderToRow(sizeRow);
    
    // 3. Optional Party Columns
    if (type !== 'supervisor') {
      const orderedRow = wsDispatch.addRow(['Ordered', ...dispatchForm.map(i => i.ordered_quantity)]);
      applyBorderToRow(orderedRow);

      const weightRow = wsDispatch.addRow(['Total Weight', ...dispatchForm.map(i => formatWeight(i.total_weight || (i.unit_weight * i.ordered_quantity)))]);
      applyBorderToRow(weightRow);

      const prevSentRow = wsDispatch.addRow(['Prev. Sent', ...dispatchForm.map(i => {
        // Calculate actual prev_dispatched from dispatch history
        const itemKey = i.item_name + '|' + (i.size || '');
        return dispatchHistory.reduce((sum, log) => {
          const logKey = log.item_name + '|' + (log.size || '');
          return logKey === itemKey ? sum + (log.quantity_sent || 0) : sum;
        }, 0);
      })]);
      applyBorderToRow(prevSentRow);
    }
    
    // 4. Balance Row (Highlighted + Borders) - Light Blue
    const balanceRow = wsDispatch.addRow(['Balance', ...dispatchForm.map(i => {
      // Calculate actual prev_dispatched from dispatch history
      const itemKey = i.item_name + '|' + (i.size || '');
      const actualPrevDispatched = dispatchHistory.reduce((sum, log) => {
        const logKey = log.item_name + '|' + (log.size || '');
        return logKey === itemKey ? sum + (log.quantity_sent || 0) : sum;
      }, 0);
      return i.ordered_quantity - actualPrevDispatched;
    })]);
    for (let col = 1; col <= dispatchForm.length + 1; col++) {
      const cell = balanceRow.getCell(col);
      // Background Color - Light Blue
      cell.fill = { 
        type: 'pattern', 
        pattern: 'solid', 
        fgColor: { argb: 'FFCFECF7' } 
      };
      // Font Style
      cell.font = { bold: true, color: { argb: 'FF0369A1' } };
      // Alignment
      cell.alignment = { horizontal: col === 1 ? 'left' : 'center', vertical: 'middle' };
      // BORDERS (Added)
      cell.border = thinBorder;
    }
    
    // 5. Balance Weight Row (Highlighted + Borders) - Light Coral
    const weightRow = wsDispatch.addRow(['Balance Weight', ...dispatchForm.map(i => {
      // Calculate actual prev_dispatched from dispatch history
      const itemKey = i.item_name + '|' + (i.size || '');
      const actualPrevDispatched = dispatchHistory.reduce((sum, log) => {
        const logKey = log.item_name + '|' + (log.size || '');
        return logKey === itemKey ? sum + (log.quantity_sent || 0) : sum;
      }, 0);
      const balance = i.ordered_quantity - actualPrevDispatched;
      const balanceWeight = balance * (parseFloat(i.unit_weight) || 0);
      return formatWeight(balanceWeight);
    })]);
    for (let col = 1; col <= dispatchForm.length + 1; col++) {
      const cell = weightRow.getCell(col);
      // Background Color - Light Coral
      cell.fill = { 
        type: 'pattern', 
        pattern: 'solid', 
        fgColor: { argb: 'FFFEE6CF' } 
      };
      // Font Style
      cell.font = { bold: true, color: { argb: 'FF99591D' } };
      // Alignment
      cell.alignment = { horizontal: col === 1 ? 'left' : 'center', vertical: 'middle' };
      // BORDERS (Added)
      cell.border = thinBorder;
    }

    // 6. Total Balance Weight Row
    let totalBalanceWeight = 0;
    dispatchForm.forEach(i => {
      // Calculate actual prev_dispatched from dispatch history
      const itemKey = i.item_name + '|' + (i.size || '');
      const actualPrevDispatched = dispatchHistory.reduce((sum, log) => {
        const logKey = log.item_name + '|' + (log.size || '');
        return logKey === itemKey ? sum + (log.quantity_sent || 0) : sum;
      }, 0);
      const balance = i.ordered_quantity - actualPrevDispatched;
      const balanceWeight = balance * (parseFloat(i.unit_weight) || 0);
      totalBalanceWeight += balanceWeight;
    });

    const totalBalanceWeightRow = wsDispatch.addRow(['TOTAL BALANCE WEIGHT', ...Array(dispatchForm.length).fill(''), formatWeight(totalBalanceWeight)]);
    for (let col = 1; col <= dispatchForm.length + 1; col++) {
      const cell = totalBalanceWeightRow.getCell(col);
      // Background Color - Match Balance Weight color
      cell.fill = { 
        type: 'pattern', 
        pattern: 'solid', 
        fgColor: { argb: 'FFFEE6CF' } 
      };
      // Font Style
      cell.font = { bold: true, color: { argb: 'FF99591D' } };
      // Alignment
      cell.alignment = { horizontal: col === 1 ? 'left' : 'center', vertical: 'middle' };
      // BORDERS
      cell.border = thinBorder;
    }
    
    // Auto-adjust column widths (Optional but recommended)
    wsDispatch.columns.forEach(column => { column.width = 15; });
    wsDispatch.getColumn(1).width = 20; // First column wider for labels
    
    // --- Sheet 2: Dispatch History (Only for Party Copy) ---
    if (dispatchHistory.length > 0 && type !== 'supervisor') {
      const wsHistory = workbook.addWorksheet('Dispatch History');
      
      wsHistory.addRow(['Party', selectedOrder.party_name]);
      wsHistory.addRow(['Order Date', formatDate(selectedOrder.order_date)]);
      wsHistory.addRow([]);
      wsHistory.addRow(['Dispatch History']).font = { bold: true, size: 14 };
      wsHistory.addRow([]);
      
      const itemKeys = [];
      const itemMeta = {};
      dispatchForm.forEach(item => {
        const key = item.item_name + '|' + (item.size || '');
        if (!itemMeta[key]) {
          itemKeys.push(key);
          itemMeta[key] = { name: item.item_name, size: item.size };
        }
      });

      // Group logs by date + challan (items sent together show in 1 row)
      const dispatchEntries = [];
      const dateChallainGroups = {};
      
      dispatchHistory.forEach(log => {
        const dateKey = log.dispatch_date;
        const challanKey = log.challan_no || 'no-challan';
        const groupKey = `${dateKey}_${challanKey}`;
        
        if (!dateChallainGroups[groupKey]) {
          dateChallainGroups[groupKey] = {
            dispatch_date: dateKey,
            challan_no: log.challan_no,
            entries: {}
          };
          dispatchEntries.push(dateChallainGroups[groupKey]);
        }
        
        const key = log.item_name + '|' + (log.size || '');
        dateChallainGroups[groupKey].entries[key] = log;
      });
      
      // Sort by date, then by challan for consistent ordering
      dispatchEntries.sort((a, b) => {
        const dateCompare = new Date(a.dispatch_date) - new Date(b.dispatch_date);
        if (dateCompare !== 0) return dateCompare;
        return (a.challan_no || '').localeCompare(b.challan_no || '');
      });

      // Header Row
      const historyHeader = wsHistory.addRow(['Date', 'Challan No', ...itemKeys.map(k => `${itemMeta[k].name} (${itemMeta[k].size})`), 'TOTAL', 'TOTAL (Kg.)']);
      applyBorderToRow(historyHeader);
      historyHeader.eachCell(cell => cell.font = { bold: true });

      // Date Rows
      dispatchEntries.forEach(entry => {
        const rowData = [formatDate(entry.dispatch_date)];
        rowData.push(entry.challan_no ? `${entry.challan_no}` : '-');
        let dateTotalQty = 0, dateTotalKg = 0;
        itemKeys.forEach(key => {
          const log = entry.entries[key];
          if (log) {
            rowData.push(log.quantity_sent);
            dateTotalQty += log.quantity_sent;
            dateTotalKg += parseFloat(log.total_weight || 0);
          } else {
            rowData.push('');
          }
        });
        rowData.push(dateTotalQty);
        rowData.push(formatWeight(dateTotalKg));
        
        const row = wsHistory.addRow(rowData);
        applyBorderToRow(row);
      });

      // Total Row
      const totalRowData = ['TOTAL', '-'];
      let grandTotalQty = 0, grandTotalKg = 0;
      itemKeys.forEach(key => {
        let itemSum = 0, itemKg = 0;
        dispatchEntries.forEach(entry => {
          const log = entry.entries[key];
          if (log) {
            itemSum += log.quantity_sent || 0;
            itemKg += parseFloat(log.total_weight) || 0;
          }
        });
        totalRowData.push(itemSum);
        grandTotalQty += itemSum;
        grandTotalKg += itemKg;
      });
      totalRowData.push(grandTotalQty);
      totalRowData.push(formatWeight(grandTotalKg));
      const totalRow = wsHistory.addRow(totalRowData);
      applyBorderToRow(totalRow);
      totalRow.eachCell(cell => cell.font = { bold: true });

      // Total Kg Row
      const totalKgRowData = ['TOTAL(KG.)', '-'];
      let totalKgPerCol = 0;
      itemKeys.forEach(key => {
        let itemKg = 0;
        dispatchEntries.forEach(entry => {
          const log = entry.entries[key];
          if (log) itemKg += parseFloat(log.total_weight) || 0;
        });
        totalKgRowData.push(formatWeight(itemKg));
        totalKgPerCol += itemKg;
      });
      totalKgRowData.push('-');
      totalKgRowData.push(formatWeight(totalKgPerCol));
      const totalKgRow = wsHistory.addRow(totalKgRowData);
      applyBorderToRow(totalKgRow);
      totalKgRow.eachCell(cell => cell.font = { bold: true, color: { argb: 'FF475569' } });

      // Pending Row
      const pendingRowData = ['PENDING', '-'];
      let pendingTotalQty = 0, pendingTotalKg = 0;
      itemKeys.forEach(key => {
        const matchingItem = dispatchForm.find(item => 
          (item.item_name + '|' + (item.size || '')) === key
        );
        // Calculate actual prev_dispatched from dispatch history
        const actualPrevDispatched = dispatchHistory.reduce((sum, log) => {
          const logKey = log.item_name + '|' + (log.size || '');
          return logKey === key ? sum + (log.quantity_sent || 0) : sum;
        }, 0);
        const balance = matchingItem ? (matchingItem.ordered_quantity - actualPrevDispatched) : 0;
        pendingRowData.push(balance);
        pendingTotalQty += balance;
        if (matchingItem && balance > 0) {
          const pendingWeight = balance * (parseFloat(matchingItem.unit_weight) || 0);
          pendingTotalKg += pendingWeight;
        }
      });
      pendingRowData.push(pendingTotalQty);
      pendingRowData.push(formatWeight(pendingTotalKg));
      const pendingRow = wsHistory.addRow(pendingRowData);
      applyBorderToRow(pendingRow);
      pendingRow.eachCell(cell => {
         cell.font = { bold: true, color: { argb: 'FF0D9488' } };
         cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2F1' } };
         cell.border = thinBorder; // Ensure borders stay after fill
      });

       // Adjust widths for History sheet too
       wsHistory.columns.forEach(column => { column.width = 15; });
       wsHistory.getColumn(1).width = 20;
    }

    // Save File
    const fileName = `${selectedOrder.party_name}_${type}_${new Date().toISOString().split('T')[0]}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
  };

  // --- MODAL & DISPATCH LOGIC ---
  const handleRowClick = async (order) => {
    setSelectedOrder(order);
    setDispatchDate(new Date().toISOString().split('T')[0]); 
    setDispatchHistory([]);
    setShowOrderDetails(false);
    
    try {
        const res = await api.get(`/api/orders/${order.id}`);
        const fullOrder = res.data.data;
        
        setSelectedOrder(fullOrder);
        setDispatchHistory(fullOrder.history || []); 
        
        if (fullOrder.items) {
            setDispatchForm(fullOrder.items.map(item => ({
                id: item.id, 
                item_name: item.item_name,
                size: item.size,
                unit_weight: item.unit_weight, 
                total_weight: item.total_weight, 
                ordered_quantity: item.ordered_quantity,
                prev_dispatched: item.dispatched_quantity || 0,
                available_stock: item.current_stock || 0,
                current_dispatch: '' 
            })));
        }
    } catch (err) {
        console.error("Error fetching details", err);
        showToast("Failed to fetch details", "error");
    }
  };

  const handleDispatchChange = (index, value) => {
    const updated = [...dispatchForm];
    const val = value === '' ? '' : parseInt(value);
    
    const currentItem = updated[index];
    const qtyToSend = val || 0;
    
    if (qtyToSend > currentItem.available_stock) {
        showToast(`Quantity (${qtyToSend}) exceeds available stock (${currentItem.available_stock})!`, 'error');
    }

    updated[index].current_dispatch = val;
    setDispatchForm(updated);
  };

  const isFormInvalid = useMemo(() => {
    return dispatchForm.some(item => {
      const qty = parseInt(item.current_dispatch) || 0;
      return qty > item.available_stock;
    });
  }, [dispatchForm]);

  const handleSaveDispatch = async () => {
    if (isFormInvalid) {
        showToast("Cannot save: One or more items exceed available stock.", "error");
        return;
    }

    const hasItemsToDispatch = dispatchForm.some(i => (parseInt(i.current_dispatch) || 0) > 0);
    if (!hasItemsToDispatch) {
        showToast("Please enter a quantity to dispatch.", "error");
        return;
    }

    if (!challanNo || challanNo.trim() === '') {
        setSubmitAttempted(true);
        return;
    }

    setIsSaving(true);
    try {
        const payload = {
            dispatch_date: dispatchDate,
            challan_no: challanNo,
            items: dispatchForm.map(i => ({
                id: i.id,
                quantity_sent: parseInt(i.current_dispatch) || 0 
            }))
        };
        
        await api.put(`/api/orders/${selectedOrder.id}/dispatch`, payload);
        
        showToast("Dispatch details updated successfully", "success");
        
        // Reset submitAttempted flag
        setSubmitAttempted(false);
        
        // Silent refresh - update orders in background without closing modal
        fetchOrders(true);
        
        // Reset the dispatch form for the next entry
        setDispatchForm(dispatchForm.map(item => ({...item, current_dispatch: ''})));
        setDispatchDate(new Date().toISOString().split('T')[0]);
        setChallanNo('');
        
        // Refresh the selected order data
        try {
            const res = await api.get(`/api/orders/${selectedOrder.id}`);
            const fullOrder = res.data.data;
            setSelectedOrder(fullOrder);
            setDispatchHistory(fullOrder.history || []);
            
            // Update dispatchForm with new prev_dispatched values
            if (fullOrder.items) {
                setDispatchForm(fullOrder.items.map(item => ({
                    id: item.id, 
                    item_name: item.item_name,
                    size: item.size,
                    unit_weight: item.unit_weight, 
                    total_weight: item.total_weight, 
                    ordered_quantity: item.ordered_quantity,
                    prev_dispatched: item.dispatched_quantity || 0,
                    available_stock: item.current_stock || 0,
                    current_dispatch: '' 
                })));
            }
            
            // Check if order is now completed and show notification
            if (fullOrder.status === 'Completed') {
                showToast("Order moved to completed orders", "success");
            }
        } catch (err) {
            console.error("Error refreshing order details", err.response?.status, err.response?.data);
        }
    } catch (err) {
        console.error("Save dispatch error:", err.response?.status, err.response?.data);
        if (err.response?.status === 401) {
          console.warn("Session expired during save dispatch");
        } else if (err.response?.status === 403) {
          showToast("You don't have permission to update dispatch", "error");
        } else {
          showToast(err.response?.data?.error || "Failed to save dispatch details", "error");
        }
    } finally {
        setIsSaving(false);
    }
  };

  // --- EDIT/DELETE HANDLERS ---
  const handleEditOrder = async (e, order) => {
    e.stopPropagation();
    // Fetch full order details with items
    try {
      const res = await api.get(`/api/orders/${order.id}`);
      const fullOrder = res.data.data;
      
      setEditOrder(fullOrder);
      setEditForm({
        partyName: fullOrder.party_name || '',
        orderDate: fullOrder.order_date ? new Date(fullOrder.order_date).toISOString().split('T')[0] : '',
        reference: fullOrder.reference || '',
        contactNo: fullOrder.contact_no || '',
        remark: fullOrder.remark || '',
        items: (fullOrder.items || []).map(item => ({
          itemId: item.item_id,
          quantity: item.ordered_quantity,
          tempId: Math.random(),
          item_name: item.item_name,
          size: item.size,
          unit_weight: item.unit_weight
        }))
      });
    } catch (err) {
      console.error("Failed to fetch order details", err);
      showToast("Failed to load order details", "error");
    }
  };

  const handleEditItemChange = (index, field, value) => {
    const updated = [...editForm.items];
    updated[index][field] = value;
    setEditForm({ ...editForm, items: updated });
  };

  const addEditItemRow = () => {
    setEditForm({
      ...editForm,
      items: [...editForm.items, { itemId: '', quantity: '', tempId: Math.random() }]
    });
  };

  const removeEditItemRow = (index) => {
    const updated = editForm.items.filter((_, i) => i !== index);
    setEditForm({ ...editForm, items: updated });
  };

  const calculateEditRowWeight = (itemId, qty) => {
    if (!itemId || !qty) return '-';
    const item = availableItems.find(i => String(i.id) === String(itemId));
    if (!item || !item.weight) return '-';
    
    const unitWeight = parseFloat(item.weight) || 0;
    const quantity = parseFloat(qty) || 0;
    const total = unitWeight * quantity;
    
    return total > 0 ? total.toFixed(2) : '-';
  };

  const handleEditOrderSave = async (e) => {
    e.preventDefault();
    if (!editOrder) return;

    setIsEditSaving(true);
    try {
      await api.put(`/api/orders/${editOrder.id}`, {
        party_name: editForm.partyName,
        order_date: editForm.orderDate,
        reference: editForm.reference,
        contact_no: editForm.contactNo,
        remark: editForm.remark,
        items: editForm.items.map(item => ({
          itemId: item.itemId,
          ordered_quantity: parseInt(item.quantity) || 0
        }))
      });
      showToast("Order updated successfully", "success");
      setEditOrder(null);
      fetchOrders();
    } catch (err) {
      console.error("Edit order error:", err.response?.status, err.response?.data);
      if (err.response?.status === 401) {
        console.warn("Session expired during edit order");
      } else if (err.response?.status === 403) {
        showToast("You don't have permission to edit this order", "error");
      } else {
        showToast(err.response?.data?.error || "Failed to update order", "error");
      }
    } finally {
      setIsEditSaving(false);
    }
  };

  // --- EDIT DISPATCH HANDLERS (INLINE) ---
  const handleEditDispatch = (e, entry) => {
    e.stopPropagation();
    const uniqueKey = `${entry.dispatch_date}_${entry.challan_no}`;
    setEditingDispatchRow({ dispatch_date: entry.dispatch_date, challan_no: entry.challan_no, original_challan_no: entry.challan_no, uniqueKey });
    setEditDispatchError('');
    // Create form from dispatch entries and store original quantities
    const formData = {};
    const originalData = {};
    Object.keys(entry.entries).forEach(key => {
      const log = entry.entries[key];
      const qty = log ? log.quantity_sent : '';
      formData[key] = qty;
      originalData[key] = qty; // Store original for validation
    });
    setEditingDispatchData(formData);
    setEditingDispatchOriginalData(originalData);
  };

  const handleEditDispatchChange = (key, value) => {
    const updatedData = { ...editingDispatchData, [key]: value };
    setEditingDispatchData(updatedData);
    
    // Real-time stock validation with net change logic
    const newQty = parseInt(value) || 0;
    const oldQty = parseInt(editingDispatchOriginalData[key]) || 0;
    const netChange = newQty - oldQty; // Negative = stock returned, Positive = stock deducted
    
    const orderItem = dispatchForm.find(item =>
      (item.item_name + '|' + (item.size || '')) === key
    );
    
    // Only show error if net deduction exceeds available stock
    if (orderItem && netChange > 0 && netChange > orderItem.available_stock) {
      setEditDispatchError(`${key}: Net change (${netChange}) exceeds available stock (${orderItem.available_stock})`);
    } else {
      setEditDispatchError('');
    }
  };

  const handleEditDispatchSave = async (e) => {
    e.preventDefault();
    if (!editingDispatchRow || !selectedOrder) return;

    // Validate stock before saving with net change logic
    setEditDispatchError('');
    for (const key of Object.keys(editingDispatchData)) {
      const newQty = parseInt(editingDispatchData[key]) || 0;
      const oldQty = parseInt(editingDispatchOriginalData[key]) || 0;
      const netChange = newQty - oldQty; // Negative = stock returned, Positive = stock deducted
      
      const orderItem = dispatchForm.find(item =>
        (item.item_name + '|' + (item.size || '')) === key
      );
      
      // Only show error if net deduction exceeds available stock
      if (orderItem && netChange > 0 && netChange > orderItem.available_stock) {
        setEditDispatchError(`${key}: Net change (${netChange}) exceeds available stock (${orderItem.available_stock})`);
        return;
      }
    }

    setIsEditDispatchSaving(true);
    try {
      // Prepare items array for the update
      const items = Object.keys(editingDispatchData).map(key => {
        return {
          item_name: itemMeta[key]?.name || '',
          size: itemMeta[key]?.size || '',
          quantity_sent: parseInt(editingDispatchData[key]) || 0
        };
      });

      await api.put(`/api/orders/${selectedOrder.id}/dispatch/${editingDispatchRow.original_challan_no}`, {
        dispatch_date: editingDispatchRow.dispatch_date,
        challan_no: editingDispatchRow.challan_no,
        items
      });

      showToast("Dispatch updated successfully", "success");
      setEditingDispatchRow(null);
      setEditingDispatchData({});
      setEditingDispatchOriginalData({});
      setEditDispatchError('');
      
      // Refresh order details
      const res = await api.get(`/api/orders/${selectedOrder.id}`);
      const updatedOrder = res.data.data;
      setSelectedOrder(updatedOrder);
      setDispatchHistory(updatedOrder.history || []);
      
      // Update dispatchForm with new available_stock values
      if (updatedOrder.items) {
        setDispatchForm(updatedOrder.items.map(item => ({
          id: item.id, 
          item_name: item.item_name,
          size: item.size,
          unit_weight: item.unit_weight, 
          total_weight: item.total_weight, 
          ordered_quantity: item.ordered_quantity,
          prev_dispatched: item.dispatched_quantity || 0,
          available_stock: item.current_stock || 0,
          current_dispatch: '' 
        })));
      }
    } catch (err) {
      console.error("Edit dispatch save error:", err.response?.status, err.response?.data);
      if (err.response?.status === 401) {
        console.warn("Session expired during edit dispatch save");
      } else if (err.response?.status === 403) {
        showToast("You don't have permission to update dispatch", "error");
      } else {
        showToast(err.response?.data?.error || "Failed to update dispatch", "error");
      }
    } finally {
      setIsEditDispatchSaving(false);
    }
  };

  const handleCancelEditDispatch = () => {
    setEditingDispatchRow(null);
    setEditingDispatchData({});
    setEditingDispatchOriginalData({});
    setEditDispatchError('');
  };

  const handleDeleteOrder = async (orderId) => {
    if (!deleteTarget || deleteTarget.type !== 'order') return;
    
    try {
      const response = await api.delete(`/api/orders/${orderId}`);
      showToast("Order deleted successfully", "success");
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      fetchOrders();
    } catch (err) {
      console.error("Delete order error:", err.response?.status, err.response?.data);
      if (err.response?.status === 401) {
        console.warn("Session expired during delete order");
      } else if (err.response?.status === 403) {
        showToast("You don't have permission to delete this order", "error");
      } else {
        showToast(err.response?.data?.error || "Failed to delete order", "error");
      }
    }
  };

  const initiateDeleteOrder = (e, orderId) => {
    e.stopPropagation();
    setDeleteTarget({ type: 'order', id: orderId });
    setShowDeleteConfirm(true);
  };

  const initiateDeleteDispatch = (e, challanNo) => {
    e.stopPropagation();
    setDeleteTarget({ type: 'dispatch', id: challanNo, orderId: selectedOrder.id });
    setShowDeleteConfirm(true);
  };

  const handleDeleteDispatchRecord = async (dispatchId, orderId) => {
    if (!deleteTarget || deleteTarget.type !== 'dispatch') return;
    
    try {
      const response = await api.delete(`/api/orders/${orderId}/dispatch/${dispatchId}`);
      showToast("Dispatch record deleted successfully", "success");
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      
      // Refresh the order details
      const res = await api.get(`/api/orders/${orderId}`);
      const fullOrder = res.data.data;
      setSelectedOrder(fullOrder);
      setDispatchHistory(fullOrder.history || []);
      
      if (fullOrder.items) {
        setDispatchForm(fullOrder.items.map(item => ({
          id: item.id, 
          item_name: item.item_name,
          size: item.size,
          unit_weight: item.unit_weight, 
          total_weight: item.total_weight, 
          ordered_quantity: item.ordered_quantity,
          prev_dispatched: item.dispatched_quantity || 0,
          available_stock: item.current_stock || 0,
          current_dispatch: '' 
        })));
      }
    } catch (err) {
      console.error("Delete dispatch error:", err.response?.status, err.response?.data);
      if (err.response?.status === 401) {
        console.warn("Session expired during delete dispatch");
      } else if (err.response?.status === 403) {
        showToast("You don't have permission to delete this dispatch record", "error");
      } else {
        showToast(err.response?.data?.error || "Failed to delete dispatch record", "error");
      }
    }
  };

  return (
    <div className="dashboard-container">
      <style>{`
        :root { --bg-body: #f8fafc; --bg-card: #ffffff; --text-main: #0f172a; --text-muted: #64748b; --primary: #059669; --primary-hover: #047857; --danger: #ef4444; --border: #e2e8f0; --highlight-bg: #d1fae5; --row-hover: #f1f5f9; }
        .dashboard-container { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: var(--bg-body); min-height: 100vh; padding: 40px 20px; padding-bottom: 100px; color: var(--text-main); }
        .page-title { font-size: 32px; font-weight: 800; margin-bottom: 24px; }
        .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-label { font-size: 13px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
        .form-input { padding: 10px; border: 1px solid var(--border); border-radius: 6px; width: 100%; font-size: 14px; }
        .form-input:focus { outline: 2px solid var(--primary); border-color: transparent; }
        .btn { padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px;}
        .btn-primary { background: var(--primary); color: white; }
        .btn-primary:hover { background: var(--primary-hover); }
        .btn-primary:disabled { background: #cbd5e1; color: #64748b; cursor: not-allowed; opacity: 1; }
        .btn-secondary { background: #f1f5f9; color: var(--text-muted); border: 1px solid var(--border); }
        .btn-secondary:hover { background: #e2e8f0; color: var(--text-main); }
        .btn-outline { background: white; color: var(--text-main); border: 1px solid var(--border); font-size: 13px; padding: 6px 12px; }
        .btn-outline:hover { background: #f8fafc; border-color: #cbd5e1; }
        
        .table-container { overflow-x: auto; border-radius: 8px; border: none; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 15px; text-align: left; }
        .data-table th { background: #f8fafc; color: var(--text-muted); font-weight: 600; padding: 12px 16px; font-size: 12px; text-transform: uppercase; }
        .data-table td { padding: 8px 16px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background-color 0.2s; }
        .data-table tbody tr:hover { background-color: var(--row-hover); }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(2px); z-index: 3000; display: flex; align-items: center; justify-content: center; }
        .large-modal { background: white; width: 1500px; max-width: 95%; max-height: 90vh; overflow-y: auto; border-radius: 12px; padding: 24px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); animation: popIn 0.2s ease-out; }
        .view-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        .view-value-box { background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; font-size: 14px; font-weight: 500; color: #334155; min-height: 42px; display: flex; align-items: center; }
        .items-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
        .items-table th { text-align: left; background: #f8fafc; padding: 8px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 12px; text-transform: uppercase; }
        .items-table td { border-bottom: 1px solid #e2e8f0; padding: 8px; color: #334155; vertical-align: middle; }
        .dispatch-input { width: 80px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; text-align: center; font-weight: 600; }
        .dispatch-input:focus { outline: 2px solid var(--primary); border-color: transparent; }
        .dispatch-input.error { border-color: #ef4444; background-color: #fef2f2; color: #b91c1c; }
        .dispatch-input.error:focus { outline: 2px solid #ef4444; }
        .error-text { font-size: 10px; color: #ef4444; display: block; margin-top: 4px; font-weight: 600; }
        .stock-tag { padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: 600; background: #e2e8f0; color: #475569; }
        .stock-low { background: #fee2e2; color: #991b1b; }
        .toast-notification { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 8px; color: white; font-weight: 600; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 4000; animation: slideIn 0.3s ease-out; }
        .toast-success { background-color: var(--primary); }
        .toast-error { background-color: var(--danger); }
        .history-table th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; padding: 8px; text-align: left; color: #64748b; }
        .history-table td { font-size: 13px; padding: 8px; border-bottom: 1px solid #e2e8f0; color: #334155; }
        @keyframes popIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slideIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      <div style={{width: '100%', margin: '0 auto'}}>
        <h1 className="page-title">Confirmed Orders</h1>

        {/* ... Search and Sort ... */}
        <div className="card">
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', alignItems: 'end'}}>
            <div className="form-group">
              <label className="form-label">Search</label>
              <input type="text" className="form-input" placeholder="Party Name or Reference" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Sort Date</label>
              <select className="form-input" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
            <div className="form-group"></div>
          </div>
        </div>

        {/* ... Order Table ... */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Party Name</th>
                  <th>Order Date</th>
                  <th>Status</th>
                  <th>Contact</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" style={{textAlign:'center', padding: '40px'}}>Loading...</td></tr>
                ) : filteredData.length === 0 ? (
                  <tr><td colSpan="6" style={{textAlign:'center', padding: '40px', color: '#94a3b8'}}>No confirmed orders found.</td></tr>
                ) : (
                  filteredData.map((order, index) => {
                    const displayId = sortOrder === 'asc' 
                        ? filteredData.length - index 
                        : index + 1;

                    return (
                        <tr key={order.id} onClick={() => handleRowClick(order)}>
                          <td style={{color: '#64748b'}}>#{displayId}</td>
                          <td style={{fontWeight: 600}}>{order.party_name}</td>
                          <td>{formatDate(order.order_date)}</td>
                          <td>
                            <span style={{
                                padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
                                backgroundColor: order.status === 'Completed' ? '#dcfce7' : '#fef9c3',
                                color: order.status === 'Completed' ? '#166534' : '#854d0e'
                            }}>
                                {order.status || 'Pending'}
                            </span>
                          </td>
                          <td>{order.contact_no || '-'}</td>
                          <td onClick={(e) => e.stopPropagation()} style={{display: 'flex', gap: '8px', justifyContent: 'center'}}>
                            <button 
                              className="icon-btn"
                              onClick={(e) => handleEditOrder(e, order)}
                              title="Edit"
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                transition: 'background 0.2s',
                                width: '32px',
                                height: '32px'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <Icons.Pencil />
                            </button>
                            <button 
                              className="icon-btn danger"
                              onClick={(e) => initiateDeleteOrder(e, order.id)}
                              title="Delete"
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                transition: 'background 0.2s',
                                width: '32px',
                                height: '32px'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <Icons.Trash />
                            </button>
                          </td>
                        </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- MODAL --- */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => !isSaving && (setSelectedOrder(null), setSubmitAttempted(false))}>
          <div className="large-modal" onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20}}>
              <div>
                  <h2 style={{fontSize: 20, fontWeight: 800, margin:0}}>{selectedOrder.party_name}</h2>
                  <p style={{fontSize: 13, color: '#64748b', margin: '4px 0 0 0'}}>Order Detail • {formatDate(selectedOrder.order_date)}</p>
              </div>
              <div style={{display:'flex', gap: 10, alignItems:'center'}}>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setShowOrderDetails(!showOrderDetails)}
                  style={{fontSize: 12, padding: '6px 12px'}}
                >
                  {showOrderDetails ? '▼ Hide Details' : '▶ Show Details'}
                </button>
                <button onClick={() => {setSelectedOrder(null); setSubmitAttempted(false);}} style={{background:'none', border:'none', cursor:'pointer'}}><Icons.Close /></button>
              </div>
            </div>

            {showOrderDetails && (
              <>
                <div className="view-grid">
                  <div><span style={{fontSize:11, fontWeight:700, color:'#64748b'}}>Contact No</span><div className="view-value-box">{selectedOrder.contact_no || '-'}</div></div>
                  <div><span style={{fontSize:11, fontWeight:700, color:'#64748b'}}>Reference</span><div className="view-value-box">{selectedOrder.reference || '-'}</div></div>
                </div>
                
                <div style={{marginBottom: 20}}>
                    <span style={{fontSize:11, fontWeight:700, color:'#64748b'}}>Remark</span>
                    <div className="view-value-box" style={{minHeight: 50}}>{selectedOrder.remark || '-'}</div>
                </div>

                <hr style={{margin: '20px 0', borderTop: '1px solid #e2e8f0'}} />
              </>
            )}

            <div style={{display: 'flex', gap: 12, justifyContent: 'flex-end', marginBottom: 15, flexWrap: 'wrap'}}>
                <button className="btn btn-outline" onClick={() => generatePDF('supervisor')}>
                    <Icons.Download /> PDF - Supervisor
                </button>
                <button className="btn btn-outline" onClick={() => generateExcel('supervisor')}>
                    <Icons.Download /> Excel - Supervisor
                </button>
                <button className="btn btn-outline" onClick={() => generatePDF('party')}>
                    <Icons.Download /> PDF - Party
                </button>
                <button className="btn btn-outline" onClick={() => generateExcel('party')}>
                    <Icons.Download /> Excel - Party
                </button>
            </div>

            <div style={{marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, background: '#f8fafc', padding: 15, borderRadius: 8}}>
                <div>
                    <label style={{fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4}}>Dispatch Date</label>
                    <input 
                        type="date" 
                        className="form-input" 
                        value={dispatchDate} 
                        onChange={(e) => setDispatchDate(e.target.value)} 
                        style={{maxWidth: 200, background: 'white'}}
                    />
                </div>
                <div>
                    <label style={{fontSize: 12, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4}}>
                        Challan No. <span style={{color: '#ef4444'}}>*</span>
                    </label>
                    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                        <input 
                            type="text" 
                            className="form-input" 
                            value={challanNo} 
                            onChange={(e) => setChallanNo(e.target.value)} 
                            placeholder="Enter challan number (required)"
                            style={{
                                maxWidth: 200, 
                                background: 'white',
                                borderColor: submitAttempted && (!challanNo || challanNo.trim() === '') ? '#fca5a5' : undefined,
                                backgroundColor: submitAttempted && (!challanNo || challanNo.trim() === '') ? '#fef2f2' : 'white'
                            }}
                        />
                        {submitAttempted && (!challanNo || challanNo.trim() === '') && (
                            <span style={{fontSize: 12, color: '#ef4444', fontWeight: 600, whiteSpace: 'nowrap'}}>
                                ✕ Required
                            </span>
                        )}
                    </div>
                </div>
                <div style={{fontSize: 13, color: '#64748b', marginTop: 16}}>
                    Use this date and challan no. to record when these items were sent from stock.
                </div>
            </div>

            <h4 style={{fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#334155'}}>Dispatch Management</h4>
            {/* Transposed Table */}
            <div style={{overflowX: 'auto'}}>
              <table className="items-table" style={{minWidth: 900}}>
                <tbody>
                  {/* 1. Item Name Row */}
                  <tr>
                    <th style={{background:'#f8fafc', textAlign:'center'}}>Item Name</th>
                    {dispatchForm.map((item, idx) => (
                      <td key={item.id || idx} style={{fontWeight:700, textAlign:'center'}}>{item.item_name}</td>
                    ))}
                  </tr>
                  {/* 2. Size Row */}
                  <tr>
                    <th style={{background:'#f8fafc', textAlign:'center'}}>Size</th>
                    {dispatchForm.map((item, idx) => (
                      <td key={item.id || idx} style={{textAlign:'center'}}>{item.size || '-'}</td>
                    ))}
                  </tr>
                  {/* 3. Ordered Quantity Row */}
                  <tr>
                    <th style={{background:'#f8fafc', textAlign:'center'}}>Ordered</th>
                    {dispatchForm.map((item, idx) => (
                      <td key={item.id || idx} style={{fontWeight:600, textAlign:'center'}}>{item.ordered_quantity}</td>
                    ))}
                  </tr>
                  {/* 4. Total Weight Row */}
                  <tr>
                    <th style={{background:'#f8fafc', textAlign:'center'}}>Total Weight</th>
                    {dispatchForm.map((item, idx) => {
                      let weight = item.total_weight;
                      if (!weight && item.unit_weight) {
                        weight = item.unit_weight * item.ordered_quantity;
                      }
                      return (
                        <td key={item.id || idx} style={{fontWeight:600, color:'#475569', textAlign:'center'}}>
                          {formatWeight(weight)}
                        </td>
                      );
                    })}
                  </tr>
                  {/* 5. Prev. Sent Row */}
                  <tr>
                    <th style={{background:'#f8fafc', color:'#64748b', textAlign:'center'}}>Prev. Sent</th>
                    {dispatchForm.map((item, idx) => {
                      // Calculate total dispatched for this item from history
                      const itemKey = item.item_name + '|' + (item.size || '');
                      const totalDispatched = dispatchHistory.reduce((sum, log) => {
                        const logKey = log.item_name + '|' + (log.size || '');
                        return logKey === itemKey ? sum + (log.quantity_sent || 0) : sum;
                      }, 0);
                      
                      return (
                        <td key={item.id || idx} style={{color:'#64748b', background:'#f8fafc', textAlign:'center', fontWeight: 600}}>
                          {totalDispatched}
                        </td>
                      );
                    })}
                  </tr>
                  {/* 6. Balance Row */}
                  <tr>
                    <th style={{background:'#f8fafc', color:'#f59e0b', textAlign:'center', fontWeight:'bold'}}>Balance</th>
                    {dispatchForm.map((item, idx) => {
                      // Calculate total dispatched for this item from history
                      const itemKey = item.item_name + '|' + (item.size || '');
                      const totalDispatched = dispatchHistory.reduce((sum, log) => {
                        const logKey = log.item_name + '|' + (log.size || '');
                        return logKey === itemKey ? sum + (log.quantity_sent || 0) : sum;
                      }, 0);
                      const balance = item.ordered_quantity - totalDispatched;
                      return <td key={item.id || idx} style={{fontWeight:'bold', color:'#92400e', background:'#fef3c7', textAlign:'center'}}>{balance}</td>;
                    })}
                  </tr>
                  {/* 6.5 Balance Weight Row */}
                  <tr>
                    <th style={{background:'#f8fafc', color:'#f59e0b', textAlign:'center', fontWeight:'bold'}}>Balance Weight</th>
                    {dispatchForm.map((item, idx) => {
                      // Calculate total dispatched for this item from history
                      const itemKey = item.item_name + '|' + (item.size || '');
                      const totalDispatched = dispatchHistory.reduce((sum, log) => {
                        const logKey = log.item_name + '|' + (log.size || '');
                        return logKey === itemKey ? sum + (log.quantity_sent || 0) : sum;
                      }, 0);
                      const balance = item.ordered_quantity - totalDispatched;
                      const balanceWeight = balance * (parseFloat(item.unit_weight) || 0);
                      return <td key={item.id || idx} style={{fontWeight:'bold', color:'#92400e', background:'#fef3c7', textAlign:'center'}}>{formatWeight(balanceWeight)}</td>;
                    })}
                  </tr>
                  {/* 7. Avail. Stock Row */}
                  <tr>
                    <th style={{background:'#f8fafc', textAlign:'center'}}>Avail. Stock</th>
                    {dispatchForm.map((item, idx) => (
                      <td key={item.id || idx} style={{textAlign:'center'}}>
                        <span className={`stock-tag ${item.available_stock === 0 ? 'stock-low' : ''}`}>{item.available_stock}</span>
                      </td>
                    ))}
                  </tr>
                  {/* 8. Send Now Row */}
                  <tr>
                    <th style={{background:'#f8fafc', textAlign:'center'}}>Send Now</th>
                    {dispatchForm.map((item, idx) => {
                      const qty = parseInt(item.current_dispatch) ;
                      const isStockExceeded = qty > item.available_stock;
                      const hasValue = item.current_dispatch !== '' && item.current_dispatch !== null && item.current_dispatch !== undefined;
                      return (
                        <td key={item.id || idx} style={{textAlign:'center', backgroundColor: hasValue ? '#d1fae5' : 'transparent', transition: 'background-color 0.2s'}}>
                          <input
                            type="number"
                            className={`dispatch-input ${isStockExceeded ? 'error' : ''}`}
                            value={item.current_dispatch}
                            onChange={e => handleDispatchChange(idx, e.target.value)}
                            placeholder="0"
                          />
                          {isStockExceeded && <span className="error-text">Exceeds Stock</span>}
                        </td>
                      );
                    })}
                  </tr>
                  {/* 9. Weight (Sending) Row */}
                  <tr>
                    <th style={{background:'#f8fafc', color:'#059669', textAlign:'center'}}>Weight (Sending)</th>
                    {dispatchForm.map((item, idx) => {
                      const qty = parseInt(item.current_dispatch) || 0;
                      const sendingWeight = qty * (parseFloat(item.unit_weight) || 0);
                      return <td key={item.id || idx} style={{fontWeight:'bold', color:'#059669', textAlign:'center'}}>{formatWeight(sendingWeight)}</td>;
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 20}}>
                <button className="btn btn-secondary" onClick={() => {setSelectedOrder(null); setSubmitAttempted(false);}} disabled={isSaving}>Cancel</button>
                <button 
                    className="btn btn-primary" 
                    onClick={handleSaveDispatch} 
                    disabled={isSaving || dispatchForm.length === 0 || isFormInvalid}
                >
                    {isSaving ? 'Saving...' : 'Update Dispatch'}
                </button>
            </div>

            {/* --- Screenshot-style History Table --- */}
            {dispatchHistory.length > 0 && (() => {
              // 1. Get all items from dispatchForm (to show all items even if no dispatch history)
              const itemKeys = [];
              const itemMeta = {};
              dispatchForm.forEach(item => {
                const key = item.item_name + '|' + (item.size || '');
                if (!itemMeta[key]) {
                  itemKeys.push(key);
                  itemMeta[key] = { name: item.item_name, size: item.size };
                }
              });
              // 2. Group logs by date + challan (items sent together show in 1 row)
              const dispatchEntries = [];
              const dateChallainGroups = {};
              
              dispatchHistory.forEach(log => {
                const dateKey = log.dispatch_date;
                const challanKey = log.challan_no || 'no-challan';
                const groupKey = `${dateKey}_${challanKey}`;
                
                if (!dateChallainGroups[groupKey]) {
                  dateChallainGroups[groupKey] = {
                    dispatch_date: dateKey,
                    challan_no: log.challan_no,
                    entries: {}
                  };
                  dispatchEntries.push(dateChallainGroups[groupKey]);
                }
                
                const key = log.item_name + '|' + (log.size || '');
                dateChallainGroups[groupKey].entries[key] = log;
              });
              
              // Sort by date, then by challan for consistent ordering
              dispatchEntries.sort((a, b) => {
                const dateCompare = new Date(a.dispatch_date) - new Date(b.dispatch_date);
                if (dateCompare !== 0) return dateCompare;
                return (a.challan_no || '').localeCompare(b.challan_no || '');
              });
              // 3. Calculate TOTAL, PENDING (balance), TOTAL (Kg.)
              const totalRow = {};
              const pendingRow = {};
              const totalKgRow = {};
              const columnWeightRow = {};
              itemKeys.forEach(key => {
                let sum = 0, sumKg = 0;
                dispatchEntries.forEach(entry => {
                  const log = entry.entries[key];
                  if (log) {
                    sum += log.quantity_sent || 0;
                    sumKg += parseFloat(log.total_weight) || 0;
                  }
                });
                totalRow[key] = sum;
                // PENDING = ordered_quantity - total dispatched (from history)
                const matchingItem = dispatchForm.find(item => 
                  (item.item_name + '|' + (item.size || '')) === key
                );
                pendingRow[key] = matchingItem ? (matchingItem.ordered_quantity - totalRow[key]) : 0;
                totalKgRow[key] = sumKg;
                columnWeightRow[key] = sumKg;
              });
              return (
                <div style={{marginTop: 30, borderTop: '1px solid #e2e8f0', paddingTop: 20}}>
                  <h4 style={{fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#334155'}}>Dispatch History</h4>
                  <div style={{overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8}}>
                    <table className="items-table history-table" style={{width: '100%', minWidth: 0, margin: 0, tableLayout: 'auto', fontSize: '15px'}}>
                      <thead>
                        <tr>
                          <th rowSpan={2} style={{background:'#f8fafc', textAlign:'center', padding: '12px 8px', fontSize: '14px', fontWeight: 700}}>Date</th>
                          <th rowSpan={2} style={{background:'#f8fafc', textAlign:'center', padding: '12px 8px', fontSize: '14px', fontWeight: 700}}>Challan No</th>
                          {itemKeys.map(key => (
                            <th key={key} colSpan={1} style={{background:'#f8fafc', textAlign:'center', padding: '12px 8px', fontSize: '14px', fontWeight: 700}}>{itemMeta[key].name}</th>
                          ))}
                          <th rowSpan={2} style={{background:'#f8fafc', textAlign:'center', padding: '12px 8px', fontSize: '14px', fontWeight: 700}}>TOTAL</th>
                          <th rowSpan={2} style={{background:'#f8fafc', textAlign:'center', padding: '12px 8px', fontSize: '14px', fontWeight: 700}}>TOTAL (Kg.)</th>
                          <th rowSpan={2} style={{background:'#f8fafc', textAlign:'center', padding: '12px 8px', fontSize: '14px', fontWeight: 700}}>Actions</th>
                        </tr>
                        <tr>
                          {itemKeys.map(key => (
                            <th key={key+':size'} style={{background:'#f8fafc', textAlign:'center', padding: '12px 8px', fontSize: '13px'}}>{itemMeta[key].size}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dispatchEntries.map((entry, idx) => {
                          const dateTotal = itemKeys.reduce((sum, key) => {
                            const log = entry.entries[key];
                            return sum + (log && log.total_weight ? parseFloat(log.total_weight) : 0);
                          }, 0);
                          const dateTotalQty = itemKeys.reduce((sum, key) => {
                            const log = entry.entries[key];
                            return sum + (log ? log.quantity_sent : 0);
                          }, 0);
                          
                          const uniqueKey = `${entry.dispatch_date}_${entry.challan_no}`;
                          const isEditing = editingDispatchRow?.uniqueKey === uniqueKey;
                          
                          return (
                            <tr key={uniqueKey}>
                              <td style={{fontWeight:700, textAlign:'center', padding: '12px 8px', fontSize: '15px'}}>
                                {isEditing ? (
                                  <input 
                                    type="date" 
                                    value={editingDispatchRow.dispatch_date ? new Date(editingDispatchRow.dispatch_date).toISOString().split('T')[0] : ''}
                                    onChange={(e) => setEditingDispatchRow({ ...editingDispatchRow, dispatch_date: e.target.value })}
                                    className="form-input"
                                    style={{width: '130px', padding: '6px', fontSize: '14px'}}
                                  />
                                ) : (
                                  formatDate(entry.dispatch_date)
                                )}
                              </td>
                              <td style={{fontWeight:600, textAlign:'center', padding: '12px 8px', color:'#059669', fontSize: '15px'}}>
                                {isEditing ? (
                                  <input 
                                    type="text" 
                                    value={editingDispatchRow.challan_no || ''}
                                    onChange={(e) => setEditingDispatchRow({ ...editingDispatchRow, challan_no: e.target.value })}
                                    className="form-input"
                                    style={{width: '90px', padding: '6px', fontSize: '14px'}}
                                  />
                                ) : (
                                  entry.challan_no ? ` ${entry.challan_no}` : '-'
                                )}
                              </td>
                              {itemKeys.map(key => {
                                const log = entry.entries[key];
                                const orderItem = dispatchForm.find(item => (item.item_name + '|' + (item.size || '')) === key);
                                const newQty = parseInt(editingDispatchData[key]) || 0;
                                const oldQty = parseInt(editingDispatchOriginalData[key]) || 0;
                                const netChange = newQty - oldQty;
                                const hasError = isEditing && orderItem && netChange > 0 && netChange > orderItem.available_stock;
                                
                                return (
                                  <td key={`${entry.dispatch_date}_${entry.challan_no}_${key}`} style={{textAlign:'center', fontWeight:600, color:'#059669', padding: '12px 8px', fontSize: '15px'}}>
                                    {isEditing ? (
                                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'}}>
                                        <input 
                                          type="number" 
                                          value={editingDispatchData[key] || ''}
                                          onChange={(e) => handleEditDispatchChange(key, e.target.value)}
                                          className="form-input"
                                          style={{
                                            width: '70px', 
                                            padding: '6px', 
                                            fontSize: '14px', 
                                            textAlign: 'center',
                                            borderColor: hasError ? '#ef4444' : '#e2e8f0',
                                            backgroundColor: hasError ? '#fef2f2' : 'white',
                                            color: hasError ? '#b91c1c' : '#334155'
                                          }}
                                          min="0"
                                        />
                                        {hasError && (
                                          <span style={{fontSize: '11px', color: '#ef4444', fontWeight: 600, whiteSpace: 'nowrap'}}>
                                            Stock: {orderItem.available_stock}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span>{log ? log.quantity_sent : ''}</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td style={{textAlign:'center', fontWeight:600, padding: '12px 8px', fontSize: '15px'}}>{dateTotalQty}</td>
                              <td style={{textAlign:'center', fontWeight:600, padding: '12px 8px', fontSize: '15px'}}>{formatWeight(dateTotal)}</td>
                              <td style={{textAlign:'center', padding: '12px 8px', alignItems: 'center', minHeight: '44px'}}>
                                <div style={{display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center'}}>
                                {isEditing ? (
                                  <>
                                    <button 
                                      onClick={handleEditDispatchSave}
                                      disabled={isEditDispatchSaving || editDispatchError}
                                      className="btn btn-primary"
                                      style={{fontSize: '12px', padding: '6px 12px', opacity: (isEditDispatchSaving || editDispatchError) ? 0.5 : 1, cursor: (isEditDispatchSaving || editDispatchError) ? 'not-allowed' : 'pointer', flexShrink: 0}}
                                      title={editDispatchError ? "Fix errors before saving" : "Save"}
                                    >
                                      Save
                                    </button>
                                    <button 
                                      onClick={handleCancelEditDispatch}
                                      disabled={isEditDispatchSaving}
                                      className="btn btn-secondary"
                                      style={{fontSize: '11px', padding: '4px 8px', flexShrink: 0}}
                                      title="Cancel"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button 
                                      className="icon-btn"
                                      onClick={(e) => handleEditDispatch(e, entry)}
                                      title="Edit"
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '6px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '6px',
                                        transition: 'background 0.2s',
                                        width: '32px',
                                        height: '32px',
                                        flexShrink: 0
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                      <Icons.Pencil />
                                    </button>
                                    <button 
                                      className="icon-btn danger"
                                      onClick={(e) => initiateDeleteDispatch(e, entry.challan_no)}
                                      title="Delete"
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '6px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '6px',
                                        transition: 'background 0.2s',
                                        width: '32px',
                                        height: '32px',
                                        flexShrink: 0
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                      <Icons.Trash />
                                    </button>
                                  </>
                                )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {/* TOTAL row */}
                        <tr>
                          <td style={{fontWeight:700, background:'#f8fafc', textAlign:'center', padding: '12px 8px', fontSize: '15px'}}>TOTAL</td>
                          <td style={{fontWeight:700, background:'#f8fafc', textAlign:'center', padding: '12px 8px', fontSize: '15px'}}>-</td>
                          {itemKeys.map(key => (
                            <td key={'total'+key} style={{textAlign:'center', fontWeight:700, padding: '12px 8px', fontSize: '15px'}}>{totalRow[key]}</td>
                          ))}
                          <td style={{textAlign:'center', fontWeight:700, background:'#f8fafc', padding: '12px 8px', fontSize: '15px'}}>
                            {itemKeys.reduce((sum, key) => sum + totalRow[key], 0)}
                          </td>
                          <td style={{textAlign:'center', fontWeight:700, background:'#f8fafc', padding: '12px 8px', fontSize: '15px'}}>
                            {formatWeight(itemKeys.reduce((sum, key) => sum + columnWeightRow[key], 0))}
                          </td>
                          <td style={{background:'#f8fafc'}}></td>
                        </tr>
                        {/* TOTAL(KG.) row - shows weight per column */}
                        <tr>
                          <td style={{fontWeight:700, background:'#f8fafc', textAlign:'center', padding: '12px 8px', fontSize: '15px'}}>TOTAL(KG.)</td>
                          <td style={{fontWeight:700, background:'#f8fafc', textAlign:'center', padding: '12px 8px', fontSize: '15px'}}>-</td>
                          {itemKeys.map(key => (
                            <td key={'totalkg'+key} style={{textAlign:'center', fontWeight:700, color:'#475569', padding: '12px 8px', fontSize: '15px'}}>
                              {formatWeight(columnWeightRow[key])}
                            </td>
                          ))}
                          <td style={{textAlign:'center', fontWeight:700, background:'#f8fafc', padding: '12px 8px', fontSize: '15px'}}>-</td>
                          <td style={{textAlign:'center', fontWeight:700, background:'#f8fafc', padding: '12px 8px', fontSize: '15px'}}>
                            {formatWeight(itemKeys.reduce((sum, key) => sum + columnWeightRow[key], 0))}
                          </td>
                          <td style={{background:'#f8fafc'}}></td>
                        </tr>
                        {/* PENDING row - shows what's left to dispatch */}
                        <tr>
                          <td style={{fontWeight:700, background:'#e0f2f1', color:'#0d9488', textAlign:'center', padding: '12px 8px', fontSize: '15px'}}>PENDING</td>
                          <td style={{fontWeight:700, background:'#e0f2f1', color:'#0d9488', textAlign:'center', padding: '12px 8px', fontSize: '15px'}}>-</td>
                          {itemKeys.map(key => (
                            <td key={'pending'+key} style={{textAlign:'center', fontWeight:700, background:'#e0f2f1', color:'#0d9488', padding: '12px 8px', fontSize: '15px'}}>{pendingRow[key]}</td>
                          ))}
                          <td style={{textAlign:'center', fontWeight:700, background:'#e0f2f1', color:'#0d9488', padding: '12px 8px', fontSize: '15px'}}>
                            {itemKeys.reduce((sum, key) => sum + pendingRow[key], 0)}
                          </td>
                          <td style={{textAlign:'center', fontWeight:700, background:'#e0f2f1', color:'#0d9488', padding: '12px 8px', fontSize: '15px'}}>
                            {formatWeight(itemKeys.reduce((sum, key) => {
                              const matchingItem = dispatchForm.find(item => 
                                (item.item_name + '|' + (item.size || '')) === key
                              );
                              const balance = pendingRow[key] || 0;
                              const pendingWeight = matchingItem && matchingItem.unit_weight ? 
                                (balance * parseFloat(matchingItem.unit_weight)) : 0;
                              return sum + pendingWeight;
                            }, 0))}
                          </td>
                          <td style={{background:'#e0f2f1'}}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {toast.show && (
        <div className={`toast-notification ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
          {toast.message}
        </div>
      )}

      {/* --- EDIT ORDER MODAL --- */}
      {editOrder && (
        <div className="modal-overlay" onClick={() => !isEditSaving && setEditOrder(null)}>
          <div className="large-modal" onClick={e => e.stopPropagation()} style={{maxHeight: '80vh', overflowY: 'auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems: 'center', marginBottom: 20}}>
                <h2 style={{fontSize: 20, fontWeight: 800, margin:0}}>Edit Order #{editOrder.id}</h2>
                <button onClick={() => setEditOrder(null)} className="close-btn" style={{background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, transition: 'background 0.2s', height: 32, width: 32}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><Icons.Close /></button>
            </div>

            <form onSubmit={handleEditOrderSave}>
                <div className="edit-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px'}}>
                    <div>
                        <label className="form-label" style={{fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'block'}}>Party Name</label>
                        <input 
                          className="form-input" 
                          style={{padding: '10px', border: '1px solid #e2e8f0', borderRadius: '6px', width: '100%', fontSize: '14px'}}
                          value={editForm.partyName} 
                          onChange={e => setEditForm({...editForm, partyName: e.target.value})} 
                          required 
                        />
                    </div>
                    <div>
                        <label className="form-label" style={{fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'block'}}>Order Date</label>
                        <input 
                          type="date" 
                          className="form-input" 
                          style={{padding: '10px', border: '1px solid #e2e8f0', borderRadius: '6px', width: '100%', fontSize: '14px'}}
                          value={editForm.orderDate} 
                          onChange={e => setEditForm({...editForm, orderDate: e.target.value})} 
                        />
                    </div>
                    <div>
                        <label className="form-label" style={{fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'block'}}>Contact No</label>
                        <input 
                          className="form-input" 
                          style={{padding: '10px', border: '1px solid #e2e8f0', borderRadius: '6px', width: '100%', fontSize: '14px'}}
                          value={editForm.contactNo} 
                          onChange={e => setEditForm({...editForm, contactNo: e.target.value})} 
                        />
                    </div>
                    <div>
                        <label className="form-label" style={{fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'block'}}>Reference</label>
                        <input 
                          className="form-input" 
                          style={{padding: '10px', border: '1px solid #e2e8f0', borderRadius: '6px', width: '100%', fontSize: '14px'}}
                          value={editForm.reference} 
                          onChange={e => setEditForm({...editForm, reference: e.target.value})} 
                        />
                    </div>
                </div>
                
                <div style={{marginBottom: 20}}>
                    <label className="form-label" style={{fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'block'}}>Remark</label>
                    <input 
                      className="form-input" 
                      style={{padding: '10px', border: '1px solid #e2e8f0', borderRadius: '6px', width: '100%', fontSize: '14px'}}
                      value={editForm.remark} 
                      onChange={e => setEditForm({...editForm, remark: e.target.value})} 
                    />
                </div>

                <hr style={{borderTop:'1px solid #e2e8f0', margin:'20px 0'}} />
                
                {/* --- ITEMS SECTION --- */}
                <div style={{marginBottom: 20}}>
                    <h4 style={{fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: '#334155'}}>Order Items</h4>
                    
                    {/* --- HEADER FOR ITEMS IN EDIT --- */}
                    <div style={{display: 'flex', gap: '10px', marginBottom: '10px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase'}}>
                        <div style={{flex: 3}}>Item Name</div>
                        <div style={{flex: 1}}>Qty</div>
                        <div style={{flex: 1}}>Total Weight (kg)</div>
                        <div style={{width: '36px'}}></div>
                    </div>

                    {editForm.items.map((row, index) => (
                        <div key={row.tempId || index} style={{display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center'}}>
                            {/* Item Dropdown */}
                            <div style={{flex: 3}}>
                                <SearchableSelect 
                                    options={availableItems}
                                    value={row.itemId}
                                    onChange={(val) => handleEditItemChange(index, 'itemId', val)}
                                    placeholder="Search item..."
                                    labelKey="displayName"
                                    valueKey="id"
                                />
                            </div>

                            {/* Quantity */}
                            <div style={{flex: 1}}>
                                <input 
                                    type="number" 
                                    className="form-input"
                                    placeholder="Qty" 
                                    value={row.quantity} 
                                    onChange={(e) => handleEditItemChange(index, 'quantity', e.target.value)} 
                                />
                            </div>

                            {/* Weight (Read Only) */}
                            <div style={{flex: 1}}>
                                <input 
                                    type="text" 
                                    className="form-input"
                                    style={{backgroundColor: '#f8fafc', color: '#64748b', cursor: 'not-allowed'}}
                                    value={calculateEditRowWeight(row.itemId, row.quantity)} 
                                    readOnly
                                />
                            </div>

                            {/* Remove Button */}
                            <button 
                                type="button" 
                                onClick={() => removeEditItemRow(index)} 
                                style={{
                                    background:'#fee2e2', 
                                    color:'#ef4444', 
                                    border:'none', 
                                    borderRadius: 4, 
                                    width: 36, 
                                    height: 36, 
                                    cursor:'pointer',
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    padding: 0,
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fecaca'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                            >
                              <Icons.X />
                            </button>
                        </div>
                    ))}
                    
                    <button 
                      type="button" 
                      onClick={addEditItemRow} 
                      className="btn btn-secondary"
                      style={{fontSize: 12, padding: '4px 10px', marginBottom: '20px'}}
                    >
                      + Add Item
                    </button>
                </div>

                <div style={{display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px'}}>
                    <button 
                      type="button"
                      onClick={() => setEditOrder(null)}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isEditSaving}
                      className="btn btn-primary"
                      style={{opacity: isEditSaving ? 0.7 : 1, cursor: isEditSaving ? 'not-allowed' : 'pointer'}}
                    >
                      {isEditSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT DISPATCH ERROR MESSAGE */}
      {editingDispatchRow && editDispatchError && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '12px 16px',
          color: '#991b1b',
          fontSize: '14px',
          zIndex: 3002,
          maxWidth: '400px'
        }}>
          {editDispatchError}
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div style={{
            background: 'white',
            padding: '28px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            maxWidth: '400px',
            width: '90%',
            zIndex: 3001
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{fontSize: '18px', fontWeight: '700', marginBottom: '12px', color: '#1e293b'}}>
              Confirm Delete
            </h3>
            <p style={{fontSize: '14px', color: '#64748b', marginBottom: '24px', lineHeight: '1.5'}}>
              {deleteTarget?.type === 'order' 
                ? 'Are you sure you want to delete this order? This action cannot be undone.' 
                : 'Are you sure you want to delete this dispatch record? This action cannot be undone.'}
            </p>
            <div style={{display: 'flex', gap: '12px', justifyContent: 'flex-end'}}>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: '8px 20px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  color: '#334155',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (deleteTarget.type === 'order') {
                    handleDeleteOrder(deleteTarget.id);
                  } else {
                    handleDeleteDispatchRecord(deleteTarget.id, deleteTarget.orderId);
                  }
                }}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Icons = {
  Close: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Download: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Pencil: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
  Trash: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>,
  X: () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
};

export default OrdersIndex;