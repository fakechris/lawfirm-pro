import { MetricsCollector } from './MetricsCollector';
import { AlertingService } from '../alerting/AlertingService';
import { ConfigurationManager } from './ConfigurationManager';
import { ComprehensiveLoggingService } from '../logging/ComprehensiveLoggingService';
import { MonitoringDashboardService } from '../../dashboard/MonitoringDashboardService';
export interface MonitoringServiceConfig {
    metrics: {
        enabled: boolean;
        retentionDays: number;
        maxMetrics: number;
    };
    alerts: {
        enabled: boolean;
        defaultChannels: string[];
        cooldownPeriod: number;
    };
    logging: {
        enabled: boolean;
        level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
        retentionDays: number;
        maxLogs: number;
    };
    dashboard: {
        enabled: boolean;
        refreshInterval: number;
        maxDataPoints: number;
    };
    config: {
        enabled: boolean;
        encryptionKey: string;
        autoRotate: boolean;
    };
}
export interface HealthCheck {
    name: string;
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    message?: string;
    details?: Record<string, any>;
    timestamp: Date;
}
export interface SystemHealth {
    overall: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    components: HealthCheck[];
    timestamp: Date;
    uptime: number;
    metrics: {
        totalRequests: number;
        errorRate: number;
        averageResponseTime: number;
        activeConnections: number;
        memoryUsage: number;
        cpuUsage: number;
    };
}
export declare class MonitoringService {
    private logger;
    private metricsCollector;
    private alertingService;
    private configurationManager;
    private loggingService;
    private dashboardService;
    private config;
    private startTime;
    private healthChecks;
    constructor(config?: Partial<MonitoringServiceConfig>);
    initialize(): Promise<void>;
    getMetricsCollector(): MetricsCollector;
    recordMetric(name: string, value: number, type: 'counter' | 'gauge' | 'timing', tags?: Record<string, string>): Promise<void>;
    getAlertingService(): AlertingService;
    createAlert(config: any): Promise<any>;
    triggerAlert(type: string, message: string, severity: string, metadata?: any): Promise<void>;
    getConfigurationManager(): ConfigurationManager;
    getConfiguration(service: string): Promise<any>;
    updateConfiguration(service: string, data: any, updatedBy: string): Promise<void>;
    getLoggingService(): ComprehensiveLoggingService;
    log(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL', message: string, context: any): Promise<void>;
    auditLog(action: string, resource: string, userId: string, details: any): Promise<void>;
    getDashboardService(): MonitoringDashboardService;
    createDashboard(name: string, createdBy: string): Promise<any>;
    getSystemHealth(): Promise<SystemHealth>;
    getMonitoringStats(): Promise<{
        uptime: number;
        metricsCount: number;
        alertsCount: number;
        logsCount: number;
        dashboardsCount: number;
        healthStatus: SystemHealth['overall'];
    }>;
    addHealthCheck(name: string, checkFn: () => Promise<HealthCheck>): void;
    removeHealthCheck(name: string): void;
    updateConfig(newConfig: Partial<MonitoringServiceConfig>): void;
    getConfig(): MonitoringServiceConfig;
    shutdown(): Promise<void>;
    private initializeServices;
    private initializeDefaultAlerts;
    private initializeDefaultDashboard;
    private initializeConfigPolicies;
    private setupHealthChecks;
    private startPeriodicTasks;
    private cleanupMetrics;
    private generateMonitoringReport;
    private cleanup;
    private mergeConfig;
    private calculateRiskLevel;
}
//# sourceMappingURL=MonitoringService.d.ts.map