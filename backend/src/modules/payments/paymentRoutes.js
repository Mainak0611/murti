import express from 'express';
import multer from 'multer';
import { protect, restrictTo } from '../../middleware/authMiddleware.js';
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
const upload = multer({ dest: 'tmp/uploads/' });

// --- All routes require 'payment_records' permission ---

// 1. Main Listing & Cleanup
router.get('/', protect, restrictTo('payment_records'), getPayments);
router.delete('/', protect, restrictTo('payment_records'), deleteAllPayments);

// 2. Upload
router.post('/upload', protect, restrictTo('payment_records'), upload.single('csvFile'), uploadCSV);

// 3. Tracking (History)
router.post('/tracking/:paymentId', protect, restrictTo('payment_records'), addTrackingEntry);
router.get('/tracking/:paymentId', protect, restrictTo('payment_records'), getTrackingEntries);

// 4. Tracking Entry Management
router.patch('/tracking/entry/:id', protect, restrictTo('payment_records'), updateTrackingEntry);
router.delete('/tracking/entry/:id', protect, restrictTo('payment_records'), deleteTrackingEntry);

// 5. Payment Status & Details
router.patch('/:id/status', protect, restrictTo('payment_records'), updatePaymentStatus);
router.patch('/:id/details', protect, restrictTo('payment_records'), updatePaymentDetails);

// 6. Merging Logic
router.post('/merge', protect, restrictTo('payment_records'), mergePayments);
router.get('/:id/merged', protect, restrictTo('payment_records'), getMergedPayments);
router.patch('/:id/unmerge', protect, restrictTo('payment_records'), unmergePayment);

export default router;
