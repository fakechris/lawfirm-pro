export interface KnowledgeBaseMetrics {
    totalViews: number;
    totalArticles: number;
    activeUsers: number;
    averageReadTime: number;
    topCategories: Array<{
        category: string;
        views: number;
    }>;
    topArticles: Array<{
        id: string;
        title: string;
        views: number;
    }>;
    userEngagement: {
        commentsPerArticle: number;
        likesPerArticle: number;
        sharesPerArticle: number;
    };
    contentGaps: Array<{
        topic: string;
        demand: number;
        supply: number;
    }>;
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
    score: number;
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
export declare class KnowledgeBaseAnalyticsEngine {
    private alerts;
    private metricsCache;
    private lastHealthCheck;
    constructor();
    recordArticleView(data: {
        articleId: string;
        userId?: string;
        sessionId?: string;
        readTime?: number;
        completionPercentage?: number;
        referrer?: string;
        utmSource?: string;
        utmMedium?: string;
        utmCampaign?: string;
    }): Promise<void>;
    recordUserInteraction(data: {
        articleId: string;
        userId: string;
        interactionType: 'like' | 'comment' | 'share' | 'bookmark' | 'helpful_vote';
        targetId?: string;
        content?: string;
        metadata?: Record<string, any>;
    }): Promise<void>;
    recordSearchActivity(data: {
        query: string;
        userId?: string;
        sessionId?: string;
        resultsCount: number;
        clickedResults: string[];
        filters?: Record<string, any>;
        responseTime: number;
        success: boolean;
    }): Promise<void>;
    getKnowledgeBaseMetrics(timeRange?: AnalyticsTimeRange): Promise<KnowledgeBaseMetrics>;
    getUserActivityMetrics(userId: string, timeRange?: AnalyticsTimeRange): Promise<UserActivityMetrics>;
    getContentPerformanceMetrics(articleId: string, timeRange?: AnalyticsTimeRange): Promise<ContentPerformanceMetrics>;
    getSystemHealthMetrics(): Promise<SystemHealthMetrics>;
    getAlerts(activeOnly?: boolean): Promise<SystemAlert[]>;
    resolveAlert(alertId: string): Promise<boolean>;
    private checkEngagementAlerts;
    private checkSearchAlerts;
    private updateViewMetricsCache;
    private cleanMetricsCache;
    private analyzeContentGaps;
    private findRelatedArticles;
    private generateHealthRecommendations;
    private startMonitoring;
    private startPeriodicHealthChecks;
}
export declare const knowledgeBaseAnalyticsEngine: KnowledgeBaseAnalyticsEngine;
//# sourceMappingURL=engine.d.ts.map