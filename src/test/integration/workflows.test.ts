import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import workflowRoutes from '../../routes/workflows';

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
    documentWorkflow: {
      create: jest.fn(),
      findMany: jest.fn(),
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
    document: {
      findUnique: jest.fn()
    },
    case: {
      findFirst: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    }
  }))
}));

const app = express();
app.use(express.json());
app.use('/api/workflows', workflowRoutes);

describe('Workflow API', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = new PrismaClient();
    jest.clearAllMocks();
  });

  describe('GET /api/workflows/:id', () => {
    it('should return specific workflow', async () => {
      const mockWorkflow = {
        id: 'workflow-id',
        name: 'Review Process',
        documentId: 'document-id',
        status: 'IN_PROGRESS',
        startedBy: 'test-user-id'
      };

      prisma.documentWorkflow.findUnique.mockResolvedValue({
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

      prisma.case.findFirst.mockResolvedValue({
        id: 'case-id',
        attorney: { userId: 'test-user-id' }
      });

      const response = await request(app)
        .get('/api/workflows/workflow-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Review Process');
    });

    it('should return 404 if workflow not found', async () => {
      prisma.documentWorkflow.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/workflows/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/workflows/:id', () => {
    it('should update workflow', async () => {
      const mockWorkflow = {
        id: 'workflow-id',
        name: 'Updated Review Process',
        documentId: 'document-id',
        status: 'COMPLETED',
        startedBy: 'test-user-id'
      };

      prisma.documentWorkflow.findUnique.mockResolvedValue({
        id: 'workflow-id',
        startedBy: 'test-user-id',
        document: {
          id: 'document-id',
          case: {
            attorney: { userId: 'test-user-id' }
          }
        }
      });

      prisma.documentWorkflow.update.mockResolvedValue({
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
        .put('/api/workflows/workflow-id')
        .send({
          name: 'Updated Review Process',
          status: 'COMPLETED'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Review Process');
    });

    it('should return 403 if user lacks permission to update', async () => {
      prisma.documentWorkflow.findUnique.mockResolvedValue({
        id: 'workflow-id',
        startedBy: 'other-user',
        document: {
          id: 'document-id',
          case: {
            attorney: { userId: 'test-user-id' }
          }
        }
      });

      const response = await request(app)
        .put('/api/workflows/workflow-id')
        .send({ name: 'Updated Workflow' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/workflows/:id', () => {
    it('should delete workflow', async () => {
      prisma.documentWorkflow.findUnique.mockResolvedValue({
        id: 'workflow-id',
        startedBy: 'test-user-id',
        document: {
          id: 'document-id',
          case: {
            attorney: { userId: 'test-user-id' }
          }
        }
      });

      prisma.documentWorkflowStep.deleteMany.mockResolvedValue({ count: 1 });
      prisma.documentWorkflow.delete.mockResolvedValue({});

      const response = await request(app)
        .delete('/api/workflows/workflow-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/workflows/:id/steps', () => {
    it('should add step to workflow', async () => {
      const mockWorkflow = {
        id: 'workflow-id',
        startedBy: 'test-user-id',
        document: {
          id: 'document-id',
          case: {
            attorney: { userId: 'test-user-id' }
          }
        }
      };

      prisma.documentWorkflow.findUnique.mockResolvedValue(mockWorkflow);

      const stepData = {
        id: 'step-id',
        workflowId: 'workflow-id',
        name: 'Initial Review',
        order: 1
      };

      prisma.documentWorkflowStep.create.mockResolvedValue({
        ...stepData,
        assignedToUser: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        }
      });

      const response = await request(app)
        .post('/api/workflows/workflow-id/steps')
        .send({
          name: 'Initial Review',
          order: 1
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Initial Review');
    });

    it('should return 403 if user lacks permission to add steps', async () => {
      prisma.documentWorkflow.findUnique.mockResolvedValue({
        id: 'workflow-id',
        startedBy: 'other-user',
        document: {
          id: 'document-id',
          case: {
            attorney: { userId: 'test-user-id' }
          }
        }
      });

      const response = await request(app)
        .post('/api/workflows/workflow-id/steps')
        .send({
          name: 'Initial Review',
          order: 1
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/workflows/:id/steps/:stepId', () => {
    it('should update workflow step', async () => {
      const mockStep = {
        id: 'step-id',
        workflowId: 'workflow-id',
        name: 'Updated Step',
        workflow: {
          startedBy: 'test-user-id',
          document: {
            id: 'document-id',
            case: {
              attorney: { userId: 'test-user-id' }
            }
          }
        }
      };

      prisma.documentWorkflowStep.findUnique.mockResolvedValue(mockStep);

      const updatedStep = {
        id: 'step-id',
        name: 'Updated Step',
        status: 'COMPLETED'
      };

      prisma.documentWorkflowStep.update.mockResolvedValue({
        ...updatedStep,
        assignedToUser: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        }
      });

      const response = await request(app)
        .put('/api/workflows/workflow-id/steps/step-id')
        .send({
          name: 'Updated Step',
          status: 'COMPLETED'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('COMPLETED');
    });

    it('should return 403 if user lacks permission to update step', async () => {
      prisma.documentWorkflowStep.findUnique.mockResolvedValue({
        id: 'step-id',
        workflowId: 'workflow-id',
        workflow: {
          startedBy: 'other-user',
          assignedTo: 'other-user',
          document: {
            id: 'document-id',
            case: {
              attorney: { userId: 'test-user-id' }
            }
          }
        }
      });

      const response = await request(app)
        .put('/api/workflows/workflow-id/steps/step-id')
        .send({ status: 'COMPLETED' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/workflows/document/:documentId', () => {
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
          status: 'IN_PROGRESS'
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

      prisma.documentWorkflow.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/workflows/document/document-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.workflows).toHaveLength(1);
    });

    it('should return 404 if document not found', async () => {
      prisma.document.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/workflows/document/non-existent');

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
        .get('/api/workflows/document/document-id');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
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
        .get('/api/workflows/document/document-id?status=COMPLETED');

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
  });
});