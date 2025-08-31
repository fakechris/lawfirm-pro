"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataManagementService = void 0;
const DataSyncEngine_1 = require("./sync/DataSyncEngine");
const ConflictResolver_1 = require("./sync/ConflictResolver");
const DataTransformer_1 = require("./transformation/DataTransformer");
const CacheService_1 = require("./caching/CacheService");
const DataValidationService_1 = require("./validation/DataValidationService");
const SyncMonitor_1 = require("./sync/SyncMonitor");
const logger_1 = require("./integration/logger");
class DataManagementService {
    constructor(cacheConfig) {
        this.logger = new logger_1.IntegrationLoggerImplementation();
        this.syncEngine = new DataSyncEngine_1.DataSyncEngineImplementation();
        this.conflictResolver = new ConflictResolver_1.ConflictResolverImplementation();
        this.dataTransformer = new DataTransformer_1.DataTransformerImplementation();
        this.cacheService = new CacheService_1.CacheServiceImplementation(cacheConfig);
        this.validationService = new DataValidationService_1.DataValidationService();
        this.syncMonitor = new SyncMonitor_1.SyncMonitorImplementation();
        this.logger.info('Data Management Service initialized');
    }
    async synchronizeData(source, target, options) {
        try {
            this.logger.info('Starting data synchronization', {
                source: source.name,
                target: target.name,
                options
            });
            const jobId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await this.syncMonitor.logSyncStart(jobId);
            let result;
            try {
                if (options?.validateBeforeSync) {
                    await this.validateBeforeSync(source, target);
                }
                if (options?.useCache) {
                    const cachedResult = await this.getCachedSyncResult(source.id, target.id);
                    if (cachedResult) {
                        this.logger.info('Using cached sync result');
                        return cachedResult;
                    }
                }
                result = await this.syncEngine.syncData(source, target);
                if (options?.transformerId && result.success) {
                    const transformer = await this.dataTransformer.createTransformation({
                        name: `Sync Transformer ${Date.now()}`,
                        sourceFormat: 'json',
                        targetFormat: 'json',
                        transformation: []
                    });
                }
                if (options?.validateAfterSync && result.success) {
                    await this.validateAfterSync(source, target, result);
                }
                if (options?.useCache && result.success) {
                    await this.cacheSyncResult(source.id, target.id, result);
                }
                await this.syncMonitor.logSyncComplete(jobId, result);
                this.logger.info('Data synchronization completed successfully', {
                    jobId,
                    duration: result.duration,
                    recordsProcessed: result.recordsProcessed,
                    conflicts: result.conflicts.length
                });
                return result;
            }
            catch (error) {
                await this.syncMonitor.logSyncError(jobId, error);
                throw error;
            }
        }
        catch (error) {
            this.logger.error('Data synchronization failed', {
                source: source.name,
                target: target.name,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async synchronizeBatch(syncConfigs, batchOptions) {
        try {
            this.logger.info('Starting batch synchronization', {
                syncCount: syncConfigs.length,
                batchOptions
            });
            const results = [];
            const errors = [];
            let successfulSyncs = 0;
            let failedSyncs = 0;
            const maxConcurrency = batchOptions?.maxConcurrency || 3;
            const semaphore = new Array(maxConcurrency).fill(null);
            for (const config of syncConfigs) {
                await Promise.race(semaphore);
                const slotIndex = semaphore.findIndex(slot => slot === null);
                semaphore[slotIndex] = this.synchronizeData(config.source, config.target, config.options)
                    .then(result => {
                    results.push(result);
                    successfulSyncs++;
                    return null;
                })
                    .catch(error => {
                    errors.push(error);
                    failedSyncs++;
                    return null;
                })
                    .finally(() => {
                    semaphore[slotIndex] = null;
                });
            }
            await Promise.all(semaphore.filter(slot => slot !== null));
            const batchResult = {
                totalSyncs: syncConfigs.length,
                successfulSyncs,
                failedSyncs,
                results,
                errors: errors.map(e => e instanceof Error ? e.message : String(e)),
                startTime: new Date(),
                endTime: new Date(),
                duration: 0
            };
            this.logger.info('Batch synchronization completed', {
                totalSyncs: batchResult.totalSyncs,
                successfulSyncs: batchResult.successfulSyncs,
                failedSyncs: batchResult.failedSyncs
            });
            return batchResult;
        }
        catch (error) {
            this.logger.error('Batch synchronization failed', {
                syncCount: syncConfigs.length,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async scheduleSync(source, target, schedule, options) {
        try {
            const jobId = `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.logger.info('Scheduling synchronization', {
                jobId,
                source: source.name,
                target: target.name,
                schedule
            });
            const syncJob = {
                id: jobId,
                name: `Scheduled sync: ${source.name} → ${target.name}`,
                sourceId: source.id,
                targetId: target.id,
                schedule,
                conflictResolution: options?.conflictResolution || 'source_wins',
                isActive: true,
                lastRun: undefined,
                nextRun: this.calculateNextRun(schedule),
                status: 'idle',
                config: {
                    batchSize: options?.batchSize || 100,
                    maxRetries: options?.maxRetries || 3,
                    retryDelay: options?.retryDelay || 1000,
                    timeout: options?.timeout || 30000,
                    parallelProcessing: options?.parallelProcessing || false,
                    errorHandling: options?.errorHandling || 'continue',
                    validation: options?.validation || false,
                    logging: true
                }
            };
            await this.cacheService.set(`sync_job:${jobId}`, syncJob, 86400);
            this.logger.info('Synchronization scheduled successfully', {
                jobId,
                nextRun: syncJob.nextRun
            });
            return jobId;
        }
        catch (error) {
            this.logger.error('Failed to schedule synchronization', {
                source: source.name,
                target: target.name,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async detectAndResolveConflicts(sourceData, targetData, strategy = 'source_wins') {
        try {
            this.logger.info('Detecting and resolving conflicts', {
                sourceRecords: sourceData.length,
                targetRecords: targetData.length,
                strategy
            });
            const conflicts = await this.conflictResolver.detectConflicts(sourceData, targetData);
            if (conflicts.length === 0) {
                this.logger.info('No conflicts detected');
                return {
                    conflicts: [],
                    resolutions: [],
                    resolved: true,
                    message: 'No conflicts detected'
                };
            }
            for (const conflict of conflicts) {
                await this.syncMonitor.logConflictDetected(conflict);
            }
            const resolutions = await this.conflictResolver.resolveConflicts(conflicts, strategy);
            for (let i = 0; i < conflicts.length; i++) {
                await this.syncMonitor.logConflictResolved(conflicts[i], resolutions[i]);
            }
            this.logger.info('Conflicts resolved successfully', {
                totalConflicts: conflicts.length,
                resolvedConflicts: resolutions.filter(r => r.resolvedValue !== null).length,
                strategy
            });
            return {
                conflicts,
                resolutions,
                resolved: true,
                message: `Resolved ${conflicts.length} conflicts using ${strategy} strategy`
            };
        }
        catch (error) {
            this.logger.error('Failed to detect and resolve conflicts', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async validateDataIntegrity(source, target, checkTypes = ['consistency']) {
        try {
            this.logger.info('Starting data integrity validation', {
                checkTypes,
                sourceRecords: sourceData.length,
                targetRecords: targetData.length
            });
            const results = [];
            let totalIssues = 0;
            let criticalIssues = 0;
            for (const checkType of checkTypes) {
                const report = await this.validationService.checkDataIntegrity(source, target, checkType);
                results.push(report);
                totalIssues += report.issues.length;
                criticalIssues += report.issues.filter(issue => issue.severity === 'critical').length;
            }
            const overallStatus = criticalIssues > 0 ? 'failed' : totalIssues > 0 ? 'warning' : 'passed';
            this.logger.info('Data integrity validation completed', {
                overallStatus,
                totalIssues,
                criticalIssues,
                checkTypes: checkTypes.length
            });
            return {
                overallStatus,
                totalIssues,
                criticalIssues,
                results,
                validatedAt: new Date()
            };
        }
        catch (error) {
            this.logger.error('Data integrity validation failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async getPerformanceReport(timeRange = '24h') {
        try {
            return await this.syncMonitor.getPerformanceReport(timeRange);
        }
        catch (error) {
            this.logger.error('Failed to get performance report', {
                timeRange,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async getSystemStatus() {
        try {
            return await this.syncMonitor.getSystemStatus();
        }
        catch (error) {
            this.logger.error('Failed to get system status', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async createAlert(config) {
        try {
            return await this.syncMonitor.createAlert(config);
        }
        catch (error) {
            this.logger.error('Failed to create alert', {
                alertName: config.name,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async checkAlerts() {
        try {
            return await this.syncMonitor.checkAlerts();
        }
        catch (error) {
            this.logger.error('Failed to check alerts', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async validateBeforeSync(source, target) {
        this.logger.debug('Validating before sync', {
            source: source.name,
            target: target.name
        });
        if (!source.id || !target.id) {
            throw new Error('Source and target must have valid IDs');
        }
        const sourceHealth = await this.checkDataSourceHealth(source);
        const targetHealth = await this.checkDataTargetHealth(target);
        if (!sourceHealth.isHealthy) {
            throw new Error(`Source data source is not healthy: ${sourceHealth.message}`);
        }
        if (!targetHealth.isHealthy) {
            throw new Error(`Target data source is not healthy: ${targetHealth.message}`);
        }
    }
    async validateAfterSync(source, target, result) {
        this.logger.debug('Validating after sync', {
            source: source.name,
            target: target.name,
            syncId: result.id
        });
        if (!result.success) {
            throw new Error('Cannot validate after failed sync');
        }
        if (result.recordsProcessed === 0) {
            this.logger.warn('No records processed during sync');
        }
        if (result.recordsFailed > result.recordsProcessed * 0.1) {
            this.logger.warn('High failure rate detected during sync', {
                failureRate: result.recordsFailed / result.recordsProcessed
            });
        }
    }
    async checkDataSourceHealth(source) {
        try {
            return { isHealthy: true };
        }
        catch (error) {
            return {
                isHealthy: false,
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async checkDataTargetHealth(target) {
        try {
            return { isHealthy: true };
        }
        catch (error) {
            return {
                isHealthy: false,
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async getCachedSyncResult(sourceId, targetId) {
        try {
            const cacheKey = `sync_result:${sourceId}:${targetId}`;
            return await this.cacheService.get(cacheKey);
        }
        catch (error) {
            this.logger.warn('Failed to get cached sync result', {
                sourceId,
                targetId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    async cacheSyncResult(sourceId, targetId, result) {
        try {
            const cacheKey = `sync_result:${sourceId}:${targetId}`;
            await this.cacheService.set(cacheKey, result, 3600);
        }
        catch (error) {
            this.logger.warn('Failed to cache sync result', {
                sourceId,
                targetId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    calculateNextRun(schedule) {
        const now = new Date();
        switch (schedule.type) {
            case 'immediate':
                return now;
            case 'interval':
                return new Date(now.getTime() + (schedule.interval || 3600000));
            case 'cron':
                return new Date(now.getTime() + 3600000);
            case 'manual':
                return new Date(now.getTime() + 86400000);
            default:
                return new Date(now.getTime() + 3600000);
        }
    }
    async destroy() {
        try {
            this.logger.info('Destroying Data Management Service');
            await this.cacheService.destroy();
            await this.syncMonitor.destroy();
            this.logger.info('Data Management Service destroyed successfully');
        }
        catch (error) {
            this.logger.error('Failed to destroy Data Management Service', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
}
exports.DataManagementService = DataManagementService;
//# sourceMappingURL=DataManagementService.js.map