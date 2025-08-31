import { DocumentRepository } from '../../../src/repositories/documentRepository';
import { PrismaClient } from '@prisma/client';

describe('DocumentRepository', () => {
  let repository: DocumentRepository;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    repository = new DocumentRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Document CRUD Operations', () => {
    beforeEach(async () => {
      // Create test data
      await prisma.user.create({
        data: {
          id: 'test-user-1',
          email: 'test1@example.com',
          password: 'hashedpassword',
          firstName: 'Test',
          lastName: 'User',
          role: 'ATTORNEY'
        }
      });

      await prisma.user.create({
        data: {
          id: 'test-user-2',
          email: 'test2@example.com',
          password: 'hashedpassword',
          firstName: 'Another',
          lastName: 'User',
          role: 'CLIENT'
        }
      });

      await prisma.case.create({
        data: {
          id: 'test-case-1',
          title: 'Test Case 1',
          description: 'Test case description',
          status: 'ACTIVE',
          attorneyId: 'test-user-1',
          clientId: 'test-user-2'
        }
      });
    });

    afterEach(async () => {
      // Clean up test data
      await prisma.document.deleteMany({
        where: {
          filename: {
            startsWith: 'test-'
          }
        }
      });
      await prisma.case.deleteMany({
        where: {
          id: {
            in: ['test-case-1']
          }
        }
      });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: ['test-user-1', 'test-user-2']
          }
        }
      });
    });

    it('should create a new document', async () => {
      const documentData = {
        filename: 'test-document.pdf',
        originalName: 'Test Document.pdf',
        path: '/documents/test-document.pdf',
        size: 1024000,
        mimeType: 'application/pdf',
        checksum: 'test-checksum-123',
        uploadedBy: 'test-user-1',
        caseId: 'test-case-1',
        category: 'CONTRACT' as const,
        status: 'ACTIVE' as const,
        description: 'Test document for repository',
        tags: ['test', 'document'],
        isConfidential: false
      };

      const document = await repository.create(documentData);

      expect(document).toBeDefined();
      expect(document.id).toBeDefined();
      expect(document.filename).toBe('test-document.pdf');
      expect(document.originalName).toBe('Test Document.pdf');
      expect(document.size).toBe(1024000);
      expect(document.mimeType).toBe('application/pdf');
      expect(document.checksum).toBe('test-checksum-123');
      expect(document.uploadedBy).toBe('test-user-1');
      expect(document.caseId).toBe('test-case-1');
      expect(document.category).toBe('CONTRACT');
      expect(document.status).toBe('ACTIVE');
      expect(document.description).toBe('Test document for repository');
      expect(document.tags).toEqual(['test', 'document']);
      expect(document.isConfidential).toBe(false);
      expect(document.uploadedAt).toBeInstanceOf(Date);
    });

    it('should find document by ID', async () => {
      // Create a document first
      const createdDocument = await repository.create({
        filename: 'test-find.pdf',
        originalName: 'Test Find.pdf',
        path: '/documents/test-find.pdf',
        size: 512000,
        mimeType: 'application/pdf',
        checksum: 'find-checksum-456',
        uploadedBy: 'test-user-1',
        caseId: 'test-case-1',
        category: 'LEGAL_BRIEF' as const,
        status: 'ACTIVE' as const,
        description: 'Test document for find operation'
      });

      // Find the document
      const foundDocument = await repository.findById(createdDocument.id);

      expect(foundDocument).toBeDefined();
      expect(foundDocument!.id).toBe(createdDocument.id);
      expect(foundDocument!.filename).toBe('test-find.pdf');
      expect(foundDocument!.originalName).toBe('Test Find.pdf');
    });

    it('should return null for non-existent document', async () => {
      const result = await repository.findById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should update document', async () => {
      // Create a document first
      const createdDocument = await repository.create({
        filename: 'test-update.pdf',
        originalName: 'Test Update.pdf',
        path: '/documents/test-update.pdf',
        size: 256000,
        mimeType: 'application/pdf',
        checksum: 'update-checksum-789',
        uploadedBy: 'test-user-1',
        caseId: 'test-case-1',
        category: 'CONTRACT' as const,
        status: 'ACTIVE' as const,
        description: 'Original description',
        tags: ['original']
      });

      // Update the document
      const updateData = {
        description: 'Updated description',
        tags: ['updated', 'document'],
        isConfidential: true,
        status: 'UNDER_REVIEW' as const
      };

      const updatedDocument = await repository.update(createdDocument.id, updateData);

      expect(updatedDocument).toBeDefined();
      expect(updatedDocument!.id).toBe(createdDocument.id);
      expect(updatedDocument!.description).toBe('Updated description');
      expect(updatedDocument!.tags).toEqual(['updated', 'document']);
      expect(updatedDocument!.isConfidential).toBe(true);
      expect(updatedDocument!.status).toBe('UNDER_REVIEW');
      // Unchanged fields should remain the same
      expect(updatedDocument!.filename).toBe('test-update.pdf');
      expect(updatedDocument!.uploadedBy).toBe('test-user-1');
    });

    it('should delete document', async () => {
      // Create a document first
      const createdDocument = await repository.create({
        filename: 'test-delete.pdf',
        originalName: 'Test Delete.pdf',
        path: '/documents/test-delete.pdf',
        size: 128000,
        mimeType: 'application/pdf',
        checksum: 'delete-checksum-999',
        uploadedBy: 'test-user-1',
        caseId: 'test-case-1',
        category: 'OTHER' as const,
        status: 'ACTIVE' as const,
        description: 'Document to be deleted'
      });

      const documentId = createdDocument.id;

      // Delete the document
      const deleted = await repository.delete(documentId);

      expect(deleted).toBe(true);

      // Verify document is deleted
      const foundDocument = await repository.findById(documentId);
      expect(foundDocument).toBeNull();
    });

    it('should return false when deleting non-existent document', async () => {
      const result = await repository.delete('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('Document Query Operations', () => {
    beforeEach(async () => {
      // Create test users
      await prisma.user.createMany({
        data: [
          {
            id: 'query-user-1',
            email: 'query1@example.com',
            password: 'hashedpassword',
            firstName: 'Query',
            lastName: 'User 1',
            role: 'ATTORNEY'
          },
          {
            id: 'query-user-2',
            email: 'query2@example.com',
            password: 'hashedpassword',
            firstName: 'Query',
            lastName: 'User 2',
            role: 'CLIENT'
          }
        ]
      });

      // Create test cases
      await prisma.case.createMany({
        data: [
          {
            id: 'query-case-1',
            title: 'Query Case 1',
            description: 'First query case',
            status: 'ACTIVE',
            attorneyId: 'query-user-1',
            clientId: 'query-user-2'
          },
          {
            id: 'query-case-2',
            title: 'Query Case 2',
            description: 'Second query case',
            status: 'CLOSED',
            attorneyId: 'query-user-1',
            clientId: 'query-user-2'
          }
        ]
      });

      // Create test documents
      await prisma.document.createMany({
        data: [
          {
            id: 'query-doc-1',
            filename: 'contract-1.pdf',
            originalName: 'Contract 1.pdf',
            path: '/documents/contract-1.pdf',
            size: 1000000,
            mimeType: 'application/pdf',
            checksum: 'contract-1-checksum',
            uploadedBy: 'query-user-1',
            caseId: 'query-case-1',
            category: 'CONTRACT',
            status: 'ACTIVE',
            description: 'First contract document',
            tags: ['contract', 'important'],
            isConfidential: false,
            uploadedAt: new Date('2024-01-15')
          },
          {
            id: 'query-doc-2',
            filename: 'brief-1.docx',
            originalName: 'Legal Brief 1.docx',
            path: '/documents/brief-1.docx',
            size: 500000,
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            checksum: 'brief-1-checksum',
            uploadedBy: 'query-user-2',
            caseId: 'query-case-1',
            category: 'LEGAL_BRIEF',
            status: 'ACTIVE',
            description: 'First legal brief',
            tags: ['brief', 'legal'],
            isConfidential: true,
            uploadedAt: new Date('2024-01-20')
          },
          {
            id: 'query-doc-3',
            filename: 'contract-2.pdf',
            originalName: 'Contract 2.pdf',
            path: '/documents/contract-2.pdf',
            size: 1200000,
            mimeType: 'application/pdf',
            checksum: 'contract-2-checksum',
            uploadedBy: 'query-user-1',
            caseId: 'query-case-2',
            category: 'CONTRACT',
            status: 'ARCHIVED',
            description: 'Second contract document',
            tags: ['contract', 'archived'],
            isConfidential: false,
            uploadedAt: new Date('2024-01-10')
          },
          {
            id: 'query-doc-4',
            filename: 'email-1.pdf',
            originalName: 'Client Email 1.pdf',
            path: '/documents/email-1.pdf',
            size: 250000,
            mimeType: 'application/pdf',
            checksum: 'email-1-checksum',
            uploadedBy: 'query-user-2',
            caseId: 'query-case-1',
            category: 'CORRESPONDENCE',
            status: 'ACTIVE',
            description: 'Client email correspondence',
            tags: ['email', 'client'],
            isConfidential: false,
            uploadedAt: new Date('2024-01-25')
          }
        ]
      });
    });

    afterEach(async () => {
      // Clean up test data
      await prisma.document.deleteMany({
        where: {
          filename: {
            startsWith: 'query-'
          }
        }
      });
      await prisma.case.deleteMany({
        where: {
          id: {
            in: ['query-case-1', 'query-case-2']
          }
        }
      });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: ['query-user-1', 'query-user-2']
          }
        }
      });
    });

    it('should find all documents', async () => {
      const documents = await repository.findAll();

      expect(Array.isArray(documents)).toBe(true);
      expect(documents.length).toBe(4);
      expect(documents.map(d => d.id)).toContain('query-doc-1');
      expect(documents.map(d => d.id)).toContain('query-doc-2');
      expect(documents.map(d => d.id)).toContain('query-doc-3');
      expect(documents.map(d => d.id)).toContain('query-doc-4');
    });

    it('should find documents by category', async () => {
      const contracts = await repository.findByCategory('CONTRACT');

      expect(contracts.length).toBe(2);
      expect(contracts.map(d => d.id)).toContain('query-doc-1');
      expect(contracts.map(d => d.id)).toContain('query-doc-3');
      contracts.forEach(doc => {
        expect(doc.category).toBe('CONTRACT');
      });
    });

    it('should find documents by case ID', async () => {
      const caseDocuments = await repository.findByCaseId('query-case-1');

      expect(caseDocuments.length).toBe(3);
      expect(caseDocuments.map(d => d.id)).toContain('query-doc-1');
      expect(caseDocuments.map(d => d.id)).toContain('query-doc-2');
      expect(caseDocuments.map(d => d.id)).toContain('query-doc-4');
      caseDocuments.forEach(doc => {
        expect(doc.caseId).toBe('query-case-1');
      });
    });

    it('should find documents by uploaded by user', async () => {
      const userDocuments = await repository.findByUploadedBy('query-user-1');

      expect(userDocuments.length).toBe(2);
      expect(userDocuments.map(d => d.id)).toContain('query-doc-1');
      expect(userDocuments.map(d => d.id)).toContain('query-doc-3');
      userDocuments.forEach(doc => {
        expect(doc.uploadedBy).toBe('query-user-1');
      });
    });

    it('should find documents by status', async () => {
      const activeDocuments = await repository.findByStatus('ACTIVE');

      expect(activeDocuments.length).toBe(3);
      expect(activeDocuments.map(d => d.id)).toContain('query-doc-1');
      expect(activeDocuments.map(d => d.id)).toContain('query-doc-2');
      expect(activeDocuments.map(d => d.id)).toContain('query-doc-4');
      activeDocuments.forEach(doc => {
        expect(doc.status).toBe('ACTIVE');
      });
    });

    it('should find documents by tags', async () => {
      const contractDocuments = await repository.findByTags(['contract']);

      expect(contractDocuments.length).toBe(2);
      expect(contractDocuments.map(d => d.id)).toContain('query-doc-1');
      expect(contractDocuments.map(d => d.id)).toContain('query-doc-3');
      contractDocuments.forEach(doc => {
        expect(doc.tags).toContain('contract');
      });
    });

    it('should find documents by multiple tags (AND condition)', async () => {
      const documents = await repository.findByTags(['contract', 'important']);

      expect(documents.length).toBe(1);
      expect(documents[0].id).toBe('query-doc-1');
      expect(documents[0].tags).toContain('contract');
      expect(documents[0].tags).toContain('important');
    });

    it('should find documents by confidentiality', async () => {
      const confidentialDocuments = await repository.findByConfidentiality(true);

      expect(confidentialDocuments.length).toBe(1);
      expect(confidentialDocuments[0].id).toBe('query-doc-2');
      expect(confidentialDocuments[0].isConfidential).toBe(true);
    });

    it('should find documents by date range', async () => {
      const documents = await repository.findByDateRange(
        new Date('2024-01-15'),
        new Date('2024-01-25')
      );

      expect(documents.length).toBe(3);
      expect(documents.map(d => d.id)).toContain('query-doc-1');
      expect(documents.map(d => d.id)).toContain('query-doc-2');
      expect(documents.map(d => d.id)).toContain('query-doc-4');
      
      documents.forEach(doc => {
        const uploadDate = doc.uploadedAt.getTime();
        expect(uploadDate).toBeGreaterThanOrEqual(new Date('2024-01-15').getTime());
        expect(uploadDate).toBeLessThanOrEqual(new Date('2024-01-25').getTime());
      });
    });

    it('should find documents by file type', async () => {
      const pdfDocuments = await repository.findByFileType('application/pdf');

      expect(pdfDocuments.length).toBe(3);
      expect(pdfDocuments.map(d => d.id)).toContain('query-doc-1');
      expect(pdfDocuments.map(d => d.id)).toContain('query-doc-3');
      expect(pdfDocuments.map(d => d.id)).toContain('query-doc-4');
      pdfDocuments.forEach(doc => {
        expect(doc.mimeType).toBe('application/pdf');
      });
    });

    it('should find documents by size range', async () => {
      const documents = await repository.findBySizeRange(400000, 800000);

      expect(documents.length).toBe(1);
      expect(documents[0].id).toBe('query-doc-2');
      expect(documents[0].size).toBe(500000);
    });

    it('should search documents by text', async () => {
      const documents = await repository.searchByText('contract');

      expect(documents.length).toBeGreaterThan(0);
      // Should find documents with 'contract' in filename, originalName, or description
      const contractDocs = documents.filter(d => 
        d.filename.includes('contract') || 
        d.originalName.includes('contract') || 
        d.description?.includes('contract')
      );
      expect(contractDocs.length).toBeGreaterThan(0);
    });

    it('should search documents with multiple criteria', async () => {
      const documents = await repository.search({
        category: 'CONTRACT',
        status: 'ACTIVE',
        isConfidential: false,
        caseId: 'query-case-1'
      });

      expect(documents.length).toBe(1);
      expect(documents[0].id).toBe('query-doc-1');
      expect(documents[0].category).toBe('CONTRACT');
      expect(documents[0].status).toBe('ACTIVE');
      expect(documents[0].isConfidential).toBe(false);
      expect(documents[0].caseId).toBe('query-case-1');
    });

    it('should paginate document results', async () => {
      const page1 = await repository.findAll({ page: 1, limit: 2 });
      const page2 = await repository.findAll({ page: 2, limit: 2 });

      expect(page1.length).toBe(2);
      expect(page2.length).toBe(2);
      
      // Verify no overlap between pages
      const page1Ids = page1.map(d => d.id);
      const page2Ids = page2.map(d => d.id);
      const intersection = page1Ids.filter(id => page2Ids.includes(id));
      expect(intersection.length).toBe(0);
    });

    it('should sort documents by upload date', async () => {
      const documents = await repository.findAll({
        sortBy: 'uploadedAt',
        sortOrder: 'desc'
      });

      expect(documents.length).toBe(4);
      
      // Verify descending order by upload date
      for (let i = 0; i < documents.length - 1; i++) {
        expect(documents[i].uploadedAt.getTime()).toBeGreaterThanOrEqual(
          documents[i + 1].uploadedAt.getTime()
        );
      }
    });

    it('should sort documents by file size', async () => {
      const documents = await repository.findAll({
        sortBy: 'size',
        sortOrder: 'asc'
      });

      expect(documents.length).toBe(4);
      
      // Verify ascending order by size
      for (let i = 0; i < documents.length - 1; i++) {
        expect(documents[i].size).toBeLessThanOrEqual(documents[i + 1].size);
      }
    });
  });

  describe('Document Statistics', () => {
    beforeEach(async () => {
      // Create test data for statistics
      await prisma.user.create({
        data: {
          id: 'stats-user',
          email: 'stats@example.com',
          password: 'hashedpassword',
          firstName: 'Stats',
          lastName: 'User',
          role: 'ATTORNEY'
        }
      });

      await prisma.case.create({
        data: {
          id: 'stats-case',
          title: 'Stats Case',
          description: 'Case for statistics',
          status: 'ACTIVE',
          attorneyId: 'stats-user',
          clientId: 'stats-user'
        }
      });

      await prisma.document.createMany({
        data: [
          {
            id: 'stats-doc-1',
            filename: 'stats-1.pdf',
            originalName: 'Stats 1.pdf',
            path: '/documents/stats-1.pdf',
            size: 1000000,
            mimeType: 'application/pdf',
            checksum: 'stats-1-checksum',
            uploadedBy: 'stats-user',
            caseId: 'stats-case',
            category: 'CONTRACT',
            status: 'ACTIVE',
            description: 'Stats document 1',
            tags: ['stats', 'contract'],
            isConfidential: false,
            uploadedAt: new Date('2024-01-15')
          },
          {
            id: 'stats-doc-2',
            filename: 'stats-2.docx',
            originalName: 'Stats 2.docx',
            path: '/documents/stats-2.docx',
            size: 500000,
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            checksum: 'stats-2-checksum',
            uploadedBy: 'stats-user',
            caseId: 'stats-case',
            category: 'LEGAL_BRIEF',
            status: 'ACTIVE',
            description: 'Stats document 2',
            tags: ['stats', 'brief'],
            isConfidential: true,
            uploadedAt: new Date('2024-01-20')
          },
          {
            id: 'stats-doc-3',
            filename: 'stats-3.pdf',
            originalName: 'Stats 3.pdf',
            path: '/documents/stats-3.pdf',
            size: 1200000,
            mimeType: 'application/pdf',
            checksum: 'stats-3-checksum',
            uploadedBy: 'stats-user',
            caseId: 'stats-case',
            category: 'CONTRACT',
            status: 'ARCHIVED',
            description: 'Stats document 3',
            tags: ['stats', 'archived'],
            isConfidential: false,
            uploadedAt: new Date('2024-01-10')
          }
        ]
      });
    });

    afterEach(async () => {
      // Clean up test data
      await prisma.document.deleteMany({
        where: {
          filename: {
            startsWith: 'stats-'
          }
        }
      });
      await prisma.case.deleteMany({
        where: {
          id: {
            in: ['stats-case']
          }
        }
      });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: ['stats-user']
          }
        }
      });
    });

    it('should get document count by category', async () => {
      const stats = await repository.getDocumentCountByCategory();

      expect(stats).toEqual({
        'CONTRACT': 2,
        'LEGAL_BRIEF': 1
      });
    });

    it('should get document count by status', async () => {
      const stats = await repository.getDocumentCountByStatus();

      expect(stats).toEqual({
        'ACTIVE': 2,
        'ARCHIVED': 1
      });
    });

    it('should get document count by user', async () => {
      const stats = await repository.getDocumentCountByUser();

      expect(stats).toEqual({
        'stats-user': 3
      });
    });

    it('should get document count by case', async () => {
      const stats = await repository.getDocumentCountByCase();

      expect(stats).toEqual({
        'stats-case': 3
      });
    });

    it('should get total storage used', async () => {
      const totalSize = await repository.getTotalStorageUsed();

      expect(totalSize).toBe(2700000); // 1000000 + 500000 + 1200000
    });

    it('should get storage used by category', async () => {
      const storageByCategory = await repository.getStorageUsedByCategory();

      expect(storageByCategory).toEqual({
        'CONTRACT': 2200000, // 1000000 + 1200000
        'LEGAL_BRIEF': 500000
      });
    });

    it('should get document statistics', async () => {
      const stats = await repository.getDocumentStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalDocuments).toBe(3);
      expect(stats.totalSize).toBe(2700000);
      expect(stats.byCategory).toEqual({
        'CONTRACT': 2,
        'LEGAL_BRIEF': 1
      });
      expect(stats.byStatus).toEqual({
        'ACTIVE': 2,
        'ARCHIVED': 1
      });
      expect(stats.byUser).toEqual({
        'stats-user': 3
      });
      expect(stats.byCase).toEqual({
        'stats-case': 3
      });
      expect(stats.confidentialCount).toBe(1);
      expect(stats.averageSize).toBe(900000); // 2700000 / 3
      expect(stats.largestDocument).toBe(1200000);
      expect(stats.smallestDocument).toBe(500000);
    });

    it('should get recent uploads', async () => {
      const recentUploads = await repository.getRecentUploads(2);

      expect(recentUploads.length).toBe(2);
      expect(recentUploads[0].id).toBe('stats-doc-2'); // Most recent
      expect(recentUploads[1].id).toBe('stats-doc-1'); // Second most recent
    });

    it('should get documents uploaded today', async () => {
      // Mock today's date for testing
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Update one document to have today's date
      await prisma.document.update({
        where: { id: 'stats-doc-1' },
        data: { uploadedAt: new Date() }
      });

      const todayUploads = await repository.getTodayUploads();

      expect(todayUploads.length).toBe(1);
      expect(todayUploads[0].id).toBe('stats-doc-1');
    });
  });

  describe('Document Operations with Relations', () => {
    beforeEach(async () => {
      // Create test data with relations
      await prisma.user.create({
        data: {
          id: 'rel-user-1',
          email: 'rel1@example.com',
          password: 'hashedpassword',
          firstName: 'Relation',
          lastName: 'User 1',
          role: 'ATTORNEY'
        }
      });

      await prisma.case.create({
        data: {
          id: 'rel-case-1',
          title: 'Relation Case 1',
          description: 'Case for relation testing',
          status: 'ACTIVE',
          attorneyId: 'rel-user-1',
          clientId: 'rel-user-1'
        }
      });

      await prisma.document.create({
        data: {
          id: 'rel-doc-1',
          filename: 'relation-test.pdf',
          originalName: 'Relation Test.pdf',
          path: '/documents/relation-test.pdf',
          size: 750000,
          mimeType: 'application/pdf',
          checksum: 'relation-checksum',
          uploadedBy: 'rel-user-1',
          caseId: 'rel-case-1',
          category: 'CONTRACT',
          status: 'ACTIVE',
          description: 'Document for relation testing',
          tags: ['relation', 'test'],
          isConfidential: false,
          uploadedAt: new Date('2024-01-15')
        }
      });

      // Create document versions
      await prisma.documentVersion.createMany({
        data: [
          {
            id: 'rel-version-1',
            documentId: 'rel-doc-1',
            versionNumber: 1,
            filename: 'relation-test-v1.pdf',
            path: '/versions/relation-test-v1.pdf',
            size: 750000,
            mimeType: 'application/pdf',
            checksum: 'relation-v1-checksum',
            uploadedBy: 'rel-user-1',
            changeDescription: 'Initial version',
            createdAt: new Date('2024-01-15')
          },
          {
            id: 'rel-version-2',
            documentId: 'rel-doc-1',
            versionNumber: 2,
            filename: 'relation-test-v2.pdf',
            path: '/versions/relation-test-v2.pdf',
            size: 800000,
            mimeType: 'application/pdf',
            checksum: 'relation-v2-checksum',
            uploadedBy: 'rel-user-1',
            changeDescription: 'Updated version',
            createdAt: new Date('2024-01-16')
          }
        ]
      });

      // Create document comments
      await prisma.documentComment.create({
        data: {
          id: 'rel-comment-1',
          documentId: 'rel-doc-1',
          userId: 'rel-user-1',
          content: 'This is a test comment on the document',
          position: { x: 100, y: 200 },
          createdAt: new Date('2024-01-17')
        }
      });

      // Create document shares
      await prisma.documentShare.create({
        data: {
          id: 'rel-share-1',
          documentId: 'rel-doc-1',
          sharedBy: 'rel-user-1',
          sharedWith: 'rel-user-1',
          permission: 'VIEW',
          message: 'Test sharing',
          createdAt: new Date('2024-01-18')
        }
      });
    });

    afterEach(async () => {
      // Clean up test data
      await prisma.documentShare.deleteMany({
        where: {
          documentId: 'rel-doc-1'
        }
      });
      await prisma.documentComment.deleteMany({
        where: {
          documentId: 'rel-doc-1'
        }
      });
      await prisma.documentVersion.deleteMany({
        where: {
          documentId: 'rel-doc-1'
        }
      });
      await prisma.document.deleteMany({
        where: {
          id: 'rel-doc-1'
        }
      });
      await prisma.case.deleteMany({
        where: {
          id: 'rel-case-1'
        }
      });
      await prisma.user.deleteMany({
        where: {
          id: 'rel-user-1'
        }
      });
    });

    it('should find document with details', async () => {
      const document = await repository.findWithDetails('rel-doc-1');

      expect(document).toBeDefined();
      expect(document!.id).toBe('rel-doc-1');
      expect(document!.versions).toBeDefined();
      expect(document!.versions!.length).toBe(2);
      expect(document!.comments).toBeDefined();
      expect(document!.comments!.length).toBe(1);
      expect(document!.shares).toBeDefined();
      expect(document!.shares!.length).toBe(1);
      expect(document!.case).toBeDefined();
      expect(document!.case!.id).toBe('rel-case-1');
    });

    it('should find document versions', async () => {
      const versions = await repository.findVersions('rel-doc-1');

      expect(versions.length).toBe(2);
      expect(versions[0].versionNumber).toBe(2);
      expect(versions[1].versionNumber).toBe(1);
    });

    it('should find document comments', async () => {
      const comments = await repository.findComments('rel-doc-1');

      expect(comments.length).toBe(1);
      expect(comments[0].content).toBe('This is a test comment on the document');
    });

    it('should find document shares', async () => {
      const shares = await repository.findShares('rel-doc-1');

      expect(shares.length).toBe(1);
      expect(shares[0].permission).toBe('VIEW');
    });
  });
});