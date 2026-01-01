import pool from '../../config/db.js';

export const createOrderDirectly = async (userId, branchId, { party_name, contact_no, reference, remark, order_date, items }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert into ORDERS
    const insertOrderSql = `
      INSERT INTO public.orders 
        (user_id, branch_id, party_name, contact_no, reference, remark, order_date, status)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, 'Pending')
      RETURNING id;
    `;
    const orderRes = await client.query(insertOrderSql, [
      userId, branchId, party_name, contact_no, reference, remark, order_date
    ]);
    const newOrderId = orderRes.rows[0].id;

    // 2. Fetch Item Details WITH Unit Weight
    const itemIds = items.map(i => i.item_id);
    const itemsRes = await client.query(`
      SELECT id, weight as unit_weight 
      FROM public.items 
      WHERE id = ANY($1)
    `, [itemIds]);
    
    const itemWeightMap = {};
    itemsRes.rows.forEach(row => {
      itemWeightMap[row.id] = parseFloat(row.unit_weight) || 0;
    });

    // 3. Insert into ORDER_ITEMS with Total Weight
    for (const item of items) {
      const unitWeight = itemWeightMap[item.item_id] || 0;
      const totalWeight = unitWeight * parseFloat(item.ordered_quantity);

      await client.query(`
        INSERT INTO public.order_items 
        (order_id, item_id, ordered_quantity, dispatched_quantity, total_weight)
        VALUES ($1, $2, $3, 0, $4)
      `, [newOrderId, item.item_id, item.ordered_quantity, totalWeight]);
    }

    await client.query('COMMIT');
    return newOrderId;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const findOrdersByBranchId = async (branchId) => {
  const sql = `
    SELECT * FROM public.orders 
    WHERE branch_id = $1 
    ORDER BY order_date DESC, created_at DESC
  `;
  const { rows } = await pool.query(sql, [branchId]);
  return rows;
};

export const findOrdersByPartyAndBranch = async (branchId, partyName) => {
  const sql = `
    SELECT 
      o.id,
      o.party_name,
      o.reference,
      o.order_date,
      o.status,
      o.contact_no,
      o.remark,
      o.created_at,
      COALESCE(
        json_agg(
          json_build_object(
            'item_id', oi.item_id,
            'item_name', i.item_name,
            'size', i.size,
            'ordered_quantity', oi.ordered_quantity,
            'dispatched_quantity', oi.dispatched_quantity
          ) ORDER BY i.item_name
        ) FILTER (WHERE oi.id IS NOT NULL), 
        '[]'::json
      ) as items
    FROM public.orders o
    LEFT JOIN public.order_items oi ON o.id = oi.order_id
    LEFT JOIN public.items i ON oi.item_id = i.id
    WHERE o.branch_id = $1 AND o.party_name = $2
    GROUP BY o.id, o.party_name, o.reference, o.order_date, o.status, o.contact_no, o.remark, o.created_at
    ORDER BY o.order_date DESC, o.created_at DESC
  `;
  const { rows } = await pool.query(sql, [branchId, partyName]);
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

export const updateOrder = async (orderId, { party_name, order_date, reference, contact_no, remark, items }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update the main order details
    await client.query(
      `UPDATE public.orders 
       SET party_name = $1, order_date = $2, reference = $3, contact_no = $4, remark = $5
       WHERE id = $6`,
      [party_name, order_date, reference, contact_no, remark, orderId]
    );

    // 2. Get existing order items to compare
    const existingResult = await client.query(
      `SELECT id, item_id, ordered_quantity, dispatched_quantity FROM public.order_items WHERE order_id = $1`,
      [orderId]
    );
    const existingItems = existingResult.rows;
    const existingItemIds = new Set(existingItems.map(i => i.item_id));

    // 3. Get IDs of items being removed (to delete their dispatch logs)
    const newItemIds = new Set(items.map(i => i.itemId));
    const itemsToRemove = existingItems.filter(i => !newItemIds.has(i.item_id));

    // Delete dispatch logs only for items being removed
    for (const item of itemsToRemove) {
      await client.query(
        `DELETE FROM public.dispatch_logs WHERE order_item_id = $1`,
        [item.id]
      );
    }

    // Delete the removed items
    for (const item of itemsToRemove) {
      await client.query(
        `DELETE FROM public.order_items WHERE id = $1`,
        [item.id]
      );
    }

    // 4. Insert or update items
    for (const item of items) {
      const { itemId, ordered_quantity } = item;
      
      // Get item details for weight calculation
      const itemResult = await client.query(
        `SELECT weight FROM public.items WHERE id = $1`,
        [itemId]
      );
      
      if (itemResult.rows.length === 0) {
        throw new Error(`Item with id ${itemId} not found`);
      }

      const unitWeight = parseFloat(itemResult.rows[0].weight) || 0;
      const totalWeight = unitWeight * ordered_quantity;

      // Check if this item already exists
      const existingItem = existingItems.find(i => i.item_id === itemId);

      if (existingItem) {
        // Update existing item's quantity and total weight
        await client.query(
          `UPDATE public.order_items 
           SET ordered_quantity = $1, total_weight = $2
           WHERE id = $3`,
          [ordered_quantity, totalWeight, existingItem.id]
        );
      } else {
        // Insert new item
        await client.query(
          `INSERT INTO public.order_items (order_id, item_id, ordered_quantity, dispatched_quantity, total_weight)
           VALUES ($1, $2, $3, 0, $4)`,
          [orderId, itemId, ordered_quantity, totalWeight]
        );
      }
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

export const updateDispatchEntry = async (orderId, challanNo, { dispatch_date, items, challan_no }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get existing dispatch logs to calculate stock adjustment
    const existingLogsResult = await client.query(
      `SELECT dl.id, dl.order_item_id, dl.quantity_sent, oi.item_id 
       FROM public.dispatch_logs dl
       JOIN public.order_items oi ON dl.order_item_id = oi.id
       WHERE dl.challan_no = $1`,
      [challanNo]
    );
    const existingLogs = existingLogsResult.rows;

    // 2. Get all order items with their item details (including weight)
    const itemsResult = await client.query(
      `SELECT oi.id, oi.item_id, i.item_name, i.size, i.weight
       FROM public.order_items oi
       JOIN public.items i ON oi.item_id = i.id
       WHERE oi.order_id = $1`,
      [orderId]
    );
    const orderItems = itemsResult.rows;

    // 3. Calculate stock adjustments and prepare for update
    const stockAdjustments = {}; // { item_id: adjustment_amount }

    // First, add back the old quantities to stock (reverse the previous dispatch)
    for (const log of existingLogs) {
      const itemId = log.item_id;
      const oldQuantity = log.quantity_sent;
      stockAdjustments[itemId] = (stockAdjustments[itemId] || 0) + oldQuantity;
    }

    // Then, subtract the new quantities from stock
    for (const item of items) {
      const { quantity_sent } = item;
      const qtyToSend = parseInt(quantity_sent) || 0;
      
      // Match items by name and size to get order item
      let matchedOrderItem = null;
      for (const orderItem of orderItems) {
        if ((orderItem.item_name + '|' + (orderItem.size || '')) === (item.item_name + '|' + (item.size || ''))) {
          matchedOrderItem = orderItem;
          break;
        }
      }

      if (matchedOrderItem) {
        const itemId = matchedOrderItem.item_id;
        stockAdjustments[itemId] = (stockAdjustments[itemId] || 0) - qtyToSend;
      }
    }

    // 4. Update stock for all affected items
    for (const itemId of Object.keys(stockAdjustments)) {
      const adjustment = stockAdjustments[itemId];
      await client.query(
        `UPDATE public.items SET current_stock = current_stock + $1 WHERE id = $2`,
        [adjustment, parseInt(itemId)]
      );
    }

    // 5. Delete existing dispatch logs for this challan
    await client.query(
      `DELETE FROM public.dispatch_logs 
       WHERE challan_no = $1`,
      [challanNo]
    );

    // 6. Insert new dispatch logs with the updated quantities and the *new* challan number
    const orderItemDispatchedQty = {}; // Track dispatched quantities per order_item_id
    
    for (const item of items) {
      const { quantity_sent } = item;
      
      // Match items by order
      let matchedOrderItem = null;
      for (const orderItem of orderItems) {
        if ((orderItem.item_name + '|' + (orderItem.size || '')) === (item.item_name + '|' + (item.size || ''))) {
          matchedOrderItem = orderItem;
          break;
        }
      }

      if (matchedOrderItem) {
        const qtyToSend = parseInt(quantity_sent) || 0;
        const unitWeight = parseFloat(matchedOrderItem.weight) || 0;
        const totalWeight = unitWeight * qtyToSend;

        await client.query(
          `INSERT INTO public.dispatch_logs (order_item_id, quantity_sent, total_weight, challan_no, dispatch_date)
           VALUES ($1, $2, $3, $4, $5)`,
          [matchedOrderItem.id, qtyToSend, totalWeight, challan_no, dispatch_date]
        );
        
        // Track the quantity for this order item
        orderItemDispatchedQty[matchedOrderItem.id] = qtyToSend;
      }
    }

    // 7. Recalculate and update dispatched_quantity for all affected order_items
    // Get all order_item_ids that were affected (from old logs)
    const affectedOrderItemIds = new Set();
    for (const log of existingLogs) {
      affectedOrderItemIds.add(log.order_item_id);
    }
    // Also include the newly added ones
    for (const orderItemId of Object.keys(orderItemDispatchedQty)) {
      affectedOrderItemIds.add(parseInt(orderItemId));
    }

    // For each affected order item, recalculate total dispatched_quantity from ALL its dispatch logs
    for (const orderItemId of affectedOrderItemIds) {
      const result = await client.query(
        `SELECT COALESCE(SUM(quantity_sent), 0) as total_dispatched
         FROM public.dispatch_logs
         WHERE order_item_id = $1`,
        [orderItemId]
      );
      const totalDispatched = parseInt(result.rows[0].total_dispatched) || 0;
      
      await client.query(
        `UPDATE public.order_items 
         SET dispatched_quantity = $1 
         WHERE id = $2`,
        [totalDispatched, orderItemId]
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

export const deleteOrder = async (orderId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Delete all dispatch logs for this order's items
    await client.query(
      `DELETE FROM public.dispatch_logs 
       WHERE order_item_id IN (SELECT id FROM public.order_items WHERE order_id = $1)`,
      [orderId]
    );

    // 2. Delete all order items
    await client.query(
      `DELETE FROM public.order_items WHERE order_id = $1`,
      [orderId]
    );

    // 3. Delete the order
    await client.query(
      `DELETE FROM public.orders WHERE id = $1`,
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

export const deleteDispatchEntry = async (orderId, challanNo) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get all dispatch logs for this challan to restore stock
    const dispatchLogsResult = await client.query(
      `SELECT dl.id, dl.order_item_id, dl.quantity_sent 
       FROM public.dispatch_logs dl
       WHERE dl.challan_no = $1`,
      [challanNo]
    );

    // 2. For each dispatch, restore the stock and update dispatched_quantity
    for (const log of dispatchLogsResult.rows) {
      const orderItemResult = await client.query(
        `SELECT item_id, dispatched_quantity FROM public.order_items WHERE id = $1`,
        [log.order_item_id]
      );

      if (orderItemResult.rows.length > 0) {
        const { item_id, dispatched_quantity } = orderItemResult.rows[0];
        const newDispatchedQty = Math.max(0, (dispatched_quantity || 0) - log.quantity_sent);

        // Update order_items to reflect the reduced dispatched quantity
        await client.query(
          `UPDATE public.order_items SET dispatched_quantity = $1 WHERE id = $2`,
          [newDispatchedQty, log.order_item_id]
        );

        // Restore stock in items table
        await client.query(
          `UPDATE public.items SET current_stock = current_stock + $1 WHERE id = $2`,
          [log.quantity_sent, item_id]
        );
      }
    }

    // 3. Delete all dispatch logs for this challan
    await client.query(
      `DELETE FROM public.dispatch_logs WHERE challan_no = $1`,
      [challanNo]
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