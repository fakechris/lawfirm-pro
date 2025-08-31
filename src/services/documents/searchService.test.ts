import { DocumentSearchService } from '../../../src/services/documents/searchService';
import { PrismaClient } from '@prisma/client';

describe('DocumentSearchService', () => {
  let searchService: DocumentSearchService;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    searchService = new DocumentSearchService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Document Search', () => {
    beforeEach(async () => {
      // Create test documents in database
      await prisma.document.createMany({
        data: [
          {
            id: 'doc1',
            filename: 'contract-agreement.pdf',
            originalName: 'Contract Agreement.pdf',
            path: '/documents/contract-agreement.pdf',
            size: 1024000,
            mimeType: 'application/pdf',
            checksum: 'abc123',
            uploadedBy: 'user1',
            caseId: 'case1',
            category: 'CONTRACT',
            status: 'ACTIVE',
            description: 'Employment contract between ABC Corp and John Doe',
            tags: ['contract', 'employment', 'agreement'],
            isConfidential: false,
            uploadedAt: new Date('2024-01-15'),
            extractedText: 'This employment contract is made between ABC Corporation and John Doe...'
          },
          {
            id: 'doc2',
            filename: 'legal-brief.docx',
            originalName: 'Legal Brief.docx',
            path: '/documents/legal-brief.docx',
            size: 512000,
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            checksum: 'def456',
            uploadedBy: 'user2',
            caseId: 'case2',
            category: 'LEGAL_BRIEF',
            status: 'ACTIVE',
            description: 'Memorandum of law for breach of contract case',
            tags: ['brief', 'memorandum', 'breach'],
            isConfidential: true,
            uploadedAt: new Date('2024-01-20'),
            extractedText: 'MEMORANDUM OF LAW regarding breach of contract claims...'
          },
          {
            id: 'doc3',
            filename: 'client-email.pdf',
            originalName: 'Client Email.pdf',
            path: '/documents/client-email.pdf',
            size: 256000,
            mimeType: 'application/pdf',
            checksum: 'ghi789',
            uploadedBy: 'user1',
            caseId: 'case1',
            category: 'CORRESPONDENCE',
            status: 'ACTIVE',
            description: 'Email correspondence with client regarding case status',
            tags: ['email', 'client', 'correspondence'],
            isConfidential: false,
            uploadedAt: new Date('2024-01-25'),
            extractedText: 'Dear Client, Following up on your case status...'
          },
          {
            id: 'doc4',
            filename: 'court-filing.pdf',
            originalName: 'Court Filing.pdf',
            path: '/documents/court-filing.pdf',
            size: 2048000,
            mimeType: 'application/pdf',
            checksum: 'jkl012',
            uploadedBy: 'user3',
            caseId: 'case2',
            category: 'COURT_FILING',
            status: 'ACTIVE',
            description: 'Complaint filed in Supreme Court',
            tags: ['filing', 'complaint', 'court'],
            isConfidential: false,
            uploadedAt: new Date('2024-01-30'),
            extractedText: 'COMPLAINT filed in Supreme Court of New York...'
          }
        ]
      });

      // Create search index entries
      await prisma.searchIndex.createMany({
        data: [
          {
            id: 'index1',
            documentId: 'doc1',
            content: 'contract employment agreement ABC Corporation John Doe terms conditions compensation benefits',
            title: 'Contract Agreement',
            category: 'CONTRACT',
            metadata: { keywords: ['contract', 'employment', 'agreement'] },
            indexedAt: new Date('2024-01-15')
          },
          {
            id: 'index2',
            documentId: 'doc2',
            content: 'memorandum law breach contract claims damages negligence legal arguments',
            title: 'Legal Brief',
            category: 'LEGAL_BRIEF',
            metadata: { keywords: ['brief', 'memorandum', 'breach', 'contract'] },
            indexedAt: new Date('2024-01-20')
          },
          {
            id: 'index3',
            documentId: 'doc3',
            content: 'email client correspondence case status update follow-up questions',
            title: 'Client Email',
            category: 'CORRESPONDENCE',
            metadata: { keywords: ['email', 'client', 'correspondence'] },
            indexedAt: new Date('2024-01-25')
          },
          {
            id: 'index4',
            documentId: 'doc4',
            content: 'complaint court filing supreme court new york civil action jurisdiction',
            title: 'Court Filing',
            category: 'COURT_FILING',
            metadata: { keywords: ['filing', 'complaint', 'court'] },
            indexedAt: new Date('2024-01-30')
          }
        ]
      });
    });

    afterEach(async () => {
      // Clean up test data
      await prisma.document.deleteMany({
        where: {
          id: {
            in: ['doc1', 'doc2', 'doc3', 'doc4']
          }
        }
      });
      await prisma.searchIndex.deleteMany({
        where: {
          documentId: {
            in: ['doc1', 'doc2', 'doc3', 'doc4']
          }
        }
      });
    });

    it('should search documents by basic query', async () => {
      const result = await searchService.searchDocuments('contract');

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.results!.length).toBe(2); // doc1 and doc2 contain 'contract'
      expect(result.total).toBe(2);
      expect(result.query).toBe('contract');
      
      // Check that results are ordered by relevance
      expect(result.results![0].id).toBe('doc1'); // Should have higher relevance
      expect(result.results![1].id).toBe('doc2');
    });

    it('should search documents with multiple terms', async () => {
      const result = await searchService.searchDocuments('memorandum breach');

      expect(result.success).toBe(true);
      expect(result.results!.length).toBe(1);
      expect(result.results![0].id).toBe('doc2');
    });

    it('should handle search with no results', async () => {
      const result = await searchService.searchDocuments('nonexistent term');

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should search with category filter', async () => {
      const result = await searchService.searchDocuments('document', {
        category: 'CONTRACT'
      });

      expect(result.success).toBe(true);
      expect(result.results!.length).toBe(1);
      expect(result.results![0].id).toBe('doc1');
      expect(result.results![0].category).toBe('CONTRACT');
    });

    it('should search with date range filter', async () => {
      const result = await searchService.searchDocuments('document', {
        dateFrom: new Date('2024-01-20'),
        dateTo: new Date('2024-01-25')
      });

      expect(result.success).toBe(true);
      expect(result.results!.length).toBe(2); // doc2 and doc3
      expect(result.results!.map(r => r.id)).toContain('doc2');
      expect(result.results!.map(r => r.id)).toContain('doc3');
    });

    it('should search with file type filter', async () => {
      const result = await searchService.searchDocuments('document', {
        fileTypes: ['application/pdf']
      });

      expect(result.success).toBe(true);
      expect(result.results!.length).toBe(3); // doc1, doc3, doc4 are PDFs
      expect(result.results!.map(r => r.id)).toContain('doc1');
      expect(result.results!.map(r => r.id)).toContain('doc3');
      expect(result.results!.map(r => r.id)).toContain('doc4');
    });

    it('should search with tags filter', async () => {
      const result = await searchService.searchDocuments('document', {
        tags: ['breach']
      });

      expect(result.success).toBe(true);
      expect(result.results!.length).toBe(1);
      expect(result.results![0].id).toBe('doc2');
    });

    it('should search with size range filter', async () => {
      const result = await searchService.searchDocuments('document', {
        minSize: 500000,
        maxSize: 1500000
      });

      expect(result.success).toBe(true);
      expect(result.results!.length).toBe(1);
      expect(result.results![0].id).toBe('doc1'); // 1024000 bytes
    });

    it('should search with confidentiality filter', async () => {
      const result = await searchService.searchDocuments('document', {
        isConfidential: true
      });

      expect(result.success).toBe(true);
      expect(result.results!.length).toBe(1);
      expect(result.results![0].id).toBe('doc2');
      expect(result.results![0].isConfidential).toBe(true);
    });

    it('should search with case filter', async () => {
      const result = await searchService.searchDocuments('document', {
        caseId: 'case1'
      });

      expect(result.success).toBe(true);
      expect(result.results!.length).toBe(2);
      expect(result.results!.map(r => r.id)).toContain('doc1');
      expect(result.results!.map(r => r.id)).toContain('doc3');
    });

    it('should search with uploaded by filter', async () => {
      const result = await searchService.searchDocuments('document', {
        uploadedBy: 'user1'
      });

      expect(result.success).toBe(true);
      expect(result.results!.length).toBe(2);
      expect(result.results!.map(r => r.id)).toContain('doc1');
      expect(result.results!.map(r => r.id)).toContain('doc3');
    });

    it('should search with pagination', async () => {
      // First page
      const page1 = await searchService.searchDocuments('document', {
        page: 1,
        limit: 2
      });

      expect(page1.success).toBe(true);
      expect(page1.results!.length).toBe(2);
      expect(page1.page).toBe(1);
      expect(page1.limit).toBe(2);
      expect(page1.totalPages).toBe(2);

      // Second page
      const page2 = await searchService.searchDocuments('document', {
        page: 2,
        limit: 2
      });

      expect(page2.success).toBe(true);
      expect(page2.results!.length).toBe(2);
      expect(page2.page).toBe(2);
      expect(page2.limit).toBe(2);
      expect(page2.totalPages).toBe(2);
    });

    it('should search with sorting options', async () => {
      // Sort by upload date (newest first)
      const result = await searchService.searchDocuments('document', {
        sortBy: 'uploadedAt',
        sortOrder: 'desc'
      });

      expect(result.success).toBe(true);
      expect(result.results!.length).toBe(4);
      
      // Check order (newest first)
      const uploadDates = result.results!.map(r => r.uploadedAt.getTime());
      expect(uploadDates[0]).toBeGreaterThan(uploadDates[1]);
      expect(uploadDates[1]).toBeGreaterThan(uploadDates[2]);
      expect(uploadDates[2]).toBeGreaterThan(uploadDates[3]);
    });

    it('should search with fuzzy matching', async () => {
      const result = await searchService.searchDocuments('memorandom', {
        fuzzySearch: true
      });

      expect(result.success).toBe(true);
      expect(result.results!.length).toBe(1);
      expect(result.results![0].id).toBe('doc2'); // Should match "memorandum"
    });

    it('should search with field-specific search', async () => {
      const result = await searchService.searchDocuments('contract', {
        searchFields: ['title']
      });

      expect(result.success).toBe(true);
      // Should only find documents where 'contract' appears in the title
      expect(result.results!.length).toBeLessThanOrEqual(4);
    });
  });

  describe('Search Suggestions', () => {
    beforeEach(async () => {
      // Create test data for suggestions
      await prisma.searchIndex.createMany({
        data: [
          {
            id: 'suggest1',
            documentId: 'suggest-doc1',
            content: 'contract employment agreement terms',
            title: 'Employment Contract',
            category: 'CONTRACT',
            metadata: { keywords: ['contract', 'employment', 'agreement'] },
            indexedAt: new Date()
          },
          {
            id: 'suggest2',
            documentId: 'suggest-doc2',
            content: 'legal brief memorandum court',
            title: 'Legal Brief Memorandum',
            category: 'LEGAL_BRIEF',
            metadata: { keywords: ['brief', 'memorandum', 'court'] },
            indexedAt: new Date()
          },
          {
            id: 'suggest3',
            documentId: 'suggest-doc3',
            content: 'client correspondence email communication',
            title: 'Client Correspondence',
            category: 'CORRESPONDENCE',
            metadata: { keywords: ['email', 'client', 'correspondence'] },
            indexedAt: new Date()
          }
        ]
      });
    });

    afterEach(async () => {
      await prisma.searchIndex.deleteMany({
        where: {
          id: {
            in: ['suggest1', 'suggest2', 'suggest3']
          }
        }
      });
    });

    it('should get search suggestions for partial query', async () => {
      const result = await searchService.getSearchSuggestions('cont');

      expect(result.success).toBe(true);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions!.length).toBeGreaterThan(0);
      
      // Should contain contract-related suggestions
      const contractSuggestions = result.suggestions!.filter(s => 
        s.text.toLowerCase().includes('contract')
      );
      expect(contractSuggestions.length).toBeGreaterThan(0);
    });

    it('should get suggestions with category filter', async () => {
      const result = await searchService.getSearchSuggestions('leg', {
        category: 'LEGAL_BRIEF'
      });

      expect(result.success).toBe(true);
      expect(result.suggestions!.length).toBeGreaterThan(0);
      
      // All suggestions should be from legal brief category
      result.suggestions!.forEach(suggestion => {
        expect(suggestion.category).toBe('LEGAL_BRIEF');
      });
    });

    it('should limit number of suggestions', async () => {
      const result = await searchService.getSearchSuggestions('doc', {
        limit: 2
      });

      expect(result.success).toBe(true);
      expect(result.suggestions!.length).toBeLessThanOrEqual(2);
    });

    it('should handle empty query', async () => {
      const result = await searchService.getSearchSuggestions('');

      expect(result.success).toBe(true);
      expect(result.suggestions!.length).toBe(0);
    });
  });

  describe('Search Statistics', () => {
    beforeEach(async () => {
      // Create test data for statistics
      await prisma.searchIndex.createMany({
        data: [
          {
            id: 'stats1',
            documentId: 'stats-doc1',
            content: 'contract agreement terms conditions',
            title: 'Contract Agreement',
            category: 'CONTRACT',
            metadata: { keywords: ['contract', 'agreement'] },
            indexedAt: new Date('2024-01-15')
          },
          {
            id: 'stats2',
            documentId: 'stats-doc2',
            content: 'legal brief memorandum court',
            title: 'Legal Brief',
            category: 'LEGAL_BRIEF',
            metadata: { keywords: ['brief', 'memorandum'] },
            indexedAt: new Date('2024-01-20')
          },
          {
            id: 'stats3',
            documentId: 'stats-doc3',
            content: 'client correspondence email',
            title: 'Client Email',
            category: 'CORRESPONDENCE',
            metadata: { keywords: ['email', 'client'] },
            indexedAt: new Date('2024-01-25')
          }
        ]
      });
    });

    afterEach(async () => {
      await prisma.searchIndex.deleteMany({
        where: {
          id: {
            in: ['stats1', 'stats2', 'stats3']
          }
        }
      });
    });

    it('should get search statistics', async () => {
      const stats = await searchService.getSearchStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalIndexed).toBe(3);
      expect(stats.byCategory).toEqual({
        'CONTRACT': 1,
        'LEGAL_BRIEF': 1,
        'CORRESPONDENCE': 1
      });
      expect(stats.averageContentLength).toBeGreaterThan(0);
      expect(stats.lastIndexed).toBeInstanceOf(Date);
    });

    it('should get popular search terms', async () => {
      // Simulate some searches
      await searchService.searchDocuments('contract');
      await searchService.searchDocuments('contract');
      await searchService.searchDocuments('legal');
      await searchService.searchDocuments('brief');

      const popularTerms = await searchService.getPopularSearchTerms();

      expect(Array.isArray(popularTerms)).toBe(true);
      expect(popularTerms.length).toBeGreaterThan(0);
      
      // Should have 'contract' as most popular (searched twice)
      expect(popularTerms[0].term).toBe('contract');
      expect(popularTerms[0].count).toBe(2);
    });

    it('should get search performance metrics', async () => {
      // Perform some searches
      await searchService.searchDocuments('contract');
      await searchService.searchDocuments('legal brief');
      await searchService.searchDocuments('nonexistent');

      const metrics = await searchService.getSearchPerformanceMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalSearches).toBe(3);
      expect(metrics.averageSearchTime).toBeGreaterThan(0);
      expect(metrics.successRate).toBeGreaterThan(0);
      expect(metrics.successRate).toBeLessThanOrEqual(1);
    });
  });

  describe('Search Index Management', () => {
    it('should index document for search', async () => {
      const documentId = 'index-test-doc';
      
      const result = await searchService.indexDocument(documentId, {
        content: 'Test document content for indexing',
        title: 'Test Document',
        category: 'OTHER',
        keywords: ['test', 'document', 'indexing']
      });

      expect(result.success).toBe(true);
      expect(result.indexId).toBeDefined();

      // Verify document is indexed
      const searchResult = await searchService.searchDocuments('test document');
      expect(searchResult.results!.some(r => r.id === documentId)).toBe(true);

      // Clean up
      await prisma.searchIndex.delete({
        where: { id: result.indexId! }
      });
    });

    it('should update document index', async () => {
      const documentId = 'update-test-doc';
      
      // Initial indexing
      const initialResult = await searchService.indexDocument(documentId, {
        content: 'Initial content',
        title: 'Initial Title',
        category: 'OTHER',
        keywords: ['initial']
      });

      expect(initialResult.success).toBe(true);

      // Update index
      const updateResult = await searchService.updateDocumentIndex(documentId, {
        content: 'Updated content with new information',
        title: 'Updated Title',
        category: 'CONTRACT',
        keywords: ['updated', 'contract']
      });

      expect(updateResult.success).toBe(true);

      // Verify update
      const searchResult = await searchService.searchDocuments('updated contract');
      expect(searchResult.results!.some(r => r.id === documentId)).toBe(true);

      // Clean up
      await prisma.searchIndex.delete({
        where: { id: initialResult.indexId! }
      });
    });

    it('should remove document from index', async () => {
      const documentId = 'remove-test-doc';
      
      // Index document
      const indexResult = await searchService.indexDocument(documentId, {
        content: 'Document to be removed',
        title: 'Remove Test',
        category: 'OTHER',
        keywords: ['remove']
      });

      expect(indexResult.success).toBe(true);

      // Remove from index
      const removeResult = await searchService.removeDocumentFromIndex(documentId);

      expect(removeResult.success).toBe(true);

      // Verify removal
      const searchResult = await searchService.searchDocuments('remove');
      expect(searchResult.results!.some(r => r.id === documentId)).toBe(false);
    });

    it('should rebuild search index', async () => {
      // Create test documents
      await prisma.document.createMany({
        data: [
          {
            id: 'rebuild1',
            filename: 'rebuild1.pdf',
            originalName: 'Rebuild 1.pdf',
            path: '/documents/rebuild1.pdf',
            size: 100000,
            mimeType: 'application/pdf',
            checksum: 'rebuild1',
            uploadedBy: 'user1',
            category: 'CONTRACT',
            status: 'ACTIVE',
            description: 'Rebuild test document 1',
            tags: ['rebuild', 'test'],
            extractedText: 'Contract document for rebuild test'
          },
          {
            id: 'rebuild2',
            filename: 'rebuild2.pdf',
            originalName: 'Rebuild 2.pdf',
            path: '/documents/rebuild2.pdf',
            size: 200000,
            mimeType: 'application/pdf',
            checksum: 'rebuild2',
            uploadedBy: 'user2',
            category: 'LEGAL_BRIEF',
            status: 'ACTIVE',
            description: 'Rebuild test document 2',
            tags: ['rebuild', 'brief'],
            extractedText: 'Legal brief for rebuild test'
          }
        ]
      });

      // Rebuild index
      const rebuildResult = await searchService.rebuildSearchIndex();

      expect(rebuildResult.success).toBe(true);
      expect(rebuildResult.indexedCount).toBe(2);

      // Verify rebuild worked
      const searchResult = await searchService.searchDocuments('rebuild');
      expect(searchResult.results!.length).toBe(2);

      // Clean up
      await prisma.document.deleteMany({
        where: {
          id: {
            in: ['rebuild1', 'rebuild2']
          }
        }
      });
      await prisma.searchIndex.deleteMany({
        where: {
          documentId: {
            in: ['rebuild1', 'rebuild2']
          }
        }
      });
    });
  });
});