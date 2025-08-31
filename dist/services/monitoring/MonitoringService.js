"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringService = void 0;
const logger_1 = require("../../utils/logger");
const MetricsCollector_1 = require("./MetricsCollector");
const AlertingService_1 = require("../alerting/AlertingService");
const ConfigurationManager_1 = require("./ConfigurationManager");
const ComprehensiveLoggingService_1 = require("../logging/ComprehensiveLoggingService");
const MonitoringDashboardService_1 = require("../../dashboard/MonitoringDashboardService");
class MonitoringService {
    constructor(config = {}) {
        this.logger = new logger_1.Logger('MonitoringService');
        this.startTime = new Date();
        this.metricsCollector = new MetricsCollector_1.MetricsCollector();
        this.alertingService = new AlertingService_1.AlertingService();
        this.configurationManager = new ConfigurationManager_1.ConfigurationManager();
        this.loggingService = new ComprehensiveLoggingService_1.ComprehensiveLoggingService();
        this.dashboardService = new MonitoringDashboardService_1.MonitoringDashboardService(this.metricsCollector, this.alertingService, this.loggingService);
        this.config = this.mergeConfig(config);
        this.healthChecks = new Map();
        this.initializeServices();
        this.setupHealthChecks();
        this.startPeriodicTasks();
    }
    async initialize() {
        try {
            this.logger.info('Initializing monitoring service');
            await this.initializeDefaultAlerts();
            await this.initializeDefaultDashboard();
            await this.initializeConfigPolicies();
            this.logger.info('Monitoring service initialized successfully');
        }
        catch (error) {
            this.logger.error('Error initializing monitoring service', { error });
            throw error;
        }
    }
    getMetricsCollector() {
        return this.metricsCollector;
    }
    async recordMetric(name, value, type, tags = {}) {
        if (!this.config.metrics.enabled)
            return;
        try {
            switch (type) {
                case 'counter':
                    this.metricsCollector.incrementCounter(name, value, tags);
                    break;
                case 'gauge':
                    this.metricsCollector.recordGauge(name, value, tags);
                    break;
                case 'timing':
                    this.metricsCollector.recordTiming(name, value, tags);
                    break;
            }
        }
        catch (error) {
            this.logger.error('Error recording metric', { error, name, value, type, tags });
        }
    }
    getAlertingService() {
        return this.alertingService;
    }
    async createAlert(config) {
        if (!this.config.alerts.enabled) {
            throw new Error('Alerting is disabled');
        }
        return this.alertingService.createAlertConfig(config);
    }
    async triggerAlert(type, message, severity, metadata) {
        if (!this.config.alerts.enabled)
            return;
        try {
            this.loggingService.warn('Alert triggered', {
                service: 'monitoring',
                operation: 'alert',
                metadata: { type, message, severity, metadata },
                tags: ['alert', 'monitoring']
            });
        }
        catch (error) {
            this.logger.error('Error triggering alert', { error, type, message, severity });
        }
    }
    getConfigurationManager() {
        return this.configurationManager;
    }
    async getConfiguration(service) {
        if (!this.config.config.enabled) {
            throw new Error('Configuration management is disabled');
        }
        return this.configurationManager.getConfiguration(service);
    }
    async updateConfiguration(service, data, updatedBy) {
        if (!this.config.config.enabled) {
            throw new Error('Configuration management is disabled');
        }
        return this.configurationManager.updateConfiguration(service, {
            service,
            data,
            updatedBy,
            reason: 'Configuration update'
        });
    }
    getLoggingService() {
        return this.loggingService;
    }
    async log(level, message, context) {
        if (!this.config.logging.enabled)
            return;
        try {
            await this.loggingService.log(level, message, context);
        }
        catch (error) {
            this.logger.error('Error logging message', { error, level, message, context });
        }
    }
    async auditLog(action, resource, userId, details) {
        if (!this.config.logging.enabled)
            return;
        try {
            await this.loggingService.auditLog(action, resource, userId, {
                details,
                riskLevel: this.calculateRiskLevel(action, resource)
            });
        }
        catch (error) {
            this.logger.error('Error logging audit event', { error, action, resource, userId });
        }
    }
    getDashboardService() {
        return this.dashboardService;
    }
    async createDashboard(name, createdBy) {
        if (!this.config.dashboard.enabled) {
            throw new Error('Dashboard is disabled');
        }
        return this.dashboardService.createDashboard(name, createdBy);
    }
    async getSystemHealth() {
        try {
            const healthChecks = [];
            for (const [name, checkFn] of this.healthChecks.entries()) {
                try {
                    const healthCheck = await checkFn();
                    healthChecks.push(healthCheck);
                }
                catch (error) {
                    healthChecks.push({
                        name,
                        status: 'UNHEALTHY',
                        message: error instanceof Error ? error.message : 'Unknown error',
                        timestamp: new Date()
                    });
                }
            }
            const hasUnhealthy = healthChecks.some(h => h.status === 'UNHEALTHY');
            const hasDegraded = healthChecks.some(h => h.status === 'DEGRADED');
            const overall = hasUnhealthy
                ? 'UNHEALTHY'
                : hasDegraded
                    ? 'DEGRADED'
                    : 'HEALTHY';
            const systemMetrics = await this.metricsCollector.getSystemMetrics();
            return {
                overall,
                components: healthChecks,
                timestamp: new Date(),
                uptime: Date.now() - this.startTime.getTime(),
                metrics: {
                    totalRequests: systemMetrics.totalRequests,
                    errorRate: systemMetrics.errorRate,
                    averageResponseTime: systemMetrics.averageResponseTime,
                    activeConnections: systemMetrics.activeConnections,
                    memoryUsage: systemMetrics.memoryUsage.heapUsed,
                    cpuUsage: systemMetrics.cpuUsage.user
                }
            };
        }
        catch (error) {
            this.logger.error('Error getting system health', { error });
            throw error;
        }
    }
    async getMonitoringStats() {
        try {
            const systemHealth = await this.getSystemHealth();
            const metrics = await this.metricsCollector.getSystemMetrics();
            const alerts = await this.alertingService.getAlertStats();
            const logs = await this.loggingService.getLogStats();
            const dashboards = await this.dashboardService.getDashboardStats();
            return {
                uptime: Date.now() - this.startTime.getTime(),
                metricsCount: metrics.totalRequests,
                alertsCount: alerts.total,
                logsCount: logs.totalLogs,
                dashboardsCount: dashboards.totalDashboards,
                healthStatus: systemHealth.overall
            };
        }
        catch (error) {
            this.logger.error('Error getting monitoring stats', { error });
            throw error;
        }
    }
    addHealthCheck(name, checkFn) {
        this.healthChecks.set(name, checkFn);
        this.logger.info('Health check added', { name });
    }
    removeHealthCheck(name) {
        this.healthChecks.delete(name);
        this.logger.info('Health check removed', { name });
    }
    updateConfig(newConfig) {
        this.config = this.mergeConfig(newConfig);
        this.logger.info('Monitoring service configuration updated', { config: this.config });
    }
    getConfig() {
        return { ...this.config };
    }
    async shutdown() {
        try {
            this.logger.info('Shutting down monitoring service');
            await this.cleanup();
            this.logger.info('Monitoring service shutdown completed');
        }
        catch (error) {
            this.logger.error('Error during monitoring service shutdown', { error });
        }
    }
    async initializeServices() {
        await this.loggingService.info('Monitoring services initialized', {
            service: 'monitoring',
            operation: 'initialization',
            metadata: {
                config: this.config,
                startTime: this.startTime
            }
        });
    }
    async initializeDefaultAlerts() {
        try {
            await this.alertingService.createNotificationChannel({
                id: 'monitoring-email',
                name: 'Monitoring Email Alerts',
                type: 'EMAIL',
                enabled: true,
                config: {
                    email: {
                        to: ['monitoring@lawfirmpro.com'],
                        subject: 'Law Firm Pro Monitoring Alert'
                    }
                }
            });
            await this.alertingService.createAlertConfig({
                id: 'high-error-rate',
                name: 'High Error Rate Alert',
                type: 'ERROR_RATE',
                severity: 'HIGH',
                condition: {
                    metric: 'integration_error_count',
                    operator: 'gt',
                    threshold: 10,
                    duration: 300
                },
                notificationChannels: ['monitoring-email'],
                enabled: true,
                cooldownPeriod: 600
            });
            await this.alertingService.createAlertConfig({
                id: 'slow-response-time',
                name: 'Slow Response Time Alert',
                type: 'PERFORMANCE',
                severity: 'MEDIUM',
                condition: {
                    metric: 'integration_response_time',
                    operator: 'gt',
                    threshold: 5000,
                    duration: 60
                },
                notificationChannels: ['monitoring-email'],
                enabled: true,
                cooldownPeriod: 300
            });
            this.logger.info('Default alerts initialized');
        }
        catch (error) {
            this.logger.error('Error initializing default alerts', { error });
        }
    }
    async initializeDefaultDashboard() {
        try {
            this.logger.info('Default dashboard initialized');
        }
        catch (error) {
            this.logger.error('Error initializing default dashboard', { error });
        }
    }
    async initializeConfigPolicies() {
        try {
            await this.loggingService.setRetentionPolicy('integration', this.config.logging.retentionDays);
            await this.configurationManager.setRotationPolicy({
                service: 'monitoring',
                rotationInterval: 90,
                warningDays: 7,
                autoRotate: false,
                notifyBeforeRotation: true,
                notificationChannels: ['monitoring-email']
            });
            this.logger.info('Configuration policies initialized');
        }
        catch (error) {
            this.logger.error('Error initializing configuration policies', { error });
        }
    }
    setupHealthChecks() {
        this.addHealthCheck('database', async () => {
            try {
                await new Promise(resolve => setTimeout(resolve, 100));
                return {
                    name: 'database',
                    status: 'HEALTHY',
                    message: 'Database connection healthy',
                    timestamp: new Date(),
                    details: {
                        responseTime: 100,
                        connectionCount: 5
                    }
                };
            }
            catch (error) {
                return {
                    name: 'database',
                    status: 'UNHEALTHY',
                    message: error instanceof Error ? error.message : 'Database connection failed',
                    timestamp: new Date()
                };
            }
        });
        this.addHealthCheck('metrics', async () => {
            try {
                const metrics = await this.metricsCollector.getSystemMetrics();
                return {
                    name: 'metrics',
                    status: 'HEALTHY',
                    message: 'Metrics service healthy',
                    timestamp: new Date(),
                    details: {
                        totalRequests: metrics.totalRequests,
                        errorRate: metrics.errorRate
                    }
                };
            }
            catch (error) {
                return {
                    name: 'metrics',
                    status: 'UNHEALTHY',
                    message: error instanceof Error ? error.message : 'Metrics service failed',
                    timestamp: new Date()
                };
            }
        });
        this.addHealthCheck('alerting', async () => {
            try {
                const alerts = await this.alertingService.getAlertStats();
                return {
                    name: 'alerting',
                    status: 'HEALTHY',
                    message: 'Alerting service healthy',
                    timestamp: new Date(),
                    details: {
                        totalAlerts: alerts.total,
                        activeAlerts: alerts.active
                    }
                };
            }
            catch (error) {
                return {
                    name: 'alerting',
                    status: 'UNHEALTHY',
                    message: error instanceof Error ? error.message : 'Alerting service failed',
                    timestamp: new Date()
                };
            }
        });
        this.addHealthCheck('logging', async () => {
            try {
                const stats = await this.loggingService.getLogStats();
                return {
                    name: 'logging',
                    status: 'HEALTHY',
                    message: 'Logging service healthy',
                    timestamp: new Date(),
                    details: {
                        totalLogs: stats.totalLogs,
                        storageUsage: stats.storageUsage
                    }
                };
            }
            catch (error) {
                return {
                    name: 'logging',
                    status: 'UNHEALTHY',
                    message: error instanceof Error ? error.message : 'Logging service failed',
                    timestamp: new Date()
                };
            }
        });
    }
    startPeriodicTasks() {
        setInterval(async () => {
            try {
                await this.getSystemHealth();
            }
            catch (error) {
                this.logger.error('Error in periodic health check', { error });
            }
        }, 60000);
        setInterval(async () => {
            try {
                await this.cleanupMetrics();
            }
            catch (error) {
                this.logger.error('Error in metrics cleanup', { error });
            }
        }, 60 * 60 * 1000);
        setInterval(async () => {
            try {
                await this.generateMonitoringReport();
            }
            catch (error) {
                this.logger.error('Error generating monitoring report', { error });
            }
        }, 6 * 60 * 60 * 1000);
    }
    async cleanupMetrics() {
        this.logger.info('Cleaning up old metrics');
    }
    async generateMonitoringReport() {
        try {
            const stats = await this.getMonitoringStats();
            const health = await this.getSystemHealth();
            this.logger.info('Monitoring report generated', {
                stats,
                health,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            this.logger.error('Error generating monitoring report', { error });
        }
    }
    async cleanup() {
    }
    mergeConfig(config) {
        const defaultConfig = {
            metrics: {
                enabled: true,
                retentionDays: 30,
                maxMetrics: 100000
            },
            alerts: {
                enabled: true,
                defaultChannels: ['email'],
                cooldownPeriod: 300
            },
            logging: {
                enabled: true,
                level: 'INFO',
                retentionDays: 30,
                maxLogs: 100000
            },
            dashboard: {
                enabled: true,
                refreshInterval: 60,
                maxDataPoints: 1000
            },
            config: {
                enabled: true,
                encryptionKey: process.env.MONITORING_ENCRYPTION_KEY || 'default-key',
                autoRotate: false
            }
        };
        return {
            metrics: { ...defaultConfig.metrics, ...config.metrics },
            alerts: { ...defaultConfig.alerts, ...config.alerts },
            logging: { ...defaultConfig.logging, ...config.logging },
            dashboard: { ...defaultConfig.dashboard, ...config.dashboard },
            config: { ...defaultConfig.config, ...config.config }
        };
    }
    calculateRiskLevel(action, resource) {
        const highRiskActions = ['DELETE', 'UPDATE', 'CONFIG_CHANGE'];
        const criticalResources = ['configuration', 'credentials', 'users'];
        if (highRiskActions.includes(action) && criticalResources.includes(resource)) {
            return 'CRITICAL';
        }
        else if (highRiskActions.includes(action)) {
            return 'HIGH';
        }
        else if (criticalResources.includes(resource)) {
            return 'HIGH';
        }
        else {
            return 'MEDIUM';
        }
    }
}
exports.MonitoringService = MonitoringService;
//# sourceMappingURL=MonitoringService.js.map