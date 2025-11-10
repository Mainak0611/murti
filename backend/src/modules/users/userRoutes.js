// backend/src/modules/users/userRoutes.js
import express from 'express';
import { registerUser, loginUser, forgotPassword, resetPassword, changePassword } from './userController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Public routes for user authentication
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected route for changing password (requires authentication)
router.post('/change-password', protect, changePassword);

export default router;