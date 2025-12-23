import React, { useEffect, useState, useMemo } from 'react';
import api from '../../lib/api'; // Adjust path if necessary
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver'; 

const CompletedOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // --- MODAL STATE ---
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dispatchForm, setDispatchForm] = useState([]); 
  const [dispatchHistory, setDispatchHistory] = useState([]); 
  const [isSaving, setIsSaving] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  
  // State for Dispatch Date & Challan
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [challanNo, setChallanNo] = useState('');

  // --- FILTER & SORT STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

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

  const formatWeight = (val) => {
    const num = parseFloat(val);
    return isNaN(num) || num === 0 ? '-' : `${num.toFixed(2)} kg`;
  };

  // --- DATA FETCHING ---
  const fetchOrders = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await api.get('/api/orders?status=confirmed'); 
      const allData = Array.isArray(res.data) ? res.data : (res.data.data || []);
      
      // CHANGE: Filter IN ONLY 'Completed' orders
      const completedList = allData.filter(order => order.status === 'Completed');
      
      setOrders(completedList);
    } catch (err) {
      console.error("Fetch error:", err);
      showToast("Failed to load orders", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(); 
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

  // --- PDF GENERATION LOGIC (Compact Portrait + Total Qty) ---
  const generatePDF = (type) => {
    if (!selectedOrder) return;

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    const denseData = dispatchForm.length > 8;
    const baseFontSize = denseData ? 8 : 9; 
    const cellPadding = 2; 
    
    let currentY = 12; 

    // Header
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

    // Table Title
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Dispatch Management', 14, currentY);
    currentY += 4;

    const dmData = [];
    
    dispatchForm.forEach((item, idx) => {
      const balance = item.ordered_quantity - item.prev_dispatched;
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
          dmData.push(['PREV.\nSENT', item.prev_dispatched.toString()]);
          dmData.push(['BALANCE', balance.toString()]);
          dmData.push(['BAL.\nWEIGHT', `${balanceWeight.toFixed(2)}`]);
        } else {
          dmData[0].push(item.item_name);
          dmData[1].push(item.size || '-');
          dmData[2].push(item.ordered_quantity.toString());
          dmData[3].push(`${parseFloat(item.total_weight || 0).toFixed(2)}`);
          dmData[4].push(item.prev_dispatched.toString());
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
          
          if (data.row.index === balanceRowIdx || data.row.index === balanceWeightRowIdx) {
            data.cell.styles.fillColor = [254, 243, 199];
            data.cell.styles.textColor = [146, 64, 14];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    currentY = doc.lastAutoTable.finalY + 8;

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

      const itemKeys = [];
      const itemMeta = {};
      dispatchForm.forEach(item => {
        const key = item.item_name + '|' + (item.size || '');
        if (!itemMeta[key]) {
          itemKeys.push(key);
          itemMeta[key] = { name: item.item_name, size: item.size };
        }
      });

      const grouped = {};
      dispatchHistory.forEach(log => {
        if (!grouped[log.dispatch_date]) grouped[log.dispatch_date] = {};
        const key = log.item_name + '|' + (log.size || '');
        grouped[log.dispatch_date][key] = log;
      });
      const allDates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));

      const historyHead = [
        'DATE', 
        'CHALLAN', 
        ...itemKeys.map(k => {
           const name = itemMeta[k].name.split(' ').join('\n'); 
           const size = itemMeta[k].size || '-';
           return `${name}\n(${size})`;
        }), 
        'TOTAL',       
        'TOTAL\n(Kg)'
      ];
      
      const historyBody = [];

      allDates.forEach(date => {
        const row = [formatDate(date)];
        const challanNo = grouped[date] && Object.values(grouped[date])[0]?.challan_no ? Object.values(grouped[date])[0].challan_no : '-';
        row.push(challanNo);

        let dateTotalQty = 0; 
        let dateTotalWeight = 0; 
        
        itemKeys.forEach(key => {
          const log = grouped[date][key];
          if (log) {
            row.push(log.quantity_sent.toString());
            dateTotalQty += log.quantity_sent;
            dateTotalWeight += parseFloat(log.total_weight || 0);
          } else {
            row.push('');
          }
        });
        
        row.push(dateTotalQty.toString()); 
        row.push(dateTotalWeight.toFixed(2)); 
        historyBody.push(row);
      });

      const totalRow = ['TOTAL', '-'];
      let grandTotalQty = 0, grandTotalWeight = 0;
      
      itemKeys.forEach(key => {
        let colQty = 0, colWeight = 0;
        allDates.forEach(date => {
          const log = grouped[date][key];
          if (log) { 
            colQty += (log.quantity_sent || 0); 
            colWeight += parseFloat(log.total_weight || 0); 
          }
        });
        totalRow.push(colQty.toString());
        grandTotalQty += colQty;
        grandTotalWeight += colWeight;
      });
      totalRow.push(grandTotalQty.toString()); 
      totalRow.push(grandTotalWeight.toFixed(2)); 
      historyBody.push(totalRow);

      const totalKgRow = ['TOT(Kg)', '-'];
      let totalKgPerColSum = 0;
      itemKeys.forEach(key => {
        let colWeight = 0;
        allDates.forEach(date => {
          const log = grouped[date][key];
          if (log) colWeight += parseFloat(log.total_weight || 0);
        });
        totalKgRow.push(colWeight.toFixed(2));
        totalKgPerColSum += colWeight;
      });
      totalKgRow.push('-'); 
      totalKgRow.push(totalKgPerColSum.toFixed(2));
      historyBody.push(totalKgRow);

      const pendingRow = ['PENDING', '-'];
      let pendingTotalQty = 0;
      let pendingTotalWeight = 0;
      itemKeys.forEach(key => {
        const matchingItem = dispatchForm.find(item => (item.item_name + '|' + (item.size || '')) === key);
        const balance = matchingItem ? (matchingItem.ordered_quantity - matchingItem.prev_dispatched) : 0;
        pendingRow.push(balance.toString());
        pendingTotalQty += balance;
        if (matchingItem && balance > 0) {
            pendingTotalWeight += (balance * (parseFloat(matchingItem.unit_weight) || 0));
        }
      });
      pendingRow.push(pendingTotalQty.toString()); 
      pendingRow.push(pendingTotalWeight.toFixed(2)); 
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
          0: { cellWidth: 20, fontStyle: 'bold', halign: 'left' }, 
          1: { cellWidth: 18 }, 
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
    const thinBorder = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    const applyBorderToRow = (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: 'center' }; 
      });
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    };

    const wsDispatch = workbook.addWorksheet('Dispatch Management');
    
    wsDispatch.addRow(['Party', selectedOrder.party_name]);
    wsDispatch.addRow(['Order Date', formatDate(selectedOrder.order_date)]);
    wsDispatch.addRow([]);
    wsDispatch.addRow(['Dispatch Management']).font = { bold: true, size: 14 };
    wsDispatch.addRow([]);
    
    const headerRow = wsDispatch.addRow(['Item Name', ...dispatchForm.map(i => i.item_name)]);
    applyBorderToRow(headerRow);
    headerRow.eachCell((cell) => { cell.font = { bold: true }; });
    
    const sizeRow = wsDispatch.addRow(['Size', ...dispatchForm.map(i => i.size || '-')]);
    applyBorderToRow(sizeRow);
    
    if (type !== 'supervisor') {
      const orderedRow = wsDispatch.addRow(['Ordered', ...dispatchForm.map(i => i.ordered_quantity)]);
      applyBorderToRow(orderedRow);

      const weightRow = wsDispatch.addRow(['Total Weight', ...dispatchForm.map(i => formatWeight(i.total_weight || (i.unit_weight * i.ordered_quantity)))]);
      applyBorderToRow(weightRow);

      const prevSentRow = wsDispatch.addRow(['Prev. Sent', ...dispatchForm.map(i => i.prev_dispatched)]);
      applyBorderToRow(prevSentRow);
    }
    
    const balanceRow = wsDispatch.addRow(['Balance', ...dispatchForm.map(i => i.ordered_quantity - i.prev_dispatched)]);
    for (let col = 1; col <= dispatchForm.length + 1; col++) {
      const cell = balanceRow.getCell(col);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      cell.font = { bold: true, color: { argb: 'FF92400E' } };
      cell.alignment = { horizontal: col === 1 ? 'left' : 'center', vertical: 'middle' };
      cell.border = thinBorder;
    }
    
    const weightRow = wsDispatch.addRow(['Balance Weight', ...dispatchForm.map(i => {
      const balance = i.ordered_quantity - i.prev_dispatched;
      const balanceWeight = balance * (parseFloat(i.unit_weight) || 0);
      return formatWeight(balanceWeight);
    })]);
    for (let col = 1; col <= dispatchForm.length + 1; col++) {
      const cell = weightRow.getCell(col);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      cell.font = { bold: true, color: { argb: 'FF92400E' } };
      cell.alignment = { horizontal: col === 1 ? 'left' : 'center', vertical: 'middle' };
      cell.border = thinBorder;
    }
    
    wsDispatch.columns.forEach(column => { column.width = 15; });
    wsDispatch.getColumn(1).width = 20; 
    
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

      const grouped = {};
      dispatchHistory.forEach(log => {
        if (!grouped[log.dispatch_date]) grouped[log.dispatch_date] = {};
        const key = log.item_name + '|' + (log.size || '');
        grouped[log.dispatch_date][key] = log;
      });
      const allDates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));

      const historyHeader = wsHistory.addRow(['Date', 'Challan No', ...itemKeys.map(k => `${itemMeta[k].name} (${itemMeta[k].size})`), 'TOTAL', 'TOTAL (Kg.)']);
      applyBorderToRow(historyHeader);
      historyHeader.eachCell(cell => cell.font = { bold: true });

      allDates.forEach(date => {
        const rowData = [formatDate(date)];
        const challanNo = grouped[date] && Object.values(grouped[date])[0]?.challan_no ? Object.values(grouped[date])[0].challan_no : '-';
        rowData.push(challanNo !== '-' ? `${challanNo}` : '-');
        let dateTotalQty = 0, dateTotalKg = 0;
        itemKeys.forEach(key => {
          const log = grouped[date][key];
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

      const totalRowData = ['TOTAL', '-'];
      let grandTotalQty = 0, grandTotalKg = 0;
      itemKeys.forEach(key => {
        let itemSum = 0, itemKg = 0;
        allDates.forEach(date => {
          const log = grouped[date][key];
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

      const totalKgRowData = ['TOTAL(KG.)', '-'];
      let totalKgPerCol = 0;
      itemKeys.forEach(key => {
        let itemKg = 0;
        allDates.forEach(date => {
          const log = grouped[date][key];
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

      const pendingRowData = ['PENDING', '-'];
      let pendingTotalQty = 0, pendingTotalKg = 0;
      itemKeys.forEach(key => {
        const matchingItem = dispatchForm.find(item => 
          (item.item_name + '|' + (item.size || '')) === key
        );
        const balance = matchingItem ? (matchingItem.ordered_quantity - matchingItem.prev_dispatched) : 0;
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
         cell.border = thinBorder; 
      });

       wsHistory.columns.forEach(column => { column.width = 15; });
       wsHistory.getColumn(1).width = 20;
    }

    const fileName = `${selectedOrder.party_name}_${type}_${new Date().toISOString().split('T')[0]}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
  };

  // --- MODAL ACTION ---
  const handleRowClick = async (order) => {
    setSelectedOrder(order);
    setDispatchDate(new Date().toISOString().split('T')[0]); 
    setChallanNo('');
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

  // Dispatch functions are disabled/hidden in the render for Completed Orders
  // but kept here in case you want to enable them later.
  const handleDispatchChange = (index, value) => {
    // Logic kept for consistency, but inputs can be disabled in UI
    const updated = [...dispatchForm];
    const val = value === '' ? '' : parseInt(value);
    updated[index].current_dispatch = val;
    setDispatchForm(updated);
  };

  const handleSaveDispatch = () => {
    showToast("This order is completed and cannot be modified.", "error");
  };

  return (
    <div className="dashboard-container">
      {/* (Keep exact same CSS as OrdersIndex) */}
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
        <h1 className="page-title">Completed Orders</h1>

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
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" style={{textAlign:'center', padding: '40px'}}>Loading...</td></tr>
                ) : filteredData.length === 0 ? (
                  <tr><td colSpan="5" style={{textAlign:'center', padding: '40px', color: '#94a3b8'}}>No completed orders found.</td></tr>
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
                                backgroundColor: '#dcfce7', // Always Green for Completed
                                color: '#166534'
                            }}>
                                Completed
                            </span>
                          </td>
                          <td>{order.contact_no || '-'}</td>
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
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
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
                <button onClick={() => setSelectedOrder(null)} style={{background:'none', border:'none', cursor:'pointer'}}><Icons.Close /></button>
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

            {/* Note: Inputs hidden for Completed View */}
            <div style={{marginBottom: 20, background: '#f0fdf4', padding: 15, borderRadius: 8, border: '1px solid #bbf7d0', color: '#166534'}}>
                <strong>Order Completed.</strong> No further dispatches can be made.
            </div>

            <h4 style={{fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#334155'}}>Dispatch Management</h4>
            <div style={{overflowX: 'auto'}}>
              <table className="items-table" style={{minWidth: 900}}>
                <tbody>
                  <tr>
                    <th style={{background:'#f8fafc', textAlign:'center'}}>Item Name</th>
                    {dispatchForm.map((item, idx) => (
                      <td key={item.id || idx} style={{fontWeight:700, textAlign:'center'}}>{item.item_name}</td>
                    ))}
                  </tr>
                  <tr>
                    <th style={{background:'#f8fafc', textAlign:'center'}}>Size</th>
                    {dispatchForm.map((item, idx) => (
                      <td key={item.id || idx} style={{textAlign:'center'}}>{item.size || '-'}</td>
                    ))}
                  </tr>
                  <tr>
                    <th style={{background:'#f8fafc', textAlign:'center'}}>Ordered</th>
                    {dispatchForm.map((item, idx) => (
                      <td key={item.id || idx} style={{fontWeight:600, textAlign:'center'}}>{item.ordered_quantity}</td>
                    ))}
                  </tr>
                  <tr>
                    <th style={{background:'#f8fafc', textAlign:'center'}}>Total Weight</th>
                    {dispatchForm.map((item, idx) => (
                      <td key={item.id || idx} style={{fontWeight:600, color:'#475569', textAlign:'center'}}>
                        {formatWeight(item.total_weight || (item.unit_weight * item.ordered_quantity))}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th style={{background:'#f8fafc', color:'#64748b', textAlign:'center'}}>Prev. Sent</th>
                    {dispatchForm.map((item, idx) => (
                      <td key={item.id || idx} style={{color:'#64748b', background:'#f8fafc', textAlign:'center'}}>{item.prev_dispatched}</td>
                    ))}
                  </tr>
                  <tr>
                    <th style={{background:'#f8fafc', color:'#f59e0b', textAlign:'center', fontWeight:'bold'}}>Balance</th>
                    {dispatchForm.map((item, idx) => {
                      const balance = item.ordered_quantity - item.prev_dispatched;
                      return <td key={item.id || idx} style={{fontWeight:'bold', color:'#92400e', background:'#fef3c7', textAlign:'center'}}>{balance}</td>;
                    })}
                  </tr>
                  <tr>
                    <th style={{background:'#f8fafc', color:'#f59e0b', textAlign:'center', fontWeight:'bold'}}>Balance Weight</th>
                    {dispatchForm.map((item, idx) => {
                      const balance = item.ordered_quantity - item.prev_dispatched;
                      const balanceWeight = balance * (parseFloat(item.unit_weight) || 0);
                      return <td key={item.id || idx} style={{fontWeight:'bold', color:'#92400e', background:'#fef3c7', textAlign:'center'}}>{formatWeight(balanceWeight)}</td>;
                    })}
                  </tr>
                  {/* Avail Stock and Input Rows hidden/disabled for clean history view */}
                </tbody>
              </table>
            </div>

            {/* History Table */}
            {dispatchHistory.length > 0 && (() => {
              const itemKeys = [];
              const itemMeta = {};
              dispatchForm.forEach(item => {
                const key = item.item_name + '|' + (item.size || '');
                if (!itemMeta[key]) {
                  itemKeys.push(key);
                  itemMeta[key] = { name: item.item_name, size: item.size };
                }
              });
              const grouped = {};
              dispatchHistory.forEach(log => {
                if (!grouped[log.dispatch_date]) grouped[log.dispatch_date] = {};
                const key = log.item_name + '|' + (log.size || '');
                grouped[log.dispatch_date][key] = log;
              });
              const allDates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));
              
              const totalRow = {};
              const pendingRow = {};
              const columnWeightRow = {};
              itemKeys.forEach(key => {
                let sum = 0, sumKg = 0;
                allDates.forEach(date => {
                  const log = grouped[date][key];
                  if (log) {
                    sum += log.quantity_sent || 0;
                    sumKg += parseFloat(log.total_weight) || 0;
                  }
                });
                totalRow[key] = sum;
                const matchingItem = dispatchForm.find(item => (item.item_name + '|' + (item.size || '')) === key);
                pendingRow[key] = matchingItem ? (matchingItem.ordered_quantity - matchingItem.prev_dispatched) : 0;
                columnWeightRow[key] = sumKg;
              });
              
              return (
                <div style={{marginTop: 30, borderTop: '1px solid #e2e8f0', paddingTop: 20}}>
                  <h4 style={{fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#334155'}}>Dispatch History</h4>
                  <div style={{overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8}}>
                    <table className="items-table history-table" style={{width: '100%', minWidth: 0, margin: 0, tableLayout: 'auto'}}>
                      <thead>
                        <tr>
                          <th rowSpan={2} style={{background:'#f8fafc', textAlign:'center'}}>Date</th>
                          <th rowSpan={2} style={{background:'#f8fafc', textAlign:'center'}}>Challan No</th>
                          {itemKeys.map(key => (
                            <th key={key} colSpan={1} style={{background:'#f8fafc', textAlign:'center'}}>{itemMeta[key].name}</th>
                          ))}
                          <th rowSpan={2} style={{background:'#f8fafc', textAlign:'center'}}>TOTAL</th>
                          <th rowSpan={2} style={{background:'#f8fafc', textAlign:'center'}}>TOTAL (Kg.)</th>
                        </tr>
                        <tr>
                          {itemKeys.map(key => (
                            <th key={key+':size'} style={{background:'#f8fafc', textAlign:'center'}}>{itemMeta[key].size}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allDates.map(date => {
                          const dateTotal = itemKeys.reduce((sum, key) => {
                            const log = grouped[date][key];
                            return sum + (log && log.total_weight ? parseFloat(log.total_weight) : 0);
                          }, 0);
                          const dateTotalQty = itemKeys.reduce((sum, key) => {
                            const log = grouped[date][key];
                            return sum + (log ? log.quantity_sent : 0);
                          }, 0);
                          const challanNo = grouped[date] && Object.values(grouped[date])[0]?.challan_no ? Object.values(grouped[date])[0].challan_no : '-';
                          return (
                            <tr key={date}>
                              <td style={{fontWeight:700, textAlign:'center', padding: '8px 12px'}}>{formatDate(date)}</td>
                              <td style={{fontWeight:600, textAlign:'center', padding: '8px 12px', color:'#059669'}}>{challanNo !== '-' ? `${challanNo}` : '-'}</td>
                              {itemKeys.map(key => {
                                const log = grouped[date][key];
                                return (
                                  <td key={date+key} style={{textAlign:'center', fontWeight:600, color:'#059669'}}>
                                    {log ? log.quantity_sent : ''}
                                  </td>
                                );
                              })}
                              <td style={{textAlign:'center', fontWeight:600}}>{dateTotalQty}</td>
                              <td style={{textAlign:'center', fontWeight:600}}>{formatWeight(dateTotal)}</td>
                            </tr>
                          );
                        })}
                        {/* TOTAL row */}
                        <tr>
                          <td style={{fontWeight:700, background:'#f8fafc', textAlign:'center'}}>TOTAL</td>
                          <td style={{fontWeight:700, background:'#f8fafc', textAlign:'center'}}>-</td>
                          {itemKeys.map(key => (
                            <td key={'total'+key} style={{textAlign:'center', fontWeight:700}}>{totalRow[key]}</td>
                          ))}
                          <td style={{textAlign:'center', fontWeight:700, background:'#f8fafc'}}>
                            {itemKeys.reduce((sum, key) => sum + totalRow[key], 0)}
                          </td>
                          <td style={{textAlign:'center', fontWeight:700, background:'#f8fafc'}}>
                            {formatWeight(itemKeys.reduce((sum, key) => sum + columnWeightRow[key], 0))}
                          </td>
                        </tr>
                        {/* TOTAL(KG.) row */}
                        <tr>
                          <td style={{fontWeight:700, background:'#f8fafc', textAlign:'center'}}>TOTAL(KG.)</td>
                          <td style={{fontWeight:700, background:'#f8fafc', textAlign:'center'}}>-</td>
                          {itemKeys.map(key => (
                            <td key={'totalkg'+key} style={{textAlign:'center', fontWeight:700, color:'#475569'}}>
                              {formatWeight(columnWeightRow[key])}
                            </td>
                          ))}
                          <td style={{textAlign:'center', fontWeight:700, background:'#f8fafc'}}>-</td>
                          <td style={{textAlign:'center', fontWeight:700, background:'#f8fafc'}}>
                            {formatWeight(itemKeys.reduce((sum, key) => sum + columnWeightRow[key], 0))}
                          </td>
                        </tr>
                         {/* PENDING row */}
                         <tr>
                          <td style={{fontWeight:700, background:'#e0f2f1', color:'#0d9488', textAlign:'center'}}>PENDING</td>
                          <td style={{fontWeight:700, background:'#e0f2f1', color:'#0d9488', textAlign:'center'}}>-</td>
                          {itemKeys.map(key => (
                            <td key={'pending'+key} style={{textAlign:'center', fontWeight:700, background:'#e0f2f1', color:'#0d9488'}}>{pendingRow[key]}</td>
                          ))}
                          <td style={{textAlign:'center', fontWeight:700, background:'#e0f2f1', color:'#0d9488'}}>
                            {itemKeys.reduce((sum, key) => sum + pendingRow[key], 0)}
                          </td>
                          <td style={{textAlign:'center', fontWeight:700, background:'#e0f2f1', color:'#0d9488'}}>
                            {formatWeight(itemKeys.reduce((sum, key) => {
                              const matchingItem = dispatchForm.find(item => 
                                (item.item_name + '|' + (item.size || '')) === key
                              );
                              const balance = matchingItem ? (matchingItem.ordered_quantity - matchingItem.prev_dispatched) : 0;
                              const pendingWeight = matchingItem && matchingItem.unit_weight ? 
                                (balance * parseFloat(matchingItem.unit_weight)) : 0;
                              return sum + pendingWeight;
                            }, 0))}
                          </td>
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
    </div>
  );
};

const Icons = {
  Close: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Download: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
};

export default CompletedOrders;