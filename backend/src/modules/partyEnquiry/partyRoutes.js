import express from 'express';
import {
  createPartyEnquiry,
  getMyPartyEnquiries,
  getPartyEnquiryById,
  updatePartyEnquiry,
  deletePartyEnquiry,
//   getAllPartyEnquiries, // Uncomment if using admin route
} from './partyService.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Protected routes - user must be authenticated
router.post('/', protect, createPartyEnquiry);           // Create

// --- CHANGED BELOW ---
router.get('/parties', protect, getMyPartyEnquiries);    // List my enquiries (Changed from /me to /parties)
// ---------------------

router.get('/:id', protect, getPartyEnquiryById);        // Get one (owner only)
router.put('/:id', protect, updatePartyEnquiry);         // Update (owner only)
router.delete('/:id', protect, deletePartyEnquiry);      // Delete (owner only)

// Optional admin route
// router.get('/', protect, isAdmin, getAllPartyEnquiries);

export default router;