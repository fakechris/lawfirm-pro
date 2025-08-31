"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.knowledgeBaseAnalyticsEngine = exports.KnowledgeBaseAnalyticsEngine = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class KnowledgeBaseAnalyticsEngine {
    constructor() {
        this.alerts = [];
        this.metricsCache = new Map();
        this.lastHealthCheck = new Date();
        this.startMonitoring();
        this.startPeriodicHealthChecks();
    }
    async recordArticleView(data) {
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
            await prisma.knowledgeBaseArticle.update({
                where: { id: data.articleId },
                data: {
                    viewCount: {
                        increment: 1,
                    },
                },
            });
            await this.checkEngagementAlerts(data);
            this.updateViewMetricsCache(data);
        }
        catch (error) {
            console.error('Failed to record article view:', error);
        }
    }
    async recordUserInteraction(data) {
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
            const updateData = {};
            switch (data.interactionType) {
                case 'like':
                    updateData.likeCount = { increment: 1 };
                    break;
                case 'comment':
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
        }
        catch (error) {
            console.error('Failed to record user interaction:', error);
        }
    }
    async recordSearchActivity(data) {
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
            await this.checkSearchAlerts(data);
        }
        catch (error) {
            console.error('Failed to record search activity:', error);
        }
    }
    async getKnowledgeBaseMetrics(timeRange = {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date(),
    }) {
        try {
            const cacheKey = `kb_metrics_${timeRange.start.toISOString()}_${timeRange.end.toISOString()}`;
            if (this.metricsCache.has(cacheKey)) {
                return this.metricsCache.get(cacheKey);
            }
            const views = await prisma.knowledgeBaseView.findMany({
                where: {
                    createdAt: {
                        gte: timeRange.start,
                        lte: timeRange.end,
                    },
                },
            });
            const totalViews = views.length;
            const totalArticles = await prisma.knowledgeBaseArticle.count({
                where: {
                    status: 'PUBLISHED',
                },
            });
            const activeUsers = new Set(views.map(v => v.userId).filter(Boolean)).size;
            const averageReadTime = views.length > 0
                ? views.reduce((sum, v) => sum + (v.readTime || 0), 0) / views.length
                : 0;
            const categoryViews = new Map();
            for (const view of views) {
                const article = await prisma.knowledgeBaseArticle.findUnique({
                    where: { id: view.articleId },
                    select: { categories: true },
                });
                if (article?.categories) {
                    article.categories.forEach((category) => {
                        categoryViews.set(category, (categoryViews.get(category) || 0) + 1);
                    });
                }
            }
            const topCategories = Array.from(categoryViews.entries())
                .map(([category, views]) => ({ category, views }))
                .sort((a, b) => b.views - a.views)
                .slice(0, 10);
            const articleViews = new Map();
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
            const contentGaps = await this.analyzeContentGaps(timeRange);
            const metrics = {
                totalViews,
                totalArticles,
                activeUsers,
                averageReadTime,
                topCategories,
                topArticles,
                userEngagement,
                contentGaps,
            };
            this.metricsCache.set(cacheKey, metrics);
            this.cleanMetricsCache();
            return metrics;
        }
        catch (error) {
            console.error('Failed to get knowledge base metrics:', error);
            throw error;
        }
    }
    async getUserActivityMetrics(userId, timeRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date(),
    }) {
        try {
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
            const categoryViews = new Map();
            for (const view of views) {
                const article = await prisma.knowledgeBaseArticle.findUnique({
                    where: { id: view.articleId },
                    select: { categories: true },
                });
                if (article?.categories) {
                    article.categories.forEach((category) => {
                        categoryViews.set(category, (categoryViews.get(category) || 0) + 1);
                    });
                }
            }
            const favoriteCategories = Array.from(categoryViews.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([category]) => category);
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
        }
        catch (error) {
            console.error('Failed to get user activity metrics:', error);
            throw error;
        }
    }
    async getContentPerformanceMetrics(articleId, timeRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date(),
    }) {
        try {
            const article = await prisma.knowledgeBaseArticle.findUnique({
                where: { id: articleId },
            });
            if (!article) {
                throw new Error('Article not found');
            }
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
            const completedViews = views.filter(v => (v.completionPercentage || 0) >= 80);
            const bouncedViews = views.filter(v => (v.completionPercentage || 0) < 20);
            const completionRate = views.length > 0 ? completedViews.length / views.length : 0;
            const bounceRate = views.length > 0 ? bouncedViews.length / views.length : 0;
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
        }
        catch (error) {
            console.error('Failed to get content performance metrics:', error);
            throw error;
        }
    }
    async getSystemHealthMetrics() {
        try {
            const now = new Date();
            const recentPeriod = {
                start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
                end: now,
            };
            let score = 100;
            const checks = {
                contentFreshness: true,
                userEngagement: true,
                searchPerformance: true,
                systemResources: true,
            };
            const recentArticles = await prisma.knowledgeBaseArticle.count({
                where: {
                    status: 'PUBLISHED',
                    createdAt: {
                        gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
                    },
                },
            });
            if (recentArticles < 5) {
                score -= 25;
                checks.contentFreshness = false;
            }
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
            const memoryUsage = process.memoryUsage();
            const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
            if (memoryUsageMB > 500) {
                score -= 10;
                checks.systemResources = false;
            }
            let status = 'healthy';
            if (score < 50) {
                status = 'unhealthy';
            }
            else if (score < 80) {
                status = 'degraded';
            }
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
        }
        catch (error) {
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
    async getAlerts(activeOnly = true) {
        if (activeOnly) {
            return this.alerts.filter(alert => !alert.resolved);
        }
        return [...this.alerts];
    }
    async resolveAlert(alertId) {
        const alertIndex = this.alerts.findIndex(alert => alert.id === alertId);
        if (alertIndex !== -1) {
            this.alerts[alertIndex].resolved = true;
            this.alerts[alertIndex].resolvedAt = new Date();
            return true;
        }
        return false;
    }
    async checkEngagementAlerts(data) {
        if ((data.readTime || 0) < 10 && (data.completionPercentage || 0) < 20) {
            const alert = {
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
    async checkSearchAlerts(data) {
        if (data.responseTime > 5000) {
            const alert = {
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
        if (data.resultsCount === 0) {
            const alert = {
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
    updateViewMetricsCache(data) {
        const now = new Date();
        const cacheKey = `views_${now.toISOString().slice(0, 10)}`;
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
    cleanMetricsCache() {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        for (const [key] of this.metricsCache) {
            if (key.includes('_') && key < `views_${weekAgo.toISOString().slice(0, 10)}`) {
                this.metricsCache.delete(key);
            }
        }
    }
    async analyzeContentGaps(timeRange) {
        const searches = await prisma.knowledgeBaseSearchActivity.findMany({
            where: {
                createdAt: {
                    gte: timeRange.start,
                    lte: timeRange.end,
                },
                resultsCount: 0,
            },
            select: { query: true },
        });
        const queryFrequency = new Map();
        searches.forEach(search => {
            const words = search.query.toLowerCase().split(' ');
            words.forEach(word => {
                if (word.length > 3) {
                    queryFrequency.set(word, (queryFrequency.get(word) || 0) + 1);
                }
            });
        });
        return Array.from(queryFrequency.entries())
            .map(([topic, demand]) => ({
            topic,
            demand,
            supply: 0,
        }))
            .sort((a, b) => b.demand - a.demand)
            .slice(0, 10);
    }
    async findRelatedArticles(articleId) {
        const article = await prisma.knowledgeBaseArticle.findUnique({
            where: { id: articleId },
            select: { categories: true, tags: true },
        });
        if (!article)
            return [];
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
    generateHealthRecommendations(metrics) {
        const recommendations = [];
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
    startMonitoring() {
        setInterval(() => {
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            this.alerts = this.alerts.filter(alert => !alert.resolved || alert.resolvedAt && alert.resolvedAt > weekAgo);
        }, 24 * 60 * 60 * 1000);
    }
    startPeriodicHealthChecks() {
        setInterval(async () => {
            try {
                const healthStatus = await this.getSystemHealthMetrics();
                if (healthStatus.overallStatus === 'unhealthy') {
                    console.error('Knowledge base system health check failed:', healthStatus);
                    const alert = {
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
            }
            catch (error) {
                console.error('Health check failed:', error);
            }
        }, 60 * 60 * 1000);
    }
}
exports.KnowledgeBaseAnalyticsEngine = KnowledgeBaseAnalyticsEngine;
exports.knowledgeBaseAnalyticsEngine = new KnowledgeBaseAnalyticsEngine();
//# sourceMappingURL=engine.js.map