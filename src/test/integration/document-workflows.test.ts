import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import documentsRoutes from '../../routes/documents';

// Mock the authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'ATTORNEY'
    };
    next();
  },
  authorize: () => (req: any, res: any, next: any) => next()
}));

// Mock the PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    document: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    documentWorkflow: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    documentWorkflowStep: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn()
    },
    case: {
      findFirst: jest.fn()
    }
  }))
}));

// Mock the documentStorageService
jest.mock('../../services/documents', () => ({
  documentStorageService: {
    validateFile: jest.fn(),
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
    downloadFile: jest.fn(),
    calculateFileHash: jest.fn(),
    readFile: jest.fn()
  }
}));

// Mock the documentMetadataService and documentSearchService
jest.mock('../../services/documents/metadata', () => ({
  extractMetadata: jest.fn()
}));

jest.mock('../../services/documents/searchService', () => ({
  indexDocument: jest.fn(),
  removeFromIndex: jest.fn()
}));

const app = express();
app.use(express.json());
app.use('/api/documents', documentsRoutes);

describe('Document Workflow Integration API', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = new PrismaClient();
    jest.clearAllMocks();
  });

  describe('POST /api/documents/:id/workflows', () => {
    it('should create workflow for document', async () => {
      const mockDocument = {
        id: 'document-id',
        uploadedBy: 'test-user-id',
        case: {
          attorney: { userId: 'test-user-id' }
        }
      };

      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.documentWorkflow.findFirst.mockResolvedValue(null); // No active workflow

      const mockWorkflow = {
        id: 'workflow-id',
        name: 'Document Review',
        documentId: 'document-id',
        status: 'PENDING',
        startedBy: 'test-user-id'
      };

      prisma.documentWorkflow.create.mockResolvedValue({
        ...mockWorkflow,
        document: {
          id: 'document-id',
          filename: 'test.pdf',
          originalName: 'test.pdf'
        },
        startedByUser: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        },
        steps: []
      });

      const response = await request(app)
        .post('/api/documents/document-id/workflows')
        .send({
          name: 'Document Review',
          description: 'Review and approve document',
          priority: 'HIGH',
          steps: [
            {
              name: 'Initial Review',
              description: 'Review document content',
              order: 0
            },
            {
              name: 'Final Approval',
              description: 'Approve document for use',
              order: 1
            }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Document Review');
    });

    it('should return 404 if document not found', async () => {
      prisma.document.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/documents/non-existent/workflows')
        .send({
          name: 'Document Review'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 if user lacks access to document', async () => {
      const mockDocument = {
        id: 'document-id',
        uploadedBy: 'other-user',
        case: {
          attorney: { userId: 'other-attorney' }
        }
      };

      prisma.document.findUnique.mockResolvedValue(mockDocument);

      const response = await request(app)
        .post('/api/documents/document-id/workflows')
        .send({
          name: 'Document Review'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 if document already has active workflow', async () => {
      const mockDocument = {
        id: 'document-id',
        uploadedBy: 'test-user-id',
        case: {
          attorney: { userId: 'test-user-id' }
        }
      };

      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.documentWorkflow.findFirst.mockResolvedValue({
        id: 'existing-workflow',
        status: 'IN_PROGRESS'
      });

      const response = await request(app)
        .post('/api/documents/document-id/workflows')
        .send({
          name: 'Document Review'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/documents/:id/workflows', () => {
    it('should return workflows for document', async () => {
      const mockDocument = {
        id: 'document-id',
        uploadedBy: 'test-user-id',
        case: {
          attorney: { userId: 'test-user-id' }
        }
      };

      const mockWorkflows = [
        {
          id: 'workflow-1',
          name: 'Review Process',
          documentId: 'document-id',
          status: 'IN_PROGRESS',
          priority: 'HIGH'
        },
        {
          id: 'workflow-2',
          name: 'Approval Process',
          documentId: 'document-id',
          status: 'COMPLETED',
          priority: 'MEDIUM'
        }
      ];

      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.documentWorkflow.findMany.mockResolvedValue(mockWorkflows.map(w => ({
        ...w,
        document: {
          id: 'document-id',
          filename: 'test.pdf',
          originalName: 'test.pdf'
        },
        startedByUser: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        },
        steps: []
      })));

      prisma.documentWorkflow.count.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/documents/document-id/workflows');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.workflows).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(2);
    });

    it('should filter workflows by status', async () => {
      const mockDocument = {
        id: 'document-id',
        uploadedBy: 'test-user-id',
        case: {
          attorney: { userId: 'test-user-id' }
        }
      };

      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.documentWorkflow.findMany.mockResolvedValue([]);
      prisma.documentWorkflow.count.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/documents/document-id/workflows?status=COMPLETED');

      expect(response.status).toBe(200);
      expect(prisma.documentWorkflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            documentId: 'document-id',
            status: 'COMPLETED'
          })
        })
      );
    });

    it('should filter workflows by priority', async () => {
      const mockDocument = {
        id: 'document-id',
        uploadedBy: 'test-user-id',
        case: {
          attorney: { userId: 'test-user-id' }
        }
      };

      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.documentWorkflow.findMany.mockResolvedValue([]);
      prisma.documentWorkflow.count.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/documents/document-id/workflows?priority=HIGH');

      expect(response.status).toBe(200);
      expect(prisma.documentWorkflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            documentId: 'document-id',
            priority: 'HIGH'
          })
        })
      );
    });

    it('should paginate workflows', async () => {
      const mockDocument = {
        id: 'document-id',
        uploadedBy: 'test-user-id',
        case: {
          attorney: { userId: 'test-user-id' }
        }
      };

      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.documentWorkflow.findMany.mockResolvedValue([]);
      prisma.documentWorkflow.count.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/documents/document-id/workflows?limit=10&offset=20');

      expect(response.status).toBe(200);
      expect(prisma.documentWorkflow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10
        })
      );
    });
  });

  describe('Workflow Step Management Integration', () => {
    it('should handle workflow creation with steps', async () => {
      const mockDocument = {
        id: 'document-id',
        uploadedBy: 'test-user-id',
        case: {
          attorney: { userId: 'test-user-id' }
        }
      };

      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.documentWorkflow.findFirst.mockResolvedValue(null);

      const mockWorkflow = {
        id: 'workflow-id',
        name: 'Multi-step Review',
        documentId: 'document-id',
        startedBy: 'test-user-id'
      };

      prisma.documentWorkflow.create.mockResolvedValue({
        ...mockWorkflow,
        document: {
          id: 'document-id',
          filename: 'test.pdf',
          originalName: 'test.pdf'
        },
        startedByUser: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        },
        steps: []
      });

      prisma.documentWorkflowStep.createMany.mockResolvedValue({ count: 2 });

      const response = await request(app)
        .post('/api/documents/document-id/workflows')
        .send({
          name: 'Multi-step Review',
          steps: [
            {
              name: 'Step 1',
              description: 'First review step',
              order: 0
            },
            {
              name: 'Step 2',
              description: 'Second review step',
              order: 1
            }
          ]
        });

      expect(response.status).toBe(201);
      expect(prisma.documentWorkflowStep.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              name: 'Step 1',
              order: 0
            }),
            expect.objectContaining({
              name: 'Step 2',
              order: 1
            })
          ])
        })
      );
    });
  });

  describe('Workflow Status Updates', () => {
    it('should handle workflow status transitions', async () => {
      const mockDocument = {
        id: 'document-id',
        uploadedBy: 'test-user-id',
        case: {
          attorney: { userId: 'test-user-id' }
        }
      };

      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.documentWorkflow.findMany.mockResolvedValue([{
        id: 'workflow-id',
        name: 'Test Workflow',
        documentId: 'document-id',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        document: {
          id: 'document-id',
          filename: 'test.pdf',
          originalName: 'test.pdf'
        },
        startedByUser: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        },
        steps: []
      }]);

      prisma.documentWorkflow.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/documents/document-id/workflows?status=IN_PROGRESS');

      expect(response.status).toBe(200);
      expect(response.body.data.workflows[0].status).toBe('IN_PROGRESS');
    });
  });
});