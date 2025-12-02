import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as userSql from './userSql.js';

// --- SECURITY CHECK ---
const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) {
    console.error('FATAL ERROR: JWT_SECRET environment variable is not defined.');
}

// [1] User Registration
export const registerUser = async (req, res) => {
  const { userId, email, password } = req.body;
  if (!userId || !email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Please provide a valid User ID, email, and a password of at least 6 characters.' });
  }

  try {
    // Check duplicates using SQL helper
    if (await userSql.findByUserIdentifier(userId)) {
      return res.status(400).json({ error: 'User ID already exists.' });
    }
    if (await userSql.findByEmail(email)) {
      return res.status(400).json({ error: 'Email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user via SQL helper
    const newUserId = await userSql.createUser(userId, email, hashedPassword);

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
    const user = await userSql.findByUserIdentifier(userId);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid User ID or password.' });
    }

    const token = jwt.sign({ id: user.id, userId: user.user_identifier, email: user.email }, SECRET_KEY, { expiresIn: '7d' });
    
    res.status(200).json({ message: 'Login successful', token, userId: user.id, userName: user.user_identifier });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: 'Server error during login.' });
  }
};

// [3] Forgot Password - Verify User and Email
export const forgotPassword = async (req, res) => {
  const { userId, email } = req.body;
  if (!userId || !email) return res.status(400).json({ error: 'Please provide both User ID and email.' });

  try {
    const user = await userSql.findByUserIdentifier(userId);
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
    const user = await userSql.findByUserIdentifier(userId);
    if (!user || user.email !== email) {
      return res.status(404).json({ error: 'User ID and email do not match our records.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await userSql.updatePasswordByUserIdentifier(userId, hashedPassword);
    
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
    const user = await userSql.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) return res.status(401).json({ error: 'Current password is incorrect.' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    await userSql.updatePasswordById(userId, hashedPassword);

    res.status(200).json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: 'Server error during password change.' });
  }
};