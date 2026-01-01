import pool from '../../config/db.js';

// Updated: Filter by Branch ID and include order information
export const getAllReturnsByBranch = async (branchId) => {
  const sql = `
    SELECT 
      r.id,
      r.order_id,
      r.item_id,
      r.party_name,
      r.quantity,
      r.return_date,
      r.challan_number,
      r.remark,
      r.created_at,
      i.item_name,
      i.size,
      i.weight,
      o.reference as order_reference,
      o.order_date
    FROM public.returns r
    JOIN public.items i ON r.item_id = i.id
    LEFT JOIN public.orders o ON r.order_id = o.id
    WHERE r.branch_id = $1 -- <--- FILTER BY BRANCH
    ORDER BY r.return_date DESC, r.created_at DESC
  `;
  const { rows } = await pool.query(sql, [branchId]);
  return rows;
};

// Updated: Insert with Branch ID and Order ID
export const createBatchReturnEntry = async ({ userId, branchId, party_name, return_date, order_id, challan_number, items }) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const insertSql = `
      INSERT INTO public.returns (branch_id, order_id, party_name, item_id, quantity, return_date, challan_number, remark)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    const updateStockSql = `
      UPDATE public.items 
      SET current_stock = current_stock + $1 
      WHERE id = $2
    `;

    for (const item of items) {
        if (!item.item_id || !item.quantity) continue;

        // 1. Insert Log
        await client.query(insertSql, [
            branchId, // <--- SAVE BRANCH ID
            order_id || null, // <--- SAVE ORDER ID (can be null)
            party_name, 
            item.item_id, 
            item.quantity, 
            return_date, 
            challan_number || '', // <--- SAVE CHALLAN NUMBER
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

// Check owner via Branch ID
export const findItemOwner = async (itemId) => {
    const res = await pool.query('SELECT user_id, branch_id FROM public.items WHERE id = $1', [itemId]);
    return res.rows[0];
};

// Get a single return entry by ID
export const getReturnById = async (returnId) => {
    const res = await pool.query(
        'SELECT * FROM public.returns WHERE id = $1',
        [returnId]
    );
    return res.rows[0];
};

// Delete a return entry and restore stock
export const deleteReturnEntry = async (returnId, itemId, quantity) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Delete the return entry
        await client.query('DELETE FROM public.returns WHERE id = $1', [returnId]);

        // Restore stock (subtract the returned quantity)
        await client.query(
            'UPDATE public.items SET current_stock = current_stock - $1 WHERE id = $2',
            [quantity, itemId]
        );

        await client.query('COMMIT');
        return true;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

// Update a return entry and adjust stock
export const updateReturnEntry = async (returnId, quantity, remark, quantityDiff) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Get current return entry
        const current = await client.query('SELECT item_id, quantity FROM public.returns WHERE id = $1', [returnId]);
        
        if (current.rows.length === 0) {
            throw new Error('Return entry not found');
        }

        const itemId = current.rows[0].item_id;

        // Update return entry
        await client.query(
            'UPDATE public.returns SET quantity = $1, remark = $2 WHERE id = $3',
            [quantity, remark, returnId]
        );

        // Adjust stock if quantity changed (positive diff = add to stock, negative = subtract)
        if (quantityDiff !== 0) {
            await client.query(
                'UPDATE public.items SET current_stock = current_stock + $1 WHERE id = $2',
                [quantityDiff, itemId]
            );
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

// Update challan number for a return entry
export const updateReturnChallan = async (returnId, challan_number) => {
    const res = await pool.query(
        'UPDATE public.returns SET challan_number = $1 WHERE id = $2 RETURNING id',
        [challan_number, returnId]
    );
    return res.rows[0];
};