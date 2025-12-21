import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as userSql from './userSql.js';

// --- SECURITY CHECK ---
const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) {
    console.error('FATAL ERROR: JWT_SECRET environment variable is not defined.');
}

// [1] User Registration (Public - Creates SUPER ADMINS)
export const registerUser = async (req, res) => {
  const { userId, email, password, name } = req.body;
  
  if (!userId || !email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Please provide User ID, email, and password (min 6 chars).' });
  }

  try {
    if (await userSql.findByUserIdentifier(userId)) return res.status(400).json({ error: 'User ID already exists.' });
    if (await userSql.findByEmail(email)) return res.status(400).json({ error: 'Email already exists.' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create Super Admin 
    // Note: branch_id is null here. You must update it manually in DB as planned.
    const newUserId = await userSql.createUser({
        userIdentifier: userId,
        email,
        password: hashedPassword,
        name: name || 'Admin',
        role: 'super_admin',
        parent_id: null,
        branch_id: null 
    });

    const token = jwt.sign({ id: newUserId, userId: userId, role: 'super_admin' }, SECRET_KEY, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Registration successful.',
      token,
      userId: newUserId,
      userName: userId,
      role: 'super_admin'
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

    // --- FIX: Add 'permissions' to the token payload ---
    // This allows the frontend to read permissions directly from the token
    const token = jwt.sign({ 
        id: user.id, 
        userId: user.user_identifier, 
        email: user.email,
        role: user.role,
        branchId: user.branch_id,
        permissions: user.permissions || [] // <--- ADDED THIS LINE
    }, SECRET_KEY, { expiresIn: '7d' });
    
    res.status(200).json({ 
        message: 'Login successful', 
        token, 
        userId: user.id, 
        userName: user.user_identifier,
        role: user.role,
        branchId: user.branch_id,
        permissions: user.permissions || [] 
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: 'Server error during login.' });
  }
};

// [3] Create Employee (Protected - Admin Only)
export const createEmployee = async (req, res) => {
  const { name, email, username, password } = req.body;
  const adminId = req.user.id; 
  const adminBranchId = req.user.branch_id; // <--- GET ADMIN'S BRANCH

  if (!name || !username || !password) return res.status(400).json({ error: "Missing required fields" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await userSql.createUser({
      userIdentifier: username, 
      email: email || null, 
      password: hashedPassword, 
      name, 
      role: 'employee', 
      parent_id: adminId,
      branch_id: adminBranchId // <--- ASSIGN EMPLOYEE TO SAME BRANCH
    });
    
    res.status(201).json({ message: "Employee created successfully" });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(400).json({ error: "Username or Email already exists" });
    res.status(500).json({ error: "Failed to create employee" });
  }
};

// [4] Get Employees List
export const getEmployees = async (req, res) => {
  try {
    // Must pass the branch_id to the SQL query
    const branchId = req.user.branch_id;
    const employees = await userSql.getEmployeesWithPermissions(branchId);
    
    res.json({ data: employees });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load employees" });
  }
};

// [5] Edit Employee
export const editEmployee = async (req, res) => {
  const { id } = req.params;
  const { name, email, username } = req.body;
  try {
    await userSql.updateUser(id, { name, email, userIdentifier: username });
    res.json({ message: "Employee updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update employee" });
  }
};

// [6] Delete Employee
export const removeEmployee = async (req, res) => {
  const { id } = req.params;
  try {
    await userSql.deleteUser(id);
    res.json({ message: "Employee deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete employee" });
  }
};

// [7] Update Permissions
export const updatePermission = async (req, res) => {
  const { id } = req.params; 
  const { moduleKey, action } = req.body; 

  try {
    if (action === 'add') {
      await userSql.addPermission(id, moduleKey);
    } else {
      await userSql.removePermission(id, moduleKey);
    }
    res.json({ message: "Permission updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update permission" });
  }
};

export const forgotPassword = async (req, res) => {
    const { userId, email } = req.body;
    if (!userId || !email) return res.status(400).json({ error: 'Please provide both User ID and email.' });
    try {
        const user = await userSql.findByUserIdentifier(userId);
        if (!user || user.email !== email) return res.status(404).json({ error: 'Details do not match.' });
        res.status(200).json({ message: 'User verified.', userId: user.id });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
};

export const resetPassword = async (req, res) => {
    const { userId, email, newPassword } = req.body;
    if (!userId || !email || !newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Invalid data.' });
    try {
        const user = await userSql.findByUserIdentifier(userId);
        if (!user || user.email !== email) return res.status(404).json({ error: 'Details do not match.' });
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        await userSql.updatePasswordByUserIdentifier(userId, hashedPassword);
        res.status(200).json({ message: 'Password reset successfully.' });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
};

export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id; 
    if (!currentPassword || !newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Invalid data.' });
    try {
        const user = await userSql.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found.' });
        
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) return res.status(401).json({ error: 'Incorrect password.' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        await userSql.updatePasswordById(userId, hashedPassword);
        res.status(200).json({ message: 'Password changed successfully.' });
    } catch (err) { res.status(500).json({ error: 'Server error.' }); }
};