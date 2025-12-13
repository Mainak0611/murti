// frontend/src/modules/item/itemRoutes.js (or backend/routes/itemRoutes.js)
import express from 'express';
import {
  createItem,
  getMyItems,
  getItemById,
  updateItem,
  deleteItem,
} from './itemMasterService.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Protected routes - user must be authenticated

router.post('/', protect, createItem);           // Create Item
router.get('/', protect, getMyItems);            // List all my items
router.get('/:id', protect, getItemById);        // Get one item (owner only)
router.put('/:id', protect, updateItem);         // Update item (owner only)
router.delete('/:id', protect, deleteItem);      // Delete item (owner only)

export default router;