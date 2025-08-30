"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentPerformanceService = exports.DocumentPerformanceService = void 0;
const client_1 = require("@prisma/client");
const perf_hooks_1 = require("perf_hooks");
class DocumentPerformanceService {
    constructor(prisma, cacheConfig) {
        this.prisma = prisma;
        this.cache = new Map();
        this.metrics = [];
        this.cacheConfig = {
            enabled: true,
            ttl: 300000,
            maxSize: 1000,
            cleanupInterval: 60000,
            ...cacheConfig
        };
        if (this.cacheConfig.enabled) {
            this.startCacheCleanup();
        }
    }
    async measurePerformance(operation, fn) {
        const startTime = perf_hooks_1.performance.now();
        const startMemory = process.memoryUsage();
        let success = true;
        let result;
        let error;
        try {
            result = await fn();
            return { result, metrics: this.createMetrics(operation, startTime, startMemory, success, error) };
        }
        catch (err) {
            success = false;
            error = err instanceof Error ? err.message : 'Unknown error';
            throw err;
        }
        finally {
            const metrics = this.createMetrics(operation, startTime, startMemory, success, error);
            this.recordMetrics(metrics);
        }
    }
    async getFromCache(key) {
        if (!this.cacheConfig.enabled)
            return null;
        const cached = this.cache.get(key);
        if (!cached)
            return null;
        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            return null;
        }
        return cached.data;
    }
    async setCache(key, data, ttl) {
        if (!this.cacheConfig.enabled)
            return;
        if (this.cache.size >= this.cacheConfig.maxSize) {
            this.evictLeastRecentlyUsed();
        }
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttl || this.cacheConfig.ttl
        });
    }
    async invalidateCache(pattern) {
        if (!this.cacheConfig.enabled)
            return;
        if (pattern) {
            const regex = new RegExp(pattern);
            for (const [key] of this.cache) {
                if (regex.test(key)) {
                    this.cache.delete(key);
                }
            }
        }
        else {
            this.cache.clear();
        }
    }
    async processBatch(items, processor, options = {
        batchSize: 50,
        concurrency: 3,
        retryAttempts: 3,
        retryDelay: 1000
    }) {
        const results = [];
        const batches = this.createBatches(items, options.batchSize);
        for (const batch of batches) {
            const batchResults = await this.processBatchWithConcurrency(batch, processor, options);
            results.push(...batchResults);
        }
        return results;
    }
    async getDocumentsOptimized(params) {
        const cacheKey = `documents:${JSON.stringify(params)}`;
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const result = await this.measurePerformance('getDocumentsOptimized', async () => {
            const { caseId, category, status, tags, limit = 20, offset = 0, includeRelations = true } = params;
            const where = {};
            if (caseId)
                where.caseId = caseId;
            if (category)
                where.category = category;
            if (status)
                where.status = status;
            if (tags && tags.length > 0) {
                where.tags = { hasSome: tags };
            }
            const include = {};
            if (includeRelations) {
                include.case = {
                    select: {
                        id: true,
                        title: true,
                        status: true
                    }
                };
                include.versions = {
                    take: 1,
                    orderBy: { versionNumber: 'desc' },
                    select: {
                        versionNumber: true,
                        createdAt: true,
                        fileSize: true
                    }
                };
                include._count = {
                    select: { versions: true }
                };
            }
            return await this.prisma.document.findMany({
                where,
                include,
                orderBy: { uploadedAt: 'desc' },
                take: limit,
                skip: offset
            });
        });
        await this.setCache(cacheKey, result.result);
        return result.result;
    }
    async searchDocumentsOptimized(query, options) {
        const cacheKey = `search:${query}:${JSON.stringify(options)}`;
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const result = await this.measurePerformance('searchDocumentsOptimized', async () => {
            const { caseId, category, tags, limit = 20, offset = 0, useFullTextSearch = true } = options;
            if (useFullTextSearch) {
                return await this.fullTextSearch(query, { caseId, category, tags, limit, offset });
            }
            const where = {
                OR: [
                    {
                        originalName: {
                            contains: query,
                            mode: 'insensitive'
                        }
                    },
                    {
                        description: {
                            contains: query,
                            mode: 'insensitive'
                        }
                    },
                    {
                        extractedText: {
                            contains: query,
                            mode: 'insensitive'
                        }
                    }
                ]
            };
            if (caseId)
                where.caseId = caseId;
            if (category)
                where.category = category;
            if (tags && tags.length > 0) {
                where.tags = { hasSome: tags };
            }
            return await this.prisma.document.findMany({
                where,
                include: {
                    case: {
                        select: {
                            id: true,
                            title: true
                        }
                    }
                },
                orderBy: { uploadedAt: 'desc' },
                take: limit,
                skip: offset
            });
        });
        await this.setCache(cacheKey, result.result);
        return result.result;
    }
    async getStorageUsageOptimized() {
        const cacheKey = 'storageUsage';
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const result = await this.measurePerformance('getStorageUsageOptimized', async () => {
            const [totalStats, categoryStats, largestFiles] = await Promise.all([
                this.prisma.document.aggregate({
                    where: { status: { not: 'DELETED' } },
                    _sum: { size: true },
                    _count: { id: true }
                }),
                this.prisma.document.groupBy({
                    by: ['category'],
                    where: { status: { not: 'DELETED' } },
                    _sum: { size: true },
                    _count: { id: true }
                }),
                this.prisma.document.findMany({
                    where: { status: { not: 'DELETED' } },
                    select: {
                        id: true,
                        filename: true,
                        size: true
                    },
                    orderBy: { size: 'desc' },
                    take: 10
                })
            ]);
            const byCategory = categoryStats.reduce((acc, stat) => {
                if (stat.category) {
                    acc[stat.category] = {
                        used: stat._sum.size || 0,
                        fileCount: stat._count.id
                    };
                }
                return acc;
            }, {});
            return {
                totalUsed: totalStats._sum.size || 0,
                totalAvailable: 0,
                byCategory,
                largestFiles: largestFiles.map(file => ({
                    id: file.id,
                    filename: file.filename,
                    size: file.size
                }))
            };
        });
        await this.setCache(cacheKey, result.result, 300000);
        return result.result;
    }
    getPerformanceStats() {
        const totalOperations = this.metrics.length;
        const successfulOperations = this.metrics.filter(m => m.success);
        const averageDuration = successfulOperations.length > 0
            ? successfulOperations.reduce((sum, m) => sum + m.duration, 0) / successfulOperations.length
            : 0;
        const slowestOperations = this.metrics
            .filter(m => m.success)
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 10)
            .map(m => ({ operation: m.operation, duration: m.duration }));
        const errorRate = totalOperations > 0
            ? (totalOperations - successfulOperations.length) / totalOperations
            : 0;
        const memoryTrend = this.metrics
            .filter(m => m.success)
            .map(m => ({
            timestamp: m.timestamp,
            usage: m.memoryUsage.percentage
        }))
            .slice(-100);
        return {
            totalOperations,
            averageDuration,
            slowestOperations,
            errorRate,
            memoryTrend
        };
    }
    async fullTextSearch(query, options) {
        return this.searchDocumentsOptimized(query, { ...options, useFullTextSearch: false });
    }
    async processBatchWithConcurrency(items, processor, options) {
        const results = [];
        const processingQueue = [...items];
        const workers = Array(options.concurrency).fill(null).map(async () => {
            while (processingQueue.length > 0) {
                const item = processingQueue.shift();
                if (!item)
                    break;
                let attempts = 0;
                let result;
                while (attempts < options.retryAttempts) {
                    try {
                        result = await processor(item);
                        results.push(result);
                        break;
                    }
                    catch (error) {
                        attempts++;
                        if (attempts === options.retryAttempts) {
                            console.error(`Failed to process item after ${options.retryAttempts} attempts:`, error);
                            throw error;
                        }
                        await new Promise(resolve => setTimeout(resolve, options.retryDelay));
                    }
                }
            }
        });
        await Promise.all(workers);
        return results;
    }
    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }
    createMetrics(operation, startTime, startMemory, success, error) {
        const duration = perf_hooks_1.performance.now() - startTime;
        const endMemory = process.memoryUsage();
        const usedMemory = endMemory.heapUsed - startMemory.heapUsed;
        const totalMemory = endMemory.heapTotal;
        const percentage = (usedMemory / totalMemory) * 100;
        return {
            operation,
            duration,
            memoryUsage: {
                used: usedMemory,
                total: totalMemory,
                percentage
            },
            timestamp: new Date(),
            success,
            error
        };
    }
    recordMetrics(metrics) {
        this.metrics.push(metrics);
        if (this.metrics.length > 1000) {
            this.metrics = this.metrics.slice(-1000);
        }
    }
    evictLeastRecentlyUsed() {
        let oldestKey = '';
        let oldestTimestamp = Infinity;
        for (const [key, value] of this.cache) {
            if (value.timestamp < oldestTimestamp) {
                oldestTimestamp = value.timestamp;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }
    startCacheCleanup() {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [key, value] of this.cache) {
                if (now - value.timestamp > value.ttl) {
                    this.cache.delete(key);
                }
            }
        }, this.cacheConfig.cleanupInterval);
    }
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.cache.clear();
        this.metrics = [];
    }
}
exports.DocumentPerformanceService = DocumentPerformanceService;
exports.documentPerformanceService = new DocumentPerformanceService(new client_1.PrismaClient());
//# sourceMappingURL=performanceService.js.map