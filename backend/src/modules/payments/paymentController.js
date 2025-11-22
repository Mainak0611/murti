// backend/src/modules/payments/paymentController.js
import pool from "../../config/db.js";
import fs from "fs";
import XLSX from "xlsx";

// UPDATED: Only mapping the columns that exist in DB now
const EXCEL_TO_SQL_MAP = [
  'party', 
  'contact_no'
];

// UPDATED: No numeric money columns left to clean
const NUMERIC_COLUMNS = new Set([]);

const cleanNumericValue = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const v = parseFloat(cleaned);
  return Number.isNaN(v) ? null : v;
};

// 1. GET CONTROLLER: Fetches payments
export const getPayments = async (req, res) => {
  const userId = req.user.id;

  // UPDATED: Explicitly selecting only the existing columns
  const sql = `
    SELECT
      p.id,
      p.party,
      p.contact_no,
      p.payment_status,
      p.user_id,
      p.created_at,
      p.date_count,
      (SELECT payment_date FROM payment_tracking WHERE payment_id = p.id ORDER BY created_at DESC LIMIT 1) AS latest_payment,
      (SELECT remark FROM payment_tracking WHERE payment_id = p.id ORDER BY created_at DESC LIMIT 1) AS latest_remark
    FROM payments p
    WHERE p.user_id = $1
    ORDER BY p.id ASC;
  `;

  try {
    const { rows } = await pool.query(sql, [userId]);
    res.json(rows);
  } catch (err) {
    console.error("Database query error (getPayments):", err);
    res.status(500).json({ error: "Failed to query database." });
  }
};

// 2. DELETE CONTROLLER
export const deleteAllPayments = async (req, res) => {
  const userId = req.user.id;

  const sql = "DELETE FROM payments WHERE user_id = $1";
  try {
    const result = await pool.query(sql, [userId]);
    res.json({
      message: `All ${result.rowCount} payment records deleted successfully for user ${userId}.`,
      rowsDeleted: result.rowCount
    });
  } catch (err) {
    console.error("Database delete error (deleteAllPayments):", err);
    res.status(500).json({ error: "Failed to delete records." });
  }
};

// 3. POST CONTROLLER (Upload CSV/XLSX)
export const uploadCSV = async (req, res) => {
  const userId = req.user.id;
  console.log('Upload called by user ID:', userId);

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const filePath = req.file.path;
  let records = [];

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rawSheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      range: 0,
      defval: null
    });

    if (rawSheetData.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: "File is empty." });
    }

    // Find header row
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
      return res.status(400).json({ error: "Could not find the 'Party' header row in the file." });
    }

    const dataRows = rawSheetData.slice(headerRowIndex + 1);
    if (dataRows.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: "Header found, but no data rows followed." });
    }

    const headers = rawSheetData[headerRowIndex];

    records = dataRows.map(row => {
      const rawPartyValue = String(row[0] || '').trim();
      if (!row || rawPartyValue === '' || rawPartyValue.toLowerCase() === 'total') return null;

      const record = {};
      headers.forEach((fileHeader, index) => {
        // Map by position based on our simplified EXCEL_TO_SQL_MAP
        // Index 0 -> party, Index 1 -> contact_no
        const sqlKey = EXCEL_TO_SQL_MAP[index];
        if (sqlKey) {
          const rawValue = row[index] !== undefined ? row[index] : null;
          record[sqlKey] = rawValue === "" ? null : rawValue;
        }
      });
      
      // Validation: Party is required
      if (!record.party) return null;
      
      return record;
    }).filter(r => r !== null);

    try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }

  } catch (err) {
    try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
    console.error("File processing error:", err);
    return res.status(500).json({ error: "Failed to read file." });
  }

  if (records.length === 0) {
    return res.status(400).json({ error: "No valid data rows found." });
  }

  // Insert logic: Only Party, Contact, Payment Status, User ID
  const columns = [...EXCEL_TO_SQL_MAP, 'payment_status', 'user_id'];
  const values = [];
  const rowPlaceholders = [];

  let paramIndex = 1;
  for (const rec of records) {
    const singleRowPlaceholders = [];
    
    // 1. party
    values.push(rec.party);
    singleRowPlaceholders.push(`$${paramIndex++}`);
    
    // 2. contact_no
    values.push(rec.contact_no);
    singleRowPlaceholders.push(`$${paramIndex++}`);

    // 3. payment_status (default PENDING)
    values.push('PENDING');
    singleRowPlaceholders.push(`$${paramIndex++}`);
    
    // 4. user_id
    values.push(userId);
    singleRowPlaceholders.push(`$${paramIndex++}`);

    rowPlaceholders.push(`(${singleRowPlaceholders.join(', ')})`);
  }

  const sql = `INSERT INTO payments (${columns.join(', ')}) VALUES ${rowPlaceholders.join(', ')}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const insertResult = await client.query(sql, values);
    await client.query('COMMIT');

    res.status(201).json({
      message: `${insertResult.rowCount} records uploaded successfully.`,
      rowsInserted: insertResult.rowCount
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error("Database insert error:", err);
    res.status(500).json({ error: "Failed to insert data.", details: err.message });
  } finally {
    client.release();
  }
};

// 4. ADD TRACKING ENTRY
export const addTrackingEntry = async (req, res) => {
  const { paymentId } = req.params;
  const { entry_date, remark } = req.body; 
  const userId = req.user.id;

  if (!entry_date && !remark) {
    return res.status(400).json({ error: "entry_date or remark must be provided." });
  }

  try {
    const ownership = await pool.query('SELECT id FROM payments WHERE id = $1 AND user_id = $2', [paymentId, userId]);
    if (ownership.rowCount === 0) {
      return res.status(404).json({ error: "Payment record not found or unauthorized." });
    }

    const insertSql = `
      INSERT INTO payment_tracking (payment_id, payment_date, remark)
      VALUES ($1, $2, $3)
      RETURNING id;
    `;
    
    const { rows } = await pool.query(insertSql, [paymentId, entry_date || null, remark || null]);
    res.status(201).json({ message: "Tracking entry added successfully.", id: rows[0].id });
  } catch (err) {
    console.error("Database insert error (addTrackingEntry):", err);
    res.status(500).json({ error: "Failed to save tracking entry." });
  }
};

// 5. GET TRACKING ENTRIES
export const getTrackingEntries = async (req, res) => {
  const { paymentId } = req.params;
  const userId = req.user.id;

  try {
    const ownership = await pool.query('SELECT id FROM payments WHERE id = $1 AND user_id = $2', [paymentId, userId]);
    if (ownership.rowCount === 0) {
      return res.status(404).json({ error: "Payment record not found or unauthorized." });
    }

    // UPDATED: Aliased 'payment_date' to 'actual_payment'
    const sql = `
      SELECT id, payment_date AS actual_payment, remark, created_at
      FROM payment_tracking
      WHERE payment_id = $1
      ORDER BY created_at DESC
    `;
    const { rows } = await pool.query(sql, [paymentId]);
    res.json(rows);
  } catch (err) {
    console.error("Database query error (getTrackingEntries):", err);
    res.status(500).json({ error: "Failed to fetch tracking history." });
  }
};

// 6. UPDATE PAYMENT STATUS
export const updatePaymentStatus = async (req, res) => {
  const { id } = req.params;
  const { newStatus } = req.body;
  const userId = req.user.id;

  const validStatuses = ['PENDING', 'PARTIAL', 'PAID'];
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({ error: "Invalid payment status provided." });
  }

  try {
    const sql = `UPDATE payments SET payment_status = $1 WHERE id = $2 AND user_id = $3`;
    const result = await pool.query(sql, [newStatus, id, userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Payment record not found or unauthorized to update." });
    }
    res.status(200).json({ message: `Status updated to ${newStatus} successfully.` });
  } catch (err) {
    console.error("Database update error (updatePaymentStatus):", err);
    res.status(500).json({ error: "Failed to update payment status." });
  }
};