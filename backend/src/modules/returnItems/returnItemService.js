// backend/src/modules/returns/returnItemService.js
import * as returnSql from './returnItemSql.js';

export const getReturns = async (req, res) => {
  const userId = req.user && req.user.id; 
  try {
    const returns = await returnSql.getAllReturns(userId);
    res.json({ data: returns });
  } catch (err) {
    console.error("Error fetching returns:", err);
    res.status(500).json({ error: 'Failed to fetch return logs' });
  }
};

export const addReturn = async (req, res) => {
  const userId = req.user && req.user.id;
  
  // New Payload Structure: { party_name, return_date, items: [{ item_id, quantity, remark }] }
  const { party_name, return_date, items } = req.body;

  if (!party_name || !return_date || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields or items list' });
  }

  try {
    // 1. Verify ownership for ALL items before processing ANY
    for (const item of items) {
        if (!item.item_id || !item.quantity) continue;
        
        const owner = await returnSql.findItemOwner(item.item_id);
        if (!owner || String(owner.user_id) !== String(userId)) {
            return res.status(403).json({ 
                error: `Unauthorized: Item ID ${item.item_id} does not belong to you` 
            });
        }
    }

    // 2. Process Batch in SQL
    await returnSql.createBatchReturnEntry({
        party_name,
        return_date,
        items
    });

    res.status(201).json({ message: 'Returns logged and stock updated successfully' });
  } catch (err) {
    console.error("Error logging return:", err);
    res.status(500).json({ error: 'Failed to log returns' });
  }
};