import express from 'express';
import { getMyOrders, getOrderById, updateDispatch } from './confirmedOrdersService.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getMyOrders);
router.get('/:id', protect, getOrderById);
router.put('/:id/dispatch', protect, updateDispatch);

export default router;