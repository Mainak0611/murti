// // partySql.js
// import pool from '../../config/db.js';

// /**
//  * SQL helper functions for party_enquiries table
//  */

// export const createPartyEnquiry = async ({ user_id, party_name, contact_no, reference, remark, enquiry_date }) => {
//   const sql = `
//     INSERT INTO public.party_enquiries
//       (user_id, party_name, contact_no, reference, remark, enquiry_date)
//     VALUES ($1, $2, $3, $4, $5, $6)
//     RETURNING *;
//   `;
//   const params = [user_id, party_name, contact_no || null, reference || null, remark || null, enquiry_date || null];
//   const { rows } = await pool.query(sql, params);
//   return rows[0];
// };

// export const findPartyEnquiryById = async (id) => {
//   const sql = `SELECT * FROM public.party_enquiries WHERE id = $1`;
//   const { rows } = await pool.query(sql, [id]);
//   return rows.length ? rows[0] : null;
// };

// export const findPartyEnquiriesByUserId = async (user_id) => {
//   const sql = `
//     SELECT * FROM public.party_enquiries
//     WHERE user_id = $1
//     ORDER BY enquiry_date DESC, created_at DESC
//   `;
//   const { rows } = await pool.query(sql, [user_id]);
//   return rows;
// };

// export const findAllPartyEnquiries = async () => {
//   const sql = `SELECT * FROM public.party_enquiries ORDER BY enquiry_date DESC, created_at DESC`;
//   const { rows } = await pool.query(sql);
//   return rows;
// };

// export const updatePartyEnquiryById = async (id, { party_name, contact_no, reference, remark, enquiry_date }) => {
//   const sql = `
//     UPDATE public.party_enquiries
//     SET party_name = COALESCE($2, party_name),
//         contact_no = COALESCE($3, contact_no),
//         reference = COALESCE($4, reference),
//         remark = COALESCE($5, remark),
//         enquiry_date = COALESCE($6, enquiry_date)
//     WHERE id = $1
//     RETURNING *;
//   `;
//   const params = [id, party_name, contact_no, reference, remark, enquiry_date];
//   const { rows } = await pool.query(sql, params);
//   return rows.length ? rows[0] : null;
// };

// export const deletePartyEnquiryById = async (id) => {
//   const sql = `DELETE FROM public.party_enquiries WHERE id = $1 RETURNING id`;
//   const { rows } = await pool.query(sql, [id]);
//   return rows.length ? rows[0] : null;
// };


import pool from '../../config/db.js';

// --- READ OPERATIONS ---

export const findPartyEnquiryById = async (id) => {
  const sqlEnquiry = `SELECT * FROM public.party_enquiries WHERE id = $1`;
  const { rows: enquiryRows } = await pool.query(sqlEnquiry, [id]);
  const enquiry = enquiryRows[0];

  if (!enquiry) return null;

  const sqlItems = `
    SELECT 
      pei.id as link_id,
      pei.item_id, 
      pei.quantity, 
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

export const findPartyEnquiriesByUserId = async (user_id) => {
  const sql = `
    SELECT * FROM public.party_enquiries
    WHERE user_id = $1
    ORDER BY enquiry_date DESC, created_at DESC
  `;
  const { rows } = await pool.query(sql, [user_id]);
  return rows;
};

export const findAllPartyEnquiries = async () => {
  const sql = `SELECT * FROM public.party_enquiries ORDER BY enquiry_date DESC, created_at DESC`;
  const { rows } = await pool.query(sql);
  return rows;
};

// --- WRITE OPERATIONS (TRANSACTIONAL) ---

export const createPartyEnquiry = async ({ user_id, party_name, contact_no, reference, remark, enquiry_date, items }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const insertEnquirySql = `
      INSERT INTO public.party_enquiries
        (user_id, party_name, contact_no, reference, remark, enquiry_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const params = [user_id, party_name, contact_no || null, reference || null, remark || null, enquiry_date || null];
    const { rows } = await client.query(insertEnquirySql, params);
    const newEnquiry = rows[0];

    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (!item.item_id || !item.quantity) continue;
        const insertItemSql = `
          INSERT INTO public.party_enquiry_items (party_enquiry_id, item_id, quantity)
          VALUES ($1, $2, $3)
        `;
        await client.query(insertItemSql, [newEnquiry.id, item.item_id, item.quantity]);
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

    if (items && Array.isArray(items)) {
      await client.query(`DELETE FROM public.party_enquiry_items WHERE party_enquiry_id = $1`, [id]);

      if (items.length > 0) {
        for (const item of items) {
           if (!item.item_id || !item.quantity) continue;
          const insertItemSql = `
            INSERT INTO public.party_enquiry_items (party_enquiry_id, item_id, quantity)
            VALUES ($1, $2, $3)
          `;
          await client.query(insertItemSql, [id, item.item_id, item.quantity]);
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

// --- NEW: CONFIRM ORDER TRANSACTION ---
export const confirmEnquiryToOrder = async (enquiryId, userId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch Enquiry
    const enqRes = await client.query(
      `SELECT * FROM public.party_enquiries WHERE id = $1 AND user_id = $2`,
      [enquiryId, userId]
    );

    if (enqRes.rows.length === 0) throw new Error('ENQUIRY_NOT_FOUND');
    const enquiry = enqRes.rows[0];

    // 2. Insert into ORDERS
    const insertOrderSql = `
      INSERT INTO public.orders 
        (user_id, party_name, contact_no, reference, remark, order_date, status)
      VALUES 
        ($1, $2, $3, $4, $5, $6, 'Pending')
      RETURNING id;
    `;
    const orderDate = enquiry.enquiry_date || new Date(); 
    const orderRes = await client.query(insertOrderSql, [
      userId, enquiry.party_name, enquiry.contact_no, enquiry.reference, enquiry.remark, orderDate
    ]);
    const newOrderId = orderRes.rows[0].id;

    // 3. Fetch Enquiry Items & Insert into ORDER_ITEMS
    const itemsRes = await client.query(
      `SELECT * FROM public.party_enquiry_items WHERE party_enquiry_id = $1`,
      [enquiryId]
    );
    
    for (const item of itemsRes.rows) {
      await client.query(`
        INSERT INTO public.order_items (order_id, item_id, ordered_quantity, dispatched_quantity)
        VALUES ($1, $2, $3, 0)
      `, [newOrderId, item.item_id, item.quantity]);
    }

    // 4. Delete Original Enquiry
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