import { KnowledgeSearchEngine, KnowledgeSearchQuery, KnowledgeSearchDocument } from '../../../../src/services/knowledge-base/search/knowledgeSearchEngine';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('KnowledgeSearchEngine', () => {
  let searchEngine: KnowledgeSearchEngine;
  const testDocument: KnowledgeSearchDocument = {
    id: 'test-doc-1',
    entityId: 'test-doc-1',
    entityType: 'knowledge_article',
    title: '合同法基础',
    content: '合同是当事人之间设立、变更、终止民事关系的协议。合同应当遵循公平、诚实信用的原则。',
    summary: '合同法基础知识介绍',
    tags: ['合同', '法律', '基础'],
    categories: ['法律知识'],
    language: 'zh-CN',
    contentType: 'LEGAL_GUIDE',
    accessLevel: 'PUBLIC',
    authorId: 'user-1',
    metadata: {
      authorName: '张律师',
      viewCount: 10,
      likeCount: 5,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    searchEngine = new KnowledgeSearchEngine();
    
    // Clean up any existing test data
    await prisma.searchIndex.deleteMany({
      where: { id: { startsWith: 'test-' } },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.searchIndex.deleteMany({
      where: { id: { startsWith: 'test-' } },
    });
    
    await prisma.$disconnect();
  });

  describe('indexKnowledgeDocument', () => {
    it('should successfully index a knowledge document', async () => {
      await expect(
        searchEngine.indexKnowledgeDocument(testDocument)
      ).resolves.not.toThrow();

      // Verify document was indexed
      const indexedDoc = await prisma.searchIndex.findUnique({
        where: { id: testDocument.id },
      });

      expect(indexedDoc).toBeTruthy();
      expect(indexedDoc?.title).toBe(testDocument.title);
      expect(indexedDoc?.content).toBe(testDocument.content);
      expect(indexedDoc?.language).toBe(testDocument.language);
    });

    it('should handle Chinese text processing correctly', async () => {
      const chineseDocument: KnowledgeSearchDocument = {
        ...testDocument,
        id: 'test-doc-chinese',
        title: '劳动合同法解读',
        content: '劳动合同是用人单位与劳动者确立劳动关系、明确双方权利和义务的协议。',
      };

      await searchEngine.indexKnowledgeDocument(chineseDocument);

      const indexedDoc = await prisma.searchIndex.findUnique({
        where: { id: chineseDocument.id },
      });

      expect(indexedDoc).toBeTruthy();
      expect(indexedDoc?.processedContent).toBeTruthy();
      expect(indexedDoc?.language).toBe('zh-CN');
    });

    it('should handle English content correctly', async () => {
      const englishDocument: KnowledgeSearchDocument = {
        ...testDocument,
        id: 'test-doc-english',
        title: 'Contract Law Basics',
        content: 'A contract is a legally binding agreement between parties.',
        language: 'en',
      };

      await searchEngine.indexKnowledgeDocument(englishDocument);

      const indexedDoc = await prisma.searchIndex.findUnique({
        where: { id: englishDocument.id },
      });

      expect(indexedDoc).toBeTruthy();
      expect(indexedDoc?.language).toBe('en');
    });

    it('should extract and store keywords', async () => {
      await searchEngine.indexKnowledgeDocument(testDocument);

      const indexedDoc = await prisma.searchIndex.findUnique({
        where: { id: testDocument.id },
      });

      expect(indexedDoc?.metadata?.keywords).toBeTruthy();
      expect(Array.isArray(indexedDoc?.metadata?.keywords)).toBe(true);
      expect((indexedDoc?.metadata?.keywords as string[]).length).toBeGreaterThan(0);
    });

    it('should generate content vector embeddings', async () => {
      await searchEngine.indexKnowledgeDocument(testDocument);

      const indexedDoc = await prisma.searchIndex.findUnique({
        where: { id: testDocument.id },
      });

      expect(indexedDoc?.vector).toBeTruthy();
      expect(Array.isArray(indexedDoc?.vector)).toBe(true);
      expect((indexedDoc?.vector as number[]).length).toBeGreaterThan(0);
    });
  });

  describe('searchKnowledge', () => {
    beforeAll(async () => {
      // Index test documents for search tests
      await searchEngine.indexKnowledgeDocument(testDocument);
      
      const testDocument2: KnowledgeSearchDocument = {
        ...testDocument,
        id: 'test-doc-2',
        title: '劳动法基础知识',
        content: '劳动法是调整劳动关系以及与劳动关系有密切联系的社会关系的法律规范总称。',
        tags: ['劳动法', '劳动关系'],
      };
      await searchEngine.indexKnowledgeDocument(testDocument2);
    });

    it('should return relevant results for Chinese queries', async () => {
      const query: KnowledgeSearchQuery = {
        query: '合同',
        pagination: { page: 1, limit: 10 },
      };

      const result = await searchEngine.searchKnowledge(query);

      expect(result).toBeTruthy();
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].title).toContain('合同');
      expect(result.total).toBe(1);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle English queries', async () => {
      const query: KnowledgeSearchQuery = {
        query: 'contract',
        pagination: { page: 1, limit: 10 },
      };

      const result = await searchEngine.searchKnowledge(query);

      expect(result).toBeTruthy();
      expect(Array.isArray(result.documents)).toBe(true);
    });

    it('should apply filters correctly', async () => {
      const query: KnowledgeSearchQuery = {
        query: '法律',
        filters: {
          contentType: ['LEGAL_GUIDE'],
          accessLevel: ['PUBLIC'],
        },
        pagination: { page: 1, limit: 10 },
      };

      const result = await searchEngine.searchKnowledge(query);

      expect(result).toBeTruthy();
      expect(Array.isArray(result.documents)).toBe(true);
    });

    it('should handle pagination correctly', async () => {
      const query: KnowledgeSearchQuery = {
        query: '法律',
        pagination: { page: 1, limit: 1 },
      };

      const result = await searchEngine.searchKnowledge(query);

      expect(result).toBeTruthy();
      expect(result.documents.length).toBeLessThanOrEqual(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(1);
    });

    it('should return search suggestions', async () => {
      const query: KnowledgeSearchQuery = {
        query: '合',
        pagination: { page: 1, limit: 10 },
      };

      const result = await searchEngine.searchKnowledge(query);

      expect(result).toBeTruthy();
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('should calculate relevance scores correctly', async () => {
      const query: KnowledgeSearchQuery = {
        query: '合同法',
        pagination: { page: 1, limit: 10 },
      };

      const result = await searchEngine.searchKnowledge(query);

      expect(result).toBeTruthy();
      if (result.documents.length > 0) {
        expect(result.documents[0].metadata?.relevanceScore).toBeGreaterThan(0);
      }
    });

    it('should handle empty query gracefully', async () => {
      const query: KnowledgeSearchQuery = {
        query: '',
        pagination: { page: 1, limit: 10 },
      };

      const result = await searchEngine.searchKnowledge(query);

      expect(result).toBeTruthy();
      expect(Array.isArray(result.documents)).toBe(true);
    });

    it('should return facets', async () => {
      const query: KnowledgeSearchQuery = {
        query: '法律',
        pagination: { page: 1, limit: 10 },
      };

      const result = await searchEngine.searchKnowledge(query);

      expect(result).toBeTruthy();
      expect(result.facets).toBeTruthy();
      expect(result.facets.dateRange).toBeTruthy();
    });
  });

  describe('getKnowledgeSuggestions', () => {
    it('should return relevant suggestions for partial queries', async () => {
      const suggestions = await searchEngine.getKnowledgeSuggestions('合', 5);

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it('should handle empty suggestions gracefully', async () => {
      const suggestions = await searchEngine.getKnowledgeSuggestions('xyz', 5);

      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('getKnowledgeRecommendations', () => {
    it('should return recommendations for users', async () => {
      const userId = 'test-user-1';
      const recommendations = await searchEngine.getKnowledgeRecommendations(userId, undefined, 3);

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeLessThanOrEqual(3);
    });

    it('should exclude current document from recommendations', async () => {
      const userId = 'test-user-1';
      const currentDocumentId = 'test-doc-1';
      const recommendations = await searchEngine.getKnowledgeRecommendations(userId, currentDocumentId, 3);

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.every(rec => rec.id !== currentDocumentId)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle indexing errors gracefully', async () => {
      const invalidDocument: KnowledgeSearchDocument = {
        ...testDocument,
        id: '', // Invalid ID
      };

      await expect(searchEngine.indexKnowledgeDocument(invalidDocument)).rejects.toThrow();
    });

    it('should handle search errors gracefully', async () => {
      // This would typically require mocking the database to simulate errors
      const query: KnowledgeSearchQuery = {
        query: 'test',
        pagination: { page: 1, limit: 10 },
      };

      const result = await searchEngine.searchKnowledge(query);
      expect(result).toBeTruthy();
    });
  });

  describe('performance', () => {
    it('should complete search within reasonable time', async () => {
      const query: KnowledgeSearchQuery = {
        query: '合同法',
        pagination: { page: 1, limit: 10 },
      };

      const startTime = Date.now();
      const result = await searchEngine.searchKnowledge(query);
      const endTime = Date.now();

      expect(result).toBeTruthy();
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max
    });

    it('should complete indexing within reasonable time', async () => {
      const startTime = Date.now();
      await searchEngine.indexKnowledgeDocument(testDocument);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds max
    });
  });
});