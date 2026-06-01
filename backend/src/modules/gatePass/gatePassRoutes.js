// backend/src/modules/gatePass/gatePassRoutes.js
// Express routes for gate pass image upload and extraction

import express from 'express';
import multer from 'multer';
import path from 'path';
import { extractGatePass } from './gatePassService.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// ── Multer configuration for gate pass images ──────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'tmp/');
  },
  filename: (req, file, cb) => {
    // Unique filename: gatepass-{timestamp}-{random}.{ext}
    const ext = path.extname(file.originalname) || '.jpg';
    const uniqueName = `gatepass-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, uniqueName);
  },
});

const imageUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'image/tiff',
    ];

    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error('Only image files (JPEG, PNG, WebP) are allowed.'), false);
    }
    cb(null, true);
  },
});

// ── Routes ─────────────────────────────────────────────────

// POST /api/gate-pass/extract
// Upload a gate pass image and extract data using OCR
router.post(
  '/extract',
  protect,                            // Auth required
  imageUpload.single('image'),        // Accept single file with field name 'image'
  extractGatePass                     // Process extraction
);

// Error handling for multer errors
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB.',
      });
    }
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`,
    });
  }
  
  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }
  
  next();
});

export default router;
