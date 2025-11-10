// backend/src/modules/payments/paymentController.js
import pool from "../../config/db.js";
import fs from "fs";
import XLSX from "xlsx";

const EXCEL_TO_SQL_MAP = [
  'party', 'contact_no', 'last_r', 'rent_amount', 'rent_r',
  'deposit', 'rent_r_plus_deposit', 'loading', 'transport',
  'lost_damage_item', 'damage_lost', 'party_payment',
  'total_amt', 'without_de'
];

const NUMERIC_COLUMNS = new Set([
  'rent_amount', 'deposit', 'rent_r_plus_deposit', 'loading',
  'transport', 'total_amt', 'without_de'
]);

const cleanNumericValue = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const v = parseFloat(cleaned);
  return Number.isNaN(v) ? null : v;
};

// 1. GET CONTROLLER: Fetches payments with the LATEST tracking data joined
export const getPayments = async (req, res) => {
  const userId = req.user.id;

  const sql = `
    SELECT
      p.*,
      (SELECT actual_payment FROM payment_tracking WHERE payment_id = p.id ORDER BY created_at DESC LIMIT 1) AS latest_payment,
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
  console.log('Full req.user:', req.user);

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

    // Find header row by searching for 'Party' (case-insensitive)
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
      return res.status(400).json({ error: "Could not find the 'Party' header row in the file. Check file formatting." });
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
        // Map by position — if file has more/less columns, we only map known ones
        const sqlKey = EXCEL_TO_SQL_MAP[index];
        if (sqlKey) {
          const rawValue = row[index] !== undefined ? row[index] : null;
          if (NUMERIC_COLUMNS.has(sqlKey)) {
            record[sqlKey] = cleanNumericValue(rawValue);
          } else {
            record[sqlKey] = rawValue === "" ? null : rawValue;
          }
        }
      });

      // Ensure all mapped keys exist
      EXCEL_TO_SQL_MAP.forEach(k => {
        if (!(k in record)) record[k] = null;
      });

      return record;
    }).filter(r => r !== null && r.party);

    // delete temp file
    try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }

  } catch (err) {
    try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
    console.error("File processing error (XLSX/CSV):", err);
    return res.status(500).json({ error: "Failed to read file. Check file integrity or column order." });
  }

  if (records.length === 0) {
    return res.status(400).json({ error: "No valid data rows found after final cleaning." });
  }

  // Build insert - include payment_status with default 'PENDING'
  const columns = [...EXCEL_TO_SQL_MAP, 'payment_status', 'user_id'];
  // Build placeholders for multi-row insert: ($1,$2,..,$N), ($N+1,...)
  const values = [];
  const rowPlaceholders = [];

  let paramIndex = 1;
  for (const rec of records) {
    const singleRowPlaceholders = [];
    for (const col of EXCEL_TO_SQL_MAP) {
      values.push(rec[col]);
      singleRowPlaceholders.push(`$${paramIndex++}`);
    }
    // append payment_status (default PENDING)
    values.push('PENDING');
    singleRowPlaceholders.push(`$${paramIndex++}`);
    // append user_id
    values.push(userId);
    singleRowPlaceholders.push(`$${paramIndex++}`);

    rowPlaceholders.push(`(${singleRowPlaceholders.join(', ')})`);
  }

  const sql = `INSERT INTO payments (${columns.join(', ')}) VALUES ${rowPlaceholders.join(', ')}`;

  // Debug logging
  console.log('=== UPLOAD DEBUG ===');
  console.log('Columns:', columns);
  console.log('Number of records:', records.length);
  console.log('First record:', records[0]);
  console.log('SQL:', sql.substring(0, 200) + '...');
  console.log('First 5 values:', values.slice(0, 5));

  // Use transaction for safety
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const insertResult = await client.query(sql, values);
    await client.query('COMMIT');

    // insertResult.rowCount gives number of rows inserted
    res.status(201).json({
      message: `${insertResult.rowCount} records uploaded successfully for user ${userId}.`,
      rowsInserted: insertResult.rowCount
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error("Database insert error (uploadCSV):", err);
    console.error("SQL Query:", sql);
    console.error("Values:", values);
    console.error("Error details:", err.message);
    console.error("Error stack:", err.stack);
    res.status(500).json({
      error: "Failed to insert data into database. Check column data types and header names. See server console for details.",
      details: err.message
    });
  } finally {
    client.release();
  }
};

// 4. ADD TRACKING ENTRY
export const addTrackingEntry = async (req, res) => {
  const { paymentId } = req.params;
  const { entry_date, remark } = req.body;  // Accept entry_date from frontend
  const userId = req.user.id;

  if (!entry_date && !remark) {
    return res.status(400).json({ error: "entry_date or remark must be provided." });
  }

  try {
    // Verify ownership
    const ownership = await pool.query('SELECT id FROM payments WHERE id = $1 AND user_id = $2', [paymentId, userId]);
    if (ownership.rowCount === 0) {
      return res.status(404).json({ error: "Payment record not found or unauthorized." });
    }

    const insertSql = `
      INSERT INTO payment_tracking (payment_id, actual_payment, remark)
      VALUES ($1, $2, $3)
      RETURNING id;
    `;
    // Store entry_date in actual_payment column (as TEXT/DATE)
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
      return res.status(404).json({ error: "Payment record not found or unauthorized to view history." });
    }

    const sql = `
      SELECT id, actual_payment, remark, created_at
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
