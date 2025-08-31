import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import templateRoutes from '../../routes/templates';
import { authenticate } from '../../middleware/auth';

// Mock the authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'ADMIN'
    };
    next();
  },
  authorize: () => (req: any, res: any, next: any) => next()
}));

// Mock the PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    documentTemplate: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    }
  }))
}));

// Mock the documentStorageService
jest.mock('../../services/documents', () => ({
  documentStorageService: {
    validateFile: jest.fn(),
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
    readFile: jest.fn(),
    calculateFileHash: jest.fn()
  }
}));

const app = express();
app.use(express.json());
app.use('/api/templates', templateRoutes);

describe('Template API', () => {
  let prisma: any;
  let mockStorage: any;

  beforeEach(() => {
    prisma = new PrismaClient();
    mockStorage = require('../../services/documents').documentStorageService;
    jest.clearAllMocks();
  });

  describe('POST /api/templates', () => {
    it('should create a new template with valid data', async () => {
      const mockTemplate = {
        id: 'template-id',
        name: 'Test Template',
        description: 'Test description',
        category: 'CONTRACT',
        filePath: '/path/to/template.docx',
        isPublic: false,
        createdBy: 'test-user-id',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockStorage.validateFile.mockResolvedValue({ isValid: true });
      mockStorage.uploadFile.mockResolvedValue({
        success: true,
        filePath: '/path/to/template.docx',
        filename: 'template.docx',
        size: 1024
      });

      prisma.documentTemplate.create.mockResolvedValue({
        ...mockTemplate,
        createdByUser: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        },
        _count: { generatedDocuments: 0 }
      });

      const response = await request(app)
        .post('/api/templates')
        .field('name', 'Test Template')
        .field('description', 'Test description')
        .field('category', 'CONTRACT')
        .field('isPublic', 'false')
        .attach('file', Buffer.from('test content'), 'template.docx');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Template');
    });

    it('should return 400 if no file is uploaded', async () => {
      const response = await request(app)
        .post('/api/templates')
        .field('name', 'Test Template')
        .field('description', 'Test description');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 if file validation fails', async () => {
      mockStorage.validateFile.mockResolvedValue({
        isValid: false,
        error: 'Invalid file type'
      });

      const response = await request(app)
        .post('/api/templates')
        .field('name', 'Test Template')
        .attach('file', Buffer.from('test content'), 'template.docx');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/templates', () => {
    it('should return list of templates', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          name: 'Template 1',
          category: 'CONTRACT',
          isPublic: true,
          createdBy: 'user-1',
          createdAt: new Date()
        },
        {
          id: 'template-2',
          name: 'Template 2',
          category: 'LEGAL_BRIEF',
          isPublic: false,
          createdBy: 'test-user-id',
          createdAt: new Date()
        }
      ];

      prisma.documentTemplate.findMany.mockResolvedValue(mockTemplates.map(template => ({
        ...template,
        createdByUser: {
          id: template.createdBy,
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        },
        _count: { generatedDocuments: 0 }
      })));

      prisma.documentTemplate.count.mockResolvedValue(2);

      const response = await request(app)
        .get('/api/templates');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.templates).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(2);
    });

    it('should filter templates by category', async () => {
      prisma.documentTemplate.findMany.mockResolvedValue([]);
      prisma.documentTemplate.count.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/templates?category=CONTRACT');

      expect(response.status).toBe(200);
      expect(prisma.documentTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'CONTRACT'
          })
        })
      );
    });
  });

  describe('GET /api/templates/:id', () => {
    it('should return specific template', async () => {
      const mockTemplate = {
        id: 'template-id',
        name: 'Test Template',
        description: 'Test description',
        category: 'CONTRACT',
        isPublic: true,
        createdBy: 'user-1',
        createdAt: new Date()
      };

      prisma.documentTemplate.findUnique.mockResolvedValue({
        ...mockTemplate,
        createdByUser: {
          id: 'user-1',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        },
        generatedDocuments: [],
        _count: { generatedDocuments: 0 }
      });

      const response = await request(app)
        .get('/api/templates/template-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Template');
    });

    it('should return 404 if template not found', async () => {
      prisma.documentTemplate.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/templates/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 if user lacks access to private template', async () => {
      const mockTemplate = {
        id: 'template-id',
        name: 'Private Template',
        isPublic: false,
        createdBy: 'other-user'
      };

      prisma.documentTemplate.findUnique.mockResolvedValue(mockTemplate);

      const response = await request(app)
        .get('/api/templates/template-id');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/templates/:id', () => {
    it('should update template', async () => {
      const mockTemplate = {
        id: 'template-id',
        name: 'Updated Template',
        description: 'Updated description',
        category: 'CONTRACT',
        isPublic: true,
        createdBy: 'test-user-id'
      };

      prisma.documentTemplate.findUnique.mockResolvedValue({
        id: 'template-id',
        createdBy: 'test-user-id'
      });

      prisma.documentTemplate.update.mockResolvedValue({
        ...mockTemplate,
        createdByUser: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        },
        _count: { generatedDocuments: 0 }
      });

      const response = await request(app)
        .put('/api/templates/template-id')
        .send({
          name: 'Updated Template',
          description: 'Updated description'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Template');
    });

    it('should return 403 if user lacks permission to update', async () => {
      prisma.documentTemplate.findUnique.mockResolvedValue({
        id: 'template-id',
        createdBy: 'other-user'
      });

      const response = await request(app)
        .put('/api/templates/template-id')
        .send({ name: 'Updated Template' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/templates/:id', () => {
    it('should delete template', async () => {
      prisma.documentTemplate.findUnique.mockResolvedValue({
        id: 'template-id',
        createdBy: 'test-user-id',
        filePath: '/path/to/template.docx',
        _count: { generatedDocuments: 0 }
      });

      mockStorage.deleteFile.mockResolvedValue(true);
      prisma.documentTemplate.delete.mockResolvedValue({});

      const response = await request(app)
        .delete('/api/templates/template-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockStorage.deleteFile).toHaveBeenCalledWith('/path/to/template.docx');
    });

    it('should return 400 if template has generated documents', async () => {
      prisma.documentTemplate.findUnique.mockResolvedValue({
        id: 'template-id',
        createdBy: 'test-user-id',
        _count: { generatedDocuments: 5 }
      });

      const response = await request(app)
        .delete('/api/templates/template-id');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/templates/:id/generate', () => {
    it('should generate document from template', async () => {
      const mockTemplate = {
        id: 'template-id',
        name: 'Test Template',
        isPublic: true,
        createdBy: 'user-1',
        variableSchema: {
          clientName: { type: 'string', required: true }
        }
      };

      prisma.documentTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockStorage.readFile.mockResolvedValue(Buffer.from('Hello {{clientName}}!'));
      mockStorage.uploadFile.mockResolvedValue({
        success: true,
        filePath: '/path/to/generated.docx',
        filename: 'generated.docx',
        size: 1024
      });

      prisma.document.create.mockResolvedValue({
        id: 'generated-doc-id',
        filename: 'generated.docx',
        originalName: 'generated.docx'
      });

      const response = await request(app)
        .post('/api/templates/template-id/generate')
        .send({
          variables: { clientName: 'John Doe' }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.documentId).toBe('generated-doc-id');
    });

    it('should return 400 if required variables are missing', async () => {
      const mockTemplate = {
        id: 'template-id',
        variableSchema: {
          clientName: { type: 'string', required: true },
          caseNumber: { type: 'string', required: true }
        }
      };

      prisma.documentTemplate.findUnique.mockResolvedValue(mockTemplate);

      const response = await request(app)
        .post('/api/templates/template-id/generate')
        .send({
          variables: { clientName: 'John Doe' }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});