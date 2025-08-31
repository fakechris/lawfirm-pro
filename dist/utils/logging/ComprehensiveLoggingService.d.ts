export interface LogEntry {
    id: string;
    timestamp: Date;
    level: LogLevel;
    message: string;
    service: string;
    operation?: string;
    userId?: string;
    sessionId?: string;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
    tags?: string[];
    traceId?: string;
    spanId?: string;
}
export interface AuditLogEntry {
    id: string;
    timestamp: Date;
    action: AuditAction;
    resource: string;
    resourceId?: string;
    userId: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    details: Record<string, any>;
    result: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
    riskLevel: RiskLevel;
    complianceTags?: string[];
}
export interface LogQuery {
    level?: LogLevel;
    service?: string;
    operation?: string;
    userId?: string;
    startTime?: Date;
    endTime?: Date;
    tags?: string[];
    traceId?: string;
    limit?: number;
    offset?: number;
}
export interface AuditQuery {
    action?: AuditAction;
    resource?: string;
    resourceId?: string;
    userId?: string;
    startTime?: Date;
    endTime?: Date;
    result?: AuditLogEntry['result'];
    riskLevel?: RiskLevel;
    limit?: number;
    offset?: number;
}
export interface LogAggregation {
    field: string;
    operation: 'count' | 'sum' | 'avg' | 'min' | 'max';
    groupBy?: string[];
    timeRange?: {
        start: Date;
        end: Date;
        interval: number;
    };
}
export interface LogExportOptions {
    format: 'json' | 'csv' | 'xml';
    compression?: 'gzip' | 'zip';
    includeMetadata?: boolean;
    filterSensitive?: boolean;
}
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
export type AuditAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'FAILED_LOGIN' | 'PERMISSION_CHANGE' | 'CONFIG_CHANGE' | 'DATA_EXPORT' | 'DATA_IMPORT' | 'SECURITY_EVENT' | 'COMPLIANCE_CHECK';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export declare class ComprehensiveLoggingService {
    private logger;
    private logs;
    private auditLogs;
    private logAggregations;
    private retentionPolicies;
    private sensitiveDataPatterns;
    constructor();
    log(level: LogLevel, message: string, context: {
        service: string;
        operation?: string;
        userId?: string;
        sessionId?: string;
        requestId?: string;
        ipAddress?: string;
        userAgent?: string;
        metadata?: Record<string, any>;
        tags?: string[];
        traceId?: string;
        spanId?: string;
    }): Promise<void>;
    debug(message: string, context: LogEntry['service'] & Partial<LogEntry>): Promise<void>;
    info(message: string, context: LogEntry['service'] & Partial<LogEntry>): Promise<void>;
    warn(message: string, context: LogEntry['service'] & Partial<LogEntry>): Promise<void>;
    error(message: string, context: LogEntry['service'] & Partial<LogEntry>): Promise<void>;
    critical(message: string, context: LogEntry['service'] & Partial<LogEntry>): Promise<void>;
    auditLog(action: AuditAction, resource: string, userId: string, context: {
        resourceId?: string;
        sessionId?: string;
        ipAddress?: string;
        userAgent?: string;
        details: Record<string, any>;
        result?: AuditLogEntry['result'];
        riskLevel?: RiskLevel;
        complianceTags?: string[];
    }): Promise<void>;
    queryLogs(query: LogQuery): Promise<LogEntry[]>;
    queryAuditLogs(query: AuditQuery): Promise<AuditLogEntry[]>;
    aggregateLogs(aggregation: LogAggregation): Promise<Record<string, number>>;
    exportLogs(query: LogQuery, options: LogExportOptions): Promise<string>;
    getLogStats(): Promise<{
        totalLogs: number;
        logsByLevel: Record<LogLevel, number>;
        logsByService: Record<string, number>;
        recentErrors: LogEntry[];
        storageUsage: number;
    }>;
    getAuditStats(): Promise<{
        totalAudits: number;
        auditsByAction: Record<AuditAction, number>;
        auditsByRiskLevel: Record<RiskLevel, number>;
        recentSecurityEvents: AuditLogEntry[];
        complianceRate: number;
    }>;
    setRetentionPolicy(service: string, retentionDays: number): Promise<void>;
    getRetentionPolicies(): Promise<Record<string, number>>;
    private checkLogAlerts;
    private checkSecurityAlerts;
    private sanitizeMetadata;
    private calculateRiskLevel;
    private applyAggregation;
    private extractFieldValue;
    private convertToCSV;
    private convertToXML;
    private compressData;
    private logToWinston;
    private initializeRetentionPolicies;
    private startPeriodicTasks;
    private cleanupOldLogs;
    private cleanupOldAuditLogs;
    private generateLogStatistics;
    private generateLogId;
    private generateAuditId;
}
//# sourceMappingURL=ComprehensiveLoggingService.d.ts.map