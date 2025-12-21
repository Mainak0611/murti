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
  const { party_name, return_date, items } = req.body;

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
        items
    });

    res.status(201).json({ message: 'Returns logged and stock updated successfully' });
  } catch (err) {
    console.error("Error logging return:", err);
    res.status(500).json({ error: 'Failed to log returns' });
  }
};