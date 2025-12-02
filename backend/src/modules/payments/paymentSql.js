import pool from "../../config/db.js";

// --- READ OPERATIONS ---

export const getPaymentsByUserId = async (userId) => {
  const sql = `
    SELECT
      p.id, p.party, p.contact_no, p.payment_status, p.month, p.year, p.user_id, p.created_at, p.date_count, p.merged_into_id,
      (SELECT to_char(payment_date::date, 'YYYY-MM-DD') FROM payment_tracking WHERE payment_id = p.id ORDER BY created_at DESC LIMIT 1) AS latest_payment,
      (SELECT remark FROM payment_tracking WHERE payment_id = p.id ORDER BY created_at DESC LIMIT 1) AS latest_remark
    FROM payments p
    WHERE p.user_id = $1
    ORDER BY p.id ASC;
  `;
  const { rows } = await pool.query(sql, [userId]);
  return rows;
};

export const checkPaymentOwnership = async (paymentId, userId) => {
  const sql = 'SELECT id FROM payments WHERE id = $1 AND user_id = $2';
  const { rows } = await pool.query(sql, [paymentId, userId]);
  return rows.length > 0;
};

export const getTrackingEntriesByPaymentId = async (paymentId) => {
  const sql = `
    SELECT id, payment_date AS actual_payment, remark, created_at
    FROM payment_tracking
    WHERE payment_id = $1
    ORDER BY created_at DESC
  `;
  const { rows } = await pool.query(sql, [paymentId]);
  return rows;
};

export const getMergedChildren = async (parentId, userId) => {
  const sql = `SELECT id, party, contact_no, payment_status, month, year, merged_into_id, date_count, created_at FROM payments WHERE merged_into_id = $1 AND user_id = $2 ORDER BY id ASC`;
  const { rows } = await pool.query(sql, [parentId, userId]);
  return rows;
};

// --- WRITE OPERATIONS ---

export const deleteAllPaymentsByUserId = async (userId) => {
  const sql = "DELETE FROM payments WHERE user_id = $1";
  const result = await pool.query(sql, [userId]);
  return result;
};

export const addTrackingEntryDb = async (paymentId, entryDate, remark) => {
  const sql = `
    INSERT INTO payment_tracking (payment_id, payment_date, remark)
    VALUES ($1, $2, $3)
    RETURNING id;
  `;
  const { rows } = await pool.query(sql, [paymentId, entryDate || null, remark || null]);
  return rows[0];
};

export const updatePaymentStatusDb = async (id, userId, newStatus) => {
  const sql = `UPDATE payments SET payment_status = $1 WHERE id = $2 AND user_id = $3`;
  const result = await pool.query(sql, [newStatus, id, userId]);
  return result;
};

export const updatePaymentDetailsDb = async (id, userId, party, contactNo) => {
  const sql = `UPDATE payments SET party = $1, contact_no = $2 WHERE id = $3 AND user_id = $4 RETURNING *`;
  const { rows } = await pool.query(sql, [party, contactNo, id, userId]);
  return rows[0];
};

export const updateTrackingEntryDb = async (trackingId, userId, entryDate, remark) => {
  // Check ownership via join first
  const checkSql = `
    SELECT t.id FROM payment_tracking t
    JOIN payments p ON t.payment_id = p.id
    WHERE t.id = $1 AND p.user_id = $2
  `;
  const check = await pool.query(checkSql, [trackingId, userId]);
  if (check.rowCount === 0) return null;

  const updateSql = `
    UPDATE payment_tracking 
    SET payment_date = COALESCE($1, payment_date), 
        remark = COALESCE($2, remark)
    WHERE id = $3
    RETURNING *
  `;
  const { rows } = await pool.query(updateSql, [entryDate, remark, trackingId]);
  return rows[0];
};

export const deleteTrackingEntryDb = async (trackingId, userId) => {
  const checkSql = `
    SELECT t.id FROM payment_tracking t
    JOIN payments p ON t.payment_id = p.id
    WHERE t.id = $1 AND p.user_id = $2
  `;
  const check = await pool.query(checkSql, [trackingId, userId]);
  if (check.rowCount === 0) return false;

  await pool.query('DELETE FROM payment_tracking WHERE id = $1', [trackingId]);
  return true;
};

export const unmergePaymentDb = async (id) => {
  const sql = `UPDATE payments SET merged_into_id = NULL WHERE id = $1 RETURNING *`;
  const { rows } = await pool.query(sql, [id]);
  return rows[0];
};

// --- COMPLEX TRANSACTIONS ---

// Used for Upload CSV (Finds duplicates)
export const findExistingParties = async (client, userId, month, year) => {
  const res = await client.query(
    `SELECT party FROM payments WHERE user_id = $1 AND month = $2 AND year = $3`,
    [userId, month, year]
  );
  return res.rows.map(r => r.party);
};

// Used for Upload CSV (Bulk Insert)
export const bulkInsertPayments = async (client, columns, values, rowPlaceholders) => {
  const sql = `INSERT INTO payments (${columns.join(', ')}) VALUES ${rowPlaceholders.join(', ')}`;
  await client.query(sql, values);
};

// Full Merge Transaction
export const executeMergeTransaction = async (userId, targetId, sourceIds) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const allIds = Array.from(new Set([targetId, ...sourceIds]));
    const checkSql = `SELECT id FROM payments WHERE user_id = $1 AND id = ANY($2)`;
    const checkRes = await client.query(checkSql, [userId, allIds]);
    
    if (checkRes.rowCount !== allIds.length) {
      throw new Error("One or more records do not exist or do not belong to you.");
    }

    const moveHistorySql = `UPDATE payment_tracking SET payment_id = $1 WHERE payment_id = ANY($2)`;
    await client.query(moveHistorySql, [targetId, sourceIds]);

    const markMergedSql = `UPDATE payments SET merged_into_id = $1 WHERE id = ANY($2)`;
    await client.query(markMergedSql, [targetId, sourceIds]);

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};