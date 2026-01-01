import express from 'express';
import { createOrderDirectly, getMyOrders, getOrdersByParty, getOrderById, updateDispatch, updateOrder, updateDispatchEntry, deleteOrder, deleteDispatchEntry } from './confirmedOrdersService.js'; // Check your imports
import { protect, restrictTo } from '../../middleware/authMiddleware.js';

const router = express.Router();

// 0. Create Order Directly (for party enquiries that want to skip enquiry and go straight to order)
router.post('/', protect, restrictTo('confirmed_orders'), createOrderDirectly);

// 1. View Orders: Needs 'confirmed_orders' OR 'completed_orders' permission (for viewing both confirmed and completed)
router.get('/', protect, restrictTo(['confirmed_orders', 'completed_orders']), getMyOrders);
router.get('/by-party', protect, restrictTo(['confirmed_orders', 'completed_orders']), getOrdersByParty);
router.get('/:id', protect, restrictTo(['confirmed_orders', 'completed_orders']), getOrderById);

// 2. Update Order: Needs 'confirmed_orders' permission
router.put('/:id', protect, restrictTo('confirmed_orders'), updateOrder);

// 3. Delete Order: Needs 'confirmed_orders' permission
router.delete('/:id', protect, restrictTo('confirmed_orders'), deleteOrder);

// 4. Dispatch: Needs 'confirmed_orders' permission (only for managing confirmed orders)
router.put('/:id/dispatch', protect, restrictTo('confirmed_orders'), updateDispatch);

// 5. Update Dispatch Entry: Needs 'confirmed_orders' permission
router.put('/:id/dispatch/:challan_no', protect, restrictTo('confirmed_orders'), updateDispatchEntry);

// 6. Delete Dispatch Entry: Needs 'confirmed_orders' permission
router.delete('/:id/dispatch/:challan_no', protect, restrictTo('confirmed_orders'), deleteDispatchEntry);

export default router;