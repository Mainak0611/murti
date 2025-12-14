import express from 'express';
import { getReturns, addReturn } from './returnItemService.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Route: GET /api/returns
router.get('/', protect, getReturns);

// Route: POST /api/returns
router.post('/', protect, addReturn);

export default router;