// routes/itemRoutes.js (or whatever you named this file)
import express from 'express';
import {
  createItem,
  getMyItems,
  getItemById,
  updateItem,
  deleteItem,
} from './itemMasterService.js';
import { protect, restrictTo } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Define who can READ items (Dropdowns in other modules)
const READ_ACCESS = [
    'item_master', 
    'confirmed_orders', 
    'party_enquiries', 
    'returns_module',
    'payment_records' // Add any other module that needs to see the item list
];

// READ Routes: Allow access if user has ANY of the permissions in READ_ACCESS
router.get('/', protect, restrictTo(READ_ACCESS), getMyItems);
router.get('/:id', protect, restrictTo(READ_ACCESS), getItemById);

// WRITE Routes: Strictly for 'item_master' only
router.post('/', protect, restrictTo('item_master'), createItem);
router.put('/:id', protect, restrictTo('item_master'), updateItem);
router.delete('/:id', protect, restrictTo('item_master'), deleteItem);

export default router;