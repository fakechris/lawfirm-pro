import { SyncMonitor, SyncMetrics, HealthStatus, AlertConfig, Alert, SyncResult, Conflict, ResolutionResult } from '../../models/integration';
export declare class SyncMonitorImplementation implements SyncMonitor {
    private logger;
    private metrics;
    private alerts;
    private activeAlerts;
    private syncHistory;
    private conflictHistory;
    private healthChecks;
    private monitoringInterval?;
    constructor();
    logSyncStart(jobId: string): Promise<void>;
    logSyncComplete(jobId: string, result: SyncResult): Promise<void>;
    logSyncError(jobId: string, error: Error): Promise<void>;
    logConflictDetected(conflict: Conflict): Promise<void>;
    logConflictResolved(conflict: Conflict, resolution: ResolutionResult): Promise<void>;
    getMetrics(): Promise<SyncMetrics>;
    getHealthStatus(): Promise<HealthStatus>;
    createAlert(config: AlertConfig): Promise<Alert>;
    getSyncHistory(limit?: number): Promise<SyncResult[]>;
    getConflictHistory(limit?: number): Promise<Conflict[]>;
    getAlertHistory(limit?: number): Promise<Alert[]>;
    getPerformanceReport(timeRange?: '1h' | '24h' | '7d' | '30d'): Promise<PerformanceReport>;
    getSystemStatus(): Promise<SystemStatus>;
    private startMonitoring;
    private evaluateAlertCondition;
    private executeAlertActions;
    private sendEmailAlert;
    private sendWebhookAlert;
    private sendNotification;
    private resolveAlert;
    private generateHealthCheck;
    private cleanupOldData;
    private calculateAverageDuration;
    private calculateAverageSyncDuration;
    private calculateAverageRecordsPerSecond;
    private calculateConflictResolutionRate;
    private calculateErrorRate;
    private getTopErrorTypes;
    private generatePerformanceRecommendations;
    private getTimeRangeMs;
    private calculateOverallStatus;
    private calculateUptime;
    private initializeMetrics;
    private generateAlertId;
    destroy(): Promise<void>;
}
export interface PerformanceReport {
    timeRange: string;
    startTime: Date;
    endTime: Date;
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    averageSyncDuration: number;
    totalRecordsProcessed: number;
    averageRecordsPerSecond: number;
    totalConflicts: number;
    resolvedConflicts: number;
    conflictResolutionRate: number;
    errorRate: number;
    topErrorTypes: Array<{
        type: string;
        count: number;
    }>;
    recommendations: PerformanceRecommendation[];
}
export interface PerformanceRecommendation {
    type: 'performance' | 'reliability' | 'data_quality' | 'security';
    priority: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    action: string;
}
export interface SystemStatus {
    overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    health: HealthStatus;
    metrics: SyncMetrics;
    activeAlerts: Alert[];
    lastUpdateTime: Date;
    uptime: number;
    version: string;
}
//# sourceMappingURL=SyncMonitor.d.ts.map