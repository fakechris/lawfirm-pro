import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of items in cache
  cleanupInterval: number; // Cleanup interval in milliseconds
}

export interface DocumentBatchOptions {
  batchSize: number;
  concurrency: number;
  retryAttempts: number;
  retryDelay: number;
}

export class DocumentPerformanceService {
  private prisma: PrismaClient;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }>;
  private metrics: PerformanceMetrics[];
  private cacheConfig: CacheConfig;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(prisma: PrismaClient, cacheConfig?: Partial<CacheConfig>) {
    this.prisma = prisma;
    this.cache = new Map();
    this.metrics = [];
    this.cacheConfig = {
      enabled: true,
      ttl: 300000, // 5 minutes
      maxSize: 1000,
      cleanupInterval: 60000, // 1 minute
      ...cacheConfig
    };

    if (this.cacheConfig.enabled) {
      this.startCacheCleanup();
    }
  }

  // Performance monitoring
  async measurePerformance<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    let success = true;
    let result: T;
    let error: string | undefined;

    try {
      result = await fn();
      return { result, metrics: this.createMetrics(operation, startTime, startMemory, success, error) };
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      const metrics = this.createMetrics(operation, startTime, startMemory, success, error);
      this.recordMetrics(metrics);
    }
  }

  // Caching utilities
  async getFromCache<T>(key: string): Promise<T | null> {
    if (!this.cacheConfig.enabled) return null;

    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  async setCache<T>(key: string, data: T, ttl?: number): Promise<void> {
    if (!this.cacheConfig.enabled) return;

    if (this.cache.size >= this.cacheConfig.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.cacheConfig.ttl
    });
  }

  async invalidateCache(pattern?: string): Promise<void> {
    if (!this.cacheConfig.enabled) return;

    if (pattern) {
      const regex = new RegExp(pattern);
      for (const [key] of this.cache) {
        if (regex.test(key)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  // Batch processing utilities
  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: DocumentBatchOptions = {
      batchSize: 50,
      concurrency: 3,
      retryAttempts: 3,
      retryDelay: 1000
    }
  ): Promise<R[]> {
    const results: R[] = [];
    const batches = this.createBatches(items, options.batchSize);

    for (const batch of batches) {
      const batchResults = await this.processBatchWithConcurrency(
        batch,
        processor,
        options
      );
      results.push(...batchResults);
    }

    return results;
  }

  // Database query optimization
  async getDocumentsOptimized(params: {
    caseId?: string;
    category?: string;
    status?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
    includeRelations?: boolean;
  }) {
    const cacheKey = `documents:${JSON.stringify(params)}`;
    
    // Try cache first
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    const result = await this.measurePerformance('getDocumentsOptimized', async () => {
      const { caseId, category, status, tags, limit = 20, offset = 0, includeRelations = true } = params;

      const where: any = {};
      if (caseId) where.caseId = caseId;
      if (category) where.category = category;
      if (status) where.status = status;
      if (tags && tags.length > 0) {
        where.tags = { hasSome: tags };
      }

      const include: any = {};
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

    // Cache the result
    await this.setCache(cacheKey, result.result);
    
    return result.result;
  }

  // Search optimization
  async searchDocumentsOptimized(query: string, options: {
    caseId?: string;
    category?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
    useFullTextSearch?: boolean;
  }) {
    const cacheKey = `search:${query}:${JSON.stringify(options)}`;
    
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    const result = await this.measurePerformance('searchDocumentsOptimized', async () => {
      const { caseId, category, tags, limit = 20, offset = 0, useFullTextSearch = true } = options;

      // Use full-text search if available and enabled
      if (useFullTextSearch) {
        return await this.fullTextSearch(query, { caseId, category, tags, limit, offset });
      }

      // Fallback to basic search
      const where: any = {
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

      if (caseId) where.caseId = caseId;
      if (category) where.category = category;
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

  // Storage optimization
  async getStorageUsageOptimized(): Promise<{
    totalUsed: number;
    totalAvailable: number;
    byCategory: Record<string, { used: number; fileCount: number }>;
    largestFiles: Array<{ id: string; filename: string; size: number }>;
  }> {
    const cacheKey = 'storageUsage';
    
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    const result = await this.measurePerformance('getStorageUsageOptimized', async () => {
      // Get total usage from database
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
      }, {} as Record<string, { used: number; fileCount: number }>);

      return {
        totalUsed: totalStats._sum.size || 0,
        totalAvailable: 0, // Would need to get from storage service
        byCategory,
        largestFiles: largestFiles.map(file => ({
          id: file.id,
          filename: file.filename,
          size: file.size
        }))
      };
    });

    await this.setCache(cacheKey, result.result, 300000); // Cache for 5 minutes
    return result.result;
  }

  // Performance analytics
  getPerformanceStats(): {
    totalOperations: number;
    averageDuration: number;
    slowestOperations: Array<{ operation: string; duration: number }>;
    errorRate: number;
    memoryTrend: Array<{ timestamp: Date; usage: number }>;
  } {
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
      .slice(-100); // Last 100 operations

    return {
      totalOperations,
      averageDuration,
      slowestOperations,
      errorRate,
      memoryTrend
    };
  }

  private async fullTextSearch(query: string, options: {
    caseId?: string;
    category?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }) {
    // This would integrate with a proper full-text search engine like Elasticsearch
    // For now, fall back to basic database search
    return this.searchDocumentsOptimized(query, { ...options, useFullTextSearch: false });
  }

  private async processBatchWithConcurrency<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: DocumentBatchOptions
  ): Promise<R[]> {
    const results: R[] = [];
    const processingQueue = [...items];

    const workers = Array(options.concurrency).fill(null).map(async () => {
      while (processingQueue.length > 0) {
        const item = processingQueue.shift();
        if (!item) break;

        let attempts = 0;
        let result: R;

        while (attempts < options.retryAttempts) {
          try {
            result = await processor(item);
            results.push(result);
            break;
          } catch (error) {
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

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private createMetrics(
    operation: string,
    startTime: number,
    startMemory: NodeJS.MemoryUsage,
    success: boolean,
    error?: string
  ): PerformanceMetrics {
    const duration = performance.now() - startTime;
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

  private recordMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only last 1000 metrics to prevent memory leak
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  private evictLeastRecentlyUsed(): void {
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

  private startCacheCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache) {
        if (now - value.timestamp > value.ttl) {
          this.cache.delete(key);
        }
      }
    }, this.cacheConfig.cleanupInterval);
  }

  // Cleanup
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
    this.metrics = [];
  }
}

export const documentPerformanceService = new DocumentPerformanceService(new PrismaClient());