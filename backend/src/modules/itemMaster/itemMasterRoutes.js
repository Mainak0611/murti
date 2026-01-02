import express from 'express';
import {
  createItem,
  getMyItems,
  getItemById,
  updateItem,
  deleteItem,
  // --- NEW IMPORTS ---
  addStock,
  reportLoss,
  getItemLogs,
  getPartyDistribution
} from './itemMasterService.js';
import { protect, restrictTo } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Define who can READ items
const READ_ACCESS = [
    'item_master', 
    'confirmed_orders', 
    'party_enquiries', 
    'returns_module',
    'payment_records'
];

// READ Routes
router.get('/', protect, restrictTo(READ_ACCESS), getMyItems);
router.get('/:id', protect, restrictTo(READ_ACCESS), getItemById);
// New Route: Get History
router.get('/:id/logs', protect, restrictTo(READ_ACCESS), getItemLogs);
// New Route: Get Party Distribution
router.get('/:itemId/distribution/parties', protect, restrictTo(READ_ACCESS), getPartyDistribution);

// WRITE Routes: Strictly for 'item_master'
router.post('/', protect, restrictTo('item_master'), createItem);
router.put('/:id', protect, restrictTo('item_master'), updateItem);
router.delete('/:id', protect, restrictTo('item_master'), deleteItem);

// --- NEW ACTION ROUTES ---
router.post('/:id/add-stock', protect, restrictTo('item_master'), addStock);
router.post('/:id/loss', protect, restrictTo('item_master'), reportLoss);

export default router;