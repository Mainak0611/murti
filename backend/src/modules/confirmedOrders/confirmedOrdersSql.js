import pool from '../../config/db.js';

export const findOrdersByUserId = async (userId) => {
  const sql = `
    SELECT * FROM public.orders 
    WHERE user_id = $1 
    ORDER BY order_date DESC, created_at DESC
  `;
  const { rows } = await pool.query(sql, [userId]);
  return rows;
};

export const findOrderById = async (id) => {
  const orderSql = `SELECT * FROM public.orders WHERE id = $1`;
  const { rows: orderRows } = await pool.query(orderSql, [id]);
  const order = orderRows[0];

  if (!order) return null;

  // 1. Fetch Items
  const itemsSql = `
    SELECT 
      oi.id, 
      oi.item_id, 
      oi.ordered_quantity, 
      oi.dispatched_quantity,
      i.item_name, 
      i.size,
      i.current_stock
    FROM public.order_items oi
    JOIN public.items i ON oi.item_id = i.id
    WHERE oi.order_id = $1
    ORDER BY i.item_name ASC
  `;
  const { rows: items } = await pool.query(itemsSql, [id]);
  order.items = items;

  // 2. Fetch Dispatch History (Logs)
  const historySql = `
    SELECT 
      dl.id,
      dl.dispatch_date,
      dl.quantity_sent,
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

export const updateDispatchQuantities = async (orderId, { dispatch_date, items }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const item of items) {
      const qtyToSend = item.quantity_sent;
      if (qtyToSend <= 0) continue;

      // 1. Insert into Log
      await client.query(
        `INSERT INTO public.dispatch_logs (order_item_id, quantity_sent, dispatch_date) VALUES ($1, $2, $3)`,
        [item.id, qtyToSend, dispatch_date]
      );

      // 2. Update Total Dispatched in Order Items
      await client.query(
        `UPDATE public.order_items SET dispatched_quantity = dispatched_quantity + $1 WHERE id = $2`,
        [qtyToSend, item.id]
      );

      // 3. Deduct from Main Stock
      await client.query(
        `UPDATE public.items SET current_stock = current_stock - $1 WHERE id = (
           SELECT item_id FROM public.order_items WHERE id = $2
         )`,
        [qtyToSend, item.id]
      );
    }

    // 4. Update Status if needed (Optional)
    await client.query(
      `UPDATE public.orders SET status = 'Dispatched' WHERE id = $1`, 
      [orderId]
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