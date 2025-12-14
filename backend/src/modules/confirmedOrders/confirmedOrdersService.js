import * as ordersSql from './confirmedOrdersSql.js';

export const getMyOrders = async (req, res) => {
  const userId = req.user && req.user.id;
  try {
    const orders = await ordersSql.findOrdersByUserId(userId);
    res.json({ data: orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

export const getOrderById = async (req, res) => {
  const userId = req.user && req.user.id;
  const { id } = req.params;
  try {
    const order = await ordersSql.findOrderById(id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (String(order.user_id) !== String(userId)) return res.status(403).json({ error: 'Forbidden' });
    
    res.json({ data: order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch order details' });
  }
};

export const updateDispatch = async (req, res) => {
  const userId = req.user && req.user.id;
  const { id } = req.params;
  
  // 1. EXTRACT both items AND dispatch_date from the request body
  const { items, dispatch_date } = req.body; 

  try {
    const order = await ordersSql.findOrderById(id);
    
    // Check if order exists and belongs to user
    if (!order || String(order.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // 2. PASS them as a single object to the SQL function
    await ordersSql.updateDispatchQuantities(id, { 
      dispatch_date, 
      items 
    });

    res.json({ message: 'Dispatch updated successfully' });
  } catch (err) {
    console.error("Dispatch Error:", err);
    res.status(500).json({ error: 'Failed to update dispatch' });
  }
};