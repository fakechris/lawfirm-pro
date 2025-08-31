export { MonitoringService } from './MonitoringService';
export type { MonitoringServiceConfig, HealthCheck, SystemHealth } from './MonitoringService';
export { MetricsCollector } from './MetricsCollector';
export type { MetricData, MetricAggregation, MetricQuery, ServiceMetrics, SystemMetrics as MetricsSystemMetrics } from './MetricsCollector';
export { ConfigurationManager } from './ConfigurationManager';
export type { Configuration, ConfigUpdateRequest, ConfigValidationResult, ConfigAuditLog, CredentialRotationPolicy, ConfigBackup } from './ConfigurationManager';
export { IntegrationMonitoringMiddleware, createIntegrationMonitoringMiddleware } from '../../middleware/integrationMonitoring';
export type { IntegrationRequest, MonitoringConfig, RequestMetrics } from '../../middleware/integrationMonitoring';
export type { AlertConfig, Alert, AlertCondition, NotificationChannel, NotificationStatus, ChannelConfig, EmailConfig, SlackConfig, WebhookConfig, SmsConfig, PagerDutyConfig } from '../alerting/AlertingService';
export type { LogEntry, AuditLogEntry, LogQuery, AuditQuery, LogAggregation, LogExportOptions, LogLevel, AuditAction, RiskLevel } from '../../logging/ComprehensiveLoggingService';
export type { Dashboard, DashboardWidget, WidgetConfig, WidgetData, DashboardExport, WidgetType, ChartType } from '../../dashboard/MonitoringDashboardService';
export declare const MONITORING_DEFAULTS: {
    readonly METRICS_RETENTION_DAYS: 30;
    readonly LOGS_RETENTION_DAYS: 30;
    readonly AUDIT_RETENTION_DAYS: 365;
    readonly ALERT_COOLDOWN_PERIOD: 300;
    readonly DASHBOARD_REFRESH_INTERVAL: 60;
    readonly MAX_METRICS: 100000;
    readonly MAX_LOGS: 100000;
    readonly SAMPLE_RATE: 1;
};
export declare const MONITORING_EVENTS: {
    readonly METRIC_RECORDED: "metric:recorded";
    readonly ALERT_TRIGGERED: "alert:triggered";
    readonly ALERT_RESOLVED: "alert:resolved";
    readonly CONFIG_UPDATED: "config:updated";
    readonly CONFIG_ROTATED: "config:rotated";
    readonly LOG_CREATED: "log:created";
    readonly AUDIT_LOGGED: "audit:logged";
    readonly HEALTH_CHECK: "health:check";
    readonly DASHBOARD_UPDATED: "dashboard:updated";
};
export declare const createMonitoringService: (config?: Partial<MonitoringServiceConfig>) => any;
export declare const createMetricsCollector: () => any;
export declare const createAlertingService: () => any;
export declare const createConfigurationManager: () => any;
export declare const createLoggingService: () => any;
export declare const createDashboardService: (metricsCollector: MetricsCollector, alertingService: AlertingService, loggingService: ComprehensiveLoggingService) => any;
export declare const createHealthCheck: (name: string, checkFn: () => Promise<HealthCheck>) => {
    name: string;
    checkFn: () => Promise<HealthCheck>;
};
export declare const isHealthy: (health: SystemHealth) => boolean;
export declare const hasDegradedComponents: (health: SystemHealth) => any;
export declare const hasUnhealthyComponents: (health: SystemHealth) => any;
export declare const createMetricTags: (base: Record<string, string>, additional?: Record<string, string>) => {
    [x: string]: string;
};
export declare const formatMetricValue: (value: number, unit?: string) => string;
export declare const createAlertCondition: (metric: string, operator: "gt" | "lt" | "eq" | "gte" | "lte", threshold: number, duration?: number) => {
    metric: string;
    operator: "lt" | "lte" | "gt" | "gte" | "eq";
    threshold: number;
    duration: number;
};
export declare const createNotificationChannel: (id: string, name: string, type: "EMAIL" | "SLACK" | "WEBHOOK" | "SMS" | "PAGERDUTY", config: ChannelConfig, enabled?: boolean) => {
    id: string;
    name: string;
    type: "EMAIL" | "SLACK" | "WEBHOOK" | "SMS" | "PAGERDUTY";
    config: ChannelConfig;
    enabled: boolean;
};
export declare const createConfiguration: (service: string, data: Record<string, any>, createdBy: string, options?: {
    encrypt?: boolean;
    metadata?: Record<string, any>;
}) => {
    encrypt?: boolean;
    metadata?: Record<string, any>;
    service: string;
    data: Record<string, any>;
    createdBy: string;
};
export declare const validateConfiguration: (service: string, data: Record<string, any>, configManager: ConfigurationManager) => Promise<any>;
export declare const createLogContext: (service: string, operation?: string, additional?: Record<string, any>) => {
    service: string;
    operation: string;
};
export declare const createAuditContext: (action: string, resource: string, userId: string, details: Record<string, any>) => {
    action: string;
    resource: string;
    userId: string;
    details: Record<string, any>;
};
export declare const createDashboardWidget: (type: WidgetType, title: string, position: {
    x: number;
    y: number;
    width: number;
    height: number;
}, config: WidgetConfig, refreshInterval?: number) => {
    type: WidgetType;
    title: string;
    position: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    config: WidgetConfig;
    refreshInterval: number;
    enabled: boolean;
};
export declare const createWidgetConfig: (metric?: string, timeRange?: number, chartType?: ChartType, additional?: Record<string, any>) => {
    metric: string;
    timeRange: number;
    chartType: ChartType;
};
export declare const createMonitoringConfig: (overrides?: Partial<MonitoringConfig>) => MonitoringConfig;
export declare const isMonitoringError: (error: Error) => boolean;
export declare const handleMonitoringError: (error: Error, context: string) => {
    success: boolean;
    error: string;
    context: string;
    timestamp: string;
};
export declare const measureExecutionTime: <T>(operation: string, fn: () => Promise<T>, tags?: Record<string, string>) => Promise<{
    result: T;
    duration: number;
}>;
export declare const initializeMonitoring: (config?: Partial<MonitoringServiceConfig>) => Promise<{
    monitoringService: any;
    metricsCollector: any;
    alertingService: any;
    configurationManager: any;
    loggingService: any;
    dashboardService: any;
}>;
export declare const setupIntegrationMonitoring: (monitoringService: MonitoringService, app: any) => any;
declare const _default: {
    MonitoringService: any;
    MetricsCollector: any;
    ConfigurationManager: any;
    IntegrationMonitoringMiddleware: any;
    createMonitoringService: (config?: Partial<MonitoringServiceConfig>) => any;
    createMetricsCollector: () => any;
    createAlertingService: () => any;
    createConfigurationManager: () => any;
    createLoggingService: () => any;
    createDashboardService: (metricsCollector: MetricsCollector, alertingService: AlertingService, loggingService: ComprehensiveLoggingService) => any;
    initializeMonitoring: (config?: Partial<MonitoringServiceConfig>) => Promise<{
        monitoringService: any;
        metricsCollector: any;
        alertingService: any;
        configurationManager: any;
        loggingService: any;
        dashboardService: any;
    }>;
    setupIntegrationMonitoring: (monitoringService: MonitoringService, app: any) => any;
    MONITORING_DEFAULTS: {
        readonly METRICS_RETENTION_DAYS: 30;
        readonly LOGS_RETENTION_DAYS: 30;
        readonly AUDIT_RETENTION_DAYS: 365;
        readonly ALERT_COOLDOWN_PERIOD: 300;
        readonly DASHBOARD_REFRESH_INTERVAL: 60;
        readonly MAX_METRICS: 100000;
        readonly MAX_LOGS: 100000;
        readonly SAMPLE_RATE: 1;
    };
    MONITORING_EVENTS: {
        readonly METRIC_RECORDED: "metric:recorded";
        readonly ALERT_TRIGGERED: "alert:triggered";
        readonly ALERT_RESOLVED: "alert:resolved";
        readonly CONFIG_UPDATED: "config:updated";
        readonly CONFIG_ROTATED: "config:rotated";
        readonly LOG_CREATED: "log:created";
        readonly AUDIT_LOGGED: "audit:logged";
        readonly HEALTH_CHECK: "health:check";
        readonly DASHBOARD_UPDATED: "dashboard:updated";
    };
};
export default _default;
//# sourceMappingURL=index.d.ts.map