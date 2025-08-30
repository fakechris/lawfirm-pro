import { Router, Request, Response } from 'express';
import { DocumentService } from '../../services/documents/documentService';
import { PrismaClient } from '@prisma/client';
import { multer } from 'multer';
import { authMiddleware } from '../../middleware/auth';
import { validateRequest } from '../../utils/validation';
import { z } from 'zod';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Initialize services
const prisma = new PrismaClient();
const documentService = new DocumentService(prisma);

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Validation schemas
const uploadDocumentSchema = z.object({
  caseId: z.string().optional(),
  isConfidential: z.boolean().optional().default(false),
  isTemplate: z.boolean().optional().default(false),
  category: z.enum(['LEGAL_BRIEF', 'CONTRACT', 'EVIDENCE', 'CORRESPONDENCE', 'COURT_FILING', 'RESEARCH', 'FINANCIAL', 'MEDICAL', 'OTHER']).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional()
});

const updateDocumentSchema = z.object({
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isConfidential: z.boolean().optional(),
  category: z.enum(['LEGAL_BRIEF', 'CONTRACT', 'EVIDENCE', 'CORRESPONDENCE', 'COURT_FILING', 'RESEARCH', 'FINANCIAL', 'MEDICAL', 'OTHER']).optional(),
  metadata: z.record(z.unknown()).optional()
});

const searchSchema = z.object({
  query: z.string().min(1),
  caseId: z.string().optional(),
  category: z.enum(['LEGAL_BRIEF', 'CONTRACT', 'EVIDENCE', 'CORRESPONDENCE', 'COURT_FILING', 'RESEARCH', 'FINANCIAL', 'MEDICAL', 'OTHER']).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0)
});

const shareDocumentSchema = z.object({
  sharedWith: z.string(),
  permission: z.enum(['VIEW', 'COMMENT', 'EDIT', 'DOWNLOAD']),
  expiresAt: z.date().optional(),
  message: z.string().optional()
});

// Document upload
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const validation = uploadDocumentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid input', details: validation.error.issues });
    }

    const { user } = req as any;
    const file = req.file;

    const result = await documentService.uploadDocument(
      file.buffer,
      file.originalname,
      file.mimetype,
      {
        ...validation.data,
        uploadedBy: user.id
      }
    );

    if (result.success) {
      res.status(201).json({
        message: 'Document uploaded successfully',
        document: result
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Document upload failed:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Get document
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const document = await documentService.getDocument(req.params.id);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access permissions
    const hasAccess = await checkDocumentAccess(req.params.id, (req as any).user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ document });
  } catch (error) {
    console.error('Failed to get document:', error);
    res.status(500).json({ error: 'Failed to get document' });
  }
});

// Update document
router.put('/:id', validateRequest(updateDocumentSchema), async (req: Request, res: Response) => {
  try {
    const document = await documentService.getDocument(req.params.id);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if user can edit
    if (document.uploadedBy !== (req as any).user.id) && (req as any).user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedDocument = await documentService.updateDocument(req.params.id, req.body);
    res.json({ document: updatedDocument });
  } catch (error) {
    console.error('Failed to update document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Delete document
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const document = await documentService.getDocument(req.params.id);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if user can delete
    if (document.uploadedBy !== (req as any).user.id && (req as any).user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await documentService.deleteDocument(req.params.id);
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Failed to delete document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// List documents
router.get('/', validateRequest(z.object({
  caseId: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0)
})), async (req: Request, res: Response) => {
  try {
    const documents = await documentService.getDocuments(req.query as any);
    res.json({ documents });
  } catch (error) {
    console.error('Failed to list documents:', error);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

// Search documents
router.post('/search', validateRequest(searchSchema), async (req: Request, res: Response) => {
  try {
    const results = await documentService.searchDocuments(req.body.query, req.body);
    res.json({ results });
  } catch (error) {
    console.error('Document search failed:', error);
    res.status(500).json({ error: 'Failed to search documents' });
  }
});

// Search by OCR text
router.post('/search-ocr', validateRequest(searchSchema), async (req: Request, res: Response) => {
  try {
    const results = await documentService.searchByOCRText(req.body.query, req.body);
    res.json({ results });
  } catch (error) {
    console.error('OCR search failed:', error);
    res.status(500).json({ error: 'Failed to search OCR text' });
  }
});

// Create document version
router.post('/:id/versions', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const document = await documentService.getDocument(req.params.id);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if user can edit
    if (document.uploadedBy !== (req as any).user.id && (req as any).user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await documentService.createVersion(
      req.params.id,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      req.body.changeDescription
    );

    if (result.success) {
      res.status(201).json({
        message: 'Document version created successfully',
        version: result
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Failed to create document version:', error);
    res.status(500).json({ error: 'Failed to create document version' });
  }
});

// Get document versions
router.get('/:id/versions', async (req: Request, res: Response) => {
  try {
    const document = await documentService.getDocument(req.params.id);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access permissions
    const hasAccess = await checkDocumentAccess(req.params.id, (req as any).user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const versions = await documentService.getDocumentVersions(req.params.id);
    res.json({ versions });
  } catch (error) {
    console.error('Failed to get document versions:', error);
    res.status(500).json({ error: 'Failed to get document versions' });
  }
});

// Download document
router.get('/:id/download', async (req: Request, res: Response) => {
  try {
    const document = await documentService.getDocument(req.params.id);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access permissions
    const hasAccess = await checkDocumentAccess(req.params.id, (req as any).user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const versionNumber = req.query.version ? parseInt(req.query.version as string) : undefined;
    const downloadResult = await documentService.downloadDocument(req.params.id, versionNumber);

    if (!downloadResult) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.setHeader('Content-Type', downloadResult.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadResult.filename}"`);
    res.send(downloadResult.buffer);
  } catch (error) {
    console.error('Failed to download document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// Reprocess OCR
router.post('/:id/reprocess-ocr', async (req: Request, res: Response) => {
  try {
    const result = await documentService.reprocessOCR(req.params.id);
    
    if (result.success) {
      res.json({ message: 'OCR reprocessing completed', result });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Failed to reprocess OCR:', error);
    res.status(500).json({ error: 'Failed to reprocess OCR' });
  }
});

// Validate OCR quality
router.get('/:id/ocr-quality', async (req: Request, res: Response) => {
  try {
    const quality = await documentService.validateOCRQuality(req.params.id);
    res.json(quality);
  } catch (error) {
    console.error('Failed to validate OCR quality:', error);
    res.status(500).json({ error: 'Failed to validate OCR quality' });
  }
});

// Share document
router.post('/:id/share', validateRequest(shareDocumentSchema), async (req: Request, res: Response) => {
  try {
    const document = await documentService.getDocument(req.params.id);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if user can share
    if (document.uploadedBy !== (req as any).user.id && (req as any).user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { sharedWith, permission, expiresAt, message } = req.body;

    // Create share record
    const share = await prisma.documentShare.create({
      data: {
        documentId: req.params.id,
        sharedBy: (req as any).user.id,
        sharedWith,
        permission,
        expiresAt,
        message,
        accessKey: Math.random().toString(36).substring(2, 15)
      }
    });

    res.json({
      message: 'Document shared successfully',
      share: {
        id: share.id,
        accessKey: share.accessKey,
        permission: share.permission,
        expiresAt: share.expiresAt
      }
    });
  } catch (error) {
    console.error('Failed to share document:', error);
    res.status(500).json({ error: 'Failed to share document' });
  }
});

// Get document shares
router.get('/:id/shares', async (req: Request, res: Response) => {
  try {
    const document = await documentService.getDocument(req.params.id);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if user can view shares
    if (document.uploadedBy !== (req as any).user.id && (req as any).user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const shares = await prisma.documentShare.findMany({
      where: { documentId: req.params.id },
      include: {
        sharedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        sharedWithUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ shares });
  } catch (error) {
    console.error('Failed to get document shares:', error);
    res.status(500).json({ error: 'Failed to get document shares' });
  }
});

// Get document statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await documentService.getDocumentStats();
    const ocrStats = await documentService.getOCRStats();
    
    res.json({
      documentStats: stats,
      ocrStats
    });
  } catch (error) {
    console.error('Failed to get document statistics:', error);
    res.status(500).json({ error: 'Failed to get document statistics' });
  }
});

// Helper function to check document access
async function checkDocumentAccess(documentId: string, userId: string): Promise<boolean> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      uploadedBy: true,
      caseId: true
    }
  });

  if (!document) return false;
  if (document.uploadedBy === userId) return true;

  // Check case access
  if (document.caseId) {
    const caseAccess = await prisma.case.findFirst({
      where: {
        id: document.caseId,
        OR: [
          { clientId: userId },
          { attorneyId: userId }
        ]
      }
    });
    if (caseAccess) return true;
  }

  // Check shared access
  const sharedAccess = await prisma.documentShare.findFirst({
    where: {
      documentId,
      sharedWith: userId,
      expiresAt: {
        gt: new Date()
      }
    }
  });

  return !!sharedAccess;
}

export default router;