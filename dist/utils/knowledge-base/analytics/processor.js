"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsDataProcessor = exports.AnalyticsDataProcessor = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class AnalyticsDataProcessor {
    constructor() {
        this.cache = new Map();
        this.startCacheCleanup();
    }
    async processTimeSeriesData(metric, filter, aggregation) {
        const cacheKey = `timeseries_${metric}_${JSON.stringify(filter)}_${JSON.stringify(aggregation)}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        let data = [];
        switch (metric) {
            case 'views':
                data = await this.getViewData(filter, aggregation);
                break;
            case 'interactions':
                data = await this.getInteractionData(filter, aggregation);
                break;
            case 'searches':
                data = await this.getSearchData(filter, aggregation);
                break;
            case 'users':
                data = await this.getUserData(filter, aggregation);
                break;
        }
        const processed = this.aggregateTimeSeries(data, aggregation);
        this.setToCache(cacheKey, processed, 5 * 60 * 1000);
        return processed;
    }
    async processCategoryData(filter) {
        const cacheKey = `category_${JSON.stringify(filter)}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        const views = await prisma.knowledgeBaseView.findMany({
            where: this.buildFilter(filter),
            include: {
                article: {
                    select: { categories: true },
                },
            },
        });
        const categoryStats = new Map();
        views.forEach(view => {
            if (view.article?.categories) {
                view.article.categories.forEach((category) => {
                    categoryStats.set(category, (categoryStats.get(category) || 0) + 1);
                });
            }
        });
        const sortedCategories = Array.from(categoryStats.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        const processed = {
            labels: sortedCategories.map(([category]) => category),
            datasets: [{
                    label: 'Views by Category',
                    data: sortedCategories.map(([, count]) => count),
                    backgroundColor: this.generateColors(sortedCategories.length),
                }],
            summary: {
                total: sortedCategories.reduce((sum, [, count]) => sum + count, 0),
                average: sortedCategories.reduce((sum, [, count]) => sum + count, 0) / sortedCategories.length,
                min: Math.min(...sortedCategories.map(([, count]) => count)),
                max: Math.max(...sortedCategories.map(([, count]) => count)),
                trend: 'stable',
            },
        };
        this.setToCache(cacheKey, processed, 10 * 60 * 1000);
        return processed;
    }
    async processUserEngagementData(filter) {
        const cacheKey = `engagement_${JSON.stringify(filter)}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        const interactions = await prisma.knowledgeBaseInteraction.findMany({
            where: this.buildFilter(filter),
        });
        const interactionTypes = new Map();
        interactions.forEach(interaction => {
            interactionTypes.set(interaction.interactionType, (interactionTypes.get(interaction.interactionType) || 0) + 1);
        });
        const sortedTypes = Array.from(interactionTypes.entries())
            .sort((a, b) => b[1] - a[1]);
        const processed = {
            labels: sortedTypes.map(([type]) => type),
            datasets: [{
                    label: 'User Interactions',
                    data: sortedTypes.map(([, count]) => count),
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                        '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
                    ],
                }],
            summary: {
                total: sortedTypes.reduce((sum, [, count]) => sum + count, 0),
                average: sortedTypes.reduce((sum, [, count]) => sum + count, 0) / sortedTypes.length,
                min: Math.min(...sortedTypes.map(([, count]) => count)),
                max: Math.max(...sortedTypes.map(([, count]) => count)),
                trend: 'stable',
            },
        };
        this.setToCache(cacheKey, processed, 10 * 60 * 1000);
        return processed;
    }
    async processSearchPerformanceData(filter) {
        const cacheKey = `search_perf_${JSON.stringify(filter)}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }
        const searches = await prisma.knowledgeBaseSearchActivity.findMany({
            where: this.buildFilter(filter),
        });
        const timeRanges = [
            { label: '0-1s', min: 0, max: 1000 },
            { label: '1-2s', min: 1000, max: 2000 },
            { label: '2-5s', min: 2000, max: 5000 },
            { label: '5-10s', min: 5000, max: 10000 },
            { label: '10s+', min: 10000, max: Infinity },
        ];
        const responseTimeDistribution = timeRanges.map(range => {
            const count = searches.filter(search => search.responseTime >= range.min && search.responseTime < range.max).length;
            return { label: range.label, count };
        });
        const processed = {
            labels: responseTimeDistribution.map(item => item.label),
            datasets: [{
                    label: 'Search Response Time Distribution',
                    data: responseTimeDistribution.map(item => item.count),
                    backgroundColor: ['#4BC0C0', '#36A2EB', '#FFCE56', '#FF9F40', '#FF6384'],
                }],
            summary: {
                total: searches.length,
                average: searches.length > 0
                    ? searches.reduce((sum, search) => sum + search.responseTime, 0) / searches.length
                    : 0,
                min: Math.min(...searches.map(search => search.responseTime)),
                max: Math.max(...searches.map(search => search.responseTime)),
                trend: 'stable',
            },
        };
        this.setToCache(cacheKey, processed, 5 * 60 * 1000);
        return processed;
    }
    async exportData(options) {
        const data = await this.getExportData(options);
        switch (options.format) {
            case 'json':
                return JSON.stringify(data, null, 2);
            case 'csv':
                return this.convertToCSV(data);
            case 'xlsx':
                return this.convertToXLSX(data);
            case 'pdf':
                return this.convertToPDF(data);
            default:
                throw new Error(`Unsupported export format: ${options.format}`);
        }
    }
    async generateInsights(filter) {
        const insights = [];
        const [totalViews, totalInteractions, totalSearches] = await Promise.all([
            prisma.knowledgeBaseView.count({ where: this.buildFilter(filter) }),
            prisma.knowledgeBaseInteraction.count({ where: this.buildFilter(filter) }),
            prisma.knowledgeBaseSearchActivity.count({ where: this.buildFilter(filter) }),
        ]);
        if (totalViews < 100) {
            insights.push('Knowledge base has low view count - consider promoting content or improving discoverability');
        }
        const engagementRate = totalViews > 0 ? totalInteractions / totalViews : 0;
        if (engagementRate < 0.05) {
            insights.push('Low user engagement detected - consider adding more interactive content or improving content quality');
        }
        if (totalSearches > 0) {
            const failedSearches = await prisma.knowledgeBaseSearchActivity.count({
                where: {
                    ...this.buildFilter(filter),
                    resultsCount: 0,
                },
            });
            const failureRate = failedSearches / totalSearches;
            if (failureRate > 0.2) {
                insights.push('High search failure rate detected - consider improving search functionality or content coverage');
            }
        }
        const recentArticles = await prisma.knowledgeBaseArticle.count({
            where: {
                status: 'PUBLISHED',
                createdAt: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                },
            },
        });
        if (recentArticles < 5) {
            insights.push('Few new articles published recently - consider updating content to keep it fresh');
        }
        return insights;
    }
    async getViewData(filter, aggregation) {
        return prisma.knowledgeBaseView.findMany({
            where: this.buildFilter(filter),
            include: {
                article: {
                    select: { categories: true, contentType: true },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
    }
    async getInteractionData(filter, aggregation) {
        return prisma.knowledgeBaseInteraction.findMany({
            where: this.buildFilter(filter),
            include: {
                article: {
                    select: { categories: true, contentType: true },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
    }
    async getSearchData(filter, aggregation) {
        return prisma.knowledgeBaseSearchActivity.findMany({
            where: this.buildFilter(filter),
            orderBy: { createdAt: 'asc' },
        });
    }
    async getUserData(filter, aggregation) {
        const views = await prisma.knowledgeBaseView.findMany({
            where: this.buildFilter(filter),
            select: { userId: true, createdAt: true },
        });
        const userActivity = new Map();
        views.forEach(view => {
            if (view.userId) {
                const dateKey = view.createdAt.toISOString().split('T')[0];
                if (!userActivity.has(view.userId)) {
                    userActivity.set(view.userId, new Set());
                }
                userActivity.get(view.userId).add(dateKey);
            }
        });
        return Array.from(userActivity.entries()).map(([userId, dates]) => ({
            userId,
            activityDays: dates.size,
            firstActivity: Math.min(...Array.from(dates).map(d => new Date(d).getTime())),
            lastActivity: Math.max(...Array.from(dates).map(d => new Date(d).getTime())),
        }));
    }
    aggregateTimeSeries(data, aggregation) {
        const grouped = new Map();
        data.forEach(item => {
            let key;
            switch (aggregation.groupBy) {
                case 'day':
                    key = item.createdAt.toISOString().split('T')[0];
                    break;
                case 'week':
                    const weekStart = new Date(item.createdAt);
                    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                    key = weekStart.toISOString().split('T')[0];
                    break;
                case 'month':
                    key = item.createdAt.toISOString().substring(0, 7);
                    break;
                case 'year':
                    key = item.createdAt.getFullYear().toString();
                    break;
                default:
                    key = item.createdAt.toISOString().split('T')[0];
            }
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            let value;
            switch (aggregation.metric) {
                case 'views':
                    value = 1;
                    break;
                case 'interactions':
                    value = 1;
                    break;
                case 'searches':
                    value = 1;
                    break;
                case 'users':
                    value = item.userId ? 1 : 0;
                    break;
                case 'completionRate':
                    value = item.completionPercentage || 0;
                    break;
                default:
                    value = 1;
            }
            grouped.get(key).push(value);
        });
        const sortedKeys = Array.from(grouped.keys()).sort();
        const aggregatedData = sortedKeys.map(key => {
            const values = grouped.get(key);
            switch (aggregation.aggregation) {
                case 'sum':
                    return values.reduce((sum, val) => sum + val, 0);
                case 'average':
                    return values.reduce((sum, val) => sum + val, 0) / values.length;
                case 'count':
                    return values.length;
                case 'max':
                    return Math.max(...values);
                case 'min':
                    return Math.min(...values);
                default:
                    return values.reduce((sum, val) => sum + val, 0);
            }
        });
        return {
            labels: sortedKeys,
            datasets: [{
                    label: `${aggregation.metric} (${aggregation.aggregation})`,
                    data: aggregatedData,
                    borderColor: '#36A2EB',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                }],
            summary: {
                total: aggregatedData.reduce((sum, val) => sum + val, 0),
                average: aggregatedData.reduce((sum, val) => sum + val, 0) / aggregatedData.length,
                min: Math.min(...aggregatedData),
                max: Math.max(...aggregatedData),
                trend: this.calculateTrend(aggregatedData),
            },
        };
    }
    buildFilter(filter) {
        const where = {};
        if (filter.dateRange) {
            where.createdAt = {
                gte: filter.dateRange.start,
                lte: filter.dateRange.end,
            };
        }
        if (filter.contentType) {
            where.article = {
                contentType: {
                    in: filter.contentType,
                },
            };
        }
        if (filter.categories) {
            where.article = {
                ...where.article,
                categories: {
                    hasSome: filter.categories,
                },
            };
        }
        if (filter.tags) {
            where.article = {
                ...where.article,
                tags: {
                    hasSome: filter.tags,
                },
            };
        }
        if (filter.users) {
            where.userId = {
                in: filter.users,
            };
        }
        if (filter.interactionTypes) {
            where.interactionType = {
                in: filter.interactionTypes,
            };
        }
        return where;
    }
    calculateTrend(data) {
        if (data.length < 2)
            return 'stable';
        const firstHalf = data.slice(0, Math.floor(data.length / 2));
        const secondHalf = data.slice(Math.floor(data.length / 2));
        const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
        const change = ((secondAvg - firstAvg) / firstAvg) * 100;
        if (change > 5)
            return 'up';
        if (change < -5)
            return 'down';
        return 'stable';
    }
    generateColors(count) {
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
        ];
        return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
    }
    async getExportData(options) {
        const data = {
            generatedAt: new Date(),
            metrics: {},
        };
        for (const metric of options.metrics) {
            switch (metric) {
                case 'views':
                    data.metrics.views = await prisma.knowledgeBaseView.count({
                        where: this.buildFilter({ dateRange: options.dateRange }),
                    });
                    break;
                case 'interactions':
                    data.metrics.interactions = await prisma.knowledgeBaseInteraction.count({
                        where: this.buildFilter({ dateRange: options.dateRange }),
                    });
                    break;
                case 'searches':
                    data.metrics.searches = await prisma.knowledgeBaseSearchActivity.count({
                        where: this.buildFilter({ dateRange: options.dateRange }),
                    });
                    break;
                case 'users':
                    const views = await prisma.knowledgeBaseView.findMany({
                        where: this.buildFilter({ dateRange: options.dateRange }),
                        select: { userId: true },
                    });
                    data.metrics.users = new Set(views.map(v => v.userId).filter(Boolean)).size;
                    break;
            }
        }
        return data;
    }
    convertToCSV(data) {
        const rows = [];
        rows.push('Metric,Value');
        Object.entries(data.metrics).forEach(([key, value]) => {
            rows.push(`${key},${value}`);
        });
        return rows.join('\n');
    }
    convertToXLSX(data) {
        return Buffer.from(JSON.stringify(data));
    }
    convertToPDF(data) {
        return Buffer.from(JSON.stringify(data));
    }
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            return cached.data;
        }
        this.cache.delete(key);
        return null;
    }
    setToCache(key, data, ttl) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
        });
    }
    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            for (const [key, value] of this.cache.entries()) {
                if (now - value.timestamp > value.ttl) {
                    this.cache.delete(key);
                }
            }
        }, 60 * 1000);
    }
}
exports.AnalyticsDataProcessor = AnalyticsDataProcessor;
exports.analyticsDataProcessor = new AnalyticsDataProcessor();
//# sourceMappingURL=processor.js.map