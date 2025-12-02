import pool from '../../config/db.js';

// --- READ OPERATIONS ---

export const findByUserIdentifier = async (userIdentifier) => {
  const sql = 'SELECT id, user_identifier, email, password FROM users WHERE user_identifier = $1';
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

// --- WRITE OPERATIONS ---

export const createUser = async (userIdentifier, email, hashedPassword) => {
  const sql = 'INSERT INTO users (user_identifier, email, password) VALUES ($1, $2, $3) RETURNING id';
  const { rows } = await pool.query(sql, [userIdentifier, email, hashedPassword]);
  return rows[0].id;
};

export const updatePasswordByUserIdentifier = async (userIdentifier, hashedPassword) => {
  const sql = 'UPDATE users SET password = $1 WHERE user_identifier = $2';
  await pool.query(sql, [hashedPassword, userIdentifier]);
};

export const updatePasswordById = async (id, hashedPassword) => {
  const sql = 'UPDATE users SET password = $1 WHERE id = $2';
  await pool.query(sql, [hashedPassword, id]);
};