import pool from '../../config/db.js';

// --- READ OPERATIONS ---

export const findPartyEnquiryById = async (id) => {
  const sqlEnquiry = `SELECT * FROM public.party_enquiries WHERE id = $1`;
  const { rows: enquiryRows } = await pool.query(sqlEnquiry, [id]);
  const enquiry = enquiryRows[0];

  if (!enquiry) return null;

  // UPDATED: Now selecting 'total_weight'
  const sqlItems = `
    SELECT 
      pei.id as link_id,
      pei.item_id, 
      pei.quantity, 
      pei.total_weight,
      i.item_name, 
      i.size,
      i.weight,
      i.price
    FROM public.party_enquiry_items pei
    JOIN public.items i ON pei.item_id = i.id
    WHERE pei.party_enquiry_id = $1
    ORDER BY pei.id ASC
  `;
  const { rows: itemRows } = await pool.query(sqlItems, [id]);

  enquiry.items = itemRows;
  return enquiry;
};

export const findPartyEnquiriesByBranchId = async (branchId) => {
  const sql = `
    SELECT * FROM public.party_enquiries
    WHERE branch_id = $1
    ORDER BY enquiry_date DESC, created_at DESC
  `;
  const { rows } = await pool.query(sql, [branchId]);
  return rows;
};

// --- HELPER: Fetch Weights for Items ---
const fetchItemWeights = async (client, items) => {
  if (!items || items.length === 0) return {};
  
  const itemIds = items.map(i => i.item_id).filter(id => id);
  if (itemIds.length === 0) return {};

  const { rows } = await client.query(
    `SELECT id, weight FROM public.items WHERE id = ANY($1)`,
    [itemIds]
  );

  const map = {};
  rows.forEach(r => {
    map[r.id] = r.weight;
  });
  return map;
};

// --- WRITE OPERATIONS (TRANSACTIONAL) ---

export const createPartyEnquiry = async ({ user_id, branch_id, party_name, contact_no, reference, remark, enquiry_date, items }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Insert Enquiry
    const insertEnquirySql = `
      INSERT INTO public.party_enquiries
        (user_id, branch_id, party_name, contact_no, reference, remark, enquiry_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const params = [user_id, branch_id, party_name, contact_no || null, reference || null, remark || null, enquiry_date || null];
    const { rows } = await client.query(insertEnquirySql, params);
    const newEnquiry = rows[0];

    // 2. Process Items (Calculate Weight & Insert)
    if (items && Array.isArray(items) && items.length > 0) {
      
      // Fetch weights for all items in this request
      const weightMap = await fetchItemWeights(client, items);

      for (const item of items) {
        if (!item.item_id || !item.quantity) continue;

        // Calculate Total Weight
        const rawWeight = weightMap[item.item_id];
        const unitWeight = parseFloat(rawWeight) || 0; // Handle "4.5kg" -> 4.5
        const totalWeight = unitWeight * parseFloat(item.quantity);

        const insertItemSql = `
          INSERT INTO public.party_enquiry_items (party_enquiry_id, item_id, quantity, total_weight)
          VALUES ($1, $2, $3, $4)
        `;
        // Pass totalWeight to DB
        await client.query(insertItemSql, [newEnquiry.id, item.item_id, item.quantity, totalWeight]);
      }
    }

    await client.query('COMMIT');
    return newEnquiry;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const updatePartyEnquiryById = async (id, { party_name, contact_no, reference, remark, enquiry_date, items }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const updateSql = `
      UPDATE public.party_enquiries
      SET party_name = COALESCE($2, party_name),
          contact_no = COALESCE($3, contact_no),
          reference = COALESCE($4, reference),
          remark = COALESCE($5, remark),
          enquiry_date = COALESCE($6, enquiry_date)
      WHERE id = $1
      RETURNING *;
    `;
    const params = [id, party_name, contact_no, reference, remark, enquiry_date];
    const { rows } = await client.query(updateSql, params);
    
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const updatedEnquiry = rows[0];

    // Update Items
    if (items && Array.isArray(items)) {
      // Delete old items
      await client.query(`DELETE FROM public.party_enquiry_items WHERE party_enquiry_id = $1`, [id]);

      if (items.length > 0) {
        // Fetch weights for new items
        const weightMap = await fetchItemWeights(client, items);

        for (const item of items) {
           if (!item.item_id || !item.quantity) continue;
           
           // Calculate Total Weight
           const rawWeight = weightMap[item.item_id];
           const unitWeight = parseFloat(rawWeight) || 0;
           const totalWeight = unitWeight * parseFloat(item.quantity);

          const insertItemSql = `
            INSERT INTO public.party_enquiry_items (party_enquiry_id, item_id, quantity, total_weight)
            VALUES ($1, $2, $3, $4)
          `;
          await client.query(insertItemSql, [id, item.item_id, item.quantity, totalWeight]);
        }
      }
    }

    await client.query('COMMIT');
    return updatedEnquiry;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const deletePartyEnquiryById = async (id) => {
  const sql = `DELETE FROM public.party_enquiries WHERE id = $1 RETURNING id`;
  const { rows } = await pool.query(sql, [id]);
  return rows.length ? rows[0] : null;
};

// backend/services/partySql.js

export const confirmEnquiryToOrder = async (enquiryId, userId, branchId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch Enquiry
    const enqRes = await client.query(
      `SELECT * FROM public.party_enquiries WHERE id = $1`,
      [enquiryId]
    );

    if (enqRes.rows.length === 0) throw new Error('ENQUIRY_NOT_FOUND');
    const enquiry = enqRes.rows[0];

    // 2. Insert into ORDERS
    const insertOrderSql = `
      INSERT INTO public.orders 
        (user_id, branch_id, party_name, contact_no, reference, remark, order_date, status)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, 'Pending')
      RETURNING id;
    `;
    const orderDate = enquiry.enquiry_date || new Date(); 
    const orderRes = await client.query(insertOrderSql, [
      userId, branchId, enquiry.party_name, enquiry.contact_no, enquiry.reference, enquiry.remark, orderDate
    ]);
    const newOrderId = orderRes.rows[0].id;

    // 3. Fetch Enquiry Items WITH Unit Weight
    // FIX: Added JOIN to fetch 'weight' so we can calculate total_weight
    const itemsRes = await client.query(`
      SELECT pei.*, i.weight as unit_weight 
      FROM public.party_enquiry_items pei
      JOIN public.items i ON pei.item_id = i.id
      WHERE pei.party_enquiry_id = $1
    `, [enquiryId]);
    
    // 4. Insert into ORDER_ITEMS with Total Weight
    for (const item of itemsRes.rows) {
      // FIX: Calculate Total Weight (Unit Weight * Quantity)
      // We parseFloat to ensure string weights like "4.5kg" become numbers (4.5)
      const unitWeight = parseFloat(item.unit_weight) || 0;
      const totalWeight = unitWeight * parseFloat(item.quantity);

      await client.query(`
        INSERT INTO public.order_items 
        (order_id, item_id, ordered_quantity, dispatched_quantity, total_weight)
        VALUES ($1, $2, $3, 0, $4)
      `, [newOrderId, item.item_id, item.quantity, totalWeight]);
    }

    // 5. Delete Original Enquiry
    await client.query(`DELETE FROM public.party_enquiries WHERE id = $1`, [enquiryId]);

    await client.query('COMMIT');
    return newOrderId;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};