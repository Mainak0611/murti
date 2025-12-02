// backend/src/routes/paymentRoutes.js
import express from 'express';
import multer from 'multer';
import { protect } from '../../middleware/authMiddleware.js';

// --- KEY CHANGE HERE ---
// Import from the new Controller location: src/modules/payments/paymentService.js
import {
  getPayments,
  deleteAllPayments,
  uploadCSV,
  addTrackingEntry,
  getTrackingEntries,
  updatePaymentStatus,
  mergePayments,
  updatePaymentDetails,
  updateTrackingEntry,
  deleteTrackingEntry,
  getMergedPayments,
  unmergePayment
} from './paymentService.js'; 

const router = express.Router();

// Use a temp folder for uploads
const upload = multer({ dest: 'tmp/uploads/' });

// --- DEFINITIONS ---

// 1. Main Listing & Cleanup
router.get('/', protect, getPayments);
router.delete('/', protect, deleteAllPayments);

// 2. Upload
router.post('/upload', protect, upload.single('csvFile'), uploadCSV);

// 3. Tracking (History)
router.post('/tracking/:paymentId', protect, addTrackingEntry);
router.get('/tracking/:paymentId', protect, getTrackingEntries);

// 4. Tracking Entry Management (Update/Delete)
router.patch('/tracking/entry/:id', protect, updateTrackingEntry);
router.delete('/tracking/entry/:id', protect, deleteTrackingEntry);

// 5. Payment Status & Details
router.patch('/:id/status', protect, updatePaymentStatus);
router.patch('/:id/details', protect, updatePaymentDetails);

// 6. Merging Logic
router.post('/merge', protect, mergePayments);
router.get('/:id/merged', protect, getMergedPayments);
router.patch('/:id/unmerge', protect, unmergePayment);

export default router;