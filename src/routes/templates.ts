import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { templateController } from '../controllers/templateController';
import multer from 'multer';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for templates
  },
  fileFilter: (req, file, cb) => {
    // Accept common document template formats
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/pdf', // .pdf
      'application/msword', // .doc
      'application/vnd.ms-excel', // .xls
      'application/vnd.ms-powerpoint', // .ppt
      'text/plain', // .txt
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only document templates are allowed.'), false);
    }
  }
});

// Create template
router.post('/', 
  authenticate,
  upload.single('file'),
  templateController.createTemplate.bind(templateController)
);

// Get all templates
router.get('/', 
  authenticate,
  templateController.getTemplates.bind(templateController)
);

// Get specific template
router.get('/:id', 
  authenticate,
  templateController.getTemplate.bind(templateController)
);

// Update template
router.put('/:id', 
  authenticate,
  templateController.updateTemplate.bind(templateController)
);

// Delete template
router.delete('/:id', 
  authenticate,
  templateController.deleteTemplate.bind(templateController)
);

// Generate document from template
router.post('/:id/generate', 
  authenticate,
  templateController.generateFromTemplate.bind(templateController)
);

// Download template
router.get('/:id/download', 
  authenticate,
  templateController.downloadTemplate.bind(templateController)
);

export default router;