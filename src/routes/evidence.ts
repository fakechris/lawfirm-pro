import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { evidenceController } from '../controllers/evidenceController';
import multer from 'multer';

const router = Router();

// Configure multer for evidence file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for evidence files
  },
  fileFilter: (req, file, cb) => {
    // Accept common evidence file types
    const allowedMimes = [
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/tiff',
      
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      
      // Audio
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/webm',
      
      // Video
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-ms-wmv',
      'video/webm',
      
      // Archives
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      
      // Text files
      'text/plain',
      'text/csv',
      'application/json'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload a supported evidence file format.'), false);
    }
  }
});

// Create evidence with optional file upload
router.post('/', 
  authenticate,
  upload.single('file'),
  evidenceController.createEvidence.bind(evidenceController)
);

// Get evidence by ID
router.get('/:id', 
  authenticate,
  evidenceController.getEvidence.bind(evidenceController)
);

// Update evidence
router.put('/:id', 
  authenticate,
  evidenceController.updateEvidence.bind(evidenceController)
);

// Delete evidence
router.delete('/:id', 
  authenticate,
  evidenceController.deleteEvidence.bind(evidenceController)
);

// Search evidence
router.get('/search', 
  authenticate,
  evidenceController.searchEvidence.bind(evidenceController)
);

// Add chain of custody entry
router.post('/:id/chain', 
  authenticate,
  evidenceController.addToChainOfCustody.bind(evidenceController)
);

// Get chain of custody
router.get('/:id/chain', 
  authenticate,
  evidenceController.getChainOfCustody.bind(evidenceController)
);

// Download evidence file
router.get('/:id/download', 
  authenticate,
  evidenceController.downloadEvidence.bind(evidenceController)
);

export default router;