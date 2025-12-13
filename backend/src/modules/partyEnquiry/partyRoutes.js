// import express from 'express';
// import {
//   createPartyEnquiry,
//   getMyPartyEnquiries,
//   getPartyEnquiryById,
//   updatePartyEnquiry,
//   deletePartyEnquiry,
// //   getAllPartyEnquiries, // Uncomment if using admin route
// } from './partyService.js';
// import { protect } from '../../middleware/authMiddleware.js';

// const router = express.Router();

// // Protected routes - user must be authenticated
// router.post('/', protect, createPartyEnquiry);           // Create

// // --- CHANGED BELOW ---
// router.get('/parties', protect, getMyPartyEnquiries);    // List my enquiries (Changed from /me to /parties)
// // ---------------------

// router.get('/:id', protect, getPartyEnquiryById);        // Get one (owner only)
// router.put('/:id', protect, updatePartyEnquiry);         // Update (owner only)
// router.delete('/:id', protect, deletePartyEnquiry);      // Delete (owner only)

// // Optional admin route
// // router.get('/', protect, isAdmin, getAllPartyEnquiries);

// export default router;

// backend/src/modules/partyEnquiry/partyRoutes.js
import express from 'express';
import {
  createPartyEnquiry,
  getMyPartyEnquiries,
  getPartyEnquiryById,
  updatePartyEnquiry,
  deletePartyEnquiry,
  // getAllPartyEnquiries, // Uncomment if creating an admin dashboard later
} from './partyService.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// --- Protected Routes (User must be logged in) ---

// 1. Create a new Enquiry (Now supports adding items in the payload)
router.post('/', protect, createPartyEnquiry);

// 2. List all Enquiries for the logged-in user
router.get('/parties', protect, getMyPartyEnquiries);

// 3. Get a specific Enquiry (Now returns the 'items' list too)
router.get('/:id', protect, getPartyEnquiryById);

// 4. Update an Enquiry (Supports updating/replacing items)
router.put('/:id', protect, updatePartyEnquiry);

// 5. Delete an Enquiry (Cascades and deletes linked items automatically)
router.delete('/:id', protect, deletePartyEnquiry);

export default router;