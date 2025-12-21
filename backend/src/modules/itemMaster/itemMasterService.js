import * as itemSql from './itemMasterSql.js';

export const createItem = async (req, res) => {
  const userId = req.user.id;
  const branchId = req.user.branch_id; // <--- ADDED BRANCH ID
  
  const { item_name, size, hsn_code, weight, price, minimum_stock, current_stock, remarks } = req.body;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!item_name) return res.status(400).json({ error: 'item_name is required' });

  try {
    const created = await itemSql.createItem({
      user_id: userId,
      branch_id: branchId, // Pass to SQL
      item_name,
      size,
      hsn_code,
      weight,
      price,
      minimum_stock,
      current_stock,
      remarks,
    });
    return res.status(201).json({ message: 'Item created', data: created });
  } catch (err) {
    console.error('createItem error:', err);
    return res.status(500).json({ error: 'Server error creating item' });
  }
};

export const getMyItems = async (req, res) => {
  const userId = req.user.id;
  const branchId = req.user.branch_id; // <--- ADDED BRANCH ID

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Pass branchId to SQL to filter items by branch
    const rows = await itemSql.findItemsByBranchId(branchId); 
    return res.status(200).json({ data: rows });
  } catch (err) {
    console.error('getMyItems error:', err);
    return res.status(500).json({ error: 'Server error fetching items' });
  }
};

export const getItemById = async (req, res) => {
  const branchId = req.user.branch_id; // <--- CHECK BRANCH ID
  const { id } = req.params;

  try {
    const item = await itemSql.findItemById(id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    
    // Strict Check: Item must belong to user's branch
    if (String(item.branch_id) !== String(branchId)) {
      return res.status(403).json({ error: 'Forbidden: Access denied to other branch data' });
    }

    return res.status(200).json({ data: item });
  } catch (err) {
    console.error('getItemById error:', err);
    return res.status(500).json({ error: 'Server error fetching item' });
  }
};

export const updateItem = async (req, res) => {
  const branchId = req.user.branch_id;
  const { id } = req.params;
  const { item_name, size, hsn_code, weight, price, minimum_stock, current_stock, remarks } = req.body;

  try {
    const existing = await itemSql.findItemById(id);
    if (!existing) return res.status(404).json({ error: 'Item not found' });
    
    if (String(existing.branch_id) !== String(branchId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await itemSql.updateItemById(id, { 
      item_name, size, hsn_code, weight, price, minimum_stock, current_stock, remarks 
    });
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
    
    if (String(existing.branch_id) !== String(branchId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await itemSql.deleteItemById(id);
    return res.status(200).json({ message: 'Item deleted' });
  } catch (err) {
    console.error('deleteItem error:', err);
    return res.status(500).json({ error: 'Server error deleting item' });
  }
};