import express from 'express';
import {
  createPartyEnquiry,
  getMyPartyEnquiries,
  getPartyEnquiryById,
  updatePartyEnquiry,
  deletePartyEnquiry,
  confirmPartyEnquiry, 
} from './partyService.js';
import { protect, restrictTo } from '../../middleware/authMiddleware.js';

const router = express.Router();

// --- CONFIGURATION ---
// 1. Who can VIEW the list of parties (for dropdowns in Orders, Payments, etc.)?
const READ_ACCESS = [
    'party_enquiries', 
    'confirmed_orders', 
    'payment_records'  // Useful if you filter payments by Party Name
];

// 2. Who can MANAGE (Create/Edit/Delete) parties?
const WRITE_ACCESS = 'party_enquiries';


// --- ROUTES ---

// READ Routes: Allow access if user has ANY of the permissions in READ_ACCESS
router.get('/parties', protect, restrictTo(READ_ACCESS), getMyPartyEnquiries);
router.get('/:id', protect, restrictTo(READ_ACCESS), getPartyEnquiryById);

// WRITE Routes: Strictly for 'party_enquiries' only
router.post('/', protect, restrictTo(WRITE_ACCESS), createPartyEnquiry);
router.put('/:id', protect, restrictTo(WRITE_ACCESS), updatePartyEnquiry);
router.delete('/:id', protect, restrictTo(WRITE_ACCESS), deletePartyEnquiry);

// Special Action: Confirming requires Write Access
router.post('/:id/confirm', protect, restrictTo(WRITE_ACCESS), confirmPartyEnquiry);

export default router;