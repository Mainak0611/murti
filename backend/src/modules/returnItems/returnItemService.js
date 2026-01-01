import * as returnSql from './returnItemSql.js';

export const getReturns = async (req, res) => {
  const branchId = req.user.branch_id; // <--- FILTER BY BRANCH
  try {
    // SQL must query WHERE branch_id = $1
    const returns = await returnSql.getAllReturnsByBranch(branchId);
    res.json({ data: returns });
  } catch (err) {
    console.error("Error fetching returns:", err);
    res.status(500).json({ error: 'Failed to fetch return logs' });
  }
};

export const addReturn = async (req, res) => {
  const userId = req.user.id;
  const branchId = req.user.branch_id; // <--- BRANCH ID
  const { party_name, return_date, order_id, challan_number, items } = req.body;

  if (!party_name || !return_date || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required fields or items list' });
  }

  try {
    // Verify items belong to this branch
    for (const item of items) {
        if (!item.item_id || !item.quantity) continue;
        
        const owner = await returnSql.findItemOwner(item.item_id);
        if (!owner || String(owner.branch_id) !== String(branchId)) {
            return res.status(403).json({ 
                error: `Unauthorized: Item ID ${item.item_id} does not belong to your branch` 
            });
        }
    }

    await returnSql.createBatchReturnEntry({
        userId,
        branchId, // Pass to SQL
        party_name,
        return_date,
        order_id: order_id || null, // <--- PASS ORDER ID (can be null)
        challan_number: challan_number || null, // <--- PASS CHALLAN NUMBER
        items
    });

    res.status(201).json({ message: 'Returns logged and stock updated successfully' });
  } catch (err) {
    console.error("Error logging return:", err);
    res.status(500).json({ error: 'Failed to log returns' });
  }
};

export const updateReturn = async (req, res) => {
  const branchId = req.user.branch_id;
  const { id } = req.params;
  const { quantity, remark, quantityDiff, challan_number } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Return ID is required' });
  }

  try {
    // Get the return entry
    const returnEntry = await returnSql.getReturnById(id);
    
    if (!returnEntry) {
      return res.status(404).json({ error: 'Return entry not found' });
    }

    // Verify ownership
    if (String(returnEntry.branch_id) !== String(branchId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Update return entry
    if (challan_number !== undefined) {
      // Updating challan number only
      await returnSql.updateReturnChallan(id, challan_number);
    } else {
      // Update return and adjust stock if quantity changed
      await returnSql.updateReturnEntry(id, quantity, remark, quantityDiff);
    }

    res.json({ message: 'Return entry updated successfully' });
  } catch (err) {
    console.error('Error updating return:', err);
    res.status(500).json({ error: 'Failed to update return entry' });
  }
};

export const deleteReturn = async (req, res) => {
  const branchId = req.user.branch_id;
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Return ID is required' });
  }

  try {
    // Get the return entry to verify ownership and get item details
    const returnEntry = await returnSql.getReturnById(id);
    
    if (!returnEntry) {
      return res.status(404).json({ error: 'Return entry not found' });
    }

    // Verify the return belongs to user's branch
    if (String(returnEntry.branch_id) !== String(branchId)) {
      return res.status(403).json({ error: 'Unauthorized: This return does not belong to your branch' });
    }

    // Delete the return and restore stock
    await returnSql.deleteReturnEntry(id, returnEntry.item_id, returnEntry.quantity);

    res.json({ message: 'Return entry deleted and stock restored successfully' });
  } catch (err) {
    console.error("Error deleting return:", err);
    res.status(500).json({ error: 'Failed to delete return entry' });
  }
};