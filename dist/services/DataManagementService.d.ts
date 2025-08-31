import { DataSource, DataTarget, SyncResult, CacheConfig, AlertConfig, Conflict, ResolutionResult, ResolutionStrategy } from '../models/integration';
export declare class DataManagementService {
    private syncEngine;
    private conflictResolver;
    private dataTransformer;
    private cacheService;
    private validationService;
    private syncMonitor;
    private logger;
    constructor(cacheConfig?: Partial<CacheConfig>);
    synchronizeData(source: DataSource, target: DataTarget, options?: SyncOptions): Promise<SyncResult>;
    synchronizeBatch(syncConfigs: Array<{
        source: DataSource;
        target: DataTarget;
        options?: SyncOptions;
    }>, batchOptions?: BatchSyncOptions): Promise<BatchSyncResult>;
    scheduleSync(source: DataSource, target: DataTarget, schedule: SyncSchedule, options?: SyncOptions): Promise<string>;
    detectAndResolveConflicts(sourceData: any[], targetData: any[], strategy?: ResolutionStrategy): Promise<ConflictResolutionResult>;
    validateDataIntegrity(source: any[], target: any[], checkTypes?: Array<'consistency' | 'completeness' | 'validity' | 'uniqueness'>): Promise<DataIntegrityValidationResult>;
    getPerformanceReport(timeRange?: '1h' | '24h' | '7d' | '30d'): Promise<PerformanceReport>;
    getSystemStatus(): Promise<SystemStatus>;
    createAlert(config: AlertConfig): Promise<Alert>;
    checkAlerts(): Promise<Alert[]>;
    private validateBeforeSync;
    private validateAfterSync;
    private checkDataSourceHealth;
    private checkDataTargetHealth;
    private getCachedSyncResult;
    private cacheSyncResult;
    private calculateNextRun;
    destroy(): Promise<void>;
}
export interface SyncOptions {
    validateBeforeSync?: boolean;
    validateAfterSync?: boolean;
    useCache?: boolean;
    conflictResolution?: ResolutionStrategy;
    batchSize?: number;
    maxRetries?: number;
    retryDelay?: number;
    timeout?: number;
    parallelProcessing?: boolean;
    errorHandling?: 'stop' | 'continue' | 'skip';
    validation?: boolean;
    transformerId?: string;
}
export interface BatchSyncOptions {
    maxConcurrency?: number;
    stopOnError?: boolean;
    timeout?: number;
}
export interface BatchSyncResult {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    results: SyncResult[];
    errors: string[];
    startTime: Date;
    endTime: Date;
    duration: number;
}
export interface SyncSchedule {
    type: 'immediate' | 'cron' | 'interval' | 'manual';
    expression?: string;
    interval?: number;
    timezone?: string;
}
export interface ConflictResolutionResult {
    conflicts: Conflict[];
    resolutions: ResolutionResult[];
    resolved: boolean;
    message: string;
}
export interface DataIntegrityValidationResult {
    overallStatus: 'passed' | 'warning' | 'failed';
    totalIssues: number;
    criticalIssues: number;
    results: any[];
    validatedAt: Date;
}
import type { PerformanceReport, SystemStatus } from './services/sync/SyncMonitor';
import type { Alert } from '../models/integration';
//# sourceMappingURL=DataManagementService.d.ts.map