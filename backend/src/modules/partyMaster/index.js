import express from 'express';
import {
  createParty,
  getMyParties,
  getPartyById,
  updateParty,
  deleteParty,
} from './service.js'; // Adjust path if your service is elsewhere
import { protect, restrictTo } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Define who can READ parties (Dropdowns in other modules)
// Parties are central data, so many modules need read access to populate dropdowns.
const READ_ACCESS = [
    'party_master', 
    'confirmed_orders', 
    'party_enquiries', 
    'returns_module',
    'payment_records' 
];

// READ Routes: Allow access if user has ANY of the permissions in READ_ACCESS
router.get('/', protect, restrictTo(READ_ACCESS), getMyParties);
router.get('/list', protect, restrictTo(READ_ACCESS), getMyParties);  // Alias for /list endpoint
router.get('/:id', protect, restrictTo(READ_ACCESS), getPartyById);

// WRITE Routes: Strictly for 'party_master' only
// Only users with specific Party Master permission can create/edit/delete
router.post('/', protect, restrictTo('party_master'), createParty);
router.put('/:id', protect, restrictTo('party_master'), updateParty);
router.delete('/:id', protect, restrictTo('party_master'), deleteParty);

export default router;