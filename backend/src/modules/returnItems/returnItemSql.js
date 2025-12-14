// backend/src/modules/returns/returnItemSql.js
import pool from '../../config/db.js';

export const getAllReturns = async (userId) => {
  const sql = `
    SELECT 
      r.id,
      r.party_name,
      r.quantity,
      r.return_date,
      r.remark,
      r.created_at,
      i.item_name,
      i.size
    FROM public.returns r
    JOIN public.items i ON r.item_id = i.id
    WHERE i.user_id = $1
    ORDER BY r.return_date DESC, r.created_at DESC
  `;
  const { rows } = await pool.query(sql, [userId]);
  return rows;
};

// --- NEW: Batch Processing Function ---
export const createBatchReturnEntry = async ({ party_name, return_date, items }) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const insertSql = `
      INSERT INTO public.returns (party_name, item_id, quantity, return_date, remark)
      VALUES ($1, $2, $3, $4, $5)
    `;

    const updateStockSql = `
      UPDATE public.items 
      SET current_stock = current_stock + $1 
      WHERE id = $2
    `;

    // Loop through items inside the transaction
    for (const item of items) {
        if (!item.item_id || !item.quantity) continue;

        // 1. Insert Log
        await client.query(insertSql, [
            party_name, 
            item.item_id, 
            item.quantity, 
            return_date, 
            item.remark || ''
        ]);

        // 2. Update Stock
        await client.query(updateStockSql, [item.quantity, item.item_id]);
    }

    await client.query('COMMIT');
    return true;

  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

export const findItemOwner = async (itemId) => {
    const res = await pool.query('SELECT user_id FROM public.items WHERE id = $1', [itemId]);
    return res.rows[0];
};