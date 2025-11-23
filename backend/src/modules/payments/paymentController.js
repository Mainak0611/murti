import pool from "../../config/db.js";
import fs from "fs";
import XLSX from "xlsx";

// Mapping Excel Columns to DB Columns
const EXCEL_TO_SQL_MAP = [
  'party', 
  'contact_no'
];

// --- 1. GET CONTROLLER ---
export const getPayments = async (req, res) => {
  const userId = req.user.id;

  // Fetches payments including the Month/Year columns
  const sql = `
    SELECT
      p.id,
      p.party,
      p.contact_no,
      p.payment_status,
      p.month, 
      p.year,
      p.user_id,
      p.created_at,
      p.date_count,
      (SELECT payment_date FROM payment_tracking WHERE payment_id = p.id ORDER BY created_at DESC LIMIT 1) AS latest_payment,
      (SELECT remark FROM payment_tracking WHERE payment_id = p.id ORDER BY created_at DESC LIMIT 1) AS latest_remark
    FROM payments p
    WHERE p.user_id = $1
    ORDER BY 
      CASE WHEN p.payment_status = 'PENDING' THEN 1 
           WHEN p.payment_status = 'PARTIAL' THEN 2 
           ELSE 3 END ASC, -- Puts PENDING first
      p.year ASC,          -- Then Oldest Year
      p.id ASC;            -- Then Creation Order
  `;

  try {
    const { rows } = await pool.query(sql, [userId]);
    res.json(rows);
  } catch (err) {
    console.error("Database query error (getPayments):", err);
    res.status(500).json({ error: "Failed to query database." });
  }
};

// --- 2. DELETE CONTROLLER ---
export const deleteAllPayments = async (req, res) => {
  const userId = req.user.id;

  // WARNING: This deletes EVERYTHING (History included). 
  const sql = "DELETE FROM payments WHERE user_id = $1";
  try {
    const result = await pool.query(sql, [userId]);
    res.json({
      message: `All ${result.rowCount} payment records deleted successfully. History wiped.`,
      rowsDeleted: result.rowCount
    });
  } catch (err) {
    console.error("Database delete error (deleteAllPayments):", err);
    res.status(500).json({ error: "Failed to delete records." });
  }
};

// --- 3. POST CONTROLLER (Upload CSV/XLSX) ---
export const uploadCSV = async (req, res) => {
  const userId = req.user.id;

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

  // --- NEW LOGIC: SMART INVENTORY MATCH ---
  const now = new Date();
  const currentMonth = now.toLocaleString('default', { month: 'long' }); // e.g., "November"
  const currentYear = now.getFullYear(); // e.g., 2025

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch ALL existing parties for this specific Month/Year
    // This allows us to compare "What we have" vs "What is coming in"
    const existingRes = await client.query(
      `SELECT party FROM payments WHERE user_id = $1 AND month = $2 AND year = $3`,
      [userId, currentMonth, currentYear]
    );
    
    // Create a "Bag" of existing parties. 
    // If DB has ['PartyA', 'PartyA'], this array will be ['PartyA', 'PartyA'].
    const existingPartiesPool = existingRes.rows.map(r => r.party);

    const rowsToInsert = [];
    
    // 2. Iterate through Excel records
    for (const rec of records) {
      // Check if this party exists in our pool
      const matchIndex = existingPartiesPool.indexOf(rec.party);

      if (matchIndex !== -1) {
        // FOUND: It exists in DB. 
        // Remove one instance from the pool to "mark it as seen".
        // We DO NOT insert this record because it's already there.
        existingPartiesPool.splice(matchIndex, 1);
      } else {
        // NOT FOUND (or all existing instances used up): 
        // This is a NEW copy (or a new party entirely).
        // We MUST insert this.
        rowsToInsert.push(rec);
      }
    }

    // 3. Insert only the truly new rows
    if (rowsToInsert.length > 0) {
      const columns = [...EXCEL_TO_SQL_MAP, 'payment_status', 'user_id', 'month', 'year'];
      const values = [];
      const rowPlaceholders = [];
      let paramIndex = 1;

      for (const rec of rowsToInsert) {
        const singleRowPlaceholders = [];
        
        // 1. Party
        values.push(rec.party);
        singleRowPlaceholders.push(`$${paramIndex++}`);
        
        // 2. Contact
        values.push(rec.contact_no);
        singleRowPlaceholders.push(`$${paramIndex++}`);

        // 3. Status
        values.push('PENDING');
        singleRowPlaceholders.push(`$${paramIndex++}`);
        
        // 4. User ID
        values.push(userId);
        singleRowPlaceholders.push(`$${paramIndex++}`);

        // 5. Month
        values.push(currentMonth);
        singleRowPlaceholders.push(`$${paramIndex++}`);

        // 6. Year
        values.push(currentYear);
        singleRowPlaceholders.push(`$${paramIndex++}`);

        rowPlaceholders.push(`(${singleRowPlaceholders.join(', ')})`);
      }

      const insertSql = `INSERT INTO payments (${columns.join(', ')}) VALUES ${rowPlaceholders.join(', ')}`;
      await client.query(insertSql, values);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: `Processed ${records.length} rows. Inserted ${rowsToInsert.length} new records. (Skipped ${records.length - rowsToInsert.length} duplicates).`,
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

// --- 5. GET TRACKING ENTRIES ---
export const getTrackingEntries = async (req, res) => {
  const { paymentId } = req.params;
  const userId = req.user.id;

  try {
    const ownership = await pool.query('SELECT id FROM payments WHERE id = $1 AND user_id = $2', [paymentId, userId]);
    if (ownership.rowCount === 0) {
      return res.status(404).json({ error: "Payment record not found or unauthorized." });
    }

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

// --- 6. UPDATE PAYMENT STATUS ---
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