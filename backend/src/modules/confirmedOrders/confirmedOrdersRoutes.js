import express from 'express';
import { getMyOrders, getOrderById, updateDispatch } from './confirmedOrdersService.js'; // Check your imports
import { protect, restrictTo } from '../../middleware/authMiddleware.js';

const router = express.Router();

// 1. View Orders: Needs 'confirmed_orders' OR 'completed_orders' permission (for viewing both confirmed and completed)
router.get('/', protect, restrictTo(['confirmed_orders', 'completed_orders']), getMyOrders);
router.get('/:id', protect, restrictTo(['confirmed_orders', 'completed_orders']), getOrderById);

// 2. Dispatch: Needs 'confirmed_orders' permission (only for managing confirmed orders)
router.put('/:id/dispatch', protect, restrictTo('confirmed_orders'), updateDispatch);

export default router;