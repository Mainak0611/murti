import express from 'express';
import { getMyOrders, getOrderById, updateDispatch } from './confirmedOrdersService.js'; // Check your imports
import { protect, restrictTo } from '../../middleware/authMiddleware.js';

const router = express.Router();

// 1. View Orders: Needs 'confirmed_orders' permission
router.get('/', protect, restrictTo('confirmed_orders'), getMyOrders);
router.get('/:id', protect, restrictTo('confirmed_orders'), getOrderById);

// 2. Dispatch: Needs 'confirmed_orders' permission (or a specific 'dispatch' permission if you prefer)
router.put('/:id/dispatch', protect, restrictTo('confirmed_orders'), updateDispatch);

export default router;