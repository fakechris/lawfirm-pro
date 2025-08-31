import {
  DocumentWithDetails
} from '../../../src/models/documents';

describe('Document Models', () => {
  describe('DocumentWithDetails Interface', () => {
    it('should validate basic structure with minimal required fields', () => {
      // Create a minimal valid document object with only core required fields
      const document: DocumentWithDetails = {
        id: 'test-doc-1',
        filename: 'test-document.pdf',
        originalName: 'Test Document.pdf',
        path: '/documents/test-document.pdf',
        size: 1024000,
        mimeType: 'application/pdf',
        type: 'LEGAL_DOCUMENT' as any,
        status: 'ACTIVE' as any,
        version: 1,
        isLatest: true,
        parentId: null,
        caseId: null,
        clientId: null,
        uploadedById: 'test-user-1',
        content: null,
        extractedText: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Test core required fields exist and have correct types
      expect(document.id).toBeDefined();
      expect(typeof document.id).toBe('string');
      expect(document.filename).toBeDefined();
      expect(typeof document.filename).toBe('string');
      expect(document.originalName).toBeDefined();
      expect(typeof document.originalName).toBe('string');
      expect(document.path).toBeDefined();
      expect(typeof document.path).toBe('string');
      expect(document.size).toBeGreaterThan(0);
      expect(typeof document.size).toBe('number');
      expect(document.mimeType).toBeDefined();
      expect(typeof document.mimeType).toBe('string');
      expect(document.type).toBeDefined();
      expect(document.status).toBeDefined();
      expect(document.version).toBeGreaterThan(0);
      expect(typeof document.version).toBe('number');
      expect(document.isLatest).toBe(true);
      expect(typeof document.isLatest).toBe('boolean');
      expect(document.uploadedById).toBeDefined();
      expect(typeof document.uploadedById).toBe('string');
      expect(document.createdAt).toBeInstanceOf(Date);
      expect(document.updatedAt).toBeInstanceOf(Date);

      // Test nullable fields
      expect(document.parentId).toBeNull();
      expect(document.caseId).toBeNull();
      expect(document.clientId).toBeNull();
      expect(document.content).toBeNull();
      expect(document.extractedText).toBeNull();

      // Test optional fields are undefined
      expect(document.versions).toBeUndefined();
      expect(document.case).toBeUndefined();
      expect(document.approvals).toBeUndefined();
      expect(document.comments).toBeUndefined();
      expect(document.shares).toBeUndefined();
      expect(document._count).toBeUndefined();
    });

    it('should validate optional fields when provided', () => {
      const documentWithOptions: DocumentWithDetails = {
        id: 'test-doc-2',
        filename: 'options.pdf',
        originalName: 'Options.pdf',
        path: '/documents/options.pdf',
        size: 2048000,
        mimeType: 'application/pdf',
        type: 'CONTRACT' as any,
        status: 'ACTIVE' as any,
        version: 1,
        isLatest: true,
        parentId: null,
        caseId: 'test-case-1',
        clientId: 'test-client-1',
        uploadedById: 'test-user-2',
        content: 'Document content',
        extractedText: 'Extracted text content',
        createdAt: new Date(),
        updatedAt: new Date(),
        // Optional fields
        versions: [],
        approvals: [],
        comments: [],
        shares: [],
        _count: {
          versions: 0,
          comments: 0,
          shares: 0
        }
      };

      // Test that optional fields are now defined
      expect(documentWithOptions.versions).toBeDefined();
      expect(Array.isArray(documentWithOptions.versions)).toBe(true);
      expect(documentWithOptions.approvals).toBeDefined();
      expect(Array.isArray(documentWithOptions.approvals)).toBe(true);
      expect(documentWithOptions.comments).toBeDefined();
      expect(Array.isArray(documentWithOptions.comments)).toBe(true);
      expect(documentWithOptions.shares).toBeDefined();
      expect(Array.isArray(documentWithOptions.shares)).toBe(true);
      expect(documentWithOptions._count).toBeDefined();
      expect(typeof documentWithOptions._count).toBe('object');

      // Test _count structure
      if (documentWithOptions._count) {
        expect(typeof documentWithOptions._count.versions).toBe('number');
        expect(typeof documentWithOptions._count.comments).toBe('number');
        expect(typeof documentWithOptions._count.shares).toBe('number');
        expect(documentWithOptions._count.versions).toBeGreaterThanOrEqual(0);
        expect(documentWithOptions._count.comments).toBeGreaterThanOrEqual(0);
        expect(documentWithOptions._count.shares).toBeGreaterThanOrEqual(0);
      }
    });

    it('should validate data type constraints', () => {
      const document: DocumentWithDetails = {
        id: 'test-doc-3',
        filename: 'types.pdf',
        originalName: 'Types.pdf',
        path: '/documents/types.pdf',
        size: 4096000,
        mimeType: 'application/pdf',
        type: 'EVIDENCE' as any,
        status: 'UNDER_REVIEW' as any,
        version: 2,
        isLatest: false,
        parentId: 'parent-doc-1',
        caseId: 'test-case-2',
        clientId: 'test-client-2',
        uploadedById: 'test-user-3',
        content: 'Test content for validation',
        extractedText: 'Extracted text for validation',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02')
      };

      // Validate string field constraints
      expect(document.id.length).toBeGreaterThan(0);
      expect(document.filename.length).toBeGreaterThan(0);
      expect(document.originalName.length).toBeGreaterThan(0);
      expect(document.path.length).toBeGreaterThan(0);
      expect(document.mimeType.length).toBeGreaterThan(0);
      expect(document.uploadedById.length).toBeGreaterThan(0);

      // Validate numeric constraints
      expect(document.size).toBeGreaterThanOrEqual(0);
      expect(document.version).toBeGreaterThan(0);

      // Validate boolean
      expect(typeof document.isLatest).toBe('boolean');

      // Validate dates
      expect(document.createdAt instanceof Date).toBe(true);
      expect(document.updatedAt instanceof Date).toBe(true);

      // Validate nullable string fields
      if (document.parentId) {
        expect(typeof document.parentId).toBe('string');
      }
      if (document.caseId) {
        expect(typeof document.caseId).toBe('string');
      }
      if (document.clientId) {
        expect(typeof document.clientId).toBe('string');
      }
      if (document.content) {
        expect(typeof document.content).toBe('string');
      }
      if (document.extractedText) {
        expect(typeof document.extractedText).toBe('string');
      }
    });

    it('should handle edge case with zero size and empty strings', () => {
      const edgeCaseDocument: DocumentWithDetails = {
        id: 'test-doc-4',
        filename: 'empty.pdf',
        originalName: 'Empty.pdf',
        path: '/documents/empty.pdf',
        size: 0,
        mimeType: 'application/pdf',
        type: 'OTHER' as any,
        status: 'DRAFT' as any,
        version: 1,
        isLatest: true,
        parentId: null,
        caseId: null,
        clientId: null,
        uploadedById: 'test-user-4',
        content: '',
        extractedText: '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Validate that zero size is acceptable
      expect(edgeCaseDocument.size).toBe(0);

      // Validate that empty strings are acceptable for content fields
      expect(edgeCaseDocument.content).toBe('');
      expect(edgeCaseDocument.extractedText).toBe('');

      // All other validations should still pass
      expect(edgeCaseDocument.id).toBeDefined();
      expect(edgeCaseDocument.filename).toBeDefined();
      expect(edgeCaseDocument.version).toBe(1);
      expect(edgeCaseDocument.isLatest).toBe(true);
    });

    it('should allow interface extension with additional properties', () => {
      const baseDocument: DocumentWithDetails = {
        id: 'base-doc',
        filename: 'base.pdf',
        originalName: 'Base.pdf',
        path: '/documents/base.pdf',
        size: 1024000,
        mimeType: 'application/pdf',
        type: 'TEMPLATE' as any,
        status: 'ACTIVE' as any,
        version: 1,
        isLatest: true,
        parentId: null,
        caseId: null,
        clientId: null,
        uploadedById: 'test-user-5',
        content: null,
        extractedText: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Test extending the interface with additional properties
      const extendedDocument = {
        ...baseDocument,
        customField: 'custom value',
        metadata: {
          category: 'test',
          priority: 'high',
          tags: ['tag1', 'tag2']
        },
        processingInfo: {
          ocrCompleted: true,
          virusScanCompleted: true,
          lastProcessed: new Date()
        }
      };

      // Verify the extended properties exist
      expect(extendedDocument.customField).toBe('custom value');
      expect(extendedDocument.metadata).toBeDefined();
      expect(extendedDocument.metadata.category).toBe('test');
      expect(Array.isArray(extendedDocument.metadata.tags)).toBe(true);
      expect(extendedDocument.processingInfo).toBeDefined();
      expect(extendedDocument.processingInfo.ocrCompleted).toBe(true);

      // Verify original properties are preserved
      expect(extendedDocument.id).toBe('base-doc');
      expect(extendedDocument.filename).toBe('base.pdf');
      expect(extendedDocument.type).toBe('TEMPLATE' as any);
    });
  });
});