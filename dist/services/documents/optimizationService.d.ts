export interface OptimizationOptions {
    cleanupTempFiles?: boolean;
    cleanupOldVersions?: boolean;
    cleanupDuplicates?: boolean;
    cleanupCorruptedFiles?: boolean;
    optimizeDatabase?: boolean;
    generateIndex?: boolean;
    compressLargeFiles?: boolean;
    defragmentStorage?: boolean;
    dryRun?: boolean;
    maxAge?: {
        tempFiles?: number;
        versions?: number;
        backups?: number;
    };
    sizeThresholds?: {
        largeFile?: number;
        versionCleanup?: number;
        duplicateDetection?: number;
    };
}
export interface OptimizationResult {
    success: boolean;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    summary: {
        filesProcessed: number;
        filesDeleted: number;
        filesOptimized: number;
        spaceFreed: number;
        spaceSaved: number;
    };
    details: {
        tempFiles: {
            deleted: number;
            spaceFreed: number;
        };
        oldVersions: {
            deleted: number;
            spaceFreed: number;
        };
        duplicates: {
            deleted: number;
            spaceFreed: number;
        };
        corrupted: {
            deleted: number;
            spaceFreed: number;
        };
        compressed: {
            optimized: number;
            spaceSaved: number;
        };
        database: {
            optimized: boolean;
            timeTaken?: number;
        };
    };
    errors: string[];
    warnings: string[];
    recommendations: string[];
}
export interface StorageMetrics {
    totalFiles: number;
    totalSize: number;
    averageFileSize: number;
    largestFiles: Array<{
        path: string;
        size: number;
        lastModified: Date;
    }>;
    byCategory: Record<string, {
        count: number;
        size: number;
        averageSize: number;
    }>;
    byType: Record<string, {
        count: number;
        size: number;
    }>;
    growth: {
        daily: number;
        weekly: number;
        monthly: number;
    };
    health: {
        score: number;
        issues: string[];
        recommendations: string[];
    };
}
export declare class StorageOptimizationService {
    private basePath;
    private baseStorageService;
    private optimizationHistory;
    constructor();
    private ensureDirectoryExists;
    private calculateFileHash;
    private getFileSize;
    private scanDirectory;
    performOptimization(options?: OptimizationOptions): Promise<OptimizationResult>;
    private cleanupTempFiles;
    private cleanupOldVersions;
    private cleanupDuplicates;
    private cleanupCorruptedFiles;
    private isCorruptedFile;
    private compressLargeFiles;
    private compressFile;
    private optimizeDatabase;
    private generateRecommendations;
    getStorageMetrics(): Promise<StorageMetrics>;
    private calculateHealthScore;
    private estimateDuplicateRatio;
    private estimateCorruptedRatio;
    private estimateOldVersionRatio;
    getOptimizationHistory(limit?: number): Promise<Array<{
        timestamp: Date;
        result: OptimizationResult;
    }>>;
    scheduleOptimization(schedule: string, options?: OptimizationOptions): Promise<string>;
    cancelScheduledOptimization(scheduleId: string): Promise<boolean>;
}
export declare const storageOptimizationService: StorageOptimizationService;
//# sourceMappingURL=optimizationService.d.ts.map