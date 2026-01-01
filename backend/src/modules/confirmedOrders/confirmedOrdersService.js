import * as orderSql from './confirmedOrdersSql.js'; // Ensure this points to your SQL file

export const createOrderDirectly = async (req, res) => {
  const userId = req.user.id;
  const branchId = req.user.branch_id;
  const { party_name, contact_no, reference, remark, order_date, items } = req.body;

  // Validation
  if (!party_name || !order_date || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid order data. Party name, date, and items are required.' });
  }

  try {
    const orderId = await orderSql.createOrderDirectly(userId, branchId, {
      party_name,
      contact_no,
      reference,
      remark,
      order_date,
      items
    });

    const createdOrder = await orderSql.findOrderById(orderId);
    return res.status(201).json({ 
      message: 'Order created successfully', 
      data: createdOrder 
    });
  } catch (err) {
    console.error('createOrderDirectly error:', err);
    return res.status(500).json({ error: 'Server error creating order' });
  }
};

export const getMyOrders = async (req, res) => {
  const userId = req.user.id;
  const branchId = req.user.branch_id; // Check Branch ID

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Fetch orders filtered by the user's branch
    const rows = await orderSql.findOrdersByBranchId(branchId);
    return res.status(200).json({ data: rows });
  } catch (err) {
    console.error('getMyOrders error:', err);
    return res.status(500).json({ error: 'Server error fetching orders' });
  }
};

export const getOrdersByParty = async (req, res) => {
  const branchId = req.user.branch_id;
  const { partyName } = req.query;

  if (!partyName) {
    return res.status(400).json({ error: 'Party name is required' });
  }

  try {
    console.log(`Fetching orders for party: "${partyName}" and branch: ${branchId}`);
    const orders = await orderSql.findOrdersByPartyAndBranch(branchId, partyName);
    console.log(`Found ${orders.length} orders for party: "${partyName}"`);
    return res.status(200).json({ data: orders });
  } catch (err) {
    console.error('getOrdersByParty error:', err.message);
    console.error('Full error:', err);
    return res.status(500).json({ error: 'Server error fetching party orders', details: err.message });
  }
};

export const getOrderById = async (req, res) => {
  const branchId = req.user.branch_id;
  const { id } = req.params;

  try {
    const order = await orderSql.findOrderById(id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Strict Security Check: Ensure order belongs to the user's branch
    if (String(order.branch_id) !== String(branchId)) {
      return res.status(403).json({ error: 'Forbidden: Access denied to other branch data' });
    }

    return res.status(200).json({ data: order });
  } catch (err) {
    console.error('getOrderById error:', err);
    return res.status(500).json({ error: 'Server error fetching order details' });
  }
};

export const updateDispatch = async (req, res) => {
  const branchId = req.user.branch_id;
  const { id } = req.params;
  const { dispatch_date, challan_no, items } = req.body; // Added challan_no

  // Basic Validation
  if (!dispatch_date || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid dispatch data. Date and items are required.' });
  }

  try {
    // 1. Fetch Order to verify ownership
    const order = await orderSql.findOrderById(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // 2. Ownership Check
    if (String(order.branch_id) !== String(branchId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 3. Process the Dispatch via SQL Transaction
    await orderSql.updateDispatchQuantities(id, { dispatch_date, challan_no, items });

    // 4. Return success (and maybe the updated order to refresh UI)
    const updatedOrder = await orderSql.findOrderById(id);
    return res.status(200).json({ 
      message: 'Dispatch updated successfully', 
      data: updatedOrder 
    });

  } catch (err) {
    console.error('updateDispatch error:', err);
    return res.status(500).json({ error: 'Server error updating dispatch' });
  }
};

export const updateOrder = async (req, res) => {
  const branchId = req.user.branch_id;
  const { id } = req.params;
  const { party_name, order_date, reference, contact_no, remark, items } = req.body;

  // Validation
  if (!party_name || !order_date || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid order data. Party name, date, and items are required.' });
  }

  try {
    // 1. Fetch Order to verify ownership
    const order = await orderSql.findOrderById(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // 2. Ownership Check
    if (String(order.branch_id) !== String(branchId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 3. Update the order
    await orderSql.updateOrder(id, { party_name, order_date, reference, contact_no, remark, items });

    // 4. Return success
    const updatedOrder = await orderSql.findOrderById(id);
    return res.status(200).json({ 
      message: 'Order updated successfully', 
      data: updatedOrder 
    });

  } catch (err) {
    console.error('updateOrder error:', err);
    return res.status(500).json({ error: 'Server error updating order' });
  }
};

export const updateDispatchEntry = async (req, res) => {
  const branchId = req.user.branch_id;
  const { id, challan_no } = req.params;
  const { dispatch_date, challan_no: newChallanNo, items } = req.body;

  if (!dispatch_date || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Invalid dispatch data' });
  }

  try {
    // 1. Verify order belongs to user's branch
    const order = await orderSql.findOrderById(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (String(order.branch_id) !== String(branchId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 2. Update dispatch entry (pass both old and new challan_no)
    await orderSql.updateDispatchEntry(id, challan_no, { dispatch_date, challan_no: newChallanNo, items });

    // 3. Return updated order
    const updatedOrder = await orderSql.findOrderById(id);
    return res.status(200).json({ 
      message: 'Dispatch entry updated successfully', 
      data: updatedOrder 
    });

  } catch (err) {
    console.error('updateDispatchEntry error:', err);
    return res.status(500).json({ error: 'Server error updating dispatch entry' });
  }
};

export const deleteOrder = async (req, res) => {
  const branchId = req.user.branch_id;
  const { id } = req.params;

  try {
    // 1. Verify order belongs to user's branch
    const order = await orderSql.findOrderById(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (String(order.branch_id) !== String(branchId)) {
      return res.status(403).json({ error: 'Forbidden: Cannot delete order from another branch' });
    }

    // 2. Delete the order
    await orderSql.deleteOrder(id);

    return res.status(200).json({ 
      message: 'Order deleted successfully' 
    });

  } catch (err) {
    console.error('deleteOrder error:', err);
    return res.status(500).json({ error: 'Server error deleting order' });
  }
};

export const deleteDispatchEntry = async (req, res) => {
  const branchId = req.user.branch_id;
  const { id, challan_no } = req.params;

  try {
    // 1. Verify order belongs to user's branch
    const order = await orderSql.findOrderById(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (String(order.branch_id) !== String(branchId)) {
      return res.status(403).json({ error: 'Forbidden: Cannot delete dispatch from another branch' });
    }

    // 2. Delete the dispatch entry
    await orderSql.deleteDispatchEntry(id, challan_no);

    // 3. Return updated order
    const updatedOrder = await orderSql.findOrderById(id);
    return res.status(200).json({ 
      message: 'Dispatch entry deleted successfully', 
      data: updatedOrder 
    });

  } catch (err) {
    console.error('deleteDispatchEntry error:', err);
    return res.status(500).json({ error: 'Server error deleting dispatch entry' });
  }
};

