import * as orderSql from './confirmedOrdersSql.js'; // Ensure this points to your SQL file

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
  const { dispatch_date, items } = req.body; // Expecting { dispatch_date, items: [{id, quantity_sent}] }

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
    await orderSql.updateDispatchQuantities(id, { dispatch_date, items });

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