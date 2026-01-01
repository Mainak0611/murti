import express from 'express';
import { getReturns, addReturn, deleteReturn, updateReturn } from './returnItemService.js';
import { protect, restrictTo } from '../../middleware/authMiddleware.js';

const router = express.Router();

// All routes require 'returns_module' permission
router.get('/', protect, restrictTo('returns_module'), getReturns);
router.post('/', protect, restrictTo('returns_module'), addReturn);
router.put('/:id', protect, restrictTo('returns_module'), updateReturn);
router.delete('/:id', protect, restrictTo('returns_module'), deleteReturn);

export default router;