"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchAnalyticsService = exports.SearchAnalyticsService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class SearchAnalyticsService {
    constructor() {
        this.alerts = [];
        this.metricsCache = new Map();
        this.lastHealthCheck = new Date();
        this.startMonitoring();
        this.startPeriodicHealthChecks();
    }
    async recordSearch(searchData) {
        try {
            await prisma.searchAnalytics.create({
                data: {
                    query: searchData.query,
                    resultsCount: searchData.resultsCount,
                    processingTime: searchData.responseTime,
                    userId: searchData.userId,
                    filters: searchData.filters,
                    sortBy: searchData.sortBy,
                },
            });
            await this.checkPerformanceAlerts(searchData);
            this.updateMetricsCache(searchData);
        }
        catch (error) {
            console.error('Failed to record search analytics:', error);
        }
    }
    async getSearchMetrics(period = {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date(),
    }) {
        try {
            const searches = await prisma.searchAnalytics.findMany({
                where: {
                    createdAt: {
                        gte: period.start,
                        lte: period.end,
                    },
                },
            });
            const totalSearches = searches.length;
            const averageResponseTime = searches.reduce((sum, s) => sum + s.processingTime, 0) / totalSearches || 0;
            const errorRate = 0;
            const queryCounts = new Map();
            searches.forEach(search => {
                queryCounts.set(search.query, (queryCounts.get(search.query) || 0) + 1);
            });
            const topQueries = Array.from(queryCounts.entries())
                .map(([query, count]) => ({ query, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);
            const hourlyDistribution = new Array(24).fill(0);
            searches.forEach(search => {
                const hour = search.createdAt.getHours();
                hourlyDistribution[hour]++;
            });
            const dailyDistribution = new Array(7).fill(0);
            searches.forEach(search => {
                const day = search.createdAt.getDay();
                dailyDistribution[day]++;
            });
            const userCounts = new Map();
            searches.forEach(search => {
                if (search.userId) {
                    userCounts.set(search.userId, (userCounts.get(search.userId) || 0) + 1);
                }
            });
            const byUser = Array.from(userCounts.entries())
                .map(([userId, count]) => ({ userId, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);
            const responseTimes = searches.map(s => s.processingTime).sort((a, b) => a - b);
            const p50ResponseTime = this.getPercentile(responseTimes, 50);
            const p95ResponseTime = this.getPercentile(responseTimes, 95);
            const p99ResponseTime = this.getPercentile(responseTimes, 99);
            return {
                totalSearches,
                averageResponseTime,
                errorRate,
                topQueries,
                searchDistribution: {
                    byHour: hourlyDistribution,
                    byDay: dailyDistribution,
                    byUser,
                },
                performanceMetrics: {
                    p50ResponseTime,
                    p95ResponseTime,
                    p99ResponseTime,
                },
            };
        }
        catch (error) {
            console.error('Failed to get search metrics:', error);
            throw error;
        }
    }
    async getSearchHealthStatus() {
        try {
            const now = new Date();
            const recentPeriod = {
                start: new Date(now.getTime() - 5 * 60 * 1000),
                end: now,
            };
            const recentSearches = await prisma.searchAnalytics.findMany({
                where: {
                    createdAt: {
                        gte: recentPeriod.start,
                        lte: recentPeriod.end,
                    },
                },
            });
            let score = 100;
            const checks = {
                responseTime: true,
                errorRate: true,
                resultQuality: true,
                systemResources: true,
            };
            const avgResponseTime = recentSearches.length > 0
                ? recentSearches.reduce((sum, s) => sum + s.processingTime, 0) / recentSearches.length
                : 0;
            if (avgResponseTime > 2000) {
                score -= 30;
                checks.responseTime = false;
            }
            else if (avgResponseTime > 1000) {
                score -= 15;
            }
            const errorRate = 0;
            if (errorRate > 0.05) {
                score -= 25;
                checks.errorRate = false;
            }
            const avgResults = recentSearches.length > 0
                ? recentSearches.reduce((sum, s) => sum + s.resultsCount, 0) / recentSearches.length
                : 0;
            if (avgResults < 1) {
                score -= 20;
                checks.resultQuality = false;
            }
            else if (avgResults < 3) {
                score -= 10;
            }
            const memoryUsage = process.memoryUsage();
            const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
            if (memoryUsageMB > 500) {
                score -= 15;
                checks.systemResources = false;
            }
            let status = 'healthy';
            if (score < 50) {
                status = 'unhealthy';
            }
            else if (score < 80) {
                status = 'degraded';
            }
            this.lastHealthCheck = now;
            return {
                status,
                score: Math.max(0, score),
                checks,
                lastCheck: now,
            };
        }
        catch (error) {
            console.error('Failed to get search health status:', error);
            return {
                status: 'unhealthy',
                score: 0,
                checks: {
                    responseTime: false,
                    errorRate: false,
                    resultQuality: false,
                    systemResources: false,
                },
                lastCheck: new Date(),
            };
        }
    }
    async getUsageReport(period) {
        try {
            const searches = await prisma.searchAnalytics.findMany({
                where: {
                    createdAt: {
                        gte: period.start,
                        lte: period.end,
                    },
                },
            });
            const totalSearches = searches.length;
            const uniqueUsers = new Set(searches.map(s => s.userId).filter(Boolean)).size;
            const averageResultsPerSearch = searches.length > 0
                ? searches.reduce((sum, s) => sum + s.resultsCount, 0) / searches.length
                : 0;
            const clickThroughRate = 0.25;
            const contentTypeCounts = new Map();
            searches.forEach(search => {
                if (search.filters?.contentType) {
                    const contentTypes = Array.isArray(search.filters.contentType)
                        ? search.filters.contentType
                        : [search.filters.contentType];
                    contentTypes.forEach(type => {
                        contentTypeCounts.set(type, (contentTypeCounts.get(type) || 0) + 1);
                    });
                }
            });
            const topContentTypes = Array.from(contentTypeCounts.entries())
                .map(([type, count]) => ({ type, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
            const userSatisfaction = Math.min(100, 50 + (averageResultsPerSearch * 5) + (clickThroughRate * 100));
            const recommendations = this.generateRecommendations({
                totalSearches,
                averageResponseTime: searches.reduce((sum, s) => sum + s.processingTime, 0) / searches.length,
                uniqueUsers,
                clickThroughRate,
            });
            return {
                period,
                totalSearches,
                uniqueUsers,
                averageResultsPerSearch,
                clickThroughRate,
                topContentTypes,
                userSatisfaction,
                recommendations,
            };
        }
        catch (error) {
            console.error('Failed to get usage report:', error);
            throw error;
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
    async checkPerformanceAlerts(searchData) {
        if (searchData.responseTime > 5000) {
            const alert = {
                id: `slow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'slow_response',
                severity: searchData.responseTime > 10000 ? 'high' : 'medium',
                message: `Slow search response: ${searchData.responseTime}ms for query "${searchData.query}"`,
                timestamp: new Date(),
                resolved: false,
            };
            this.alerts.push(alert);
            console.warn('Search performance alert:', alert.message);
        }
        if (searchData.resultsCount === 0) {
            const alert = {
                id: `no_results_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'low_result_count',
                severity: 'medium',
                message: `No results found for query: "${searchData.query}"`,
                timestamp: new Date(),
                resolved: false,
            };
            this.alerts.push(alert);
            console.warn('Search result alert:', alert.message);
        }
    }
    updateMetricsCache(searchData) {
        const now = new Date();
        const cacheKey = `metrics_${now.toISOString().slice(0, 10)}`;
        if (!this.metricsCache.has(cacheKey)) {
            this.metricsCache.set(cacheKey, {
                totalSearches: 0,
                totalResponseTime: 0,
                totalResults: 0,
                queries: new Map(),
            });
        }
        const cached = this.metricsCache.get(cacheKey);
        cached.totalSearches++;
        cached.totalResponseTime += searchData.responseTime;
        cached.totalResults += searchData.resultsCount;
        const queryCount = cached.queries.get(searchData.query) || 0;
        cached.queries.set(searchData.query, queryCount + 1);
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        for (const [key] of this.metricsCache) {
            if (key < `metrics_${weekAgo.toISOString().slice(0, 10)}`) {
                this.metricsCache.delete(key);
            }
        }
    }
    getPercentile(sortedArray, percentile) {
        if (sortedArray.length === 0)
            return 0;
        const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
    }
    generateRecommendations(metrics) {
        const recommendations = [];
        if (metrics.averageResponseTime > 2000) {
            recommendations.push('Consider optimizing search queries or adding caching to improve response times');
        }
        if (metrics.averageResponseTime > 5000) {
            recommendations.push('Search performance is critically slow - investigate database queries and indexing');
        }
        if (metrics.uniqueUsers === 0) {
            recommendations.push('No users are utilizing the search functionality - consider promoting its features');
        }
        if (metrics.totalSearches < 10) {
            recommendations.push('Search usage is low - consider improving search UI/UX');
        }
        if (metrics.clickThroughRate < 0.1) {
            recommendations.push('Low click-through rate suggests poor search result relevance - consider improving ranking algorithms');
        }
        if (metrics.clickThroughRate < 0.05) {
            recommendations.push('Critically low click-through rate - review search result quality and relevance scoring');
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
                const healthStatus = await this.getSearchHealthStatus();
                if (healthStatus.status === 'unhealthy') {
                    console.error('Search system health check failed:', healthStatus);
                    const alert = {
                        id: `health_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        type: 'system_overload',
                        severity: 'critical',
                        message: `Search system is unhealthy (score: ${healthStatus.score})`,
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
        }, 60 * 1000);
    }
    async getRealTimeMetrics() {
        return {
            activeSearches: 0,
            averageResponseTime: 0,
            errorRate: 0,
            systemLoad: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
        };
    }
}
exports.SearchAnalyticsService = SearchAnalyticsService;
exports.searchAnalyticsService = new SearchAnalyticsService();
//# sourceMappingURL=analyticsService.js.map