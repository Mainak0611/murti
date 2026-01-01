import * as itemSql from './itemMasterSql.js';

// ... [createItem, getMyItems, getItemById remain unchanged] ...
export const createItem = async (req, res) => {
  const userId = req.user.id;
  const branchId = req.user.branch_id;
  const { item_name, size, hsn_code, weight, price, minimum_stock, current_stock, remarks } = req.body;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!item_name) return res.status(400).json({ error: 'item_name is required' });

  try {
    const created = await itemSql.createItem({
      user_id: userId,
      branch_id: branchId,
      item_name, size, hsn_code, weight, price, minimum_stock, current_stock, remarks,
    });
    
    // Optional: Log the initial creation
    await itemSql.createStockLog({
        item_id: created.id,
        branch_id: branchId,
        user_id: userId,
        previous_stock: 0,
        change_qty: current_stock || 0,
        new_stock: current_stock || 0,
        transaction_type: 'initial_creation',
        remarks: 'Item Created'
    });

    return res.status(201).json({ message: 'Item created', data: created });
  } catch (err) {
    console.error('createItem error:', err);
    return res.status(500).json({ error: 'Server error creating item' });
  }
};

export const getMyItems = async (req, res) => {
  const userId = req.user.id;
  const branchId = req.user.branch_id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const rows = await itemSql.findItemsByBranchId(branchId); 
    return res.status(200).json({ data: rows });
  } catch (err) {
    console.error('getMyItems error:', err);
    return res.status(500).json({ error: 'Server error fetching items' });
  }
};

export const getItemById = async (req, res) => {
  const branchId = req.user.branch_id;
  const { id } = req.params;

  try {
    const item = await itemSql.findItemById(id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (String(item.branch_id) !== String(branchId)) return res.status(403).json({ error: 'Forbidden' });

    return res.status(200).json({ data: item });
  } catch (err) {
    console.error('getItemById error:', err);
    return res.status(500).json({ error: 'Server error fetching item' });
  }
};

export const updateItem = async (req, res) => {
  const branchId = req.user.branch_id;
  const userId = req.user.id;
  const { id } = req.params;
  const { item_name, size, hsn_code, weight, price, minimum_stock, current_stock, remarks } = req.body;

  try {
    const existing = await itemSql.findItemById(id);
    if (!existing) return res.status(404).json({ error: 'Item not found' });
    if (String(existing.branch_id) !== String(branchId)) return res.status(403).json({ error: 'Forbidden' });

    // Check for Manual Stock Override from Edit Form
    const oldStock = parseInt(existing.current_stock || 0);
    const newStockVal = current_stock !== undefined ? parseInt(current_stock) : oldStock;

    const updated = await itemSql.updateItemById(id, { 
      item_name, size, hsn_code, weight, price, minimum_stock, current_stock, remarks 
    });

    // Log manual update if stock changed via Edit Form
    if (newStockVal !== oldStock) {
        await itemSql.createStockLog({
            item_id: id,
            branch_id: branchId,
            user_id: userId,
            previous_stock: oldStock,
            change_qty: newStockVal - oldStock,
            new_stock: newStockVal,
            transaction_type: 'manual_update',
            remarks: 'Updated via Edit Form'
        });
    }

    return res.status(200).json({ message: 'Item updated', data: updated });
  } catch (err) {
    console.error('updateItem error:', err);
    return res.status(500).json({ error: 'Server error updating item' });
  }
};

export const deleteItem = async (req, res) => {
  const branchId = req.user.branch_id;
  const { id } = req.params;

  try {
    const existing = await itemSql.findItemById(id);
    if (!existing) return res.status(404).json({ error: 'Item not found' });
    if (String(existing.branch_id) !== String(branchId)) return res.status(403).json({ error: 'Forbidden' });

    await itemSql.deleteItemById(id);
    return res.status(200).json({ message: 'Item deleted' });
  } catch (err) {
    console.error('deleteItem error:', err);
    return res.status(500).json({ error: 'Server error deleting item' });
  }
};

// =========================================================
// NEW FUNCTIONS: Add Stock, Report Loss, Get Logs
// =========================================================

export const addStock = async (req, res) => {
    const branchId = req.user.branch_id;
    const userId = req.user.id;
    const { id } = req.params;
    const { qty } = req.body; // Frontend sends { qty: 10 }

    if (!qty || isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Invalid quantity' });

    try {
        const item = await itemSql.findItemById(id);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        if (String(item.branch_id) !== String(branchId)) return res.status(403).json({ error: 'Forbidden' });

        const oldStock = parseInt(item.current_stock || 0);
        const addAmount = parseInt(qty);
        const newStock = oldStock + addAmount;

        // 1. Update Master Table
        await itemSql.updateItemStock(id, newStock);

        // 2. Create Log
        await itemSql.createStockLog({
            item_id: id,
            branch_id: branchId,
            user_id: userId,
            previous_stock: oldStock,
            change_qty: addAmount,
            new_stock: newStock,
            transaction_type: 'add_stock',
            remarks: 'Stock Added'
        });

        return res.status(200).json({ message: 'Stock added successfully', new_stock: newStock });
    } catch (err) {
        console.error('addStock error:', err);
        return res.status(500).json({ error: 'Server error adding stock' });
    }
};

export const reportLoss = async (req, res) => {
    const branchId = req.user.branch_id;
    const userId = req.user.id;
    const { id } = req.params;
    const { qty, reason } = req.body; 

    if (!qty || isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Invalid quantity' });
    
    // --- CHANGE: Removed "if (!reason)" check ---
    
    try {
        const item = await itemSql.findItemById(id);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        if (String(item.branch_id) !== String(branchId)) return res.status(403).json({ error: 'Forbidden' });

        const oldStock = parseInt(item.current_stock || 0);
        const lossAmount = parseInt(qty);
        const newStock = oldStock - lossAmount;

        await itemSql.updateItemStock(id, newStock);

        await itemSql.createStockLog({
            item_id: id,
            branch_id: branchId,
            user_id: userId,
            previous_stock: oldStock,
            change_qty: -lossAmount, 
            new_stock: newStock,
            transaction_type: 'loss',
            remarks: reason || null // Allow null
        });

        return res.status(200).json({ message: 'Loss reported successfully', new_stock: newStock });
    } catch (err) {
        console.error('reportLoss error:', err);
        return res.status(500).json({ error: 'Server error reporting loss' });
    }
};

export const getItemLogs = async (req, res) => {
    const branchId = req.user.branch_id;
    const { id } = req.params;

    try {
        const item = await itemSql.findItemById(id);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        if (String(item.branch_id) !== String(branchId)) return res.status(403).json({ error: 'Forbidden' });

        const logs = await itemSql.findLogsByItemId(id);
        return res.status(200).json({ data: logs });
    } catch (err) {
        console.error('getItemLogs error:', err);
        return res.status(500).json({ error: 'Server error fetching logs' });
    }
};