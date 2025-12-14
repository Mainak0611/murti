// backend/src/modules/itemMaster/itemMasterService.js
import * as itemSql from './itemMasterSql.js';

export const createItem = async (req, res) => {
  const userId = req.user && req.user.id;
  // Added current_stock to destructuring
  const { item_name, size, hsn_code, weight, price, minimum_stock, current_stock, remarks } = req.body;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!item_name) return res.status(400).json({ error: 'item_name is required' });

  try {
    const created = await itemSql.createItem({
      user_id: userId,
      item_name,
      size,
      hsn_code,
      weight,
      price,
      minimum_stock,
      current_stock, // Pass to SQL
      remarks,
    });
    return res.status(201).json({ message: 'Item created', data: created });
  } catch (err) {
    console.error('createItem error:', err);
    return res.status(500).json({ error: 'Server error creating item' });
  }
};

// Get all items for the authenticated user (protected)
export const getMyItems = async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const rows = await itemSql.findItemsByUserId(userId);
    return res.status(200).json({ data: rows });
  } catch (err) {
    console.error('getMyItems error:', err);
    return res.status(500).json({ error: 'Server error fetching items' });
  }
};

// Get a single item by id
export const getItemById = async (req, res) => {
  const userId = req.user && req.user.id;
  const { id } = req.params;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const item = await itemSql.findItemById(id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    
    if (String(item.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.status(200).json({ data: item });
  } catch (err) {
    console.error('getItemById error:', err);
    return res.status(500).json({ error: 'Server error fetching item' });
  }
};

// Update an item (protected)
export const updateItem = async (req, res) => {
  const userId = req.user && req.user.id;
  const { id } = req.params;
  
  // Added current_stock to destructuring
  const { item_name, size, hsn_code, weight, price, minimum_stock, current_stock, remarks } = req.body;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const existing = await itemSql.findItemById(id);
    if (!existing) return res.status(404).json({ error: 'Item not found' });
    
    if (String(existing.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await itemSql.updateItemById(id, { 
      item_name, 
      size, 
      hsn_code, 
      weight, 
      price, 
      minimum_stock, 
      current_stock, // Pass to SQL
      remarks 
    });
    return res.status(200).json({ message: 'Item updated', data: updated });
  } catch (err) {
    console.error('updateItem error:', err);
    return res.status(500).json({ error: 'Server error updating item' });
  }
};

// Delete an item (protected)
export const deleteItem = async (req, res) => {
  const userId = req.user && req.user.id;
  const { id } = req.params;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const existing = await itemSql.findItemById(id);
    if (!existing) return res.status(404).json({ error: 'Item not found' });
    
    if (String(existing.user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await itemSql.deleteItemById(id);
    return res.status(200).json({ message: 'Item deleted' });
  } catch (err) {
    console.error('deleteItem error:', err);
    return res.status(500).json({ error: 'Server error deleting item' });
  }
};