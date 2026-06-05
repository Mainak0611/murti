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

export const getBranchDispatches = async (req, res) => {
  const branchId = req.user.branch_id;
  try {
    const dispatches = await orderSql.findDispatchesByBranchId(branchId);
    return res.status(200).json({ data: dispatches });
  } catch (err) {
    console.error('getBranchDispatches error:', err);
    return res.status(500).json({ error: 'Server error fetching branch dispatches' });
  }
};

export const createEstimate = async (req, res) => {
  const userId = req.user.id;
  const branchId = req.user.branch_id;
  const { party_name, party_id, challan_no, estimate_date, items } = req.body;

  if (!party_name || !challan_no || !estimate_date || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid estimate data. Party name, challan number, date, and items are required.' });
  }

  try {
    const isUnique = await orderSql.checkChallanUnique(branchId, challan_no);
    if (!isUnique) {
      return res.status(400).json({ error: `Challan number "${challan_no}" is already in use, enter different challan.` });
    }

    const estimateId = await orderSql.createEstimate(userId, branchId, {
      party_name,
      party_id,
      challan_no,
      estimate_date,
      items
    });

    const createdEstimate = await orderSql.findEstimateById(estimateId);
    return res.status(201).json({
      message: 'Estimate created successfully',
      data: createdEstimate
    });
  } catch (err) {
    console.error('createEstimate error:', err);
    return res.status(500).json({ error: 'Server error creating estimate' });
  }
};

export const getEstimates = async (req, res) => {
  const branchId = req.user.branch_id;
  try {
    const estimates = await orderSql.findEstimatesByBranch(branchId);
    return res.status(200).json({ data: estimates });
  } catch (err) {
    console.error('getEstimates error:', err);
    return res.status(500).json({ error: 'Server error fetching estimates' });
  }
};

export const checkChallanNo = async (req, res) => {
  const branchId = req.user.branch_id;
  const { challan_no } = req.params;
  const { excludeEstimateId } = req.query;

  try {
    const isUnique = await orderSql.checkChallanUnique(branchId, challan_no, excludeEstimateId);
    return res.status(200).json({ available: isUnique });
  } catch (err) {
    console.error('checkChallanNo error:', err);
    return res.status(500).json({ error: 'Server error checking challan number availability' });
  }
};

export const getEstimateByChallanNo = async (req, res) => {
  const branchId = req.user.branch_id;
  const { challan_no } = req.params;

  try {
    const estimate = await orderSql.findEstimateByChallanNo(branchId, challan_no);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found with this challan number.' });
    }
    return res.status(200).json({ data: estimate });
  } catch (err) {
    console.error('getEstimateByChallanNo error:', err);
    return res.status(500).json({ error: 'Server error fetching estimate by challan number' });
  }
};

export const getEstimateById = async (req, res) => {
  const branchId = req.user.branch_id;
  const { id } = req.params;

  try {
    const estimate = await orderSql.findEstimateById(id);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found.' });
    }
    return res.status(200).json({ data: estimate });
  } catch (err) {
    console.error('getEstimateById error:', err);
    return res.status(500).json({ error: 'Server error fetching estimate' });
  }
};

export const updateEstimate = async (req, res) => {
  const branchId = req.user.branch_id;
  const { id } = req.params;
  const { party_name, party_id, challan_no, estimate_date, items } = req.body;

  if (!party_name || !challan_no || !estimate_date || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid estimate data. Party name, challan number, date, and items are required.' });
  }

  try {
    const estimate = await orderSql.findEstimateById(id);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    const isUnique = await orderSql.checkChallanUnique(branchId, challan_no, id);
    if (!isUnique) {
      return res.status(400).json({ error: `Challan number "${challan_no}" is already in use in this branch.` });
    }

    await orderSql.updateEstimate(id, { party_name, party_id, challan_no, estimate_date, items });
    const updatedEstimate = await orderSql.findEstimateById(id);
    return res.status(200).json({
      message: 'Estimate updated successfully',
      data: updatedEstimate
    });
  } catch (err) {
    console.error('updateEstimate error:', err);
    return res.status(500).json({ error: 'Server error updating estimate' });
  }
};

export const deleteEstimate = async (req, res) => {
  const { id } = req.params;
  try {
    const estimate = await orderSql.findEstimateById(id);
    if (!estimate) {
      return res.status(404).json({ error: 'Estimate not found' });
    }
    await orderSql.deleteEstimate(id);
    return res.status(200).json({ message: 'Estimate deleted successfully' });
  } catch (err) {
    console.error('deleteEstimate error:', err);
    return res.status(500).json({ error: 'Server error deleting estimate' });
  }
};

