import { PrismaClient } from '@prisma/client';
import { knowledgeSearchEngine, KnowledgeSearchDocument } from '../search/knowledgeSearchEngine';

const prisma = new PrismaClient();

export interface UserProfile {
  id: string;
  role: string;
  department?: string;
  practiceAreas?: string[];
  searchHistory: SearchHistory[];
  viewHistory: ViewHistory[];
  preferences: UserPreferences;
}

export interface SearchHistory {
  query: string;
  timestamp: Date;
  resultsCount: number;
  clickedResults: string[];
}

export interface ViewHistory {
  documentId: string;
  timestamp: Date;
  duration: number;
  completionRate: number;
}

export interface UserPreferences {
  contentTypes: string[];
  categories: string[];
  tags: string[];
  language: string;
  updateFrequency: 'daily' | 'weekly' | 'monthly';
}

export interface Recommendation {
  document: KnowledgeSearchDocument;
  score: number;
  reason: string;
  type: 'content_based' | 'collaborative' | 'trending' | 'similar_users' | 'recent';
}

export interface RecommendationRequest {
  userId: string;
  currentDocumentId?: string;
  limit: number;
  context?: {
    currentCase?: string;
    currentTask?: string;
    timeOfDay?: string;
    location?: string;
  };
}

export interface RecommendationAnalytics {
  userId: string;
  recommendations: Recommendation[];
  clicked: string[];
  viewed: string[];
  conversionRate: number;
  timestamp: Date;
}

export class KnowledgeRecommendationEngine {
  private userProfiles: Map<string, UserProfile> = new Map();
  private trendingContent: Map<string, { documentId: string; score: number; timestamp: Date }> = new Map();
  private contentSimilarity: Map<string, Map<string, number>> = new Map();

  constructor() {
    this.initializeTrendingContent();
    this.startPeriodicUpdates();
  }

  async getPersonalizedRecommendations(request: RecommendationRequest): Promise<Recommendation[]> {
    try {
      const { userId, currentDocumentId, limit, context } = request;

      // Get or create user profile
      const userProfile = await this.getUserProfile(userId);

      // Get different types of recommendations
      const [contentBased, collaborative, trending, similarUsers] = await Promise.all([
        this.getContentBasedRecommendations(userProfile, currentDocumentId, limit),
        this.getCollaborativeRecommendations(userProfile, limit),
        this.getTrendingRecommendations(userProfile, limit),
        this.getSimilarUsersRecommendations(userProfile, limit),
      ]);

      // Combine and score recommendations
      const allRecommendations = [
        ...contentBased.map(r => ({ ...r, type: 'content_based' as const })),
        ...collaborative.map(r => ({ ...r, type: 'collaborative' as const })),
        ...trending.map(r => ({ ...r, type: 'trending' as const })),
        ...similarUsers.map(r => ({ ...r, type: 'similar_users' as const })),
      ];

      // Apply contextual scoring
      const scoredRecommendations = this.applyContextualScoring(
        allRecommendations,
        userProfile,
        context
      );

      // Remove duplicates and current document
      const uniqueRecommendations = this.deduplicateRecommendations(
        scoredRecommendations,
        currentDocumentId
      );

      // Sort by score and limit results
      const finalRecommendations = uniqueRecommendations
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // Log recommendation analytics
      await this.logRecommendationAnalytics(userId, finalRecommendations);

      return finalRecommendations;
    } catch (error) {
      console.error('Failed to get personalized recommendations:', error);
      return [];
    }
  }

  async getContentBasedRecommendations(
    userProfile: UserProfile,
    excludeDocumentId?: string,
    limit: number = 10
  ): Promise<Recommendation[]> {
    try {
      const recommendations: Recommendation[] = [];

      // Get user's preferred content types and categories
      const preferredContentTypes = userProfile.preferences.contentTypes;
      const preferredCategories = userProfile.preferences.categories;
      const preferredTags = userProfile.preferences.tags;

      // Get recent user interests from search history
      const userInterests = this.extractUserInterests(userProfile.searchHistory);

      // Build search query based on user preferences
      const searchQuery = {
        query: userInterests.join(' '),
        filters: {
          contentType: preferredContentTypes.length > 0 ? preferredContentTypes : undefined,
          categories: preferredCategories.length > 0 ? preferredCategories : undefined,
          tags: preferredTags.length > 0 ? preferredTags : undefined,
        },
        pagination: { page: 1, limit: limit * 2 }, // Get more to filter
      };

      const searchResults = await knowledgeSearchEngine.searchKnowledge(searchQuery);

      // Score and rank results
      for (const document of searchResults.documents) {
        if (document.id === excludeDocumentId) continue;

        const score = this.calculateContentBasedScore(document, userProfile);
        const reason = this.generateContentBasedReason(document, userProfile);

        recommendations.push({
          document,
          score,
          reason,
          type: 'content_based',
        });
      }

      return recommendations.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (error) {
      console.error('Failed to get content-based recommendations:', error);
      return [];
    }
  }

  async getCollaborativeRecommendations(
    userProfile: UserProfile,
    limit: number = 10
  ): Promise<Recommendation[]> {
    try {
      const recommendations: Recommendation[] = [];

      // Find users with similar profiles
      const similarUsers = await this.findSimilarUsers(userProfile);

      // Get documents viewed by similar users
      const similarUserDocuments = new Set<string>();
      
      for (const similarUser of similarUsers) {
        const viewHistory = await prisma.searchAnalytics.findMany({
          where: { userId: similarUser.id },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });

        viewHistory.forEach(record => {
          if (record.resultsCount > 0) {
            similarUserDocuments.add(record.query);
          }
        });
      }

      // Search for documents related to similar users' interests
      if (similarUserDocuments.size > 0) {
        const searchQuery = {
          query: Array.from(similarUserDocuments).join(' '),
          pagination: { page: 1, limit: limit * 2 },
        };

        const searchResults = await knowledgeSearchEngine.searchKnowledge(searchQuery);

        for (const document of searchResults.documents) {
          const score = this.calculateCollaborativeScore(document, similarUsers);
          const reason = `Popular among ${similarUsers.length} similar users`;

          recommendations.push({
            document,
            score,
            reason,
            type: 'collaborative',
          });
        }
      }

      return recommendations.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (error) {
      console.error('Failed to get collaborative recommendations:', error);
      return [];
    }
  }

  async getTrendingRecommendations(
    userProfile: UserProfile,
    limit: number = 10
  ): Promise<Recommendation[]> {
    try {
      const recommendations: Recommendation[] = [];

      // Get recently popular content
      const recentAnalytics = await prisma.searchAnalytics.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      });

      // Calculate trending scores
      const trendingScores = new Map<string, number>();
      
      recentAnalytics.forEach(record => {
        const query = record.query.toLowerCase();
        const currentScore = trendingScores.get(query) || 0;
        
        // Score based on frequency and recency
        const recencyWeight = Math.exp(-(Date.now() - record.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
        trendingScores.set(query, currentScore + (1 * recencyWeight));
      });

      // Get top trending queries
      const topTrending = Array.from(trendingScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      // Search for documents matching trending queries
      for (const [query, score] of topTrending) {
        const searchResults = await knowledgeSearchEngine.searchKnowledge({
          query,
          pagination: { page: 1, limit: 2 },
        });

        for (const document of searchResults.documents) {
          const personalizedScore = this.calculateTrendingScore(document, userProfile, score);
          const reason = `Trending topic: ${query}`;

          recommendations.push({
            document,
            score: personalizedScore,
            reason,
            type: 'trending',
          });
        }
      }

      return recommendations.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (error) {
      console.error('Failed to get trending recommendations:', error);
      return [];
    }
  }

  async getSimilarUsersRecommendations(
    userProfile: UserProfile,
    limit: number = 10
  ): Promise<Recommendation[]> {
    try {
      const recommendations: Recommendation[] = [];

      // Find users with similar roles and departments
      const similarUsers = await prisma.user.findMany({
        where: {
          role: userProfile.role,
          ...(userProfile.department && { department: userProfile.department }),
          id: { not: userProfile.id },
        },
        take: 5,
      });

      // Get recent documents accessed by similar users
      const recentDocuments = await prisma.searchIndex.findMany({
        where: {
          metadata: {
            path: ['accessLevel'],
            equals: 'PUBLIC', // Only public content
          },
          lastAccessedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
        orderBy: { lastAccessedAt: 'desc' },
        take: limit * 3,
      });

      // Score documents based on similarity to user profile
      for (const document of recentDocuments) {
        const score = this.calculateSimilarUserScore(document, userProfile, similarUsers);
        const reason = `Recently viewed by users in your ${userProfile.role} role`;

        recommendations.push({
          document: this.mapToSearchDocument(document),
          score,
          reason,
          type: 'similar_users',
        });
      }

      return recommendations.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (error) {
      console.error('Failed to get similar users recommendations:', error);
      return [];
    }
  }

  async recordUserAction(userId: string, action: {
    type: 'search' | 'view' | 'like' | 'share' | 'bookmark';
    documentId?: string;
    query?: string;
    duration?: number;
  }): Promise<void> {
    try {
      const userProfile = await this.getUserProfile(userId);

      switch (action.type) {
        case 'search':
          if (action.query) {
            userProfile.searchHistory.push({
              query: action.query,
              timestamp: new Date(),
              resultsCount: 0, // Will be updated when search results are available
              clickedResults: [],
            });
          }
          break;

        case 'view':
          if (action.documentId) {
            userProfile.viewHistory.push({
              documentId: action.documentId,
              timestamp: new Date(),
              duration: action.duration || 0,
              completionRate: 1.0, // Assume full completion for now
            });

            // Update document view count
            await prisma.searchIndex.update({
              where: { id: action.documentId },
              data: {
                viewCount: { increment: 1 },
                lastAccessedAt: new Date(),
              },
            });
          }
          break;

        case 'like':
          if (action.documentId) {
            await prisma.searchIndex.update({
              where: { id: action.documentId },
              data: {
                metadata: {
                  path: ['likeCount'],
                  increment: 1,
                },
              },
            });
          }
          break;
      }

      // Update user profile
      this.userProfiles.set(userId, userProfile);
      await this.updateUserPreferences(userId);

    } catch (error) {
      console.error('Failed to record user action:', error);
    }
  }

  private async getUserProfile(userId: string): Promise<UserProfile> {
    // Check cache first
    const cachedProfile = this.userProfiles.get(userId);
    if (cachedProfile) {
      return cachedProfile;
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Get user's search history
    const searchHistory = await this.getUserSearchHistory(userId);
    const viewHistory = await this.getUserViewHistory(userId);

    // Get user preferences
    const preferences = await this.getUserPreferences(userId);

    const profile: UserProfile = {
      id: userId,
      role: user.role,
      department: user.department,
      practiceAreas: [], // Could be extended based on user data
      searchHistory,
      viewHistory,
      preferences,
    };

    // Cache profile
    this.userProfiles.set(userId, profile);

    return profile;
  }

  private async getUserSearchHistory(userId: string): Promise<SearchHistory[]> {
    const analytics = await prisma.searchAnalytics.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return analytics.map(record => ({
      query: record.query,
      timestamp: record.createdAt,
      resultsCount: record.resultsCount,
      clickedResults: [], // Could be extended with click tracking
    }));
  }

  private async getUserViewHistory(userId: string): Promise<ViewHistory[]> {
    // This would need to be implemented with a separate view tracking table
    // For now, return empty array
    return [];
  }

  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    // This would need to be implemented with a user preferences table
    // For now, return default preferences
    return {
      contentTypes: [],
      categories: [],
      tags: [],
      language: 'zh-CN',
      updateFrequency: 'weekly',
    };
  }

  private async updateUserPreferences(userId: string): Promise<void> {
    // Update user preferences based on recent activity
    const userProfile = this.userProfiles.get(userId);
    if (!userProfile) return;

    // Extract preferences from search history
    const contentTypes = new Set<string>();
    const categories = new Set<string>();
    const tags = new Set<string>();

    userProfile.searchHistory.forEach(search => {
      // This could be enhanced by analyzing search results and clicked documents
      // For now, we'll use a simple approach
    });

    userProfile.preferences = {
      contentTypes: Array.from(contentTypes),
      categories: Array.from(categories),
      tags: Array.from(tags),
      language: userProfile.preferences.language,
      updateFrequency: userProfile.preferences.updateFrequency,
    };
  }

  private extractUserInterests(searchHistory: SearchHistory[]): string[] {
    const interests = new Set<string>();

    searchHistory.forEach(search => {
      // Extract keywords from search queries
      const keywords = search.query.toLowerCase().split(/\s+/);
      keywords.forEach(keyword => {
        if (keyword.length > 2) {
          interests.add(keyword);
        }
      });
    });

    return Array.from(interests);
  }

  private calculateContentBasedScore(document: KnowledgeSearchDocument, userProfile: UserProfile): number {
    let score = 0;

    // Content type preference
    if (userProfile.preferences.contentTypes.includes(document.contentType || '')) {
      score += 10;
    }

    // Category preference
    const categoryMatch = document.categories.some(category => 
      userProfile.preferences.categories.includes(category)
    );
    if (categoryMatch) {
      score += 8;
    }

    // Tag preference
    const tagMatch = document.tags.some(tag => 
      userProfile.preferences.tags.includes(tag)
    );
    if (tagMatch) {
      score += 6;
    }

    // Search history match
    const userInterests = this.extractUserInterests(userProfile.searchHistory);
    const content = `${document.title} ${document.content}`.toLowerCase();
    const interestMatches = userInterests.filter(interest => content.includes(interest));
    score += interestMatches.length * 3;

    // View count boost
    const viewBoost = Math.log(document.metadata?.viewCount || 1) * 0.5;
    score += viewBoost;

    // Recency boost
    const daysSinceCreated = (Date.now() - document.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const recencyBoost = Math.max(0, 30 - daysSinceCreated) * 0.1;
    score += recencyBoost;

    return score;
  }

  private generateContentBasedReason(document: KnowledgeSearchDocument, userProfile: UserProfile): string {
    const reasons: string[] = [];

    if (userProfile.preferences.contentTypes.includes(document.contentType || '')) {
      reasons.push(`Matches your interest in ${document.contentType}`);
    }

    if (document.categories.some(cat => userProfile.preferences.categories.includes(cat))) {
      reasons.push(`Related to your preferred categories`);
    }

    if (document.tags.some(tag => userProfile.preferences.tags.includes(tag))) {
      reasons.push(`Contains your preferred tags`);
    }

    if (reasons.length === 0) {
      reasons.push('Based on your recent activity');
    }

    return reasons.join(', ');
  }

  private async findSimilarUsers(userProfile: UserProfile): Promise<UserProfile[]> {
    // Simplified similarity search - in production, this would use more sophisticated algorithms
    const similarUsers = await prisma.user.findMany({
      where: {
        role: userProfile.role,
        id: { not: userProfile.id },
      },
      take: 10,
    });

    return similarUsers.map(user => ({
      id: user.id,
      role: user.role,
      department: user.department,
      practiceAreas: [],
      searchHistory: [],
      viewHistory: [],
      preferences: {
        contentTypes: [],
        categories: [],
        tags: [],
        language: 'zh-CN',
        updateFrequency: 'weekly',
      },
    }));
  }

  private calculateCollaborativeScore(document: KnowledgeSearchDocument, similarUsers: UserProfile[]): number {
    // Base score from collaborative filtering
    let score = 5;

    // Boost for popular content among similar users
    score += similarUsers.length * 0.5;

    // View count boost
    const viewBoost = Math.log(document.metadata?.viewCount || 1) * 0.3;
    score += viewBoost;

    return score;
  }

  private calculateTrendingScore(document: KnowledgeSearchDocument, userProfile: UserProfile, trendingScore: number): number {
    let score = trendingScore * 2; // Base trending score

    // Personalization boost
    const contentMatch = this.calculateContentBasedScore(document, userProfile);
    score += contentMatch * 0.3;

    return score;
  }

  private calculateSimilarUserScore(document: any, userProfile: UserProfile, similarUsers: any[]): number {
    let score = 3; // Base score

    // Role relevance
    if (userProfile.role === 'LAWYER' || userProfile.role === 'ATTORNEY') {
      score += 2;
    }

    // Department relevance
    if (userProfile.department) {
      score += 1;
    }

    // Recency boost
    const daysSinceAccessed = document.lastAccessedAt ? 
      (Date.now() - document.lastAccessedAt.getTime()) / (1000 * 60 * 60 * 24) : 30;
    const recencyBoost = Math.max(0, 30 - daysSinceAccessed) * 0.2;
    score += recencyBoost;

    return score;
  }

  private mapToSearchDocument(document: any): KnowledgeSearchDocument {
    return {
      id: document.id,
      entityId: document.entityId,
      entityType: document.entityType,
      title: document.title,
      content: document.content,
      tags: document.tags || [],
      categories: document.metadata?.categories || [],
      language: document.language,
      contentType: document.metadata?.contentType,
      accessLevel: document.accessLevel,
      authorId: document.metadata?.authorId,
      metadata: document.metadata || {},
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  private applyContextualScoring(
    recommendations: Recommendation[],
    userProfile: UserProfile,
    context?: RecommendationRequest['context']
  ): Recommendation[] {
    if (!context) return recommendations;

    return recommendations.map(rec => {
      let score = rec.score;

      // Time-based scoring
      if (context.timeOfDay) {
        const hour = new Date().getHours();
        if (hour >= 9 && hour <= 17) {
          // Business hours - boost professional content
          if (rec.document.contentType === 'LEGAL_GUIDE' || rec.document.contentType === 'BEST_PRACTICE') {
            score += 2;
          }
        }
      }

      // Current case context
      if (context.currentCase) {
        // Boost content related to current case
        const caseKeywords = context.currentCase.toLowerCase().split(/\s+/);
        const content = `${rec.document.title} ${rec.document.content}`.toLowerCase();
        const matches = caseKeywords.filter(keyword => content.includes(keyword));
        score += matches.length * 1.5;
      }

      // Current task context
      if (context.currentTask) {
        // Boost content relevant to current task
        const taskKeywords = context.currentTask.toLowerCase().split(/\s+/);
        const content = `${rec.document.title} ${rec.document.content}`.toLowerCase();
        const matches = taskKeywords.filter(keyword => content.includes(keyword));
        score += matches.length * 1.2;
      }

      return { ...rec, score };
    });
  }

  private deduplicateRecommendations(
    recommendations: Recommendation[],
    excludeDocumentId?: string
  ): Recommendation[] {
    const seen = new Set<string>();
    
    return recommendations.filter(rec => {
      if (rec.document.id === excludeDocumentId) return false;
      if (seen.has(rec.document.id)) return false;
      
      seen.add(rec.document.id);
      return true;
    });
  }

  private async logRecommendationAnalytics(userId: string, recommendations: Recommendation[]): Promise<void> {
    try {
      // This would be implemented with a recommendations analytics table
      // For now, we'll just log to console
      console.log(`Generated ${recommendations.length} recommendations for user ${userId}`);
    } catch (error) {
      console.error('Failed to log recommendation analytics:', error);
    }
  }

  private initializeTrendingContent(): void {
    // Initialize trending content calculation
    this.updateTrendingContent();
    
    // Update trending content every hour
    setInterval(() => this.updateTrendingContent(), 60 * 60 * 1000);
  }

  private async updateTrendingContent(): Promise<void> {
    try {
      const recentAnalytics = await prisma.searchAnalytics.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      });

      // Calculate trending scores
      const trendingScores = new Map<string, number>();
      
      recentAnalytics.forEach(record => {
        const query = record.query.toLowerCase();
        const currentScore = trendingScores.get(query) || 0;
        const recencyWeight = Math.exp(-(Date.now() - record.createdAt.getTime()) / (24 * 60 * 60 * 1000));
        trendingScores.set(query, currentScore + (1 * recencyWeight));
      });

      // Update trending content
      this.trendingContent.clear();
      Array.from(trendingScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .forEach(([query, score]) => {
          this.trendingContent.set(query, { documentId: query, score, timestamp: new Date() });
        });
    } catch (error) {
      console.error('Failed to update trending content:', error);
    }
  }

  private startPeriodicUpdates(): void {
    // Update user profiles every hour
    setInterval(() => {
      this.userProfiles.clear(); // Clear cache to force refresh
    }, 60 * 60 * 1000);

    // Update content similarity matrix every 6 hours
    setInterval(() => {
      this.updateContentSimilarity();
    }, 6 * 60 * 60 * 1000);
  }

  private async updateContentSimilarity(): Promise<void> {
    // This would implement content-based similarity calculations
    // For now, it's a placeholder
    console.log('Updating content similarity matrix...');
  }
}

export const knowledgeRecommendationEngine = new KnowledgeRecommendationEngine();