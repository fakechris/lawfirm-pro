export interface IntegrationMetric {
    name: string;
    value: number;
    timestamp: Date;
    tags: Record<string, string>;
}
export interface IntegrationEvent {
    id: string;
    type: EventType;
    service: string;
    operation: string;
    timestamp: Date;
    data: Record<string, any>;
    userId?: string;
    severity: EventSeverity;
}
export interface HealthCheckResult {
    service: string;
    healthy: boolean;
    responseTime: number;
    lastChecked: Date;
    error?: string;
    details?: Record<string, any>;
}
export interface SystemHealthResult {
    overall: boolean;
    services: HealthCheckResult[];
    timestamp: Date;
    uptime: number;
    metrics: SystemMetrics;
}
export interface SystemMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    errorRate: number;
    activeConnections: number;
}
export interface Alert {
    id: string;
    type: AlertType;
    severity: AlertSeverity;
    service: string;
    message: string;
    timestamp: Date;
    resolved: boolean;
    resolvedAt?: Date;
    metadata?: Record<string, any>;
}
export interface Report {
    id: string;
    type: ReportType;
    period: ReportPeriod;
    generatedAt: Date;
    data: any;
    summary: string;
}
export interface HealthStatus {
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    timestamp: Date;
    checks: HealthCheckResult[];
    metrics: SystemMetrics;
}
export interface ServiceHealthResult extends HealthCheckResult {
    service: string;
    metrics: ServiceMetrics;
}
export interface ServiceMetrics {
    requestCount: number;
    errorCount: number;
    averageResponseTime: number;
    lastRequestTime: Date;
    uptime: number;
}
export type EventType = 'REQUEST' | 'RESPONSE' | 'ERROR' | 'WEBHOOK' | 'HEALTH_CHECK';
export type EventSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
export type AlertType = 'PERFORMANCE' | 'ERROR_RATE' | 'AVAILABILITY' | 'SECURITY';
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ReportType = 'PERFORMANCE' | 'ERROR' | 'USAGE' | 'SECURITY';
export type ReportPeriod = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export declare class IntegrationMonitor {
    private logger;
    private metrics;
    private events;
    private healthChecks;
    private alerts;
    private serviceMetrics;
    private startTime;
    constructor();
    recordMetric(metric: IntegrationMetric): void;
    performHealthCheck(service: string): Promise<HealthCheckResult>;
    logEvent(event: IntegrationEvent): void;
    checkAlerts(): Promise<Alert[]>;
    generateReport(type: ReportType, period: ReportPeriod): Promise<Report>;
    getSystemHealth(): Promise<SystemHealthResult>;
    private initializeMetrics;
    private startPeriodicTasks;
    private updateServiceMetrics;
    private checkHealthAlerts;
    private checkEventAlerts;
    private checkErrorRateAlerts;
    private checkPerformanceAlerts;
    private checkAvailabilityAlerts;
    private calculateSystemMetrics;
    private generatePerformanceReport;
    private generateErrorReport;
    private generateUsageReport;
    private generateSecurityReport;
    private generatePerformanceSummary;
    private generateErrorSummary;
    private generateUsageSummary;
    private generateSecuritySummary;
    private generateSecurityRecommendations;
    private groupErrorsByService;
    private groupErrorsByType;
    private groupRequestsByService;
    private groupRequestsByOperation;
    private groupEventsByType;
    private groupEventsByService;
    private getTopUsers;
    private getPeriodStartTime;
    private cleanupOldData;
    private generateEventId;
    private generateAlertId;
    private generateReportId;
}
//# sourceMappingURL=IntegrationMonitor.d.ts.map