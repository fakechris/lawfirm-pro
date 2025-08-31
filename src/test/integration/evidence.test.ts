import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import evidenceRoutes from '../../routes/evidence';

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
    evidenceItem: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    case: {
      findUnique: jest.fn(),
      findMany: jest.fn()
    },
    evidenceChainOfCustody: {
      create: jest.fn(),
      findMany: jest.fn()
    },
    user: {
      findMany: jest.fn()
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
    calculateFileHash: jest.fn()
  }
}));

const app = express();
app.use(express.json());
app.use('/api/evidence', evidenceRoutes);

describe('Evidence API', () => {
  let prisma: any;
  let mockStorage: any;

  beforeEach(() => {
    prisma = new PrismaClient();
    mockStorage = require('../../services/documents').documentStorageService;
    jest.clearAllMocks();
  });

  describe('POST /api/evidence', () => {
    it('should create new evidence with file', async () => {
      const mockCase = {
        id: 'case-id',
        attorney: { userId: 'test-user-id' },
        client: { userId: 'client-id' }
      };

      const mockEvidence = {
        id: 'evidence-id',
        title: 'Test Evidence',
        description: 'Test description',
        type: 'DIGITAL',
        caseId: 'case-id',
        filePath: '/path/to/evidence.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        createdBy: 'test-user-id',
        createdAt: new Date()
      };

      prisma.case.findUnique.mockResolvedValue(mockCase);
      mockStorage.validateFile.mockResolvedValue({ isValid: true });
      mockStorage.uploadFile.mockResolvedValue({
        success: true,
        filePath: '/path/to/evidence.pdf',
        filename: 'evidence.pdf',
        size: 1024
      });
      mockStorage.calculateFileHash.mockResolvedValue('hash123');

      prisma.evidenceItem.create.mockResolvedValue({
        ...mockEvidence,
        case: {
          id: 'case-id',
          title: 'Test Case',
          caseNumber: 'CASE-001'
        },
        collectedByUser: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        },
        createdByUser: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        }
      });

      const response = await request(app)
        .post('/api/evidence')
        .field('title', 'Test Evidence')
        .field('description', 'Test description')
        .field('type', 'DIGITAL')
        .field('caseId', 'case-id')
        .attach('file', Buffer.from('test content'), 'evidence.pdf');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Test Evidence');
    });

    it('should create evidence without file', async () => {
      const mockCase = {
        id: 'case-id',
        attorney: { userId: 'test-user-id' },
        client: { userId: 'client-id' }
      };

      const mockEvidence = {
        id: 'evidence-id',
        title: 'Physical Evidence',
        type: 'PHYSICAL',
        caseId: 'case-id',
        createdBy: 'test-user-id'
      };

      prisma.case.findUnique.mockResolvedValue(mockCase);
      prisma.evidenceItem.create.mockResolvedValue({
        ...mockEvidence,
        case: {
          id: 'case-id',
          title: 'Test Case',
          caseNumber: 'CASE-001'
        },
        collectedByUser: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        },
        createdByUser: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        }
      });

      const response = await request(app)
        .post('/api/evidence')
        .send({
          title: 'Physical Evidence',
          type: 'PHYSICAL',
          caseId: 'case-id'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('PHYSICAL');
    });

    it('should return 404 if case not found', async () => {
      prisma.case.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/evidence')
        .send({
          title: 'Test Evidence',
          type: 'DIGITAL',
          caseId: 'non-existent-case'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 if user lacks access to case', async () => {
      const mockCase = {
        id: 'case-id',
        attorney: { userId: 'other-attorney' },
        client: { userId: 'client-id' }
      };

      prisma.case.findUnique.mockResolvedValue(mockCase);

      const response = await request(app)
        .post('/api/evidence')
        .send({
          title: 'Test Evidence',
          type: 'DIGITAL',
          caseId: 'case-id'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/evidence/:id', () => {
    it('should return specific evidence', async () => {
      const mockEvidence = {
        id: 'evidence-id',
        title: 'Test Evidence',
        type: 'DIGITAL',
        caseId: 'case-id',
        createdBy: 'test-user-id'
      };

      prisma.evidenceItem.findUnique.mockResolvedValue({
        ...mockEvidence,
        case: {
          id: 'case-id',
          title: 'Test Case',
          caseNumber: 'CASE-001'
        },
        collectedByUser: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        },
        createdByUser: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        },
        chainOfCustody: []
      });

      prisma.case.findFirst.mockResolvedValue({
        id: 'case-id',
        attorney: { userId: 'test-user-id' }
      });

      const response = await request(app)
        .get('/api/evidence/evidence-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Test Evidence');
    });

    it('should return 404 if evidence not found', async () => {
      prisma.evidenceItem.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/evidence/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/evidence/:id', () => {
    it('should update evidence', async () => {
      const mockEvidence = {
        id: 'evidence-id',
        title: 'Updated Evidence',
        caseId: 'case-id'
      };

      prisma.evidenceItem.findUnique.mockResolvedValue({
        id: 'evidence-id',
        case: {
          attorney: { userId: 'test-user-id' }
        }
      });

      prisma.evidenceItem.update.mockResolvedValue({
        ...mockEvidence,
        case: {
          id: 'case-id',
          title: 'Test Case',
          caseNumber: 'CASE-001'
        },
        collectedByUser: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        },
        createdByUser: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        }
      });

      const response = await request(app)
        .put('/api/evidence/evidence-id')
        .send({
          title: 'Updated Evidence',
          description: 'Updated description'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Evidence');
    });
  });

  describe('DELETE /api/evidence/:id', () => {
    it('should delete evidence', async () => {
      prisma.evidenceItem.findUnique.mockResolvedValue({
        id: 'evidence-id',
        filePath: '/path/to/evidence.pdf',
        case: {
          attorney: { userId: 'test-user-id' }
        }
      });

      mockStorage.deleteFile.mockResolvedValue(true);
      prisma.evidenceItem.delete.mockResolvedValue({});

      const response = await request(app)
        .delete('/api/evidence/evidence-id');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockStorage.deleteFile).toHaveBeenCalledWith('/path/to/evidence.pdf');
    });
  });

  describe('GET /api/evidence/search', () => {
    it('should search evidence with filters', async () => {
      const mockEvidence = [
        {
          id: 'evidence-1',
          title: 'Test Evidence 1',
          type: 'DIGITAL',
          caseId: 'case-id'
        }
      ];

      prisma.case.findMany.mockResolvedValue([
        { id: 'case-id' }
      ]);

      prisma.evidenceItem.findMany.mockResolvedValue(mockEvidence.map(e => ({
        ...e,
        case: {
          id: 'case-id',
          title: 'Test Case',
          caseNumber: 'CASE-001'
        },
        collectedByUser: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        },
        createdByUser: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        }
      })));

      prisma.evidenceItem.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/evidence/search?type=DIGITAL&search=Test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.evidence).toHaveLength(1);
    });
  });

  describe('POST /api/evidence/:id/chain', () => {
    it('should add chain of custody entry', async () => {
      const mockEvidence = {
        id: 'evidence-id',
        caseId: 'case-id'
      };

      prisma.evidenceItem.findUnique.mockResolvedValue({
        ...mockEvidence,
        case: {
          attorney: { userId: 'test-user-id' }
        }
      });

      prisma.case.findFirst.mockResolvedValue({
        id: 'case-id',
        attorney: { userId: 'test-user-id' }
      });

      const chainEntry = {
        id: 'chain-id',
        evidenceId: 'evidence-id',
        transferredTo: 'user-2',
        transferredBy: 'test-user-id',
        transferDate: new Date(),
        reason: 'Analysis required'
      };

      prisma.evidenceChainOfCustody.create.mockResolvedValue({
        ...chainEntry,
        transferredToUser: {
          id: 'user-2',
          firstName: 'Other',
          lastName: 'User',
          email: 'other@example.com'
        },
        transferredByUser: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        }
      });

      const response = await request(app)
        .post('/api/evidence/evidence-id/chain')
        .send({
          transferredTo: 'user-2',
          transferDate: new Date().toISOString(),
          reason: 'Analysis required'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transferredTo).toBe('user-2');
    });
  });

  describe('GET /api/evidence/:id/chain', () => {
    it('should return chain of custody', async () => {
      const mockEvidence = {
        id: 'evidence-id',
        caseId: 'case-id'
      };

      prisma.evidenceItem.findUnique.mockResolvedValue(mockEvidence);
      prisma.case.findFirst.mockResolvedValue({
        id: 'case-id',
        attorney: { userId: 'test-user-id' }
      });

      const chainEntries = [
        {
          id: 'chain-1',
          evidenceId: 'evidence-id',
          transferredTo: 'user-2',
          transferredBy: 'test-user-id',
          transferDate: new Date(),
          reason: 'Initial transfer'
        }
      ];

      prisma.evidenceChainOfCustody.findMany.mockResolvedValue(chainEntries.map(entry => ({
        ...entry,
        transferredToUser: {
          id: 'user-2',
          firstName: 'Other',
          lastName: 'User',
          email: 'other@example.com'
        },
        transferredByUser: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com'
        }
      })));

      const response = await request(app)
        .get('/api/evidence/evidence-id/chain');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/evidence/:id/download', () => {
    it('should download evidence file', async () => {
      const mockEvidence = {
        id: 'evidence-id',
        filePath: '/path/to/evidence.pdf',
        mimeType: 'application/pdf',
        title: 'Test Evidence',
        caseId: 'case-id'
      };

      prisma.evidenceItem.findUnique.mockResolvedValue(mockEvidence);
      prisma.case.findFirst.mockResolvedValue({
        id: 'case-id',
        attorney: { userId: 'test-user-id' }
      });

      mockStorage.downloadFile.mockResolvedValue({
        success: true,
        buffer: Buffer.from('test content')
      });

      const response = await request(app)
        .get('/api/evidence/evidence-id/download');

      expect(response.status).toBe(200);
      expect(response.header['content-type']).toBe('application/pdf');
    });

    it('should return 404 if evidence has no file', async () => {
      const mockEvidence = {
        id: 'evidence-id',
        filePath: null,
        caseId: 'case-id'
      };

      prisma.evidenceItem.findUnique.mockResolvedValue(mockEvidence);
      prisma.case.findFirst.mockResolvedValue({
        id: 'case-id',
        attorney: { userId: 'test-user-id' }
      });

      const response = await request(app)
        .get('/api/evidence/evidence-id/download');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});