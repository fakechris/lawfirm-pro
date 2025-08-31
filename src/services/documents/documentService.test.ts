import { DocumentService } from '../src/services/documents/documentService';
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

describe('DocumentService', () => {
  let prisma: PrismaClient;
  let documentService: DocumentService;

  beforeAll(async () => {
    prisma = new PrismaClient();
    documentService = new DocumentService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('uploadDocument', () => {
    it('should upload a valid document successfully', async () => {
      // Create a test file
      const testContent = 'This is a test document content';
      const testBuffer = Buffer.from(testContent);
      
      const result = await documentService.uploadDocument(
        testBuffer,
        'test-document.txt',
        'text/plain',
        {
          uploadedBy: 'test-user-id',
          description: 'Test document upload',
          tags: ['test', 'document'],
          category: 'OTHER'
        }
      );

      expect(result.success).toBe(true);
      expect(result.filename).toBeDefined();
      expect(result.size).toBe(testBuffer.length);
      expect(result.mimeType).toBe('text/plain');
      expect(result.checksum).toBeDefined();
    });

    it('should reject invalid MIME type', async () => {
      const testBuffer = Buffer.from('test content');
      
      const result = await documentService.uploadDocument(
        testBuffer,
        'test.exe',
        'application/x-executable',
        {
          uploadedBy: 'test-user-id'
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported MIME type');
    });

    it('should reject files that are too large', async () => {
      // Create a large buffer (101MB)
      const largeBuffer = Buffer.alloc(101 * 1024 * 1024);
      
      const result = await documentService.uploadDocument(
        largeBuffer,
        'large-file.txt',
        'text/plain',
        {
          uploadedBy: 'test-user-id'
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('File size exceeds maximum limit');
    });

    it('should reject invalid tags', async () => {
      const testBuffer = Buffer.from('test content');
      
      const result = await documentService.uploadDocument(
        testBuffer,
        'test.txt',
        'text/plain',
        {
          uploadedBy: 'test-user-id',
          tags: ['valid-tag', 'invalid@tag', 'another-valid-tag']
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid tags');
    });
  });

  describe('getDocument', () => {
    it('should retrieve an existing document', async () => {
      // First upload a document
      const testContent = 'Test document for retrieval';
      const testBuffer = Buffer.from(testContent);
      
      const uploadResult = await documentService.uploadDocument(
        testBuffer,
        'retrieval-test.txt',
        'text/plain',
        {
          uploadedBy: 'test-user-id',
          description: 'Test document for retrieval'
        }
      );

      expect(uploadResult.success).toBe(true);

      // Get the document ID from the filename (this is a simplified approach)
      // In a real scenario, you'd get the ID from the upload result
      const documents = await documentService.getDocuments({ limit: 1 });
      expect(documents.length).toBeGreaterThan(0);

      const document = documents[0];
      expect(document.originalName).toBe('retrieval-test.txt');
      expect(document.size).toBe(testBuffer.length);
      expect(document.mimeType).toBe('text/plain');
    });
  });

  describe('searchDocuments', () => {
    it('should search documents by filename', async () => {
      // Upload a test document
      const testContent = 'Search test content';
      const testBuffer = Buffer.from(testContent);
      
      await documentService.uploadDocument(
        testBuffer,
        'search-test-document.txt',
        'text/plain',
        {
          uploadedBy: 'test-user-id',
          description: 'Document for search testing',
          tags: ['search', 'test']
        }
      );

      // Search for the document
      const results = await documentService.searchDocuments('search-test');
      expect(results.length).toBeGreaterThan(0);
      
      const found = results.find(doc => doc.originalName === 'search-test-document.txt');
      expect(found).toBeDefined();
    });

    it('should search documents by tags', async () => {
      const results = await documentService.searchDocuments('search', {
        tags: ['test']
      });
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('getDocumentStats', () => {
    it('should return document statistics', async () => {
      const stats = await documentService.getDocumentStats();
      
      expect(stats).toHaveProperty('totalDocuments');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('byCategory');
      expect(stats).toHaveProperty('byStatus');
      expect(stats).toHaveProperty('recentUploads');
      
      expect(typeof stats.totalDocuments).toBe('number');
      expect(typeof stats.totalSize).toBe('number');
      expect(typeof stats.byCategory).toBe('object');
      expect(typeof stats.byStatus).toBe('object');
      expect(typeof stats.recentUploads).toBe('number');
    });
  });

  describe('createVersion', () => {
    it('should create a new version of a document', async () => {
      // Upload original document
      const originalContent = 'Original document content';
      const originalBuffer = Buffer.from(originalContent);
      
      const uploadResult = await documentService.uploadDocument(
        originalBuffer,
        'version-test.txt',
        'text/plain',
        {
          uploadedBy: 'test-user-id',
          description: 'Original document for version testing'
        }
      );

      expect(uploadResult.success).toBe(true);

      // Get the document
      const documents = await documentService.getDocuments({ 
        originalName: 'version-test.txt' 
      });
      expect(documents.length).toBeGreaterThan(0);
      
      const document = documents[0];

      // Create a new version
      const newContent = 'Updated document content version 2';
      const newBuffer = Buffer.from(newContent);
      
      const versionResult = await documentService.createVersion(
        document.id,
        newBuffer,
        'version-test-v2.txt',
        'text/plain',
        'Updated content and formatting'
      );

      expect(versionResult.success).toBe(true);
      expect(versionResult.filename).toBeDefined();
      expect(versionResult.size).toBe(newBuffer.length);

      // Verify versions were created
      const versions = await documentService.getDocumentVersions(document.id);
      expect(versions.length).toBe(2);
      expect(versions[0].versionNumber).toBe(2);
      expect(versions[1].versionNumber).toBe(1);
    });
  });

  describe('downloadDocument', () => {
    it('should download the latest version of a document', async () => {
      // Upload a test document
      const testContent = 'Download test content';
      const testBuffer = Buffer.from(testContent);
      
      await documentService.uploadDocument(
        testBuffer,
        'download-test.txt',
        'text/plain',
        {
          uploadedBy: 'test-user-id',
          description: 'Document for download testing'
        }
      );

      // Get the document
      const documents = await documentService.getDocuments({ 
        originalName: 'download-test.txt' 
      });
      expect(documents.length).toBeGreaterThan(0);
      
      const document = documents[0];

      // Download the document
      const downloadResult = await documentService.downloadDocument(document.id);
      
      expect(downloadResult).not.toBeNull();
      expect(downloadResult!.buffer.equals(testBuffer)).toBe(true);
      expect(downloadResult!.filename).toBe('download-test.txt');
      expect(downloadResult!.mimeType).toBe('text/plain');
    });

    it('should download a specific version of a document', async () => {
      // Upload original and create a version
      const originalContent = 'Original content';
      const originalBuffer = Buffer.from(originalContent);
      
      const uploadResult = await documentService.uploadDocument(
        originalBuffer,
        'version-download-test.txt',
        'text/plain',
        {
          uploadedBy: 'test-user-id',
          description: 'Document for version download testing'
        }
      );

      expect(uploadResult.success).toBe(true);

      // Get the document
      const documents = await documentService.getDocuments({ 
        originalName: 'version-download-test.txt' 
      });
      expect(documents.length).toBeGreaterThan(0);
      
      const document = documents[0];

      // Create a new version
      const newContent = 'Version 2 content';
      const newBuffer = Buffer.from(newContent);
      
      await documentService.createVersion(
        document.id,
        newBuffer,
        'version-download-test-v2.txt',
        'text/plain',
        'Second version'
      );

      // Download version 1
      const version1Result = await documentService.downloadDocument(document.id, 1);
      expect(version1Result).not.toBeNull();
      expect(version1Result!.buffer.equals(originalBuffer)).toBe(true);

      // Download version 2
      const version2Result = await documentService.downloadDocument(document.id, 2);
      expect(version2Result).not.toBeNull();
      expect(version2Result!.buffer.equals(newBuffer)).toBe(true);
    });
  });
});