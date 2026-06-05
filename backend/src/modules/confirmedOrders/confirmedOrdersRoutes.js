import express from 'express';
import { 
  createOrderDirectly, getMyOrders, getOrdersByParty, getOrderById, updateDispatch, updateOrder, 
  updateDispatchEntry, deleteOrder, deleteDispatchEntry, getBranchDispatches,
  createEstimate, getEstimates, checkChallanNo, getEstimateByChallanNo, getEstimateById, updateEstimate, deleteEstimate
} from './confirmedOrdersService.js'; 
import { protect, restrictTo } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Estimates endpoints
router.post('/estimates', protect, restrictTo(['confirmed_orders', 'dispatch_items']), createEstimate);
router.get('/estimates', protect, restrictTo(['confirmed_orders', 'dispatch_items']), getEstimates);
router.get('/estimates/check-challan/:challan_no', protect, restrictTo(['confirmed_orders', 'dispatch_items']), checkChallanNo);
router.get('/estimates/challan/:challan_no', protect, restrictTo(['confirmed_orders', 'dispatch_items']), getEstimateByChallanNo);
router.get('/estimates/:id', protect, restrictTo(['confirmed_orders', 'dispatch_items']), getEstimateById);
router.put('/estimates/:id', protect, restrictTo(['confirmed_orders', 'dispatch_items']), updateEstimate);
router.delete('/estimates/:id', protect, restrictTo(['confirmed_orders', 'dispatch_items']), deleteEstimate);

// 0. Create Order Directly (for party enquiries that want to skip enquiry and go straight to order)
router.post('/', protect, restrictTo(['confirmed_orders', 'dispatch_items']), createOrderDirectly);

// 1. View Orders: Needs 'confirmed_orders' OR 'completed_orders' OR 'dispatch_items' permission
router.get('/dispatches', protect, restrictTo(['confirmed_orders', 'completed_orders', 'dispatch_items']), getBranchDispatches);
router.get('/', protect, restrictTo(['confirmed_orders', 'completed_orders', 'dispatch_items']), getMyOrders);
router.get('/by-party', protect, restrictTo(['confirmed_orders', 'completed_orders', 'dispatch_items']), getOrdersByParty);
router.get('/:id', protect, restrictTo(['confirmed_orders', 'completed_orders', 'dispatch_items']), getOrderById);

// 2. Update Order: Needs 'confirmed_orders' permission
router.put('/:id', protect, restrictTo(['confirmed_orders', 'dispatch_items']), updateOrder);

// 3. Delete Order: Needs 'confirmed_orders' permission
router.delete('/:id', protect, restrictTo(['confirmed_orders', 'dispatch_items']), deleteOrder);

// 4. Dispatch: Needs 'confirmed_orders' or 'dispatch_items' permission
router.put('/:id/dispatch', protect, restrictTo(['confirmed_orders', 'dispatch_items']), updateDispatch);

// 5. Update Dispatch Entry: Needs 'confirmed_orders' or 'dispatch_items' permission
router.put('/:id/dispatch/:challan_no', protect, restrictTo(['confirmed_orders', 'dispatch_items']), updateDispatchEntry);

// 6. Delete Dispatch Entry: Needs 'confirmed_orders' or 'dispatch_items' permission
router.delete('/:id/dispatch/:challan_no', protect, restrictTo(['confirmed_orders', 'dispatch_items']), deleteDispatchEntry);

export default router;