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

  const itemsSql = `
    SELECT 
      oi.id, 
      oi.item_id, 
      oi.ordered_quantity, 
      oi.dispatched_quantity,
      i.item_name, 
      i.size,
      i.current_stock -- Added this line to fetch available stock
    FROM public.order_items oi
    JOIN public.items i ON oi.item_id = i.id
    WHERE oi.order_id = $1
    ORDER BY i.item_name ASC
  `;
  const { rows: items } = await pool.query(itemsSql, [id]);
  
  order.items = items;
  return order;
};

export const updateDispatchQuantities = async (orderId, items) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const item of items) {
      await client.query(
        `UPDATE public.order_items SET dispatched_quantity = $1 WHERE id = $2 AND order_id = $3`,
        [item.dispatched_quantity, item.id, orderId]
      );
    }

    // Optional: Auto-update status to 'Dispatched' if items > 0
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