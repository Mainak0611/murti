import pool from '../../config/db.js';

export const findOrdersByBranchId = async (branchId) => {
  const sql = `
    SELECT * FROM public.orders 
    WHERE branch_id = $1 
    ORDER BY order_date DESC, created_at DESC
  `;
  const { rows } = await pool.query(sql, [branchId]);
  return rows;
};

export const findOrderById = async (id) => {
  const orderSql = `SELECT * FROM public.orders WHERE id = $1`;
  const { rows: orderRows } = await pool.query(orderSql, [id]);
  const order = orderRows[0];

  if (!order) return null;

  // 1. Fetch Items (Added total_weight and unit weight)
  const itemsSql = `
    SELECT 
      oi.id, 
      oi.item_id, 
      oi.ordered_quantity, 
      oi.dispatched_quantity,
      oi.total_weight,   -- <--- FETCH TOTAL ORDER WEIGHT
      i.item_name, 
      i.size,
      i.current_stock,
      i.weight as unit_weight -- <--- FETCH UNIT WEIGHT (Useful for frontend calcs)
    FROM public.order_items oi
    JOIN public.items i ON oi.item_id = i.id
    WHERE oi.order_id = $1
    ORDER BY i.item_name ASC
  `;
  const { rows: items } = await pool.query(itemsSql, [id]);
  order.items = items;

  // 2. Fetch Dispatch History (Added total_weight and challan_no for logs)
  const historySql = `
    SELECT 
      dl.id,
      dl.dispatch_date,
      dl.challan_no,
      dl.quantity_sent,
      dl.total_weight, -- <--- FETCH BATCH WEIGHT
      i.item_name,
      i.size
    FROM public.dispatch_logs dl
    JOIN public.order_items oi ON dl.order_item_id = oi.id
    JOIN public.items i ON oi.item_id = i.id
    WHERE oi.order_id = $1
    ORDER BY dl.dispatch_date DESC, dl.created_at DESC
  `;
  const { rows: history } = await pool.query(historySql, [id]);
  order.history = history;

  return order;
};

export const updateDispatchQuantities = async (orderId, { dispatch_date, challan_no, items }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // PRE-FETCH: Get Unit Weights for all items in this order to calculate batch weight
    // We map order_item_id -> unit_weight
    const weightRes = await client.query(`
      SELECT oi.id, i.weight 
      FROM public.order_items oi
      JOIN public.items i ON oi.item_id = i.id
      WHERE oi.order_id = $1
    `, [orderId]);
    
    const weightMap = {};
    weightRes.rows.forEach(row => {
        weightMap[row.id] = parseFloat(row.weight) || 0;
    });

    // Loop through dispatch items
    for (const item of items) {
      const qtyToSend = parseFloat(item.quantity_sent); // Ensure number
      if (qtyToSend <= 0) continue;

      // Calculate Batch Weight
      const unitWeight = weightMap[item.id] || 0;
      const batchWeight = unitWeight * qtyToSend;

      // 1. Insert into Log (With Total Weight and Challan No)
      await client.query(
        `INSERT INTO public.dispatch_logs 
          (order_item_id, quantity_sent, dispatch_date, challan_no, total_weight) 
         VALUES ($1, $2, $3, $4, $5)`,
        [item.id, qtyToSend, dispatch_date, challan_no || null, batchWeight]
      );

      // 2. Update Total Dispatched in Order Items
      await client.query(
        `UPDATE public.order_items SET dispatched_quantity = dispatched_quantity + $1 WHERE id = $2`,
        [qtyToSend, item.id]
      );

      // 3. Deduct from Main Stock (Items Table)
      await client.query(
        `UPDATE public.items SET current_stock = current_stock - $1 WHERE id = (
           SELECT item_id FROM public.order_items WHERE id = $2
         )`,
        [qtyToSend, item.id]
      );
    }

    // 4. Update Order Status Logic 
    // (Optional: You might want to check if ALL items are fully dispatched to set 'Completed')
    // For now, setting to 'Dispatched' or keeping your existing logic is fine.
    // A simple check could be:
    const checkStatusSql = `
        SELECT count(*) as pending_count 
        FROM public.order_items 
        WHERE order_id = $1 AND dispatched_quantity < ordered_quantity
    `;
    const { rows: statusRows } = await client.query(checkStatusSql, [orderId]);
    const isFullyCompleted = parseInt(statusRows[0].pending_count) === 0;

    const newStatus = isFullyCompleted ? 'Completed' : 'Partial Dispatch';

    await client.query(
      `UPDATE public.orders SET status = $1 WHERE id = $2`, 
      [newStatus, orderId]
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