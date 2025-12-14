// backend/routes/itemRoutes.js
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

router.post('/', protect, createItem);
router.get('/', protect, getMyItems);
router.get('/:id', protect, getItemById);
router.put('/:id', protect, updateItem); // This now handles current_stock updates
router.delete('/:id', protect, deleteItem);

export default router;