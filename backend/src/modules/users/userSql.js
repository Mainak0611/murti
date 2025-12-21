import pool from '../../config/db.js';

// --- READ OPERATIONS ---

// [Updated] Fetches user details + Role + Permissions + BRANCH ID
export const findByUserIdentifier = async (userIdentifier) => {
  const sql = `
    SELECT 
      u.id, 
      u.user_identifier, 
      u.email, 
      u.password,
      u.name,
      u.role,
      u.branch_id, -- <--- ADDED: Critical for multi-tenancy
      COALESCE(
        json_agg(up.module_key) FILTER (WHERE up.module_key IS NOT NULL), 
        '[]'
      ) as permissions
    FROM users u
    LEFT JOIN user_permissions up ON u.id = up.user_id
    WHERE u.user_identifier = $1
    GROUP BY u.id
  `;
  const { rows } = await pool.query(sql, [userIdentifier]);
  return rows.length > 0 ? rows[0] : null;
};

export const findByEmail = async (email) => {
  const sql = 'SELECT id, user_identifier, email, password FROM users WHERE email = $1';
  const { rows } = await pool.query(sql, [email]);
  return rows.length > 0 ? rows[0] : null;
};

export const findById = async (id) => {
  const sql = 'SELECT id, user_identifier, email, password FROM users WHERE id = $1';
  const { rows } = await pool.query(sql, [id]);
  return rows.length > 0 ? rows[0] : null;
};

// [Updated] Fetch employees ONLY for the specific branch
export const getEmployeesWithPermissions = async (branchId) => {
  const sql = `
    SELECT 
      u.id, 
      u.name, 
      u.user_identifier as username, 
      u.email, 
      u.role,
      COALESCE(
        json_agg(up.module_key) FILTER (WHERE up.module_key IS NOT NULL), 
        '[]'
      ) as permissions
    FROM public.users u
    LEFT JOIN public.user_permissions up ON u.id = up.user_id
    WHERE u.role != 'super_admin'
      AND u.branch_id = $1 -- <--- ADDED: Filter by Admin's Branch
    GROUP BY u.id
    ORDER BY u.name ASC
  `;
  const { rows } = await pool.query(sql, [branchId]);
  return rows;
};

// --- WRITE OPERATIONS ---

// [Updated] Now accepts and inserts branch_id
export const createUser = async ({ userIdentifier, email, password, name, role, parent_id, branch_id }) => {
  const sql = `
    INSERT INTO users (user_identifier, email, password, name, role, parent_id, branch_id) 
    VALUES ($1, $2, $3, $4, $5, $6, $7) 
    RETURNING id, user_identifier, email, role
  `;
  
  const { rows } = await pool.query(sql, [
    userIdentifier, 
    email, 
    password, 
    name || null, 
    role || 'super_admin', 
    parent_id || null,
    branch_id || null // <--- ADDED: Save the branch link
  ]);
  return rows[0].id; 
};

// [Updated] Update Employee Details
export const updateUser = async (id, { name, email, userIdentifier }) => {
  const sql = `
    UPDATE public.users 
    SET name = $1, email = $2, user_identifier = $3
    WHERE id = $4
  `;
  await pool.query(sql, [name, email, userIdentifier, id]);
};

// [Updated] Delete User
export const deleteUser = async (id) => {
  const sql = `DELETE FROM public.users WHERE id = $1`;
  await pool.query(sql, [id]);
};

// [Updated] Add Permission
export const addPermission = async (userId, moduleKey) => {
  const sql = `
    INSERT INTO public.user_permissions (user_id, module_key)
    VALUES ($1, $2)
    ON CONFLICT (user_id, module_key) DO NOTHING
  `;
  await pool.query(sql, [userId, moduleKey]);
};

// [Updated] Remove Permission
export const removePermission = async (userId, moduleKey) => {
  const sql = `DELETE FROM public.user_permissions WHERE user_id = $1 AND module_key = $2`;
  await pool.query(sql, [userId, moduleKey]);
};

export const updatePasswordByUserIdentifier = async (userIdentifier, hashedPassword) => {
  const sql = 'UPDATE users SET password = $1 WHERE user_identifier = $2';
  await pool.query(sql, [hashedPassword, userIdentifier]);
};

export const updatePasswordById = async (id, hashedPassword) => {
  const sql = 'UPDATE users SET password = $1 WHERE id = $2';
  await pool.query(sql, [hashedPassword, id]);
};