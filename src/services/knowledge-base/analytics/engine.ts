import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface KnowledgeBaseMetrics {
  totalViews: number;
  totalArticles: number;
  activeUsers: number;
  averageReadTime: number;
  topCategories: Array<{ category: string; views: number }>;
  topArticles: Array<{ id: string; title: string; views: number }>;
  userEngagement: {
    commentsPerArticle: number;
    likesPerArticle: number;
    sharesPerArticle: number;
  };
  contentGaps: Array<{ topic: string; demand: number; supply: number }>;
}

export interface UserActivityMetrics {
  userId: string;
  totalViews: number;
  uniqueArticlesViewed: number;
  averageReadTime: number;
  favoriteCategories: string[];
  searchQueries: string[];
  contributions: {
    articlesAuthored: number;
    commentsMade: number;
    helpfulVotes: number;
  };
}

export interface ContentPerformanceMetrics {
  articleId: string;
  title: string;
  views: number;
  uniqueViewers: number;
  averageReadTime: number;
  completionRate: number;
  bounceRate: number;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    bookmarks: number;
  };
  searchTerms: string[];
  relatedArticles: string[];
}

export interface SystemHealthMetrics {
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  score: number; // 0-100
  checks: {
    contentFreshness: boolean;
    userEngagement: boolean;
    searchPerformance: boolean;
    systemResources: boolean;
  };
  alerts: SystemAlert[];
  recommendations: string[];
}

export interface SystemAlert {
  id: string;
  type: 'content_stale' | 'low_engagement' | 'search_issues' | 'system_overload';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

export interface AnalyticsTimeRange {
  start: Date;
  end: Date;
}

export class KnowledgeBaseAnalyticsEngine {
  private alerts: SystemAlert[] = [];
  private metricsCache: Map<string, any> = new Map();
  private lastHealthCheck: Date = new Date();

  constructor() {
    this.startMonitoring();
    this.startPeriodicHealthChecks();
  }

  async recordArticleView(data: {
    articleId: string;
    userId?: string;
    sessionId?: string;
    readTime?: number;
    completionPercentage?: number;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  }): Promise<void> {
    try {
      await prisma.knowledgeBaseView.create({
        data: {
          articleId: data.articleId,
          userId: data.userId,
          sessionId: data.sessionId,
          readTime: data.readTime || 0,
          completionPercentage: data.completionPercentage || 0,
          referrer: data.referrer,
          utmSource: data.utmSource,
          utmMedium: data.utmMedium,
          utmCampaign: data.utmCampaign,
        },
      });

      // Update article view count
      await prisma.knowledgeBaseArticle.update({
        where: { id: data.articleId },
        data: {
          viewCount: {
            increment: 1,
          },
        },
      });

      // Check for engagement alerts
      await this.checkEngagementAlerts(data);

      // Update cache
      this.updateViewMetricsCache(data);

    } catch (error) {
      console.error('Failed to record article view:', error);
    }
  }

  async recordUserInteraction(data: {
    articleId: string;
    userId: string;
    interactionType: 'like' | 'comment' | 'share' | 'bookmark' | 'helpful_vote';
    targetId?: string; // For comments or helpful votes
    content?: string; // For comments
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await prisma.knowledgeBaseInteraction.create({
        data: {
          articleId: data.articleId,
          userId: data.userId,
          interactionType: data.interactionType,
          targetId: data.targetId,
          content: data.content,
          metadata: data.metadata,
        },
      });

      // Update article interaction counts
      const updateData: any = {};
      switch (data.interactionType) {
        case 'like':
          updateData.likeCount = { increment: 1 };
          break;
        case 'comment':
          // Comments are handled separately
          break;
        case 'share':
          updateData.shareCount = { increment: 1 };
          break;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.knowledgeBaseArticle.update({
          where: { id: data.articleId },
          data: updateData,
        });
      }

    } catch (error) {
      console.error('Failed to record user interaction:', error);
    }
  }

  async recordSearchActivity(data: {
    query: string;
    userId?: string;
    sessionId?: string;
    resultsCount: number;
    clickedResults: string[];
    filters?: Record<string, any>;
    responseTime: number;
    success: boolean;
  }): Promise<void> {
    try {
      await prisma.knowledgeBaseSearchActivity.create({
        data: {
          query: data.query,
          userId: data.userId,
          sessionId: data.sessionId,
          resultsCount: data.resultsCount,
          clickedResults: data.clickedResults,
          filters: data.filters,
          responseTime: data.responseTime,
          success: data.success,
        },
      });

      // Check for search performance alerts
      await this.checkSearchAlerts(data);

    } catch (error) {
      console.error('Failed to record search activity:', error);
    }
  }

  async getKnowledgeBaseMetrics(
    timeRange: AnalyticsTimeRange = {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      end: new Date(),
    }
  ): Promise<KnowledgeBaseMetrics> {
    try {
      const cacheKey = `kb_metrics_${timeRange.start.toISOString()}_${timeRange.end.toISOString()}`;
      
      if (this.metricsCache.has(cacheKey)) {
        return this.metricsCache.get(cacheKey);
      }

      // Get total views
      const views = await prisma.knowledgeBaseView.findMany({
        where: {
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
      });

      const totalViews = views.length;

      // Get total articles
      const totalArticles = await prisma.knowledgeBaseArticle.count({
        where: {
          status: 'PUBLISHED',
        },
      });

      // Get active users
      const activeUsers = new Set(views.map(v => v.userId).filter(Boolean)).size;

      // Get average read time
      const averageReadTime = views.length > 0
        ? views.reduce((sum, v) => sum + (v.readTime || 0), 0) / views.length
        : 0;

      // Get top categories
      const categoryViews = new Map<string, number>();
      for (const view of views) {
        const article = await prisma.knowledgeBaseArticle.findUnique({
          where: { id: view.articleId },
          select: { categories: true },
        });
        
        if (article?.categories) {
          article.categories.forEach((category: string) => {
            categoryViews.set(category, (categoryViews.get(category) || 0) + 1);
          });
        }
      }

      const topCategories = Array.from(categoryViews.entries())
        .map(([category, views]) => ({ category, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

      // Get top articles
      const articleViews = new Map<string, { title: string; views: number }>();
      for (const view of views) {
        const article = await prisma.knowledgeBaseArticle.findUnique({
          where: { id: view.articleId },
          select: { title: true },
        });
        
        if (article) {
          const current = articleViews.get(view.articleId) || { title: article.title, views: 0 };
          articleViews.set(view.articleId, { ...current, views: current.views + 1 });
        }
      }

      const topArticles = Array.from(articleViews.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

      // Get user engagement metrics
      const interactions = await prisma.knowledgeBaseInteraction.findMany({
        where: {
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
      });

      const publishedArticles = await prisma.knowledgeBaseArticle.count({
        where: {
          status: 'PUBLISHED',
        },
      });

      const userEngagement = {
        commentsPerArticle: publishedArticles > 0 
          ? interactions.filter(i => i.interactionType === 'comment').length / publishedArticles 
          : 0,
        likesPerArticle: publishedArticles > 0
          ? interactions.filter(i => i.interactionType === 'like').length / publishedArticles
          : 0,
        sharesPerArticle: publishedArticles > 0
          ? interactions.filter(i => i.interactionType === 'share').length / publishedArticles
          : 0,
      };

      // Get content gaps (simplified analysis)
      const contentGaps = await this.analyzeContentGaps(timeRange);

      const metrics: KnowledgeBaseMetrics = {
        totalViews,
        totalArticles,
        activeUsers,
        averageReadTime,
        topCategories,
        topArticles,
        userEngagement,
        contentGaps,
      };

      // Cache the result
      this.metricsCache.set(cacheKey, metrics);
      
      // Clean old cache entries
      this.cleanMetricsCache();

      return metrics;
    } catch (error) {
      console.error('Failed to get knowledge base metrics:', error);
      throw error;
    }
  }

  async getUserActivityMetrics(
    userId: string,
    timeRange: AnalyticsTimeRange = {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      end: new Date(),
    }
  ): Promise<UserActivityMetrics> {
    try {
      // Get user's views
      const views = await prisma.knowledgeBaseView.findMany({
        where: {
          userId,
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
      });

      const totalViews = views.length;
      const uniqueArticlesViewed = new Set(views.map(v => v.articleId)).size;
      const averageReadTime = views.length > 0
        ? views.reduce((sum, v) => sum + (v.readTime || 0), 0) / views.length
        : 0;

      // Get favorite categories
      const categoryViews = new Map<string, number>();
      for (const view of views) {
        const article = await prisma.knowledgeBaseArticle.findUnique({
          where: { id: view.articleId },
          select: { categories: true },
        });
        
        if (article?.categories) {
          article.categories.forEach((category: string) => {
            categoryViews.set(category, (categoryViews.get(category) || 0) + 1);
          });
        }
      }

      const favoriteCategories = Array.from(categoryViews.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category]) => category);

      // Get search queries
      const searches = await prisma.knowledgeBaseSearchActivity.findMany({
        where: {
          userId,
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
        select: { query: true },
      });

      const searchQueries = [...new Set(searches.map(s => s.query))];

      // Get contributions
      const interactions = await prisma.knowledgeBaseInteraction.findMany({
        where: {
          userId,
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
      });

      const authoredArticles = await prisma.knowledgeBaseArticle.count({
        where: {
          authorId: userId,
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
      });

      const contributions = {
        articlesAuthored: authoredArticles,
        commentsMade: interactions.filter(i => i.interactionType === 'comment').length,
        helpfulVotes: interactions.filter(i => i.interactionType === 'helpful_vote').length,
      };

      return {
        userId,
        totalViews,
        uniqueArticlesViewed,
        averageReadTime,
        favoriteCategories,
        searchQueries,
        contributions,
      };
    } catch (error) {
      console.error('Failed to get user activity metrics:', error);
      throw error;
    }
  }

  async getContentPerformanceMetrics(
    articleId: string,
    timeRange: AnalyticsTimeRange = {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      end: new Date(),
    }
  ): Promise<ContentPerformanceMetrics> {
    try {
      const article = await prisma.knowledgeBaseArticle.findUnique({
        where: { id: articleId },
      });

      if (!article) {
        throw new Error('Article not found');
      }

      // Get views
      const views = await prisma.knowledgeBaseView.findMany({
        where: {
          articleId,
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
      });

      const uniqueViewers = new Set(views.map(v => v.userId).filter(Boolean)).size;
      const averageReadTime = views.length > 0
        ? views.reduce((sum, v) => sum + (v.readTime || 0), 0) / views.length
        : 0;

      // Calculate completion rate and bounce rate
      const completedViews = views.filter(v => (v.completionPercentage || 0) >= 80);
      const bouncedViews = views.filter(v => (v.completionPercentage || 0) < 20);
      
      const completionRate = views.length > 0 ? completedViews.length / views.length : 0;
      const bounceRate = views.length > 0 ? bouncedViews.length / views.length : 0;

      // Get engagement
      const interactions = await prisma.knowledgeBaseInteraction.findMany({
        where: {
          articleId,
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
      });

      const engagement = {
        likes: interactions.filter(i => i.interactionType === 'like').length,
        comments: interactions.filter(i => i.interactionType === 'comment').length,
        shares: interactions.filter(i => i.interactionType === 'share').length,
        bookmarks: interactions.filter(i => i.interactionType === 'bookmark').length,
      };

      // Get search terms that led to this article
      const searches = await prisma.knowledgeBaseSearchActivity.findMany({
        where: {
          clickedResults: {
            has: articleId,
          },
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
        select: { query: true },
      });

      const searchTerms = [...new Set(searches.map(s => s.query))];

      // Get related articles (simplified)
      const relatedArticles = await this.findRelatedArticles(articleId);

      return {
        articleId,
        title: article.title,
        views: views.length,
        uniqueViewers,
        averageReadTime,
        completionRate,
        bounceRate,
        engagement,
        searchTerms,
        relatedArticles,
      };
    } catch (error) {
      console.error('Failed to get content performance metrics:', error);
      throw error;
    }
  }

  async getSystemHealthMetrics(): Promise<SystemHealthMetrics> {
    try {
      const now = new Date();
      const recentPeriod = {
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Last 24 hours
        end: now,
      };

      let score = 100;
      const checks = {
        contentFreshness: true,
        userEngagement: true,
        searchPerformance: true,
        systemResources: true,
      };

      // Check content freshness
      const recentArticles = await prisma.knowledgeBaseArticle.count({
        where: {
          status: 'PUBLISHED',
          createdAt: {
            gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      });

      if (recentArticles < 5) {
        score -= 25;
        checks.contentFreshness = false;
      }

      // Check user engagement
      const recentInteractions = await prisma.knowledgeBaseInteraction.count({
        where: {
          createdAt: {
            gte: recentPeriod.start,
          },
        },
      });

      if (recentInteractions < 10) {
        score -= 20;
        checks.userEngagement = false;
      }

      // Check search performance
      const recentSearches = await prisma.knowledgeBaseSearchActivity.findMany({
        where: {
          createdAt: {
            gte: recentPeriod.start,
          },
        },
      });

      const avgSearchTime = recentSearches.length > 0
        ? recentSearches.reduce((sum, s) => sum + s.responseTime, 0) / recentSearches.length
        : 0;

      if (avgSearchTime > 2000) {
        score -= 15;
        checks.searchPerformance = false;
      }

      // Check system resources
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
      
      if (memoryUsageMB > 500) {
        score -= 10;
        checks.systemResources = false;
      }

      // Determine overall status
      let status: SystemHealthMetrics['overallStatus'] = 'healthy';
      if (score < 50) {
        status = 'unhealthy';
      } else if (score < 80) {
        status = 'degraded';
      }

      // Generate recommendations
      const recommendations = this.generateHealthRecommendations({
        recentArticles,
        recentInteractions,
        avgSearchTime,
        memoryUsageMB,
      });

      return {
        overallStatus: status,
        score: Math.max(0, score),
        checks,
        alerts: this.alerts.filter(a => !a.resolved),
        recommendations,
      };
    } catch (error) {
      console.error('Failed to get system health metrics:', error);
      return {
        overallStatus: 'unhealthy',
        score: 0,
        checks: {
          contentFreshness: false,
          userEngagement: false,
          searchPerformance: false,
          systemResources: false,
        },
        alerts: [],
        recommendations: ['System health check failed'],
      };
    }
  }

  async getAlerts(activeOnly: boolean = true): Promise<SystemAlert[]> {
    if (activeOnly) {
      return this.alerts.filter(alert => !alert.resolved);
    }
    return [...this.alerts];
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    const alertIndex = this.alerts.findIndex(alert => alert.id === alertId);
    if (alertIndex !== -1) {
      this.alerts[alertIndex].resolved = true;
      this.alerts[alertIndex].resolvedAt = new Date();
      return true;
    }
    return false;
  }

  private async checkEngagementAlerts(data: {
    articleId: string;
    readTime?: number;
    completionPercentage?: number;
  }): Promise<void> {
    // Low engagement alert
    if ((data.readTime || 0) < 10 && (data.completionPercentage || 0) < 20) {
      const alert: SystemAlert = {
        id: `low_engagement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'low_engagement',
        severity: 'low',
        message: `Low engagement detected for article ${data.articleId}`,
        timestamp: new Date(),
        resolved: false,
        metadata: {
          articleId: data.articleId,
          readTime: data.readTime,
          completionPercentage: data.completionPercentage,
        },
      };
      this.alerts.push(alert);
    }
  }

  private async checkSearchAlerts(data: {
    query: string;
    responseTime: number;
    resultsCount: number;
  }): Promise<void> {
    // Slow search alert
    if (data.responseTime > 5000) {
      const alert: SystemAlert = {
        id: `slow_search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'search_issues',
        severity: data.responseTime > 10000 ? 'high' : 'medium',
        message: `Slow search response: ${data.responseTime}ms for query "${data.query}"`,
        timestamp: new Date(),
        resolved: false,
        metadata: {
          query: data.query,
          responseTime: data.responseTime,
          resultsCount: data.resultsCount,
        },
      };
      this.alerts.push(alert);
    }

    // No results alert
    if (data.resultsCount === 0) {
      const alert: SystemAlert = {
        id: `no_results_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'search_issues',
        severity: 'medium',
        message: `No results found for query: "${data.query}"`,
        timestamp: new Date(),
        resolved: false,
        metadata: {
          query: data.query,
          resultsCount: data.resultsCount,
        },
      };
      this.alerts.push(alert);
    }
  }

  private updateViewMetricsCache(data: {
    articleId: string;
    userId?: string;
    readTime?: number;
  }): void {
    const now = new Date();
    const cacheKey = `views_${now.toISOString().slice(0, 10)}`; // Daily cache key

    if (!this.metricsCache.has(cacheKey)) {
      this.metricsCache.set(cacheKey, {
        totalViews: 0,
        totalReadTime: 0,
        articles: new Map(),
        users: new Set(),
      });
    }

    const cached = this.metricsCache.get(cacheKey);
    cached.totalViews++;
    cached.totalReadTime += data.readTime || 0;
    
    const articleCount = cached.articles.get(data.articleId) || 0;
    cached.articles.set(data.articleId, articleCount + 1);

    if (data.userId) {
      cached.users.add(data.userId);
    }
  }

  private cleanMetricsCache(): void {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    for (const [key] of this.metricsCache) {
      if (key.includes('_') && key < `views_${weekAgo.toISOString().slice(0, 10)}`) {
        this.metricsCache.delete(key);
      }
    }
  }

  private async analyzeContentGaps(timeRange: AnalyticsTimeRange): Promise<Array<{ topic: string; demand: number; supply: number }>> {
    // Simplified content gap analysis
    const searches = await prisma.knowledgeBaseSearchActivity.findMany({
      where: {
        createdAt: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
        resultsCount: 0, // Only searches with no results
      },
      select: { query: true },
    });

    const queryFrequency = new Map<string, number>();
    searches.forEach(search => {
      const words = search.query.toLowerCase().split(' ');
      words.forEach(word => {
        if (word.length > 3) { // Ignore short words
          queryFrequency.set(word, (queryFrequency.get(word) || 0) + 1);
        }
      });
    });

    return Array.from(queryFrequency.entries())
      .map(([topic, demand]) => ({
        topic,
        demand,
        supply: 0, // Simplified - would need actual content analysis
      }))
      .sort((a, b) => b.demand - a.demand)
      .slice(0, 10);
  }

  private async findRelatedArticles(articleId: string): Promise<string[]> {
    // Simplified related articles finding
    const article = await prisma.knowledgeBaseArticle.findUnique({
      where: { id: articleId },
      select: { categories: true, tags: true },
    });

    if (!article) return [];

    const related = await prisma.knowledgeBaseArticle.findMany({
      where: {
        id: { not: articleId },
        status: 'PUBLISHED',
        OR: [
          {
            categories: {
              hasSome: article.categories || [],
            },
          },
          {
            tags: {
              hasSome: article.tags || [],
            },
          },
        ],
      },
      select: { id: true },
      take: 5,
    });

    return related.map(a => a.id);
  }

  private generateHealthRecommendations(metrics: {
    recentArticles: number;
    recentInteractions: number;
    avgSearchTime: number;
    memoryUsageMB: number;
  }): string[] {
    const recommendations: string[] = [];

    if (metrics.recentArticles < 5) {
      recommendations.push('Consider adding new content to keep the knowledge base fresh');
    }

    if (metrics.recentInteractions < 10) {
      recommendations.push('User engagement is low - consider promoting knowledge base features');
    }

    if (metrics.avgSearchTime > 2000) {
      recommendations.push('Search performance is slow - consider optimizing search queries');
    }

    if (metrics.memoryUsageMB > 500) {
      recommendations.push('High memory usage detected - consider implementing caching strategies');
    }

    return recommendations;
  }

  private startMonitoring(): void {
    // Clean up resolved alerts older than 7 days
    setInterval(() => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      this.alerts = this.alerts.filter(alert => 
        !alert.resolved || alert.resolvedAt && alert.resolvedAt > weekAgo
      );
    }, 24 * 60 * 60 * 1000); // Clean up daily
  }

  private startPeriodicHealthChecks(): void {
    // Perform health checks every hour
    setInterval(async () => {
      try {
        const healthStatus = await this.getSystemHealthMetrics();
        
        if (healthStatus.overallStatus === 'unhealthy') {
          console.error('Knowledge base system health check failed:', healthStatus);
          
          // Create alert for unhealthy system
          const alert: SystemAlert = {
            id: `health_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'system_overload',
            severity: 'critical',
            message: `Knowledge base system is unhealthy (score: ${healthStatus.score})`,
            timestamp: new Date(),
            resolved: false,
          };
          
          if (!this.alerts.some(a => a.type === 'system_overload' && !a.resolved)) {
            this.alerts.push(alert);
          }
        }
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, 60 * 60 * 1000); // Check every hour
  }
}

export const knowledgeBaseAnalyticsEngine = new KnowledgeBaseAnalyticsEngine();