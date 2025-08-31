import { PrismaClient } from '@prisma/client';
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
    ttl: number;
    maxSize: number;
    cleanupInterval: number;
}
export interface DocumentBatchOptions {
    batchSize: number;
    concurrency: number;
    retryAttempts: number;
    retryDelay: number;
}
export declare class DocumentPerformanceService {
    private prisma;
    private cache;
    private metrics;
    private cacheConfig;
    private cleanupInterval;
    constructor(prisma: PrismaClient, cacheConfig?: Partial<CacheConfig>);
    measurePerformance<T>(operation: string, fn: () => Promise<T>): Promise<{
        result: T;
        metrics: PerformanceMetrics;
    }>;
    getFromCache<T>(key: string): Promise<T | null>;
    setCache<T>(key: string, data: T, ttl?: number): Promise<void>;
    invalidateCache(pattern?: string): Promise<void>;
    processBatch<T, R>(items: T[], processor: (item: T) => Promise<R>, options?: DocumentBatchOptions): Promise<R[]>;
    getDocumentsOptimized(params: {
        caseId?: string;
        category?: string;
        status?: string;
        tags?: string[];
        limit?: number;
        offset?: number;
        includeRelations?: boolean;
    }): Promise<{}>;
    searchDocumentsOptimized(query: string, options: {
        caseId?: string;
        category?: string;
        tags?: string[];
        limit?: number;
        offset?: number;
        useFullTextSearch?: boolean;
    }): any;
    getStorageUsageOptimized(): Promise<{
        totalUsed: number;
        totalAvailable: number;
        byCategory: Record<string, {
            used: number;
            fileCount: number;
        }>;
        largestFiles: Array<{
            id: string;
            filename: string;
            size: number;
        }>;
    }>;
    getPerformanceStats(): {
        totalOperations: number;
        averageDuration: number;
        slowestOperations: Array<{
            operation: string;
            duration: number;
        }>;
        errorRate: number;
        memoryTrend: Array<{
            timestamp: Date;
            usage: number;
        }>;
    };
    private fullTextSearch;
    private processBatchWithConcurrency;
    private createBatches;
    private createMetrics;
    private recordMetrics;
    private evictLeastRecentlyUsed;
    private startCacheCleanup;
    destroy(): void;
}
export declare const documentPerformanceService: DocumentPerformanceService;
//# sourceMappingURL=performanceService.d.ts.map