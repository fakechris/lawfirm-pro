// Main monitoring service
export { MonitoringService } from './MonitoringService';
export type {
  MonitoringServiceConfig,
  HealthCheck,
  SystemHealth
} from './MonitoringService';

// Metrics collection
export { MetricsCollector } from './MetricsCollector';
export type {
  MetricData,
  MetricAggregation,
  MetricQuery,
  ServiceMetrics,
  SystemMetrics as MetricsSystemMetrics
} from './MetricsCollector';

// Configuration management
export { ConfigurationManager } from './ConfigurationManager';
export type {
  Configuration,
  ConfigUpdateRequest,
  ConfigValidationResult,
  ConfigAuditLog,
  CredentialRotationPolicy,
  ConfigBackup
} from './ConfigurationManager';

// Integration monitoring middleware
export { 
  IntegrationMonitoringMiddleware,
  createIntegrationMonitoringMiddleware 
} from '../../middleware/integrationMonitoring';
export type {
  IntegrationRequest,
  MonitoringConfig,
  RequestMetrics
} from '../../middleware/integrationMonitoring';

// Re-export alerting service types
export type {
  AlertConfig,
  Alert,
  AlertCondition,
  NotificationChannel,
  NotificationStatus,
  ChannelConfig,
  EmailConfig,
  SlackConfig,
  WebhookConfig,
  SmsConfig,
  PagerDutyConfig
} from '../alerting/AlertingService';

// Re-export logging service types
export type {
  LogEntry,
  AuditLogEntry,
  LogQuery,
  AuditQuery,
  LogAggregation,
  LogExportOptions,
  LogLevel,
  AuditAction,
  RiskLevel
} from '../../logging/ComprehensiveLoggingService';

// Re-export dashboard service types
export type {
  Dashboard,
  DashboardWidget,
  WidgetConfig,
  WidgetData,
  DashboardExport,
  WidgetType,
  ChartType
} from '../../dashboard/MonitoringDashboardService';

// Utility functions and constants
export const MONITORING_DEFAULTS = {
  METRICS_RETENTION_DAYS: 30,
  LOGS_RETENTION_DAYS: 30,
  AUDIT_RETENTION_DAYS: 365,
  ALERT_COOLDOWN_PERIOD: 300,
  DASHBOARD_REFRESH_INTERVAL: 60,
  MAX_METRICS: 100000,
  MAX_LOGS: 100000,
  SAMPLE_RATE: 1.0
} as const;

export const MONITORING_EVENTS = {
  METRIC_RECORDED: 'metric:recorded',
  ALERT_TRIGGERED: 'alert:triggered',
  ALERT_RESOLVED: 'alert:resolved',
  CONFIG_UPDATED: 'config:updated',
  CONFIG_ROTATED: 'config:rotated',
  LOG_CREATED: 'log:created',
  AUDIT_LOGGED: 'audit:logged',
  HEALTH_CHECK: 'health:check',
  DASHBOARD_UPDATED: 'dashboard:updated'
} as const;

// Factory functions
export const createMonitoringService = (config?: Partial<MonitoringServiceConfig>) => {
  const service = new MonitoringService(config);
  return service;
};

export const createMetricsCollector = () => {
  return new MetricsCollector();
};

export const createAlertingService = () => {
  return new AlertingService();
};

export const createConfigurationManager = () => {
  return new ConfigurationManager();
};

export const createLoggingService = () => {
  return new ComprehensiveLoggingService();
};

export const createDashboardService = (
  metricsCollector: MetricsCollector,
  alertingService: AlertingService,
  loggingService: ComprehensiveLoggingService
) => {
  return new MonitoringDashboardService(metricsCollector, alertingService, loggingService);
};

// Health check utilities
export const createHealthCheck = (
  name: string,
  checkFn: () => Promise<HealthCheck>
) => {
  return { name, checkFn };
};

export const isHealthy = (health: SystemHealth) => {
  return health.overall === 'HEALTHY';
};

export const hasDegradedComponents = (health: SystemHealth) => {
  return health.components.some(c => c.status === 'DEGRADED');
};

export const hasUnhealthyComponents = (health: SystemHealth) => {
  return health.components.some(c => c.status === 'UNHEALTHY');
};

// Metrics utilities
export const createMetricTags = (
  base: Record<string, string>,
  additional?: Record<string, string>
) => {
  return { ...base, ...additional };
};

export const formatMetricValue = (value: number, unit?: string) => {
  return unit ? `${value} ${unit}` : value.toString();
};

// Alert utilities
export const createAlertCondition = (
  metric: string,
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte',
  threshold: number,
  duration?: number
) => {
  return { metric, operator, threshold, duration };
};

export const createNotificationChannel = (
  id: string,
  name: string,
  type: 'EMAIL' | 'SLACK' | 'WEBHOOK' | 'SMS' | 'PAGERDUTY',
  config: ChannelConfig,
  enabled: boolean = true
) => {
  return { id, name, type, config, enabled };
};

// Configuration utilities
export const createConfiguration = (
  service: string,
  data: Record<string, any>,
  createdBy: string,
  options?: { encrypt?: boolean; metadata?: Record<string, any> }
) => {
  return { service, data, createdBy, ...options };
};

export const validateConfiguration = async (
  service: string,
  data: Record<string, any>,
  configManager: ConfigurationManager
) => {
  return await configManager.validateConfiguration(service, data);
};

// Logging utilities
export const createLogContext = (
  service: string,
  operation?: string,
  additional?: Record<string, any>
) => {
  return { service, operation, ...additional };
};

export const createAuditContext = (
  action: string,
  resource: string,
  userId: string,
  details: Record<string, any>
) => {
  return { action, resource, userId, details };
};

// Dashboard utilities
export const createDashboardWidget = (
  type: WidgetType,
  title: string,
  position: { x: number; y: number; width: number; height: number },
  config: WidgetConfig,
  refreshInterval: number = 60
) => {
  return {
    type,
    title,
    position,
    config,
    refreshInterval,
    enabled: true
  };
};

export const createWidgetConfig = (
  metric?: string,
  timeRange?: number,
  chartType?: ChartType,
  additional?: Record<string, any>
) => {
  return { metric, timeRange, chartType, ...additional };
};

// Monitoring middleware utilities
export const createMonitoringConfig = (
  overrides: Partial<MonitoringConfig> = {}
) => {
  const defaultConfig: MonitoringConfig = {
    enabled: true,
    logRequests: true,
    logResponses: true,
    logErrors: true,
    collectMetrics: true,
    enableAlerting: true,
    sampleRate: 1.0,
    sensitiveHeaders: ['authorization', 'cookie', 'token', 'api-key'],
    sensitiveQueryParams: ['password', 'token', 'secret', 'key'],
    maxBodySize: 1024 * 1024,
    ...overrides
  };
  
  return defaultConfig;
};

// Error handling utilities
export const isMonitoringError = (error: Error) => {
  return error.name.startsWith('Monitoring') || 
         error.name.startsWith('Metrics') ||
         error.name.startsWith('Alerting') ||
         error.name.startsWith('Config') ||
         error.name.startsWith('Logging');
};

export const handleMonitoringError = (error: Error, context: string) => {
  console.error(`Monitoring error in ${context}:`, error);
  
  // In a real implementation, this would send to error tracking service
  return {
    success: false,
    error: error.message,
    context,
    timestamp: new Date().toISOString()
  };
};

// Performance monitoring utilities
export const measureExecutionTime = async <T>(
  operation: string,
  fn: () => Promise<T>,
  tags?: Record<string, string>
): Promise<{ result: T; duration: number }> => {
  const startTime = Date.now();
  
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    
    // In a real implementation, this would record the metric
    console.log(`Operation ${operation} completed in ${duration}ms`);
    
    return { result, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Operation ${operation} failed after ${duration}ms:`, error);
    throw error;
  }
};

// Integration helpers
export const initializeMonitoring = async (
  config?: Partial<MonitoringServiceConfig>
) => {
  const monitoringService = createMonitoringService(config);
  await monitoringService.initialize();
  
  return {
    monitoringService,
    metricsCollector: monitoringService.getMetricsCollector(),
    alertingService: monitoringService.getAlertingService(),
    configurationManager: monitoringService.getConfigurationManager(),
    loggingService: monitoringService.getLoggingService(),
    dashboardService: monitoringService.getDashboardService()
  };
};

export const setupIntegrationMonitoring = (
  monitoringService: MonitoringService,
  app: any
) => {
  const middleware = new IntegrationMonitoringMiddleware(
    monitoringService.getMetricsCollector(),
    monitoringService.getAlertingService(),
    monitoringService.getLoggingService()
  );
  
  // Apply middleware to all routes
  app.use(middleware.middleware);
  
  return middleware;
};

// Default export for convenience
export default {
  MonitoringService,
  MetricsCollector,
  ConfigurationManager,
  IntegrationMonitoringMiddleware,
  createMonitoringService,
  createMetricsCollector,
  createAlertingService,
  createConfigurationManager,
  createLoggingService,
  createDashboardService,
  initializeMonitoring,
  setupIntegrationMonitoring,
  MONITORING_DEFAULTS,
  MONITORING_EVENTS
};