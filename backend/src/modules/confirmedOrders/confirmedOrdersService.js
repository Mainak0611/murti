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
  const { items } = req.body; // Array of { id, dispatched_quantity }

  try {
    const order = await ordersSql.findOrderById(id);
    if (!order || String(order.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await ordersSql.updateDispatchQuantities(id, items);
    res.json({ message: 'Dispatch updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update dispatch' });
  }
};