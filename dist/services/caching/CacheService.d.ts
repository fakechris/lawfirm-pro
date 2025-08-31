import { CacheService, CacheConfig, CacheMetrics } from '../../models/integration';
export declare class CacheServiceImplementation implements CacheService {
    private logger;
    private cache;
    private config;
    private cleanupInterval?;
    private metrics;
    constructor(config?: Partial<CacheConfig>);
    set(key: string, value: any, ttl?: number): Promise<void>;
    get(key: string): Promise<any>;
    del(key: string): Promise<void>;
    clear(): Promise<void>;
    exists(key: string): Promise<boolean>;
    ttl(key: string): Promise<number>;
    getMetrics(): Promise<CacheMetrics>;
    getMultiple(keys: string[]): Promise<Record<string, any>>;
    setMultiple(entries: Record<string, {
        value: any;
        ttl?: number;
    }>): Promise<void>;
    increment(key: string, delta?: number): Promise<number>;
    decrement(key: string, delta?: number): Promise<number>;
    expire(key: string, ttl: number): Promise<void>;
    persist(key: string): Promise<void>;
    scan(pattern: string, count?: number): Promise<string[]>;
    keys(): Promise<string[]>;
    size(): Promise<number>;
    cleanup(): Promise<void>;
    private isExpired;
    private evictEntries;
    private evictLRU;
    private evictFIFO;
    private evictTTL;
    private calculateSize;
    private updateMetrics;
    private resetMetrics;
    private initializeMetrics;
    private mergeConfig;
    private startCleanupInterval;
    private patternToRegex;
    destroy(): Promise<void>;
    getStats(): Promise<CacheStats>;
    exportData(): Promise<CacheExport>;
    importData(data: CacheExport): Promise<void>;
}
export interface CacheStats {
    totalEntries: number;
    memoryUsage: number;
    hitRate: number;
    missRate: number;
    averageTTL: number;
    oldestEntry: number | null;
    newestEntry: number | null;
    expiredEntries: number;
    compressionEnabled: boolean;
    evictionStrategy: string;
    lastCleanup: Date;
}
export interface CacheExport {
    entries: CacheExportEntry[];
    config: CacheConfig;
    metrics: CacheMetrics;
    exportedAt: string;
}
export interface CacheExportEntry {
    key: string;
    value: any;
    ttl: number;
    createdAt: string;
    accessedAt: string;
    hitCount: number;
    metadata?: Record<string, any>;
}
//# sourceMappingURL=CacheService.d.ts.map