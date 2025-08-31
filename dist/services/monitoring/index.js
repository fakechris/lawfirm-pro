"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupIntegrationMonitoring = exports.initializeMonitoring = exports.measureExecutionTime = exports.handleMonitoringError = exports.isMonitoringError = exports.createMonitoringConfig = exports.createWidgetConfig = exports.createDashboardWidget = exports.createAuditContext = exports.createLogContext = exports.validateConfiguration = exports.createConfiguration = exports.createNotificationChannel = exports.createAlertCondition = exports.formatMetricValue = exports.createMetricTags = exports.hasUnhealthyComponents = exports.hasDegradedComponents = exports.isHealthy = exports.createHealthCheck = exports.createDashboardService = exports.createLoggingService = exports.createConfigurationManager = exports.createAlertingService = exports.createMetricsCollector = exports.createMonitoringService = exports.MONITORING_EVENTS = exports.MONITORING_DEFAULTS = exports.createIntegrationMonitoringMiddleware = exports.IntegrationMonitoringMiddleware = exports.ConfigurationManager = exports.MetricsCollector = exports.MonitoringService = void 0;
var MonitoringService_1 = require("./MonitoringService");
Object.defineProperty(exports, "MonitoringService", { enumerable: true, get: function () { return MonitoringService_1.MonitoringService; } });
var MetricsCollector_1 = require("./MetricsCollector");
Object.defineProperty(exports, "MetricsCollector", { enumerable: true, get: function () { return MetricsCollector_1.MetricsCollector; } });
var ConfigurationManager_1 = require("./ConfigurationManager");
Object.defineProperty(exports, "ConfigurationManager", { enumerable: true, get: function () { return ConfigurationManager_1.ConfigurationManager; } });
var integrationMonitoring_1 = require("../../middleware/integrationMonitoring");
Object.defineProperty(exports, "IntegrationMonitoringMiddleware", { enumerable: true, get: function () { return integrationMonitoring_1.IntegrationMonitoringMiddleware; } });
Object.defineProperty(exports, "createIntegrationMonitoringMiddleware", { enumerable: true, get: function () { return integrationMonitoring_1.createIntegrationMonitoringMiddleware; } });
exports.MONITORING_DEFAULTS = {
    METRICS_RETENTION_DAYS: 30,
    LOGS_RETENTION_DAYS: 30,
    AUDIT_RETENTION_DAYS: 365,
    ALERT_COOLDOWN_PERIOD: 300,
    DASHBOARD_REFRESH_INTERVAL: 60,
    MAX_METRICS: 100000,
    MAX_LOGS: 100000,
    SAMPLE_RATE: 1.0
};
exports.MONITORING_EVENTS = {
    METRIC_RECORDED: 'metric:recorded',
    ALERT_TRIGGERED: 'alert:triggered',
    ALERT_RESOLVED: 'alert:resolved',
    CONFIG_UPDATED: 'config:updated',
    CONFIG_ROTATED: 'config:rotated',
    LOG_CREATED: 'log:created',
    AUDIT_LOGGED: 'audit:logged',
    HEALTH_CHECK: 'health:check',
    DASHBOARD_UPDATED: 'dashboard:updated'
};
const createMonitoringService = (config) => {
    const service = new MonitoringService(config);
    return service;
};
exports.createMonitoringService = createMonitoringService;
const createMetricsCollector = () => {
    return new MetricsCollector();
};
exports.createMetricsCollector = createMetricsCollector;
const createAlertingService = () => {
    return new AlertingService();
};
exports.createAlertingService = createAlertingService;
const createConfigurationManager = () => {
    return new ConfigurationManager();
};
exports.createConfigurationManager = createConfigurationManager;
const createLoggingService = () => {
    return new ComprehensiveLoggingService();
};
exports.createLoggingService = createLoggingService;
const createDashboardService = (metricsCollector, alertingService, loggingService) => {
    return new MonitoringDashboardService(metricsCollector, alertingService, loggingService);
};
exports.createDashboardService = createDashboardService;
const createHealthCheck = (name, checkFn) => {
    return { name, checkFn };
};
exports.createHealthCheck = createHealthCheck;
const isHealthy = (health) => {
    return health.overall === 'HEALTHY';
};
exports.isHealthy = isHealthy;
const hasDegradedComponents = (health) => {
    return health.components.some(c => c.status === 'DEGRADED');
};
exports.hasDegradedComponents = hasDegradedComponents;
const hasUnhealthyComponents = (health) => {
    return health.components.some(c => c.status === 'UNHEALTHY');
};
exports.hasUnhealthyComponents = hasUnhealthyComponents;
const createMetricTags = (base, additional) => {
    return { ...base, ...additional };
};
exports.createMetricTags = createMetricTags;
const formatMetricValue = (value, unit) => {
    return unit ? `${value} ${unit}` : value.toString();
};
exports.formatMetricValue = formatMetricValue;
const createAlertCondition = (metric, operator, threshold, duration) => {
    return { metric, operator, threshold, duration };
};
exports.createAlertCondition = createAlertCondition;
const createNotificationChannel = (id, name, type, config, enabled = true) => {
    return { id, name, type, config, enabled };
};
exports.createNotificationChannel = createNotificationChannel;
const createConfiguration = (service, data, createdBy, options) => {
    return { service, data, createdBy, ...options };
};
exports.createConfiguration = createConfiguration;
const validateConfiguration = async (service, data, configManager) => {
    return await configManager.validateConfiguration(service, data);
};
exports.validateConfiguration = validateConfiguration;
const createLogContext = (service, operation, additional) => {
    return { service, operation, ...additional };
};
exports.createLogContext = createLogContext;
const createAuditContext = (action, resource, userId, details) => {
    return { action, resource, userId, details };
};
exports.createAuditContext = createAuditContext;
const createDashboardWidget = (type, title, position, config, refreshInterval = 60) => {
    return {
        type,
        title,
        position,
        config,
        refreshInterval,
        enabled: true
    };
};
exports.createDashboardWidget = createDashboardWidget;
const createWidgetConfig = (metric, timeRange, chartType, additional) => {
    return { metric, timeRange, chartType, ...additional };
};
exports.createWidgetConfig = createWidgetConfig;
const createMonitoringConfig = (overrides = {}) => {
    const defaultConfig = {
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
exports.createMonitoringConfig = createMonitoringConfig;
const isMonitoringError = (error) => {
    return error.name.startsWith('Monitoring') ||
        error.name.startsWith('Metrics') ||
        error.name.startsWith('Alerting') ||
        error.name.startsWith('Config') ||
        error.name.startsWith('Logging');
};
exports.isMonitoringError = isMonitoringError;
const handleMonitoringError = (error, context) => {
    console.error(`Monitoring error in ${context}:`, error);
    return {
        success: false,
        error: error.message,
        context,
        timestamp: new Date().toISOString()
    };
};
exports.handleMonitoringError = handleMonitoringError;
const measureExecutionTime = async (operation, fn, tags) => {
    const startTime = Date.now();
    try {
        const result = await fn();
        const duration = Date.now() - startTime;
        console.log(`Operation ${operation} completed in ${duration}ms`);
        return { result, duration };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        console.error(`Operation ${operation} failed after ${duration}ms:`, error);
        throw error;
    }
};
exports.measureExecutionTime = measureExecutionTime;
const initializeMonitoring = async (config) => {
    const monitoringService = (0, exports.createMonitoringService)(config);
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
exports.initializeMonitoring = initializeMonitoring;
const setupIntegrationMonitoring = (monitoringService, app) => {
    const middleware = new IntegrationMonitoringMiddleware(monitoringService.getMetricsCollector(), monitoringService.getAlertingService(), monitoringService.getLoggingService());
    app.use(middleware.middleware);
    return middleware;
};
exports.setupIntegrationMonitoring = setupIntegrationMonitoring;
exports.default = {
    MonitoringService,
    MetricsCollector,
    ConfigurationManager,
    IntegrationMonitoringMiddleware,
    createMonitoringService: exports.createMonitoringService,
    createMetricsCollector: exports.createMetricsCollector,
    createAlertingService: exports.createAlertingService,
    createConfigurationManager: exports.createConfigurationManager,
    createLoggingService: exports.createLoggingService,
    createDashboardService: exports.createDashboardService,
    initializeMonitoring: exports.initializeMonitoring,
    setupIntegrationMonitoring: exports.setupIntegrationMonitoring,
    MONITORING_DEFAULTS: exports.MONITORING_DEFAULTS,
    MONITORING_EVENTS: exports.MONITORING_EVENTS
};
//# sourceMappingURL=index.js.map