import fs from "fs";
import XLSX from "xlsx";
import pool from "../../config/db.js"; // Needed for pool.connect() in upload
import * as paymentSql from "./paymentSql.js";

const EXCEL_TO_SQL_MAP = ['party', 'contact_no'];

// --- 1. GET CONTROLLER ---
export const getPayments = async (req, res) => {
  try {
    const rows = await paymentSql.getPaymentsByUserId(req.user.id);
    res.json(rows);
  } catch (err) {
    console.error("Error in getPayments:", err);
    res.status(500).json({ error: "Failed to query database." });
  }
};

// --- 2. DELETE ALL ---
export const deleteAllPayments = async (req, res) => {
  try {
    const result = await paymentSql.deleteAllPaymentsByUserId(req.user.id);
    res.json({
      message: `All ${result.rowCount} payment records deleted successfully.`,
      rowsDeleted: result.rowCount
    });
  } catch (err) {
    console.error("Error in deleteAllPayments:", err);
    res.status(500).json({ error: "Failed to delete records." });
  }
};

// --- 3. UPLOAD CSV/XLSX ---
export const uploadCSV = async (req, res) => {
  const userId = req.user.id;
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const filePath = req.file.path;
  let records = [];

  // --- FILE PARSING LOGIC ---
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rawSheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1, range: 0, defval: null
    });

    if (rawSheetData.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: "File is empty." });
    }

    let headerRowIndex = -1;
    for (let i = 0; i < rawSheetData.length; i++) {
      const row = rawSheetData[i];
      if (row && String(row[0] || '').trim().toLowerCase() === 'party') {
        headerRowIndex = i;
        break;
      }
    }
    if (headerRowIndex === -1) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: "Could not find the 'Party' header row." });
    }

    const dataRows = rawSheetData.slice(headerRowIndex + 1);
    const headers = rawSheetData[headerRowIndex];

    records = dataRows.map(row => {
      const rawPartyValue = String(row[0] || '').trim();
      if (!row || rawPartyValue === '' || rawPartyValue.toLowerCase() === 'total') return null;

      const record = {};
      headers.forEach((fileHeader, index) => {
        const sqlKey = EXCEL_TO_SQL_MAP[index];
        if (sqlKey) {
          const rawValue = row[index] !== undefined ? row[index] : null;
          record[sqlKey] = rawValue === "" ? null : rawValue;
        }
      });
      return record.party ? record : null;
    }).filter(r => r !== null);

    try { fs.unlinkSync(filePath); } catch (e) {}
  } catch (err) {
    try { fs.unlinkSync(filePath); } catch (e) {}
    console.error("File processing error:", err);
    return res.status(500).json({ error: "Failed to read file." });
  }

  if (records.length === 0) return res.status(400).json({ error: "No valid data rows found." });

  // --- DB INSERTION LOGIC ---
  const now = new Date();
  const currentMonth = now.toLocaleString('default', { month: 'long' });
  const currentYear = now.getFullYear();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Use SQL Helper
    const existingPartiesPool = await paymentSql.findExistingParties(client, userId, currentMonth, currentYear);
    
    const rowsToInsert = [];
    for (const rec of records) {
      const matchIndex = existingPartiesPool.indexOf(rec.party);
      if (matchIndex !== -1) {
        existingPartiesPool.splice(matchIndex, 1);
      } else {
        rowsToInsert.push(rec);
      }
    }

    if (rowsToInsert.length > 0) {
      const columns = [...EXCEL_TO_SQL_MAP, 'payment_status', 'user_id', 'month', 'year'];
      const values = [];
      const rowPlaceholders = [];
      let paramIndex = 1;

      for (const rec of rowsToInsert) {
        const singleRowPlaceholders = [];
        values.push(rec.party);
        singleRowPlaceholders.push(`$${paramIndex++}`);
        values.push(rec.contact_no);
        singleRowPlaceholders.push(`$${paramIndex++}`);
        values.push('PENDING');
        singleRowPlaceholders.push(`$${paramIndex++}`);
        values.push(userId);
        singleRowPlaceholders.push(`$${paramIndex++}`);
        values.push(currentMonth);
        singleRowPlaceholders.push(`$${paramIndex++}`);
        values.push(currentYear);
        singleRowPlaceholders.push(`$${paramIndex++}`);
        rowPlaceholders.push(`(${singleRowPlaceholders.join(', ')})`);
      }

      // Use SQL Helper
      await paymentSql.bulkInsertPayments(client, columns, values, rowPlaceholders);
    }

    await client.query('COMMIT');
    res.status(201).json({
      message: `Processed ${records.length} rows. Inserted ${rowsToInsert.length} new records.`,
      rowsInserted: rowsToInsert.length
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error("Database insert error:", err);
    res.status(500).json({ error: "Failed to insert data.", details: err.message });
  } finally {
    client.release();
  }
};

// --- 4. ADD TRACKING ENTRY ---
export const addTrackingEntry = async (req, res) => {
  const { paymentId } = req.params;
  const { entry_date, remark } = req.body;
  
  if (!entry_date && !remark) return res.status(400).json({ error: "entry_date or remark must be provided." });

  try {
    const isOwner = await paymentSql.checkPaymentOwnership(paymentId, req.user.id);
    if (!isOwner) return res.status(404).json({ error: "Payment record not found or unauthorized." });

    const result = await paymentSql.addTrackingEntryDb(paymentId, entry_date, remark);
    res.status(201).json({ message: "Tracking entry added successfully.", id: result.id });
  } catch (err) {
    console.error("Error in addTrackingEntry:", err);
    res.status(500).json({ error: "Failed to save tracking entry." });
  }
};

// --- 5. GET TRACKING ENTRIES ---
export const getTrackingEntries = async (req, res) => {
  const { paymentId } = req.params;
  try {
    const isOwner = await paymentSql.checkPaymentOwnership(paymentId, req.user.id);
    if (!isOwner) return res.status(404).json({ error: "Payment record not found or unauthorized." });

    const rows = await paymentSql.getTrackingEntriesByPaymentId(paymentId);
    res.json(rows);
  } catch (err) {
    console.error("Error in getTrackingEntries:", err);
    res.status(500).json({ error: "Failed to fetch tracking history." });
  }
};

// --- 6. UPDATE PAYMENT STATUS ---
export const updatePaymentStatus = async (req, res) => {
  const { id } = req.params;
  const { newStatus } = req.body;
  const validStatuses = ['PENDING', 'PARTIAL', 'PAID', 'NO_RESPONSE', 'CLOSE_PARTY'];
  
  if (!validStatuses.includes(newStatus)) return res.status(400).json({ error: "Invalid payment status provided." });

  try {
    const result = await paymentSql.updatePaymentStatusDb(id, req.user.id, newStatus);
    if (result.rowCount === 0) return res.status(404).json({ error: "Payment record not found or unauthorized to update." });
    
    res.status(200).json({ message: `Status updated to ${newStatus} successfully.` });
  } catch (err) {
    console.error("Error in updatePaymentStatus:", err);
    res.status(500).json({ error: "Failed to update payment status." });
  }
};

// --- 7. MERGE PAYMENTS ---
export const mergePayments = async (req, res) => {
  const { targetId, sourceIds } = req.body;
  if (!targetId || !Array.isArray(sourceIds) || sourceIds.length === 0) return res.status(400).json({ error: "Invalid merge request data." });

  const targetIdInt = parseInt(targetId, 10);
  const sourceIdsInt = sourceIds
    .map(id => parseInt(id, 10))
    .filter(id => !isNaN(id) && Number(id) !== Number(targetIdInt));

  if (isNaN(targetIdInt) || sourceIdsInt.length === 0) return res.status(400).json({ error: "Invalid IDs provided." });

  try {
    await paymentSql.executeMergeTransaction(req.user.id, targetIdInt, sourceIdsInt);
    res.json({ message: "Records merged successfully (sources marked & history moved)." });
  } catch (err) {
    console.error("Merge error details:", err);
    res.status(500).json({ error: err.message || "Failed to merge records." });
  }
};

// --- 8. UPDATE PAYMENT DETAILS ---
export const updatePaymentDetails = async (req, res) => {
  const { id } = req.params;
  const { party, contact_no } = req.body;
  if (!party) return res.status(400).json({ error: "Party name is required." });

  try {
    const payment = await paymentSql.updatePaymentDetailsDb(id, req.user.id, party, contact_no);
    if (!payment) return res.status(404).json({ error: "Record not found or unauthorized." });
    res.json({ message: "Details updated successfully.", payment });
  } catch (err) {
    console.error("Error in updatePaymentDetails:", err);
    res.status(500).json({ error: "Failed to update details." });
  }
};

// --- 9. UPDATE TRACKING ENTRY ---
export const updateTrackingEntry = async (req, res) => {
  const { id } = req.params;
  const { entry_date, remark } = req.body;

  try {
    const result = await paymentSql.updateTrackingEntryDb(id, req.user.id, entry_date, remark);
    if (!result) return res.status(404).json({ error: "Entry not found or unauthorized." });
    res.json(result);
  } catch (err) {
    console.error("Error in updateTrackingEntry:", err);
    res.status(500).json({ error: "Failed to update entry." });
  }
};

// --- 10. DELETE TRACKING ENTRY ---
export const deleteTrackingEntry = async (req, res) => {
  const { id } = req.params;
  try {
    const success = await paymentSql.deleteTrackingEntryDb(id, req.user.id);
    if (!success) return res.status(404).json({ error: "Entry not found or unauthorized." });
    res.json({ message: "Entry deleted successfully." });
  } catch (err) {
    console.error("Error in deleteTrackingEntry:", err);
    res.status(500).json({ error: "Failed to delete entry." });
  }
};

// --- 11. GET MERGED CHILDREN ---
export const getMergedPayments = async (req, res) => {
  const { id } = req.params;
  try {
    const isOwner = await paymentSql.checkPaymentOwnership(id, req.user.id);
    if (!isOwner) return res.status(404).json({ error: "Payment not found or unauthorized." });

    const rows = await paymentSql.getMergedChildren(id, req.user.id);
    res.json(rows);
  } catch (err) {
    console.error("Error in getMergedPayments:", err);
    res.status(500).json({ error: "Failed to fetch merged accounts." });
  }
};

// --- 12. UNMERGE ---
export const unmergePayment = async (req, res) => {
  const { id } = req.params;
  try {
    const isOwner = await paymentSql.checkPaymentOwnership(id, req.user.id);
    if (!isOwner) return res.status(404).json({ error: "Record not found or unauthorized." });

    const payment = await paymentSql.unmergePaymentDb(id);
    res.json({ message: "Record unmerged.", payment });
  } catch (err) {
    console.error("Error in unmergePayment:", err);
    res.status(500).json({ error: "Failed to unmerge record." });
  }
};