import pool from '../../config/db.js';

export const createItem = async ({ user_id, branch_id, item_name, size, hsn_code, weight, price, minimum_stock, current_stock, remarks }) => {
  const sql = `
    INSERT INTO public.items
      (user_id, branch_id, item_name, size, hsn_code, weight, price, minimum_stock, current_stock, remarks)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *;
  `;
  
  const safePrice = price !== undefined && price !== '' ? price : 0;
  const safeMinStock = minimum_stock !== undefined && minimum_stock !== '' ? minimum_stock : 0;
  const safeCurStock = current_stock !== undefined && current_stock !== '' ? current_stock : 0;

  const params = [
    user_id, 
    branch_id, // Insert Branch ID
    item_name, 
    size || null, 
    hsn_code || null, 
    weight || null, 
    safePrice, 
    safeMinStock,
    safeCurStock,
    remarks || null
  ];

  const { rows } = await pool.query(sql, params);
  return rows[0];
};

export const findItemById = async (id) => {
  const sql = `SELECT * FROM public.items WHERE id = $1`;
  const { rows } = await pool.query(sql, [id]);
  return rows.length ? rows[0] : null;
};

// Updated to filter by Branch ID
export const findItemsByBranchId = async (branchId) => {
  const sql = `
    SELECT * FROM public.items
    WHERE branch_id = $1
    ORDER BY id DESC
  `;
  const { rows } = await pool.query(sql, [branchId]);
  return rows;
};

export const updateItemById = async (id, { item_name, size, hsn_code, weight, price, minimum_stock, current_stock, remarks }) => {
  const sql = `
    UPDATE public.items
    SET item_name = COALESCE($2, item_name),
        size = COALESCE($3, size),
        hsn_code = COALESCE($4, hsn_code),
        weight = COALESCE($5, weight),
        price = COALESCE($6, price),
        minimum_stock = COALESCE($7, minimum_stock),
        current_stock = COALESCE($8, current_stock),
        remarks = COALESCE($9, remarks)
    WHERE id = $1
    RETURNING *;
  `;
  
  const params = [
    id, 
    item_name, 
    size, 
    hsn_code, 
    weight, 
    price, 
    minimum_stock, 
    current_stock,
    remarks 
  ];
  
  const { rows } = await pool.query(sql, params);
  return rows.length ? rows[0] : null;
};

export const deleteItemById = async (id) => {
  const sql = `DELETE FROM public.items WHERE id = $1 RETURNING id`;
  const { rows } = await pool.query(sql, [id]);
  return rows.length ? rows[0] : null;
};