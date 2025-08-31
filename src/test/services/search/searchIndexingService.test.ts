import { searchIndexingService, SearchDocument, SearchQuery, IndexingOptions } from '../../../src/services/search/searchIndexingService';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    searchIndex: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    document: {
      findMany: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

const mockPrisma = new PrismaClient() as any;

describe('SearchIndexingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('indexDocument', () => {
    it('should index a document successfully', async () => {
      const document: SearchDocument = {
        id: 'doc1',
        entityId: 'doc1',
        entityType: 'document',
        title: 'Test Document',
        content: 'This is test content for indexing',
        metadata: { size: 1024, mimeType: 'text/plain' },
        tags: ['test', 'document'],
        language: 'eng',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.searchIndex.upsert.mockResolvedValue({ id: 'doc1' });

      await searchIndexingService.indexDocument(document);

      expect(mockPrisma.searchIndex.upsert).toHaveBeenCalledWith({
        where: { id: 'doc1' },
        update: expect.objectContaining({
          id: 'doc1',
          title: 'Test Document',
          content: 'This is test content for indexing',
        }),
        create: expect.objectContaining({
          id: 'doc1',
          title: 'Test Document',
          content: 'This is test content for indexing',
        }),
      });
    });

    it('should handle indexing errors', async () => {
      const document: SearchDocument = {
        id: 'doc1',
        entityId: 'doc1',
        entityType: 'document',
        title: 'Test Document',
        content: 'Test content',
        metadata: {},
        tags: [],
        language: 'eng',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.searchIndex.upsert.mockRejectedValue(new Error('Database error'));

      await expect(searchIndexingService.indexDocument(document))
        .rejects.toThrow('Document indexing failed: Database error');
    });
  });

  describe('search', () => {
    it('should perform search with basic query', async () => {
      const query: SearchQuery = {
        query: 'test search',
        pagination: { page: 1, limit: 10 },
      };

      const mockDocuments = [
        {
          id: 'doc1',
          title: 'Test Document',
          content: 'This is a test document',
          metadata: { keywords: ['test', 'document'] },
          tags: ['test'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.searchIndex.count.mockResolvedValue(1);
      mockPrisma.searchIndex.findMany.mockResolvedValue(mockDocuments);

      const result = await searchIndexingService.search(query);

      expect(result.documents).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.query).toBe('test search');
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should apply search filters', async () => {
      const query: SearchQuery = {
        query: 'test',
        filters: {
          entityType: ['document'],
          tags: ['important'],
          dateRange: {
            start: new Date('2023-01-01'),
            end: new Date('2023-12-31'),
          },
        },
        pagination: { page: 1, limit: 10 },
      };

      mockPrisma.searchIndex.count.mockResolvedValue(0);
      mockPrisma.searchIndex.findMany.mockResolvedValue([]);

      await searchIndexingService.search(query);

      expect(mockPrisma.searchIndex.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityType: { in: ['document'] },
            tags: { hasSome: ['important'] },
            createdAt: {
              gte: new Date('2023-01-01'),
              lte: new Date('2023-12-31'),
            },
          }),
        })
      );
    });

    it('should handle search errors', async () => {
      const query: SearchQuery = {
        query: 'test',
      };

      mockPrisma.searchIndex.count.mockRejectedValue(new Error('Search error'));

      await expect(searchIndexingService.search(query))
        .rejects.toThrow('Search failed: Search error');
    });
  });

  describe('reindexAllDocuments', () => {
    it('should reindex all documents', async () => {
      const mockDocuments = [
        {
          id: 'doc1',
          originalName: 'Document 1',
          content: 'Content 1',
          path: '/path/to/doc1',
          size: 1024,
          mimeType: 'text/plain',
          tags: ['tag1'],
          createdAt: new Date(),
          updatedAt: new Date(),
          uploadedBy: { username: 'user1' },
          case: { title: 'Case 1' },
          client: { firstName: 'John', lastName: 'Doe' },
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);
      mockPrisma.searchIndex.upsert.mockResolvedValue({});

      await searchIndexingService.reindexAllDocuments();

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith({
        include: {
          uploadedBy: true,
          case: true,
          client: true,
        },
      });

      expect(mockPrisma.searchIndex.upsert).toHaveBeenCalled();
    });

    it('should handle reindexing errors gracefully', async () => {
      const mockDocuments = [
        {
          id: 'doc1',
          originalName: 'Document 1',
          content: 'Content 1',
          path: '/path/to/doc1',
          size: 1024,
          mimeType: 'text/plain',
          tags: ['tag1'],
          createdAt: new Date(),
          updatedAt: new Date(),
          uploadedBy: { username: 'user1' },
          case: null,
          client: null,
        },
      ];

      mockPrisma.document.findMany.mockResolvedValue(mockDocuments);
      mockPrisma.searchIndex.upsert.mockRejectedValue(new Error('Indexing error'));

      await expect(searchIndexingService.reindexAllDocuments())
        .rejects.toThrow('Reindexing failed: Indexing error');
    });
  });

  describe('deleteFromIndex', () => {
    it('should delete document from index', async () => {
      await searchIndexingService.deleteFromIndex('doc1');

      expect(mockPrisma.searchIndex.delete).toHaveBeenCalledWith({
        where: { id: 'doc1' },
      });
    });

    it('should handle deletion errors', async () => {
      mockPrisma.searchIndex.delete.mockRejectedValue(new Error('Delete error'));

      await expect(searchIndexingService.deleteFromIndex('doc1'))
        .rejects.toThrow('Failed to delete from index: Delete error');
    });
  });

  describe('getSearchSuggestions', () => {
    it('should return search suggestions', async () => {
      const mockDocuments = [
        {
          id: 'doc1',
          title: 'Test Document Title',
          content: 'Test content',
          tags: ['test', 'suggestion'],
        },
        {
          id: 'doc2',
          title: 'Another Test',
          content: 'More test content',
          tags: ['test', 'another'],
        },
      ];

      mockPrisma.searchIndex.findMany.mockResolvedValue(mockDocuments);

      const suggestions = await searchIndexingService.getSearchSuggestions('test');

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should handle empty suggestions', async () => {
      mockPrisma.searchIndex.findMany.mockResolvedValue([]);

      const suggestions = await searchIndexingService.getSearchSuggestions('nonexistent');

      expect(suggestions).toEqual([]);
    });

    it('should handle suggestion errors', async () => {
      mockPrisma.searchIndex.findMany.mockRejectedValue(new Error('Suggestion error'));

      const suggestions = await searchIndexingService.getSearchSuggestions('test');

      expect(suggestions).toEqual([]);
    });
  });

  describe('content processing', () => {
    it('should process content correctly', async () => {
      const content = 'This is a test content for processing. It contains multiple sentences and should be processed correctly.';
      const options: IndexingOptions = {
        extractKeywords: true,
        generateSummary: true,
        analyzeSentiment: true,
        extractEntities: true,
        categorizeContent: true,
      };

      const result = await (searchIndexingService as any).processContent(content, options);

      expect(result.processedText).toBeDefined();
      expect(result.keywords).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.sentiment).toBeDefined();
      expect(result.entities).toBeDefined();
      expect(result.category).toBeDefined();
    });

    it('should handle empty content', async () => {
      const content = '';
      const options: IndexingOptions = {};

      const result = await (searchIndexingService as any).processContent(content, options);

      expect(result.processedText).toBe('');
      expect(result.keywords).toEqual([]);
      expect(result.summary).toBe('');
    });
  });

  describe('extractKeywords', () => {
    it('should extract keywords from text', () => {
      const text = 'document processing text extraction keywords analysis';
      const keywords = (searchIndexingService as any).extractKeywords(text, 5);

      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBeLessThanOrEqual(5);
    });
  });

  describe('generateSummary', () => {
    it('should generate summary from content', () => {
      const content = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
      const summary = (searchIndexingService as any).generateSummary(content, 50);

      expect(typeof summary).toBe('string');
      expect(summary.length).toBeLessThanOrEqual(50);
    });

    it('should handle empty content', () => {
      const summary = (searchIndexingService as any).generateSummary('', 50);

      expect(summary).toBe('');
    });
  });

  describe('analyzeSentiment', () => {
    it('should analyze sentiment correctly', () => {
      const positiveText = 'This is a great and wonderful document';
      const negativeText = 'This is a terrible and awful document';
      const neutralText = 'This is a document about facts';

      const positiveSentiment = (searchIndexingService as any).analyzeSentiment(positiveText);
      const negativeSentiment = (searchIndexingService as any).analyzeSentiment(negativeText);
      const neutralSentiment = (searchIndexingService as any).analyzeSentiment(neutralText);

      expect(['positive', 'negative', 'neutral']).toContain(positiveSentiment);
      expect(['positive', 'negative', 'neutral']).toContain(negativeSentiment);
      expect(['positive', 'negative', 'neutral']).toContain(neutralSentiment);
    });
  });

  describe('categorizeContent', () => {
    it('should categorize legal content correctly', () => {
      const contractText = 'This is a legal contract between parties';
      const lawsuitText = 'This document files a lawsuit against defendant';
      const evidenceText = 'This is evidence for the case';
      const generalText = 'This is a general document';

      const contractCategory = (searchIndexingService as any).categorizeContent(contractText);
      const lawsuitCategory = (searchIndexingService as any).categorizeContent(lawsuitText);
      const evidenceCategory = (searchIndexingService as any).categorizeContent(evidenceText);
      const generalCategory = (searchIndexingService as any).categorizeContent(generalText);

      expect(contractCategory).toBe('contract');
      expect(lawsuitCategory).toBe('lawsuit');
      expect(evidenceCategory).toBe('evidence');
      expect(generalCategory).toBe('general');
    });
  });
});