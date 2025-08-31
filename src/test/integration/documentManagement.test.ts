import { DocumentService } from '../../src/services/documents';
import { OCRService } from '../../src/utils/document-processing';
import { DocumentCollaborationService } from '../../src/services/documents';
import { DocumentSearchService } from '../../src/services/documents';
import { DocumentPerformanceService } from '../../src/services/documents';
import { DocumentSecurityService } from '../../src/services/documents';
import { PrismaClient } from '@prisma/client';

describe('Document Management System Integration Tests', () => {
  let prisma: PrismaClient;
  let documentService: DocumentService;
  let ocrService: OCRService;
  let searchService: DocumentSearchService;
  let performanceService: DocumentPerformanceService;
  let securityService: DocumentSecurityService;

  beforeAll(async () => {
    prisma = new PrismaClient();
    documentService = new DocumentService(prisma);
    ocrService = new OCRService();
    searchService = new DocumentSearchService(prisma);
    performanceService = new DocumentPerformanceService(prisma);
    securityService = new DocumentSecurityService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Document Upload and OCR Processing', () => {
    it('should upload document and process OCR successfully', async () => {
      const testContent = 'This is a test legal document for OCR processing.';
      const testBuffer = Buffer.from(testContent);
      
      const result = await documentService.uploadDocument(
        testBuffer,
        'test-legal-document.txt',
        'text/plain',
        {
          uploadedBy: 'test-user-id',
          description: 'Test legal document',
          tags: ['legal', 'test', 'ocr'],
          category: 'LEGAL_BRIEF'
        }
      );

      expect(result.success).toBe(true);
      expect(result.filename).toBeDefined();
      expect(result.size).toBe(testBuffer.length);
      expect(result.mimeType).toBe('text/plain');
      expect(result.checksum).toBeDefined();
      
      // OCR should have been processed
      expect(result.extractedText).toBe(testContent);
    });

    it('should handle OCR processing for different languages', async () => {
      const chineseContent = '这是一个测试法律文档。';
      const testBuffer = Buffer.from(chineseContent);
      
      const result = await documentService.uploadDocument(
        testBuffer,
        'test-chinese-document.txt',
        'text/plain',
        {
          uploadedBy: 'test-user-id',
          description: 'Chinese test document',
          tags: ['chinese', 'test'],
          category: 'LEGAL_BRIEF'
        }
      );

      expect(result.success).toBe(true);
      expect(result.extractedText).toBe(chineseContent);
    });

    it('should reprocess OCR for existing document', async () => {
      // First upload a document
      const testContent = 'Initial content for OCR reprocessing test.';
      const testBuffer = Buffer.from(testContent);
      
      const uploadResult = await documentService.uploadDocument(
        testBuffer,
        'ocr-reprocess-test.txt',
        'text/plain',
        {
          uploadedBy: 'test-user-id',
          description: 'Document for OCR reprocessing test'
        }
      );

      expect(uploadResult.success).toBe(true);

      // Get the document ID
      const documents = await documentService.getDocuments({ 
        originalName: 'ocr-reprocess-test.txt' 
      });
      expect(documents.length).toBeGreaterThan(0);
      
      const document = documents[0];

      // Reprocess OCR
      const reprocessResult = await documentService.reprocessOCR(document.id);
      expect(reprocessResult.success).toBe(true);
      expect(reprocessResult.extractedText).toBe(testContent);
    });
  });

  describe('Document Search and Indexing', () => {
    it('should index document for search', async () => {
      // Upload a test document
      const testContent = 'This document contains searchable legal content about contract disputes.';
      const testBuffer = Buffer.from(testContent);
      
      await documentService.uploadDocument(
        testBuffer,
        'searchable-document.txt',
        'text/plain',
        {
          uploadedBy: 'test-user-id',
          description: 'Document for search testing',
          tags: ['searchable', 'contract', 'dispute'],
          category: 'CONTRACT'
        }
      );

      // Index the document
      const documents = await documentService.getDocuments({ 
        originalName: 'searchable-document.txt' 
      });
      expect(documents.length).toBeGreaterThan(0);
      
      const document = documents[0];

      await searchService.indexDocument(document.id);

      // Search for the document
      const searchResults = await searchService.searchDocuments('contract disputes', {
        category: 'CONTRACT',
        limit: 10
      });

      expect(searchResults.length).toBeGreaterThan(0);
      const found = searchResults.find(result => result.id === document.id);
      expect(found).toBeDefined();
      expect(found?.title).toBe('searchable-document.txt');
    });

    it('should search by OCR text', async () => {
      // Upload a document with specific OCR content
      const ocrContent = 'This text should be searchable via OCR functionality.';
      const testBuffer = Buffer.from(ocrContent);
      
      await documentService.uploadDocument(
        testBuffer,
        'ocr-search-test.txt',
        'text/plain',
        {
          uploadedBy: 'test-user-id',
          description: 'Document for OCR search testing',
          tags: ['ocr', 'search']
        }
      );

      // Search by OCR text
      const results = await documentService.searchByOCRText('searchable via OCR');
      expect(results.length).toBeGreaterThan(0);
      
      const found = results.find(doc => doc.originalName === 'ocr-search-test.txt');
      expect(found).toBeDefined();
    });
  });

  describe('Document Performance Optimization', () => {
    it('should measure document operation performance', async () => {
      const testContent = 'Performance test document content.';
      const testBuffer = Buffer.from(testContent);
      
      const { result, metrics } = await performanceService.measurePerformance(
        'document_upload',
        () => documentService.uploadDocument(
          testBuffer,
          'performance-test.txt',
          'text/plain',
          {
            uploadedBy: 'test-user-id',
            description: 'Performance test document'
          }
        )
      );

      expect(result.success).toBe(true);
      expect(metrics.operation).toBe('document_upload');
      expect(metrics.duration).toBeGreaterThan(0);
      expect(metrics.success).toBe(true);
      expect(metrics.memoryUsage.used).toBeGreaterThan(0);
    });

    it('should cache document queries', async () => {
      // First query - should not be cached
      const firstResult = await performanceService.getDocumentsOptimized({
        category: 'LEGAL_BRIEF',
        limit: 5
      });

      // Second query - should be cached
      const secondResult = await performanceService.getDocumentsOptimized({
        category: 'LEGAL_BRIEF',
        limit: 5
      });

      expect(Array.isArray(firstResult)).toBe(true);
      expect(Array.isArray(secondResult)).toBe(true);
    });

    it('should process documents in batches', async () => {
      const testDocuments = [
        { content: 'Batch document 1', name: 'batch1.txt' },
        { content: 'Batch document 2', name: 'batch2.txt' },
        { content: 'Batch document 3', name: 'batch3.txt' }
      ];

      const results = await performanceService.processBatch(
        testDocuments,
        async (doc) => {
          const buffer = Buffer.from(doc.content);
          const result = await documentService.uploadDocument(
            buffer,
            doc.name,
            'text/plain',
            {
              uploadedBy: 'test-user-id',
              description: `Batch processed document: ${doc.name}`
            }
          );
          return result;
        },
        {
          batchSize: 2,
          concurrency: 2,
          retryAttempts: 2,
          retryDelay: 100
        }
      );

      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Document Security', () => {
    it('should perform security audit', async () => {
      const audit = await securityService.performSecurityAudit();
      
      expect(audit.overallScore).toBeGreaterThanOrEqual(0);
      expect(audit.overallScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(audit.results)).toBe(true);
      expect(Array.isArray(audit.vulnerabilities)).toBe(true);
      expect(Array.isArray(audit.recommendations)).toBe(true);
      expect(audit.testedAt).toBeInstanceOf(Date);
    });

    it('should detect file upload vulnerabilities', async () => {
      const vulnerabilities = await securityService.scanForFileUploadVulnerabilities();
      
      expect(Array.isArray(vulnerabilities)).toBe(true);
      vulnerabilities.forEach(vuln => {
        expect(vuln.type).toBe('FILE_UPLOAD');
        expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(vuln.severity);
      });
    });

    it('should validate input security', async () => {
      const maliciousInputs = [
        { field: 'filename', value: '../../etc/passwd' },
        { field: 'description', value: '<script>alert(1)</script>' }
      ];

      for (const input of maliciousInputs) {
        const isValid = securityService['validateInput'](input.field, input.value);
        expect(isValid).toBe(false);
      }
    });
  });

  describe('Document Collaboration Features', () => {
    it('should handle document sharing', async () => {
      // Upload a test document
      const testContent = 'Document for sharing test.';
      const testBuffer = Buffer.from(testContent);
      
      const uploadResult = await documentService.uploadDocument(
        testBuffer,
        'sharing-test.txt',
        'text/plain',
        {
          uploadedBy: 'test-user-id',
          description: 'Document for sharing testing'
        }
      );

      expect(uploadResult.success).toBe(true);

      // Get the document
      const documents = await documentService.getDocuments({ 
        originalName: 'sharing-test.txt' 
      });
      expect(documents.length).toBeGreaterThan(0);
      
      const document = documents[0];

      // Share the document (this would normally be done through API)
      const share = await prisma.documentShare.create({
        data: {
          documentId: document.id,
          sharedBy: 'test-user-id',
          sharedWith: 'another-user-id',
          permission: 'VIEW',
          message: 'Test sharing'
        }
      });

      expect(share.id).toBeDefined();
      expect(share.permission).toBe('VIEW');
    });

    it('should handle document comments', async () => {
      // Upload a test document
      const testContent = 'Document for comments test.';
      const testBuffer = Buffer.from(testContent);
      
      const uploadResult = await documentService.uploadDocument(
        testBuffer,
        'comments-test.txt',
        'text/plain',
        {
          uploadedBy: 'test-user-id',
          description: 'Document for comments testing'
        }
      );

      expect(uploadResult.success).toBe(true);

      // Get the document
      const documents = await documentService.getDocuments({ 
        originalName: 'comments-test.txt' 
      });
      expect(documents.length).toBeGreaterThan(0);
      
      const document = documents[0];

      // Add a comment
      const comment = await prisma.documentComment.create({
        data: {
          documentId: document.id,
          userId: 'test-user-id',
          content: 'This is a test comment on the document.',
          position: { x: 100, y: 200 }
        }
      });

      expect(comment.id).toBeDefined();
      expect(comment.content).toBe('This is a test comment on the document.');
      expect(comment.isResolved).toBe(false);
    });
  });

  describe('Document Versioning', () => {
    it('should create document versions', async () => {
      // Upload original document
      const originalContent = 'Original document content version 1.';
      const originalBuffer = Buffer.from(originalContent);
      
      const uploadResult = await documentService.uploadDocument(
        originalBuffer,
        'version-test.txt',
        'text/plain',
        {
          uploadedBy: 'test-user-id',
          description: 'Document for version testing'
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
      const newContent = 'Updated document content version 2.';
      const newBuffer = Buffer.from(newContent);
      
      const versionResult = await documentService.createVersion(
        document.id,
        newBuffer,
        'version-test-v2.txt',
        'text/plain',
        'Updated content and formatting'
      );

      expect(versionResult.success).toBe(true);

      // Verify versions were created
      const versions = await documentService.getDocumentVersions(document.id);
      expect(versions.length).toBe(2);
      expect(versions[0].versionNumber).toBe(2);
      expect(versions[1].versionNumber).toBe(1);
    });

    it('should download specific document versions', async () => {
      // Upload original and create a version
      const originalContent = 'Version download test original.';
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
      const newContent = 'Version download test version 2.';
      const newBuffer = Buffer.from(newContent);
      
      await documentService.createVersion(
        document.id,
        newBuffer,
        'version-download-test-v2.txt',
        'text/plain',
        'Second version for download test'
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

  describe('Document Statistics and Analytics', () => {
    it('should get document statistics', async () => {
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

    it('should get OCR statistics', async () => {
      const stats = await documentService.getOCRStats();
      
      expect(stats).toHaveProperty('totalDocuments');
      expect(stats).toHaveProperty('documentsWithOCR');
      expect(stats).toHaveProperty('averageConfidence');
      expect(stats).toHaveProperty('byLanguage');
      expect(stats).toHaveProperty('processingTimes');
      
      expect(typeof stats.totalDocuments).toBe('number');
      expect(typeof stats.documentsWithOCR).toBe('number');
      expect(typeof stats.averageConfidence).toBe('number');
      expect(typeof stats.byLanguage).toBe('object');
      expect(typeof stats.processingTimes).toBe('object');
    });

    it('should get search statistics', async () => {
      const stats = await searchService.getSearchStats();
      
      expect(stats).toHaveProperty('totalIndexed');
      expect(stats).toHaveProperty('averageContentLength');
      expect(stats).toHaveProperty('lastIndexed');
      expect(stats).toHaveProperty('byCategory');
      
      expect(typeof stats.totalIndexed).toBe('number');
      expect(typeof stats.averageContentLength).toBe('number');
      expect(typeof stats.byCategory).toBe('object');
    });

    it('should get performance statistics', async () => {
      const stats = performanceService.getPerformanceStats();
      
      expect(stats).toHaveProperty('totalOperations');
      expect(stats).toHaveProperty('averageDuration');
      expect(stats).toHaveProperty('slowestOperations');
      expect(stats).toHaveProperty('errorRate');
      expect(stats).toHaveProperty('memoryTrend');
      
      expect(typeof stats.totalOperations).toBe('number');
      expect(typeof stats.averageDuration).toBe('number');
      expect(Array.isArray(stats.slowestOperations)).toBe(true);
      expect(typeof stats.errorRate).toBe('number');
      expect(Array.isArray(stats.memoryTrend)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid file types', async () => {
      const maliciousContent = 'Malicious executable content.';
      const maliciousBuffer = Buffer.from(maliciousContent);
      
      const result = await documentService.uploadDocument(
        maliciousBuffer,
        'malicious.exe',
        'application/x-executable',
        {
          uploadedBy: 'test-user-id',
          description: 'Malicious file test'
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported MIME type');
    });

    it('should handle files that are too large', async () => {
      // Create a large buffer (over 100MB)
      const largeBuffer = Buffer.alloc(101 * 1024 * 1024);
      
      const result = await documentService.uploadDocument(
        largeBuffer,
        'large-file.txt',
        'text/plain',
        {
          uploadedBy: 'test-user-id',
          description: 'Large file test'
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('File size exceeds maximum limit');
    });

    it('should handle invalid tags', async () => {
      const testContent = 'Test content with invalid tags.';
      const testBuffer = Buffer.from(testContent);
      
      const result = await documentService.uploadDocument(
        testBuffer,
        'invalid-tags-test.txt',
        'text/plain',
        {
          uploadedBy: 'test-user-id',
          description: 'Invalid tags test',
          tags: ['valid-tag', 'invalid@tag', '<script>alert(1)</script>']
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid tags');
    });

    it('should handle duplicate files', async () => {
      const testContent = 'Duplicate file test content.';
      const testBuffer = Buffer.from(testContent);
      
      // Upload first time
      const firstResult = await documentService.uploadDocument(
        testBuffer,
        'duplicate-test.txt',
        'text/plain',
        {
          uploadedBy: 'test-user-id',
          description: 'First upload'
        }
      );

      expect(firstResult.success).toBe(true);

      // Try to upload the same content again
      const secondResult = await documentService.uploadDocument(
        testBuffer,
        'duplicate-test-v2.txt',
        'text/plain',
        {
          uploadedBy: 'test-user-id',
          description: 'Second upload - should be duplicate'
        }
      );

      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toBe('Duplicate file detected');
    });
  });
});

describe('OCR Service Unit Tests', () => {
  let ocrService: OCRService;

  beforeAll(async () => {
    ocrService = new OCRService();
  });

  afterAll(async () => {
    await ocrService.terminate();
  });

  describe('OCR Processing', () => {
    it('should detect document language', async () => {
      const englishText = 'This is an English text for language detection.';
      const chineseText = '这是用于语言检测的中文文本。';

      const englishLang = await ocrService.detectLanguage(englishText);
      const chineseLang = await ocrService.detectLanguage(chineseText);

      expect(englishLang).toBe('eng');
      expect(chineseLang).toBe('chi_sim');
    });

    it('should validate OCR quality', async () => {
      const lowQualityResult = {
        text: 'Very short text',
        confidence: 45,
        language: 'eng',
        pages: [{
          pageNumber: 1,
          text: 'Very short text',
          confidence: 45,
          blocks: []
        }],
        processingTime: 1000
      };

      const quality = await ocrService.validateOCRQuality(lowQualityResult);
      
      expect(quality.isValid).toBe(false);
      expect(quality.issues.length).toBeGreaterThan(0);
      expect(quality.suggestions.length).toBeGreaterThan(0);
    });

    it('should return supported formats', async () => {
      const formats = await ocrService.getSupportedFormats();
      
      expect(Array.isArray(formats)).toBe(true);
      expect(formats.length).toBeGreaterThan(0);
      expect(formats).toContain('image/png');
      expect(formats).toContain('image/jpeg');
      expect(formats).toContain('application/pdf');
    });

    it('should check format support', async () => {
      const supported = await ocrService.isFormatSupported('image/png');
      const unsupported = await ocrService.isFormatSupported('application/x-executable');

      expect(supported).toBe(true);
      expect(unsupported).toBe(false);
    });
  });
});

describe('Integration Test Cleanup', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should clean up test data', async () => {
    // Clean up test documents
    await prisma.document.deleteMany({
      where: {
        OR: [
          { originalName: { contains: 'test' } },
          { description: { contains: 'test' } }
        ]
      }
    });

    // Clean up test comments
    await prisma.documentComment.deleteMany({
      where: {
        content: { contains: 'test' }
      }
    });

    // Clean up test shares
    await prisma.documentShare.deleteMany({
      where: {
        message: { contains: 'test' }
      }
    });

    // Clean up test search indices
    await prisma.searchIndex.deleteMany({
      where: {
        content: { contains: 'test' }
      }
    });

    // Verify cleanup
    const remainingDocuments = await prisma.document.count({
      where: {
        OR: [
          { originalName: { contains: 'test' } },
          { description: { contains: 'test' } }
        ]
      }
    });

    expect(remainingDocuments).toBe(0);
  });
});