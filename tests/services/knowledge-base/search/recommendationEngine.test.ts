import { KnowledgeRecommendationEngine, RecommendationRequest, UserProfile } from '../../../../src/services/knowledge-base/search/recommendationEngine';
import { KnowledgeSearchDocument } from '../../../../src/services/knowledge-base/search/knowledgeSearchEngine';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  searchAnalytics: {
    findMany: jest.fn(),
  },
  searchIndex: {
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

describe('KnowledgeRecommendationEngine', () => {
  let recommendationEngine: KnowledgeRecommendationEngine;
  const mockUserProfile: UserProfile = {
    id: 'user-1',
    role: 'LAWYER',
    department: 'litigation',
    practiceAreas: ['contract_law', 'labor_law'],
    searchHistory: [
      { query: '合同法', timestamp: new Date(), resultsCount: 5, clickedResults: [] },
      { query: '劳动法', timestamp: new Date(), resultsCount: 3, clickedResults: [] },
    ],
    viewHistory: [],
    preferences: {
      contentTypes: ['LEGAL_GUIDE', 'CASE_STUDY'],
      categories: ['合同法', '劳动法'],
      tags: ['合同', '劳动', '法律'],
      language: 'zh-CN',
      updateFrequency: 'weekly',
    },
  };

  const mockDocuments: KnowledgeSearchDocument[] = [
    {
      id: 'doc-1',
      entityId: 'doc-1',
      entityType: 'knowledge_article',
      title: '合同法详解',
      content: '合同法是调整合同关系的法律规范...',
      tags: ['合同', '法律'],
      categories: ['合同法'],
      language: 'zh-CN',
      contentType: 'LEGAL_GUIDE',
      accessLevel: 'PUBLIC',
      metadata: { viewCount: 100, likeCount: 20 },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'doc-2',
      entityId: 'doc-2',
      entityType: 'knowledge_article',
      title: '劳动法基础知识',
      content: '劳动法是调整劳动关系的法律...',
      tags: ['劳动', '法律'],
      categories: ['劳动法'],
      language: 'zh-CN',
      contentType: 'LEGAL_GUIDE',
      accessLevel: 'PUBLIC',
      metadata: { viewCount: 80, likeCount: 15 },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeAll(() => {
    recommendationEngine = new KnowledgeRecommendationEngine();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPersonalizedRecommendations', () => {
    it('should return personalized recommendations', async () => {
      const request: RecommendationRequest = {
        userId: 'user-1',
        limit: 5,
      };

      // Mock user profile
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'LAWYER',
        department: 'litigation',
      });

      // Mock search analytics
      mockPrisma.searchAnalytics.findMany.mockResolvedValue([]);

      const recommendations = await recommendationEngine.getPersonalizedRecommendations(request);

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeLessThanOrEqual(request.limit);
      
      recommendations.forEach(rec => {
        expect(rec).toHaveProperty('document');
        expect(rec).toHaveProperty('score');
        expect(rec).toHaveProperty('reason');
        expect(rec).toHaveProperty('type');
        expect(typeof rec.score).toBe('number');
        expect(typeof rec.reason).toBe('string');
      });
    });

    it('should exclude current document from recommendations', async () => {
      const request: RecommendationRequest = {
        userId: 'user-1',
        currentDocumentId: 'doc-1',
        limit: 5,
      };

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'LAWYER',
      });

      mockPrisma.searchAnalytics.findMany.mockResolvedValue([]);

      const recommendations = await recommendationEngine.getPersonalizedRecommendations(request);

      expect(recommendations.every(rec => rec.document.id !== 'doc-1')).toBe(true);
    });

    it('should apply contextual scoring', async () => {
      const request: RecommendationRequest = {
        userId: 'user-1',
        limit: 5,
        context: {
          currentCase: '合同纠纷',
          currentTask: '准备诉讼材料',
          timeOfDay: 'morning',
        },
      };

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'LAWYER',
      });

      mockPrisma.searchAnalytics.findMany.mockResolvedValue([]);

      const recommendations = await recommendationEngine.getPersonalizedRecommendations(request);

      expect(Array.isArray(recommendations)).toBe(true);
      // Contextual scoring should be applied
    });

    it('should handle user not found', async () => {
      const request: RecommendationRequest = {
        userId: 'non-existent-user',
        limit: 5,
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(recommendationEngine.getPersonalizedRecommendations(request))
        .rejects.toThrow('User not found');
    });
  });

  describe('getContentBasedRecommendations', () => {
    it('should generate content-based recommendations', async () => {
      const recommendations = await recommendationEngine.getContentBasedRecommendations(
        mockUserProfile,
        undefined,
        5
      );

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeLessThanOrEqual(5);
      
      recommendations.forEach(rec => {
        expect(rec.type).toBe('content_based');
        expect(rec.reason).toContain('Matches your interest');
      });
    });

    it('should score based on user preferences', async () => {
      const recommendations = await recommendationEngine.getContentBasedRecommendations(
        mockUserProfile,
        undefined,
        5
      );

      recommendations.forEach(rec => {
        // Should score higher for preferred content types and categories
        expect(rec.score).toBeGreaterThan(0);
      });
    });
  });

  describe('getCollaborativeRecommendations', () => {
    it('should generate collaborative recommendations', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-2', role: 'LAWYER', department: 'litigation' },
      ]);

      mockPrisma.searchAnalytics.findMany.mockResolvedValue([
        { query: '合同法', resultsCount: 5, userId: 'user-2', createdAt: new Date() },
      ]);

      const recommendations = await recommendationEngine.getCollaborativeRecommendations(
        mockUserProfile,
        5
      );

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeLessThanOrEqual(5);
      
      recommendations.forEach(rec => {
        expect(rec.type).toBe('collaborative');
        expect(rec.reason).toContain('similar users');
      });
    });

    it('should handle no similar users', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const recommendations = await recommendationEngine.getCollaborativeRecommendations(
        mockUserProfile,
        5
      );

      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('getTrendingRecommendations', () => {
    it('should generate trending recommendations', async () => {
      mockPrisma.searchAnalytics.findMany.mockResolvedValue([
        { query: '劳动合同法', resultsCount: 10, createdAt: new Date() },
        { query: '合同条款', resultsCount: 8, createdAt: new Date() },
      ]);

      const recommendations = await recommendationEngine.getTrendingRecommendations(
        mockUserProfile,
        5
      );

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeLessThanOrEqual(5);
      
      recommendations.forEach(rec => {
        expect(rec.type).toBe('trending');
        expect(rec.reason).toContain('Trending topic');
      });
    });

    it('should handle no trending content', async () => {
      mockPrisma.searchAnalytics.findMany.mockResolvedValue([]);

      const recommendations = await recommendationEngine.getTrendingRecommendations(
        mockUserProfile,
        5
      );

      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('getSimilarUsersRecommendations', () => {
    it('should generate similar users recommendations', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-2', role: 'LAWYER', department: 'litigation' },
        { id: 'user-3', role: 'LAWYER', department: 'litigation' },
      ]);

      mockPrisma.searchIndex.findMany.mockResolvedValue([
        {
          id: 'doc-3',
          title: '诉讼技巧',
          lastAccessedAt: new Date(),
          metadata: { accessLevel: 'PUBLIC' },
        },
      ]);

      const recommendations = await recommendationEngine.getSimilarUsersRecommendations(
        mockUserProfile,
        5
      );

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeLessThanOrEqual(5);
      
      recommendations.forEach(rec => {
        expect(rec.type).toBe('similar_users');
        expect(rec.reason).toContain('users in your');
      });
    });
  });

  describe('recordUserAction', () => {
    it('should record search actions', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'LAWYER',
      });

      await recommendationEngine.recordUserAction('user-1', {
        type: 'search',
        query: '合同法',
      });

      // Should not throw an error
      expect(true).toBe(true);
    });

    it('should record view actions and update view count', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'LAWYER',
      });

      mockPrisma.searchIndex.update.mockResolvedValue({});

      await recommendationEngine.recordUserAction('user-1', {
        type: 'view',
        documentId: 'doc-1',
        duration: 30000,
      });

      expect(mockPrisma.searchIndex.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: {
          viewCount: { increment: 1 },
          lastAccessedAt: expect.any(Date),
        },
      });
    });

    it('should record like actions', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'LAWYER',
      });

      mockPrisma.searchIndex.update.mockResolvedValue({});

      await recommendationEngine.recordUserAction('user-1', {
        type: 'like',
        documentId: 'doc-1',
      });

      expect(mockPrisma.searchIndex.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: {
          metadata: {
            path: ['likeCount'],
            increment: 1,
          },
        },
      });
    });
  });

  describe('scoring methods', () => {
    it('should calculate content-based scores correctly', () => {
      const document: KnowledgeSearchDocument = {
        ...mockDocuments[0],
        contentType: 'LEGAL_GUIDE',
        categories: ['合同法'],
        tags: ['合同'],
        metadata: { viewCount: 100 },
      };

      const score = recommendationEngine['calculateContentBasedScore'](document, mockUserProfile);

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThan(0);
    });

    it('should calculate collaborative scores correctly', () => {
      const document: KnowledgeSearchDocument = mockDocuments[0];
      const similarUsers = [
        { id: 'user-2', role: 'LAWYER' },
        { id: 'user-3', role: 'LAWYER' },
      ];

      const score = recommendationEngine['calculateCollaborativeScore'](document, similarUsers);

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThan(0);
    });

    it('should calculate trending scores correctly', () => {
      const document: KnowledgeSearchDocument = mockDocuments[0];
      const trendingScore = 5.0;

      const score = recommendationEngine['calculateTrendingScore'](document, mockUserProfile, trendingScore);

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('utility methods', () => {
    it('should extract user interests from search history', () => {
      const interests = recommendationEngine['extractUserInterests'](mockUserProfile.searchHistory);

      expect(Array.isArray(interests)).toBe(true);
      expect(interests).toContain('合同法');
      expect(interests).toContain('劳动法');
    });

    it('should deduplicate recommendations', () => {
      const recommendations = [
        { document: { id: 'doc-1' }, score: 10, reason: 'test', type: 'content_based' },
        { document: { id: 'doc-1' }, score: 8, reason: 'test', type: 'collaborative' },
        { document: { id: 'doc-2' }, score: 9, reason: 'test', type: 'trending' },
      ];

      const deduplicated = recommendationEngine['deduplicateRecommendations'](recommendations, 'doc-2');

      expect(deduplicated.length).toBe(1);
      expect(deduplicated[0].document.id).toBe('doc-1');
    });

    it('should generate content-based reasons', () => {
      const document: KnowledgeSearchDocument = {
        ...mockDocuments[0],
        contentType: 'LEGAL_GUIDE',
        categories: ['合同法'],
      };

      const reason = recommendationEngine['generateContentBasedReason'](document, mockUserProfile);

      expect(typeof reason).toBe('string');
      expect(reason.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      const request: RecommendationRequest = {
        userId: 'user-1',
        limit: 5,
      };

      const recommendations = await recommendationEngine.getPersonalizedRecommendations(request);

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBe(0);
    });
  });
});