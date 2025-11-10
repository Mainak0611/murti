// backend/src/modules/users/userController.js (LIVE DATABASE INTEGRATION)

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../../config/db.js'; // 🛑 USING ACTUAL DB IMPORT 🛑

// Get the secret key from environment variables
const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key'; 

// --- Database Helper Functions (Using real SQL) ---

// Helper function to query the database and return a user object by userId
const findUserByUserId = (userId) => {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT id, userId, email, password FROM users WHERE userId = ?';
        db.query(sql, [userId], (err, results) => {
            if (err) return reject(err);
            // If user found, resolve with the user object (first result)
            if (results.length > 0) {
                resolve(results[0]);
            } else {
                // If user not found, resolve with null
                resolve(null);
            }
        });
    });
};

// Helper function to query the database and return a user object by email
const findUserByEmail = (email) => {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT id, userId, email, password FROM users WHERE email = ?';
        db.query(sql, [email], (err, results) => {
            if (err) return reject(err);
            // If user found, resolve with the user object (first result)
            if (results.length > 0) {
                resolve(results[0]);
            } else {
                // If user not found, resolve with null
                resolve(null);
            }
        });
    });
};

// Helper function to insert a new user into the database
const createUser = (userId, email, hashedPassword) => {
    return new Promise((resolve, reject) => {
        const sql = 'INSERT INTO users (userId, email, password) VALUES (?, ?, ?)';
        db.query(sql, [userId, email, hashedPassword], (err, result) => {
            if (err) return reject(err);
            // Resolve with the ID of the newly inserted user
            resolve(result.insertId);
        });
    });
};
// --- End Database Helper Functions ---


// [1] User Registration
export const registerUser = async (req, res) => {
    const { userId, email, password } = req.body;

    // Basic input validation
    if (!userId || !email || !password || password.length < 6) {
        return res.status(400).json({ error: 'Please provide a valid User ID, email, and a password of at least 6 characters.' });
    }

    try {
        // Check if user already exists by userId or email
        if (await findUserByUserId(userId)) {
            return res.status(400).json({ error: 'User ID already exists.' });
        }
        
        if (await findUserByEmail(email)) {
            return res.status(400).json({ error: 'Email already exists.' });
        }

        // Hash the password securely
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Insert user into DB
        const userIdFromDb = await createUser(userId, email, hashedPassword); 

        // Generate a token that expires in 7 days
        const token = jwt.sign(
            { id: userIdFromDb, userId: userId, email: email }, 
            SECRET_KEY,
            { expiresIn: '7d' }
        );

        res.status(201).json({ 
            message: 'User registered successfully and logged in.', 
            token,
            userId: userIdFromDb,
            userName: userId // Send the actual username
        });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ error: 'Server error during registration.' });
    }
};

// [2] User Login
export const loginUser = async (req, res) => {
    const { userId, password } = req.body;
    
    // Basic input validation
    if (!userId || !password) {
        return res.status(400).json({ error: 'Please provide both User ID and password.' });
    }

    try {
        const user = await findUserByUserId(userId);

        // Check if user exists AND if the password matches the hash
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid User ID or password.' });
        }

        // Generate JWT token that expires in 7 days
        const token = jwt.sign(
            { id: user.id, userId: user.userId, email: user.email }, 
            SECRET_KEY,
            { expiresIn: '7d' }
        );

        // Send token to the client
        res.status(200).json({ 
            message: 'Login successful', 
            token,
            userId: user.id,
            userName: user.userId // Send the actual username
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: 'Server error during login.' });
    }
};

// [3] Forgot Password - Verify User and Email
export const forgotPassword = async (req, res) => {
    const { userId, email } = req.body;
    
    // Basic input validation
    if (!userId || !email) {
        return res.status(400).json({ error: 'Please provide both User ID and email.' });
    }

    try {
        const user = await findUserByUserId(userId);

        // Check if user exists and email matches
        if (!user || user.email !== email) {
            return res.status(404).json({ error: 'User ID and email do not match our records.' });
        }

        // In a production app, you would send an email with a reset token here
        // For now, we'll return success and allow password reset
        res.status(200).json({ 
            message: 'User verified. You can now reset your password.',
            userId: user.id
        });
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ error: 'Server error during password reset.' });
    }
};

// [4] Reset Password (Public - for forgot password)
export const resetPassword = async (req, res) => {
    const { userId, email, newPassword } = req.body;
    
    // Basic input validation
    if (!userId || !email || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Please provide User ID, email, and a new password of at least 6 characters.' });
    }

    try {
        const user = await findUserByUserId(userId);

        // Check if user exists and email matches
        if (!user || user.email !== email) {
            return res.status(404).json({ error: 'User ID and email do not match our records.' });
        }

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // Update password in database
        const sql = 'UPDATE users SET password = ? WHERE userId = ?';
        await new Promise((resolve, reject) => {
            db.query(sql, [hashedPassword, userId], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        res.status(200).json({ 
            message: 'Password reset successfully. You can now login with your new password.'
        });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ error: 'Server error during password reset.' });
    }
};

// [5] Change Password (Protected - for logged-in users)
export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id; // Get from JWT token
    
    // Basic input validation
    if (!currentPassword || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Please provide current password and a new password of at least 6 characters.' });
    }

    try {
        // Get user by database ID
        const user = await new Promise((resolve, reject) => {
            const sql = 'SELECT id, userId, email, password FROM users WHERE id = ?';
            db.query(sql, [userId], (err, results) => {
                if (err) return reject(err);
                resolve(results.length > 0 ? results[0] : null);
            });
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // Update password in database
        const sql = 'UPDATE users SET password = ? WHERE id = ?';
        await new Promise((resolve, reject) => {
            db.query(sql, [hashedPassword, userId], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        res.status(200).json({ 
            message: 'Password changed successfully.'
        });
    } catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({ error: 'Server error during password change.' });
    }
};