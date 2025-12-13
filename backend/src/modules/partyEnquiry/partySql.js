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


// backend/src/modules/partyEnquiry/partySql.js
import pool from '../../config/db.js';

/**
 * SQL helper functions for party_enquiries table
 */

// --- READ OPERATIONS ---

export const findPartyEnquiryById = async (id) => {
  // 1. Get the main enquiry details
  const sqlEnquiry = `SELECT * FROM public.party_enquiries WHERE id = $1`;
  const { rows: enquiryRows } = await pool.query(sqlEnquiry, [id]);
  const enquiry = enquiryRows[0];

  if (!enquiry) return null;

  // 2. Get the associated items (joining with items table to get names/sizes)
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

  // 3. Attach items to the enquiry object
  enquiry.items = itemRows;
  return enquiry;
};

export const findPartyEnquiriesByUserId = async (user_id) => {
  // Note: This returns the list of enquiries. 
  // If you want to show items in the main list, you'd need a more complex query,
  // but usually, for a list view, just the main details are enough.
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
  const client = await pool.connect(); // Get a dedicated client for transaction

  try {
    await client.query('BEGIN'); // Start Transaction

    // 1. Insert the Main Enquiry
    const insertEnquirySql = `
      INSERT INTO public.party_enquiries
        (user_id, party_name, contact_no, reference, remark, enquiry_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const params = [user_id, party_name, contact_no || null, reference || null, remark || null, enquiry_date || null];
    const { rows } = await client.query(insertEnquirySql, params);
    const newEnquiry = rows[0];

    // 2. Insert Items (if provided)
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        // Skip invalid rows
        if (!item.item_id || !item.quantity) continue;

        const insertItemSql = `
          INSERT INTO public.party_enquiry_items (party_enquiry_id, item_id, quantity)
          VALUES ($1, $2, $3)
        `;
        await client.query(insertItemSql, [newEnquiry.id, item.item_id, item.quantity]);
      }
    }

    await client.query('COMMIT'); // Save everything
    return newEnquiry;

  } catch (error) {
    await client.query('ROLLBACK'); // Undo everything if error
    throw error;
  } finally {
    client.release(); // Release client back to pool
  }
};

export const updatePartyEnquiryById = async (id, { party_name, contact_no, reference, remark, enquiry_date, items }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Update Main Enquiry
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
      return null; // Enquiry not found
    }

    const updatedEnquiry = rows[0];

    // 2. Update Items (Strategy: Delete old -> Insert new)
    // Only perform this if 'items' array was explicitly passed in the request
    if (items && Array.isArray(items)) {
      // A. Delete existing items for this enquiry
      await client.query(`DELETE FROM public.party_enquiry_items WHERE party_enquiry_id = $1`, [id]);

      // B. Insert new list
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
  // Because we set "ON DELETE CASCADE" in the database schema, 
  // deleting the parent enquiry automatically wipes the child items.
  const sql = `DELETE FROM public.party_enquiries WHERE id = $1 RETURNING id`;
  const { rows } = await pool.query(sql, [id]);
  return rows.length ? rows[0] : null;
};