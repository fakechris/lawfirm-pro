import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { documentController } from '../controllers/documentController';
import { workflowController } from '../controllers/workflowController';

const router = Router();

// Validation schemas
const createDocumentSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  originalName: z.string().min(1, 'Original name is required'),
  path: z.string().min(1, 'Path is required'),
  size: z.number().min(0, 'Size must be non-negative'),
  mimeType: z.string().min(1, 'MIME type is required'),
  caseId: z.string().optional(),
  isConfidential: z.boolean().optional().default(false),
  category: z.enum([
    'LEGAL_BRIEF', 'CONTRACT', 'EVIDENCE', 'CORRESPONDENCE', 
    'COURT_FILING', 'RESEARCH', 'FINANCIAL', 'MEDICAL', 'OTHER'
  ]).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'DELETED', 'UNDER_REVIEW']).optional().default('ACTIVE'),
  description: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  metadata: z.record(z.any()).optional(),
});

const updateDocumentSchema = z.object({
  filename: z.string().min(1, 'Filename is required').optional(),
  originalName: z.string().min(1, 'Original name is required').optional(),
  path: z.string().min(1, 'Path is required').optional(),
  size: z.number().min(0, 'Size must be non-negative').optional(),
  mimeType: z.string().min(1, 'MIME type is required').optional(),
  caseId: z.string().optional(),
  isConfidential: z.boolean().optional(),
  category: z.enum([
    'LEGAL_BRIEF', 'CONTRACT', 'EVIDENCE', 'CORRESPONDENCE', 
    'COURT_FILING', 'RESEARCH', 'FINANCIAL', 'MEDICAL', 'OTHER'
  ]).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'DELETED', 'UNDER_REVIEW']).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

// Get all documents
router.get('/', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const db = new Database();
  await db.connect();

  let documents;
  
  // Admin can see all documents
  if (req.user!.role === 'ADMIN') {
    documents = await db.client.document.findMany({
      include: {
        case: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });
  } 
  // Other users can see documents they uploaded or documents from cases they have access to
  else {
    // Get user's cases (as attorney or client)
    const userCases = await db.client.case.findMany({
      where: {
        OR: [
          { attorney: { userId: req.user!.id } },
          { client: { userId: req.user!.id } },
        ],
      },
      select: { id: true },
    });

    const caseIds = userCases.map(c => c.id);

    documents = await db.client.document.findMany({
      where: {
        OR: [
          { uploadedBy: req.user!.id },
          { caseId: { in: caseIds } },
        ],
      },
      include: {
        case: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  await db.disconnect();

  res.json({
    success: true,
    data: { documents },
  });
}));

// Get document by ID
router.get('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  const db = new Database();
  await db.connect();

  const document = await db.client.document.findUnique({
    where: { id },
    include: {
      case: {
        include: {
          attorney: {
            select: { userId: true },
          },
          client: {
            select: { userId: true },
          },
        },
      },
    },
  });

  await db.disconnect();

  if (!document) {
    throw createError('Document not found', 404);
  }

  // Check if user has permission to view this document
  const hasAccess = 
    req.user!.role === 'ADMIN' ||
    document.uploadedBy === req.user!.id ||
    (document.case && (
      (req.user!.role === 'ATTORNEY' && document.case.attorney.userId === req.user!.id) ||
      (req.user!.role === 'CLIENT' && document.case.client.userId === req.user!.id)
    ));

  if (!hasAccess) {
    throw createError('Access denied', 403);
  }

  res.json({
    success: true,
    data: { document },
  });
}));

// Create document
router.post('/', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const validatedData = createDocumentSchema.parse(req.body);

  const db = new Database();
  await db.connect();

  // If caseId is provided, verify case exists and user has access
  if (validatedData.caseId) {
    const caseRecord = await db.client.case.findUnique({
      where: { id: validatedData.caseId },
      include: {
        attorney: {
          select: { userId: true },
        },
        client: {
          select: { userId: true },
        },
      },
    });

    if (!caseRecord) {
      await db.disconnect();
      throw createError('Case not found', 404);
    }

    // Check if user has permission to add documents to this case
    const hasAccess = 
      req.user!.role === 'ADMIN' ||
      (req.user!.role === 'ATTORNEY' && caseRecord.attorney.userId === req.user!.id) ||
      (req.user!.role === 'CLIENT' && caseRecord.client.userId === req.user!.id);

    if (!hasAccess) {
      await db.disconnect();
      throw createError('Access denied', 403);
    }
  }

  const document = await db.client.document.create({
    data: {
      ...validatedData,
      uploadedBy: req.user!.id,
    },
    include: {
      case: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  await db.disconnect();

  res.status(201).json({
    success: true,
    message: 'Document created successfully',
    data: { document },
  });
}));

// Update document
router.put('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const validatedData = updateDocumentSchema.parse(req.body);

  const db = new Database();
  await db.connect();

  // Check if document exists
  const existingDocument = await db.client.document.findUnique({
    where: { id },
    include: {
      case: {
        include: {
          attorney: {
            select: { userId: true },
          },
          client: {
            select: { userId: true },
          },
        },
      },
    },
  });

  if (!existingDocument) {
    await db.disconnect();
    throw createError('Document not found', 404);
  }

  // Check if user has permission to update this document
  const hasAccess = 
    req.user!.role === 'ADMIN' ||
    existingDocument.uploadedBy === req.user!.id ||
    (existingDocument.case && (
      (req.user!.role === 'ATTORNEY' && existingDocument.case.attorney.userId === req.user!.id) ||
      (req.user!.role === 'CLIENT' && existingDocument.case.client.userId === req.user!.id)
    ));

  if (!hasAccess) {
    await db.disconnect();
    throw createError('Access denied', 403);
  }

  // If updating caseId, verify new case exists and user has access
  if (validatedData.caseId) {
    const caseRecord = await db.client.case.findUnique({
      where: { id: validatedData.caseId },
      include: {
        attorney: {
          select: { userId: true },
        },
        client: {
          select: { userId: true },
        },
      },
    });

    if (!caseRecord) {
      await db.disconnect();
      throw createError('Case not found', 404);
    }

    const caseAccess = 
      req.user!.role === 'ADMIN' ||
      (req.user!.role === 'ATTORNEY' && caseRecord.attorney.userId === req.user!.id) ||
      (req.user!.role === 'CLIENT' && caseRecord.client.userId === req.user!.id);

    if (!caseAccess) {
      await db.disconnect();
      throw createError('Access denied to new case', 403);
    }
  }

  const document = await db.client.document.update({
    where: { id },
    data: validatedData,
    include: {
      case: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  await db.disconnect();

  res.json({
    success: true,
    message: 'Document updated successfully',
    data: { document },
  });
}));

// Delete document
router.delete('/:id', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  const db = new Database();
  await db.connect();

  // Check if document exists
  const existingDocument = await db.client.document.findUnique({
    where: { id },
    include: {
      case: {
        include: {
          attorney: {
            select: { userId: true },
          },
        },
      },
    },
  });

  if (!existingDocument) {
    await db.disconnect();
    throw createError('Document not found', 404);
  }

  // Check if user has permission to delete this document
  const hasAccess = 
    req.user!.role === 'ADMIN' ||
    existingDocument.uploadedBy === req.user!.id ||
    (existingDocument.case && req.user!.role === 'ATTORNEY' && existingDocument.case.attorney.userId === req.user!.id);

  if (!hasAccess) {
    await db.disconnect();
    throw createError('Access denied', 403);
  }

  await db.client.document.delete({
    where: { id },
  });

  await db.disconnect();

  res.json({
    success: true,
    message: 'Document deleted successfully',
  });
}));

// Get documents by case ID
router.get('/case/:caseId', authenticate, asyncHandler(async (req: AuthRequest, res) => {
  const { caseId } = req.params;

  const db = new Database();
  await db.connect();

  // Verify case exists and user has access
  const caseRecord = await db.client.case.findUnique({
    where: { id: caseId },
    include: {
      attorney: {
        select: { userId: true },
      },
      client: {
        select: { userId: true },
      },
    },
  });

  if (!caseRecord) {
    await db.disconnect();
    throw createError('Case not found', 404);
  }

  // Check if user has permission to view this case
  const hasAccess = 
    req.user!.role === 'ADMIN' ||
    (req.user!.role === 'ATTORNEY' && caseRecord.attorney.userId === req.user!.id) ||
    (req.user!.role === 'CLIENT' && caseRecord.client.userId === req.user!.id);

  if (!hasAccess) {
    await db.disconnect();
    throw createError('Access denied', 403);
  }

  const documents = await db.client.document.findMany({
    where: { caseId },
    include: {
      case: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: { uploadedAt: 'desc' },
  });

  await db.disconnect();

  res.json({
    success: true,
    data: { documents },
  });
}));

// Enhanced Document Management Routes (using new comprehensive services)
router.post('/upload', authenticate, documentController.uploadDocument.bind(documentController));
router.get('/:id/download', authenticate, documentController.downloadDocument.bind(documentController));
router.get('/search/documents', authenticate, documentController.searchDocuments.bind(documentController));
router.get('/search/suggestions', authenticate, documentController.getSearchSuggestions.bind(documentController));
router.get('/stats', authenticate, authorize(['ADMIN', 'MANAGER']), documentController.getDocumentStats.bind(documentController));
router.get('/user/documents', authenticate, documentController.getUserDocuments.bind(documentController));
router.post('/:id/versions', authenticate, documentController.createVersion.bind(documentController));
router.get('/:id/versions', authenticate, documentController.getVersions.bind(documentController));
router.post('/:id/reprocess', authenticate, documentController.reprocessDocument.bind(documentController));

// Document Workflow Management Routes
router.post('/:id/workflows', authenticate, workflowController.createWorkflow.bind(workflowController));
router.get('/:id/workflows', authenticate, workflowController.getDocumentWorkflows.bind(workflowController));

export default router;