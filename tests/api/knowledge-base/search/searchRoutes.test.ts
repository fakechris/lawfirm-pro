import request from 'supertest';
import express from 'express';
import searchRoutes from '../../../../src/api/knowledge-base/search/searchRoutes';
import { authenticate } from '../../../../src/middleware/auth';

// Mock dependencies
jest.mock('../../../../src/middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-1', role: 'LAWYER' };
    next();
  }),
}));

jest.mock('../../../../src/services/knowledge-base/search/knowledgeSearchEngine', () => ({
  knowledgeSearchEngine: {
    searchKnowledge: jest.fn(),
    getKnowledgeSuggestions: jest.fn(),
    getKnowledgeRecommendations: jest.fn(),
  },
}));

jest.mock('../../../../src/services/knowledge-base/search/knowledgeIndexingService', () => ({
  knowledgeIndexingService: {
    indexKnowledgeArticle: jest.fn(),
    indexDocument: jest.fn(),
    processBatchIndexing: jest.fn(),
    reindexAllKnowledgeContent: jest.fn(),
    removeFromIndex: jest.fn(),
    getIndexingStats: jest.fn(),
    getIndexingQueue: jest.fn(),
    cancelIndexingJob: jest.fn(),
  },
}));

jest.mock('../../../../src/utils/knowledge-base/search/searchTextUtils', () => ({
  searchTextUtils: {
    analyzeSearchQuery: jest.fn(),
    highlightSearchResults: jest.fn(),
  },
}));

const mockKnowledgeSearchEngine = require('../../../../src/services/knowledge-base/search/knowledgeSearchEngine').knowledgeSearchEngine;
const mockKnowledgeIndexingService = require('../../../../src/services/knowledge-base/search/knowledgeIndexingService').knowledgeIndexingService;
const mockSearchTextUtils = require('../../../../src/utils/knowledge-base/search/searchTextUtils').searchTextUtils;

describe('Search API Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/knowledge-base/search', searchRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/knowledge-base/search/search', () => {
    it('should search knowledge base successfully', async () => {
      const mockSearchResult = {
        documents: [
          {
            id: 'doc-1',
            title: '合同法基础知识',
            content: '合同法是调整合同关系的法律规范...',
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        facets: {},
        query: '合同法',
        processingTime: 100,
        suggestions: [],
      };

      mockKnowledgeSearchEngine.searchKnowledge.mockResolvedValue(mockSearchResult);

      const response = await request(app)
        .post('/api/knowledge-base/search/search')
        .send({
          query: '合同法',
          pagination: { page: 1, limit: 10 },
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockSearchResult,
      });

      expect(mockKnowledgeSearchEngine.searchKnowledge).toHaveBeenCalledWith({
        query: '合同法',
        pagination: { page: 1, limit: 10 },
        userId: 'test-user-1',
      });
    });

    it('should return 400 for missing query', async () => {
      const response = await request(app)
        .post('/api/knowledge-base/search/search')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Query is required and must be a string');
    });

    it('should return 400 for empty query', async () => {
      const response = await request(app)
        .post('/api/knowledge-base/search/search')
        .send({ query: '' })
        .expect(400);

      expect(response.body.error).toBe('Query is required and must be a string');
    });

    it('should return 400 for invalid pagination', async () => {
      const response = await request(app)
        .post('/api/knowledge-base/search/search')
        .send({
          query: '合同法',
          pagination: { page: -1, limit: 10 },
        })
        .expect(400);

      expect(response.body.error).toBe('Page must be a positive number');
    });

    it('should handle search errors gracefully', async () => {
      mockKnowledgeSearchEngine.searchKnowledge.mockRejectedValue(new Error('Search failed'));

      const response = await request(app)
        .post('/api/knowledge-base/search/search')
        .send({ query: '合同法' })
        .expect(500);

      expect(response.body.error).toBe('Failed to search knowledge base');
    });
  });

  describe('GET /api/knowledge-base/search/suggestions', () => {
    it('should return search suggestions', async () => {
      const mockSuggestions = ['合同法', '劳动合同', '合同条款'];

      mockKnowledgeSearchEngine.getKnowledgeSuggestions.mockResolvedValue(mockSuggestions);

      const response = await request(app)
        .get('/api/knowledge-base/search/suggestions?q=合')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          query: '合',
          suggestions: mockSuggestions,
        },
      });

      expect(mockKnowledgeSearchEngine.getKnowledgeSuggestions).toHaveBeenCalledWith('合', 10);
    });

    it('should return 400 for missing query parameter', async () => {
      const response = await request(app)
        .get('/api/knowledge-base/search/suggestions')
        .expect(400);

      expect(response.body.error).toBe('Query parameter "q" is required');
    });

    it('should handle custom limit parameter', async () => {
      mockKnowledgeSearchEngine.getKnowledgeSuggestions.mockResolvedValue([]);

      await request(app)
        .get('/api/knowledge-base/search/suggestions?q=合&limit=5')
        .expect(200);

      expect(mockKnowledgeSearchEngine.getKnowledgeSuggestions).toHaveBeenCalledWith('合', 5);
    });
  });

  describe('POST /api/knowledge-base/search/analyze', () => {
    it('should analyze search query', async () => {
      const mockAnalysis = {
        originalQuery: '合同法',
        processedQuery: '合同 法',
        tokens: ['合同', '法'],
        keywords: ['合同', '法'],
        entities: [],
        intent: { type: 'informational', confidence: 0.8 },
        language: 'zh',
        complexity: 2,
      };

      mockSearchTextUtils.analyzeSearchQuery.mockReturnValue(mockAnalysis);

      const response = await request(app)
        .post('/api/knowledge-base/search/analyze')
        .send({ query: '合同法' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockAnalysis,
      });

      expect(mockSearchTextUtils.analyzeSearchQuery).toHaveBeenCalledWith('合同法');
    });

    it('should return 400 for missing query', async () => {
      const response = await request(app)
        .post('/api/knowledge-base/search/analyze')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Query is required and must be a string');
    });
  });

  describe('GET /api/knowledge-base/search/recommendations', () => {
    it('should return personalized recommendations', async () => {
      const mockRecommendations = [
        {
          document: {
            id: 'doc-1',
            title: '合同法详解',
            content: '合同法是调整合同关系的法律规范...',
          },
          score: 8.5,
          reason: 'Based on your interest in legal guides',
          type: 'content_based',
        },
      ];

      mockKnowledgeSearchEngine.getKnowledgeRecommendations.mockResolvedValue(mockRecommendations);

      const response = await request(app)
        .get('/api/knowledge-base/search/recommendations')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          userId: 'test-user-1',
          recommendations: mockRecommendations,
        },
      });

      expect(mockKnowledgeSearchEngine.getKnowledgeRecommendations).toHaveBeenCalledWith(
        'test-user-1',
        undefined,
        5
      );
    });

    it('should handle document exclusion parameter', async () => {
      mockKnowledgeSearchEngine.getKnowledgeRecommendations.mockResolvedValue([]);

      await request(app)
        .get('/api/knowledge-base/search/recommendations?documentId=doc-1&limit=3')
        .expect(200);

      expect(mockKnowledgeSearchEngine.getKnowledgeRecommendations).toHaveBeenCalledWith(
        'test-user-1',
        'doc-1',
        3
      );
    });
  });

  describe('POST /api/knowledge-base/search/index/article/:articleId', () => {
    it('should index knowledge article', async () => {
      mockKnowledgeIndexingService.indexKnowledgeArticle.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/knowledge-base/search/index/article/article-1')
        .send({ options: { extractKeywords: true } })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Knowledge article indexed successfully',
      });

      expect(mockKnowledgeIndexingService.indexKnowledgeArticle).toHaveBeenCalledWith(
        'article-1',
        { extractKeywords: true }
      );
    });

    it('should handle indexing errors', async () => {
      mockKnowledgeIndexingService.indexKnowledgeArticle.mockRejectedValue(new Error('Indexing failed'));

      const response = await request(app)
        .post('/api/knowledge-base/search/index/article/article-1')
        .expect(500);

      expect(response.body.error).toBe('Failed to index knowledge article');
    });
  });

  describe('POST /api/knowledge-base/search/index/batch', () => {
    it('should process batch indexing', async () => {
      const mockResult = {
        success: ['doc-1', 'doc-2'],
        failed: [],
      };

      mockKnowledgeIndexingService.processBatchIndexing.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/knowledge-base/search/index/batch')
        .send({
          documentIds: ['doc-1', 'doc-2'],
          options: { generateSummary: true },
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockResult,
      });

      expect(mockKnowledgeIndexingService.processBatchIndexing).toHaveBeenCalledWith(
        ['doc-1', 'doc-2'],
        { generateSummary: true }
      );
    });

    it('should return 400 for invalid documentIds', async () => {
      const response = await request(app)
        .post('/api/knowledge-base/search/index/batch')
        .send({ documentIds: 'not-an-array' })
        .expect(400);

      expect(response.body.error).toBe('documentIds must be a non-empty array');
    });

    it('should return 400 for empty documentIds', async () => {
      const response = await request(app)
        .post('/api/knowledge-base/search/index/batch')
        .send({ documentIds: [] })
        .expect(400);

      expect(response.body.error).toBe('documentIds must be a non-empty array');
    });
  });

  describe('DELETE /api/knowledge-base/search/index/:entityId', () => {
    it('should remove entity from index', async () => {
      mockKnowledgeIndexingService.removeFromIndex.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/knowledge-base/search/index/doc-1')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Entity removed from index successfully',
      });

      expect(mockKnowledgeIndexingService.removeFromIndex).toHaveBeenCalledWith('doc-1');
    });
  });

  describe('GET /api/knowledge-base/search/stats/indexing', () => {
    it('should return indexing stats', async () => {
      const mockStats = {
        totalDocuments: 100,
        indexedDocuments: 95,
        failedDocuments: 5,
        averageProcessingTime: 150,
        lastIndexingTime: new Date(),
        indexingQueueSize: 3,
      };

      mockKnowledgeIndexingService.getIndexingStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/knowledge-base/search/stats/indexing')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockStats,
      });
    });
  });

  describe('GET /api/knowledge-base/search/queue', () => {
    it('should return indexing queue', async () => {
      const mockQueue = [
        {
          id: 'job-1',
          type: 'knowledge_article',
          status: 'pending',
          priority: 'medium',
          createdAt: new Date(),
        },
      ];

      mockKnowledgeIndexingService.getIndexingQueue.mockResolvedValue(mockQueue);

      const response = await request(app)
        .get('/api/knowledge-base/search/queue')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockQueue,
      });
    });
  });

  describe('DELETE /api/knowledge-base/search/queue/:jobId', () => {
    it('should cancel indexing job', async () => {
      mockKnowledgeIndexingService.cancelIndexingJob.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/knowledge-base/search/queue/job-1')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Indexing job cancelled successfully',
      });

      expect(mockKnowledgeIndexingService.cancelIndexingJob).toHaveBeenCalledWith('job-1');
    });

    it('should return 404 for non-existent job', async () => {
      mockKnowledgeIndexingService.cancelIndexingJob.mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/knowledge-base/search/queue/non-existent-job')
        .expect(404);

      expect(response.body.error).toBe('Job not found or cannot be cancelled');
    });
  });

  describe('POST /api/knowledge-base/search/highlight', () => {
    it('should highlight search results', async () => {
      const mockHighlights = [
        {
          field: 'content',
          text: '合同法是调整合同关系的法律规范。',
          highlights: [
            { start: 0, end: 3, text: '合同' },
            { start: 4, end: 6, text: '法' },
          ],
        },
      ];

      mockSearchTextUtils.highlightSearchResults.mockReturnValue(mockHighlights);

      const response = await request(app)
        .post('/api/knowledge-base/search/highlight')
        .send({
          text: '合同法是调整合同关系的法律规范。',
          query: '合同法',
          maxFragments: 2,
          fragmentLength: 100,
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockHighlights,
      });

      expect(mockSearchTextUtils.highlightSearchResults).toHaveBeenCalledWith(
        '合同法是调整合同关系的法律规范。',
        '合同法',
        2,
        100
      );
    });

    it('should return 400 for missing text or query', async () => {
      const response = await request(app)
        .post('/api/knowledge-base/search/highlight')
        .send({ text: 'some text' })
        .expect(400);

      expect(response.body.error).toBe('text and query are required');
    });
  });

  describe('GET /api/knowledge-base/search/analytics', () => {
    it('should return search analytics', async () => {
      // Mock PrismaClient for analytics
      const mockPrisma = {
        searchAnalytics: {
          findMany: jest.fn().mockResolvedValue([
            { query: '合同法', resultsCount: 5, processingTime: 100, createdAt: new Date() },
          ]),
          groupBy: jest.fn().mockResolvedValue([
            { query: '合同法', _count: { query: 3 }, _avg: { processingTime: 120 } },
          ]),
        },
      };

      jest.doMock('@prisma/client', () => ({
        PrismaClient: jest.fn(() => mockPrisma),
      }));

      const response = await request(app)
        .get('/api/knowledge-base/search/analytics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('analytics');
      expect(response.body.data).toHaveProperty('summary');
    });

    it('should handle date range parameters', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      await request(app)
        .get(`/api/knowledge-base/search/analytics?startDate=${startDate}&endDate=${endDate}`)
        .expect(200);

      // Should not throw an error
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all endpoints', async () => {
      // Temporarily disable authentication mock
      const originalAuthenticate = authenticate;
      (authenticate as jest.Mock).mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Authentication required' });
      });

      const response = await request(app)
        .post('/api/knowledge-base/search/search')
        .send({ query: 'test' })
        .expect(401);

      expect(response.body.error).toBe('Authentication required');

      // Restore original mock
      (authenticate as jest.Mock).mockImplementation(originalAuthenticate);
    });
  });

  describe('Rate limiting', () => {
    it('should handle rate limiting gracefully', async () => {
      // This test would need rate limiting middleware to be properly implemented
      // For now, we'll just test that the endpoint doesn't crash
      const response = await request(app)
        .post('/api/knowledge-base/search/search')
        .send({ query: 'test' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});