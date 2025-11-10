// backend/src/modules/users/userController.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../../config/db.js';

// --- SECURITY FIX: Remove Fallback Secret ---
const SECRET_KEY = process.env.JWT_SECRET;

// Ensure the application stops if the secret key isn't loaded
if (!SECRET_KEY) {
    // This will cause a process crash upon import/startup if the .env file
    // or environment variable isn't correctly loaded. This is intentional.
    console.error('FATAL ERROR: JWT_SECRET environment variable is not defined.');
    // In a real app, you might use process.exit(1) here if this file is at the entry point.
}
// ---------------------------------------------


// Helper: find by user_identifier (previously userId)
const findUserByUserId = async (userIdentifier) => {
  const sql = 'SELECT id, user_identifier, email, password FROM users WHERE user_identifier = $1';
  const { rows } = await pool.query(sql, [userIdentifier]);
  return rows.length > 0 ? rows[0] : null;
};

const findUserByEmail = async (email) => {
  const sql = 'SELECT id, user_identifier, email, password FROM users WHERE email = $1';
  const { rows } = await pool.query(sql, [email]);
  return rows.length > 0 ? rows[0] : null;
};

const createUser = async (userIdentifier, email, hashedPassword) => {
  const sql = 'INSERT INTO users (user_identifier, email, password) VALUES ($1, $2, $3) RETURNING id';
  const { rows } = await pool.query(sql, [userIdentifier, email, hashedPassword]);
  return rows[0].id;
};

// [1] User Registration
export const registerUser = async (req, res) => {
  const { userId, email, password } = req.body;
  if (!userId || !email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Please provide a valid User ID, email, and a password of at least 6 characters.' });
  }

  try {
    if (await findUserByUserId(userId)) {
      return res.status(400).json({ error: 'User ID already exists.' });
    }
    if (await findUserByEmail(email)) {
      return res.status(400).json({ error: 'Email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUserId = await createUser(userId, email, hashedPassword);

    // --- JWT Creation using the guaranteed loaded SECRET_KEY ---
    const token = jwt.sign({ id: newUserId, userId: userId, email }, SECRET_KEY, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully and logged in.',
      token,
      userId: newUserId,
      userName: userId
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
};

// [2] User Login
export const loginUser = async (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) return res.status(400).json({ error: 'Please provide both User ID and password.' });

  try {
    const user = await findUserByUserId(userId);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid User ID or password.' });
    }

    // --- JWT Creation using the guaranteed loaded SECRET_KEY ---
    const token = jwt.sign({ id: user.id, userId: user.user_identifier, email: user.email }, SECRET_KEY, { expiresIn: '7d' });
    res.status(200).json({ message: 'Login successful', token, userId: user.id, userName: user.user_identifier });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: 'Server error during login.' });
  }
};

// ... (The rest of the code is unchanged as it doesn't involve JWT signing)

// [3] Forgot Password - Verify User and Email
export const forgotPassword = async (req, res) => {
  const { userId, email } = req.body;
  if (!userId || !email) return res.status(400).json({ error: 'Please provide both User ID and email.' });

  try {
    const user = await findUserByUserId(userId);
    if (!user || user.email !== email) {
      return res.status(404).json({ error: 'User ID and email do not match our records.' });
    }
    // Real app: send reset token via email
    res.status(200).json({ message: 'User verified. You can now reset your password.', userId: user.id });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: 'Server error during password reset.' });
  }
};

// [4] Reset Password (Public - for forgot password)
export const resetPassword = async (req, res) => {
  const { userId, email, newPassword } = req.body;
  if (!userId || !email || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Please provide User ID, email, and a new password of at least 6 characters.' });
  }

  try {
    const user = await findUserByUserId(userId);
    if (!user || user.email !== email) {
      return res.status(404).json({ error: 'User ID and email do not match our records.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.query('UPDATE users SET password = $1 WHERE user_identifier = $2', [hashedPassword, userId]);
    res.status(200).json({ message: 'Password reset successfully. You can now login with your new password.' });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: 'Server error during password reset.' });
  }
};

// [5] Change Password (Protected)
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id; // database id, retrieved from the verified token payload

  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Please provide current password and a new password of at least 6 characters.' });
  }

  try {
    // Get user by DB id
    const { rows } = await pool.query('SELECT id, user_identifier, email, password FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) return res.status(401).json({ error: 'Current password is incorrect.' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);

    res.status(200).json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: 'Server error during password change.' });
  }
};