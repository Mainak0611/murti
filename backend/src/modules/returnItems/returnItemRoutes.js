import express from 'express';
import { getReturns, addReturn } from './returnItemService.js';
import { protect, restrictTo } from '../../middleware/authMiddleware.js';

const router = express.Router();

// All routes require 'returns_module' permission
router.get('/', protect, restrictTo('returns_module'), getReturns);
router.post('/', protect, restrictTo('returns_module'), addReturn);

export default router;