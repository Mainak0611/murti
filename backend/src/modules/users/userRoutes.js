import express from 'express';
import { 
    registerUser, loginUser, forgotPassword, resetPassword, changePassword,
    getEmployees, createEmployee, editEmployee, removeEmployee, updatePermission
} from './userService.js';
import { protect, restrictTo } from '../../middleware/authMiddleware.js';

const router = express.Router();

// --- PUBLIC AUTH ---
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// --- PROTECTED USER ROUTES ---
router.post('/change-password', protect, changePassword);

// ✅ NEW ROUTE ADDED HERE:
// This allows the frontend to ask "Who am I?" and get permissions dynamically.
router.get('/me', protect, (req, res) => {
    // req.user is already fetched by the 'protect' middleware
    if (!req.user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json(req.user);
});

// --- EMPLOYEE MANAGEMENT (Super Admin Only) ---
router.get('/employees', protect, restrictTo('super_admin'), getEmployees);
router.post('/employees', protect, restrictTo('super_admin'), createEmployee);
router.put('/employees/:id', protect, restrictTo('super_admin'), editEmployee);
router.delete('/employees/:id', protect, restrictTo('super_admin'), removeEmployee);

// --- PERMISSIONS ---
router.put('/:id/permissions', protect, restrictTo('super_admin'), updatePermission);

export default router;