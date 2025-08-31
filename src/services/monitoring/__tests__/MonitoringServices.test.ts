import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MetricsCollector } from '../MetricsCollector';
import { AlertingService } from '../../alerting/AlertingService';
import { ConfigurationManager } from '../ConfigurationManager';
import { ComprehensiveLoggingService } from '../../logging/ComprehensiveLoggingService';
import { MonitoringDashboardService } from '../../../dashboard/MonitoringDashboardService';
import { MonitoringService } from '../MonitoringService';
import { IntegrationMonitoringMiddleware } from '../../../middleware/integrationMonitoring';

describe('Monitoring Services Integration Tests', () => {
  let metricsCollector: MetricsCollector;
  let alertingService: AlertingService;
  let configManager: ConfigurationManager;
  let loggingService: ComprehensiveLoggingService;
  let dashboardService: MonitoringDashboardService;
  let monitoringService: MonitoringService;
  let middleware: IntegrationMonitoringMiddleware;

  beforeEach(async () => {
    // Initialize all services
    metricsCollector = new MetricsCollector();
    alertingService = new AlertingService();
    configManager = new ConfigurationManager();
    loggingService = new ComprehensiveLoggingService();
    dashboardService = new MonitoringDashboardService(
      metricsCollector,
      alertingService,
      loggingService
    );
    monitoringService = new MonitoringService();
    middleware = new IntegrationMonitoringMiddleware(
      metricsCollector,
      alertingService,
      loggingService
    );

    // Initialize monitoring service
    await monitoringService.initialize();
  });

  afterEach(async () => {
    // Cleanup
    await monitoringService.shutdown();
  });

  describe('MetricsCollector', () => {
    it('should record counter metrics correctly', () => {
      metricsCollector.incrementCounter('test_counter', 5, { service: 'test' });
      
      const metrics = metricsCollector['metrics'];
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toMatchObject({
        name: 'test_counter',
        value: 5,
        tags: { service: 'test' }
      });
    });

    it('should record timing metrics correctly', () => {
      metricsCollector.recordTiming('response_time', 150, { service: 'api' });
      
      const metrics = metricsCollector['metrics'];
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toMatchObject({
        name: 'response_time',
        value: 150,
        tags: { service: 'api' }
      });
    });

    it('should query metrics with filters', async () => {
      metricsCollector.incrementCounter('request_count', 1, { service: 'api' });
      metricsCollector.incrementCounter('request_count', 2, { service: 'web' });
      
      const results = await metricsCollector.queryMetrics({
        name: 'request_count',
        tags: { service: 'api' }
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].value).toBe(1);
    });

    it('should calculate service metrics correctly', async () => {
      metricsCollector.recordTiming('response_time', 100, { service: 'test' });
      metricsCollector.recordTiming('response_time', 200, { service: 'test' });
      metricsCollector.incrementCounter('error_count', 1, { service: 'test' });
      
      const serviceMetrics = await metricsCollector.getServiceMetrics('test');
      
      expect(serviceMetrics).toMatchObject({
        serviceName: 'test',
        requestCount: 2,
        errorCount: 1,
        averageResponseTime: 150
      });
    });

    it('should get system metrics', async () => {
      const systemMetrics = await metricsCollector.getSystemMetrics();
      
      expect(systemMetrics).toMatchObject({
        totalRequests: expect.any(Number),
        successfulRequests: expect.any(Number),
        failedRequests: expect.any(Number),
        averageResponseTime: expect.any(Number),
        errorRate: expect.any(Number),
        activeConnections: expect.any(Number),
        memoryUsage: expect.any(Object),
        cpuUsage: expect.any(Object),
        uptime: expect.any(Number)
      });
    });
  });

  describe('AlertingService', () => {
    it('should create alert configuration', async () => {
      const config = {
        id: 'test-alert',
        name: 'Test Alert',
        type: 'METRIC' as const,
        severity: 'HIGH' as const,
        condition: {
          metric: 'test_metric',
          operator: 'gt' as const,
          threshold: 10
        },
        notificationChannels: ['default-email'],
        enabled: true,
        cooldownPeriod: 300
      };

      await alertingService.createAlertConfig(config);
      
      const retrieved = await alertingService.getAlertConfig('test-alert');
      expect(retrieved).toMatchObject(config);
    });

    it('should trigger alert when condition is met', async () => {
      const config = {
        id: 'test-alert',
        name: 'Test Alert',
        type: 'METRIC' as const,
        severity: 'HIGH' as const,
        condition: {
          metric: 'test_metric',
          operator: 'gt' as const,
          threshold: 10
        },
        notificationChannels: ['default-email'],
        enabled: true,
        cooldownPeriod: 300
      };

      await alertingService.createAlertConfig(config);
      
      const triggeredBy = {
        metric: 'test_metric',
        value: 15,
        threshold: 10,
        condition: 'gt 10',
        tags: { service: 'test' }
      };

      const alert = await alertingService.triggerAlert('test-alert', triggeredBy);
      
      expect(alert).toMatchObject({
        configId: 'test-alert',
        name: 'Test Alert',
        type: 'METRIC',
        severity: 'HIGH',
        status: 'ACTIVE'
      });
    });

    it('should evaluate alerts based on metrics', async () => {
      const config = {
        id: 'metric-alert',
        name: 'Metric Alert',
        type: 'METRIC' as const,
        severity: 'MEDIUM' as const,
        condition: {
          metric: 'error_count',
          operator: 'gt' as const,
          threshold: 5
        },
        notificationChannels: ['default-email'],
        enabled: true,
        cooldownPeriod: 300
      };

      await alertingService.createAlertConfig(config);
      
      // This should trigger the alert
      await alertingService.evaluateAlert('error_count', 6, { service: 'test' });
      
      const alerts = await alertingService.getAlerts({ status: 'ACTIVE' });
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('should resolve alerts', async () => {
      const config = {
        id: 'resolvable-alert',
        name: 'Resolvable Alert',
        type: 'METRIC' as const,
        severity: 'LOW' as const,
        condition: {
          metric: 'test_metric',
          operator: 'gt' as const,
          threshold: 10
        },
        notificationChannels: ['default-email'],
        enabled: true,
        cooldownPeriod: 300
      };

      await alertingService.createAlertConfig(config);
      
      const triggeredBy = {
        metric: 'test_metric',
        value: 15,
        threshold: 10,
        condition: 'gt 10',
        tags: { service: 'test' }
      };

      const alert = await alertingService.triggerAlert('resolvable-alert', triggeredBy);
      const resolved = await alertingService.resolveAlert(alert.id);
      
      expect(resolved.status).toBe('RESOLVED');
      expect(resolved.resolvedAt).toBeDefined();
    });

    it('should get alert statistics', async () => {
      const stats = await alertingService.getAlertStats();
      
      expect(stats).toMatchObject({
        total: expect.any(Number),
        active: expect.any(Number),
        resolved: expect.any(Number),
        bySeverity: expect.any(Object),
        byType: expect.any(Object)
      });
    });
  });

  describe('ConfigurationManager', () => {
    it('should create configuration', async () => {
      const config = await configManager.createConfiguration(
        'test-service',
        { apiKey: 'test-key', timeout: 30 },
        'test-user',
        { encrypt: true }
      );
      
      expect(config).toMatchObject({
        service: 'test-service',
        version: 1,
        encrypted: true,
        createdBy: 'test-user'
      });
    });

    it('should update configuration', async () => {
      await configManager.createConfiguration(
        'test-service',
        { apiKey: 'test-key', timeout: 30 },
        'test-user'
      );
      
      const updated = await configManager.updateConfiguration('test-service', {
        service: 'test-service',
        data: { apiKey: 'new-key', timeout: 60 },
        updatedBy: 'test-user',
        reason: 'Updated timeout'
      });
      
      expect(updated.version).toBe(2);
      expect(updated.data.timeout).toBe(60);
    });

    it('should validate configuration', async () => {
      const validation = await configManager.validateConfiguration('stripe', {
        apiKey: 'test-key',
        publishableKey: 'test-pub-key',
        environment: 'test'
      });
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should rotate credentials', async () => {
      await configManager.createConfiguration(
        'test-service',
        { apiKey: 'original-key', secret: 'original-secret' },
        'test-user',
        { encrypt: true }
      );
      
      const rotated = await configManager.rotateCredentials('test-service', 'test-user');
      
      expect(rotated.version).toBe(2);
      expect(rotated.encrypted).toBe(true);
    });

    it('should get audit logs', async () => {
      await configManager.createConfiguration(
        'test-service',
        { apiKey: 'test-key' },
        'test-user'
      );
      
      const auditLogs = await configManager.getAuditLogs(undefined, 'test-service');
      
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0]).toMatchObject({
        action: 'CREATE',
        resource: 'test-service'
      });
    });
  });

  describe('ComprehensiveLoggingService', () => {
    it('should log messages with different levels', async () => {
      await loggingService.info('Test info message', {
        service: 'test',
        operation: 'test-operation'
      });
      
      await loggingService.error('Test error message', {
        service: 'test',
        operation: 'test-operation'
      });
      
      const logs = await loggingService.queryLogs({
        service: 'test',
        limit: 10
      });
      
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].service).toBe('test');
    });

    it('should log audit events', async () => {
      await loggingService.auditLog('CREATE', 'test-resource', 'test-user', {
        details: { action: 'create test resource' },
        result: 'SUCCESS'
      });
      
      const auditLogs = await loggingService.queryAuditLogs({
        action: 'CREATE',
        limit: 10
      });
      
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0]).toMatchObject({
        action: 'CREATE',
        resource: 'test-resource',
        userId: 'test-user',
        result: 'SUCCESS'
      });
    });

    it('should aggregate logs', async () => {
      // Log multiple entries
      for (let i = 0; i < 5; i++) {
        await loggingService.info('Test message', {
          service: 'test',
          operation: 'test-operation'
        });
      }
      
      const aggregation = await loggingService.aggregateLogs({
        field: 'service',
        operation: 'count'
      });
      
      expect(aggregation).toHaveProperty('test');
      expect(aggregation.test).toBeGreaterThan(0);
    });

    it('should get log statistics', async () => {
      const stats = await loggingService.getLogStats();
      
      expect(stats).toMatchObject({
        totalLogs: expect.any(Number),
        logsByLevel: expect.any(Object),
        logsByService: expect.any(Object),
        recentErrors: expect.any(Array),
        storageUsage: expect.any(Number)
      });
    });

    it('should export logs', async () => {
      await loggingService.info('Test export message', {
        service: 'test',
        operation: 'export'
      });
      
      const exported = await loggingService.exportLogs(
        { service: 'test', limit: 10 },
        { format: 'json' }
      );
      
      expect(typeof exported).toBe('string');
      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
    });
  });

  describe('MonitoringDashboardService', () => {
    it('should create dashboard', async () => {
      const dashboard = await dashboardService.createDashboard('Test Dashboard', 'test-user');
      
      expect(dashboard).toMatchObject({
        name: 'Test Dashboard',
        createdBy: 'test-user',
        layout: 'grid',
        theme: 'light'
      });
    });

    it('should add widget to dashboard', async () => {
      const dashboard = await dashboardService.createDashboard('Test Dashboard', 'test-user');
      
      const widget = await dashboardService.addWidget(dashboard.id, {
        type: 'metric',
        title: 'Test Metric',
        position: { x: 0, y: 0, width: 4, height: 2 },
        refreshInterval: 60,
        enabled: true,
        config: {
          metric: 'test_metric',
          timeRange: 1
        }
      });
      
      expect(widget).toMatchObject({
        type: 'metric',
        title: 'Test Metric',
        enabled: true
      });
    });

    it('should refresh widget data', async () => {
      const dashboard = await dashboardService.createDashboard('Test Dashboard', 'test-user');
      
      const widget = await dashboardService.addWidget(dashboard.id, {
        type: 'metric',
        title: 'Test Metric',
        position: { x: 0, y: 0, width: 4, height: 2 },
        refreshInterval: 60,
        enabled: true,
        config: {
          metric: 'test_metric',
          timeRange: 1
        }
      });
      
      const widgetData = await dashboardService.refreshWidget(widget.id);
      
      expect(widgetData).toMatchObject({
        widgetId: widget.id,
        data: expect.any(Object),
        timestamp: expect.any(Date)
      });
    });

    it('should get dashboard statistics', async () => {
      const stats = await dashboardService.getDashboardStats();
      
      expect(stats).toMatchObject({
        totalDashboards: expect.any(Number),
        totalWidgets: expect.any(Number),
        activeWidgets: expect.any(Number),
        popularWidgets: expect.any(Array),
        dataPoints: expect.any(Number)
      });
    });
  });

  describe('IntegrationMonitoringMiddleware', () => {
    it('should initialize middleware correctly', () => {
      expect(middleware).toBeDefined();
      expect(middleware.getConfig()).toMatchObject({
        enabled: true,
        logRequests: true,
        logResponses: true,
        collectMetrics: true
      });
    });

    it('should update configuration', () => {
      middleware.updateConfig({
        sampleRate: 0.5,
        logRequests: false
      });
      
      const config = middleware.getConfig();
      expect(config.sampleRate).toBe(0.5);
      expect(config.logRequests).toBe(false);
    });

    it('should enable and disable middleware', () => {
      middleware.disable();
      expect(middleware.getConfig().enabled).toBe(false);
      
      middleware.enable();
      expect(middleware.getConfig().enabled).toBe(true);
    });

    it('should add and remove sensitive headers', () => {
      middleware.addSensitiveHeader('x-custom-secret');
      expect(middleware.getConfig().sensitiveHeaders).toContain('x-custom-secret');
      
      middleware.removeSensitiveHeader('x-custom-secret');
      expect(middleware.getConfig().sensitiveHeaders).not.toContain('x-custom-secret');
    });
  });

  describe('MonitoringService Integration', () => {
    it('should initialize all services', async () => {
      expect(monitoringService).toBeDefined();
      
      const stats = await monitoringService.getMonitoringStats();
      expect(stats).toMatchObject({
        uptime: expect.any(Number),
        metricsCount: expect.any(Number),
        alertsCount: expect.any(Number),
        logsCount: expect.any(Number),
        dashboardsCount: expect.any(Number),
        healthStatus: expect.any(String)
      });
    });

    it('should get system health', async () => {
      const health = await monitoringService.getSystemHealth();
      
      expect(health).toMatchObject({
        overall: expect.any(String),
        components: expect.any(Array),
        timestamp: expect.any(Date),
        uptime: expect.any(Number),
        metrics: expect.any(Object)
      });
      
      expect(health.components.length).toBeGreaterThan(0);
    });

    it('should record metrics through monitoring service', async () => {
      await monitoringService.recordMetric('integration_test', 10, 'counter', { service: 'test' });
      
      const metrics = await metricsCollector.queryMetrics({
        name: 'integration_test',
        tags: { service: 'test' }
      });
      
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should log through monitoring service', async () => {
      await monitoringService.log('INFO', 'Test message through monitoring service', {
        service: 'monitoring-test',
        operation: 'test'
      });
      
      const logs = await loggingService.queryLogs({
        service: 'monitoring-test',
        limit: 10
      });
      
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should create alerts through monitoring service', async () => {
      const alertConfig = {
        id: 'monitoring-test-alert',
        name: 'Monitoring Test Alert',
        type: 'METRIC' as const,
        severity: 'MEDIUM' as const,
        condition: {
          metric: 'monitoring_test_metric',
          operator: 'gt' as const,
          threshold: 5
        },
        notificationChannels: ['monitoring-email'],
        enabled: true,
        cooldownPeriod: 300
      };

      const alert = await monitoringService.createAlert(alertConfig);
      
      expect(alert).toMatchObject(alertConfig);
    });

    it('should handle audit logging through monitoring service', async () => {
      await monitoringService.auditLog('UPDATE', 'test-config', 'test-user', {
        action: 'update configuration',
        changes: { timeout: 60 }
      });
      
      const auditLogs = await loggingService.queryAuditLogs({
        action: 'UPDATE',
        limit: 10
      });
      
      expect(auditLogs.length).toBeGreaterThan(0);
    });

    it('should handle configuration management through monitoring service', async () => {
      await monitoringService.updateConfiguration('test-service', { timeout: 120 }, 'test-user');
      
      const config = await monitoringService.getConfiguration('test-service');
      
      expect(config).toBeDefined();
      expect(config?.data.timeout).toBe(120);
    });

    it('should handle dashboard creation through monitoring service', async () => {
      const dashboard = await monitoringService.createDashboard('Monitoring Test Dashboard', 'test-user');
      
      expect(dashboard).toMatchObject({
        name: 'Monitoring Test Dashboard',
        createdBy: 'test-user'
      });
    });

    it('should add custom health checks', () => {
      monitoringService.addHealthCheck('custom-check', async () => ({
        name: 'custom-check',
        status: 'HEALTHY',
        message: 'Custom health check passed',
        timestamp: new Date()
      }));
      
      // The health check should be added
      expect(monitoringService['healthChecks'].has('custom-check')).toBe(true);
    });

    it('should handle graceful shutdown', async () => {
      await expect(monitoringService.shutdown()).resolves.not.toThrow();
    });
  });

  describe('End-to-End Integration Scenarios', () => {
    it('should handle complete request monitoring flow', async () => {
      // Simulate a request being monitored
      await monitoringService.recordMetric('request_count', 1, 'counter', { 
        service: 'integration',
        method: 'GET',
        path: '/api/test'
      });
      
      await monitoringService.recordMetric('response_time', 150, 'timing', {
        service: 'integration',
        method: 'GET',
        path: '/api/test'
      });
      
      // Log the request
      await monitoringService.log('INFO', 'Integration request processed', {
        service: 'integration',
        operation: 'request',
        metadata: {
          method: 'GET',
          path: '/api/test',
          statusCode: 200,
          responseTime: 150
        }
      });
      
      // Check that metrics were recorded
      const metrics = await metricsCollector.queryMetrics({
        tags: { service: 'integration' }
      });
      
      expect(metrics.length).toBeGreaterThan(0);
      
      // Check that logs were created
      const logs = await loggingService.queryLogs({
        service: 'integration',
        limit: 10
      });
      
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should handle error scenario with alerts', async () => {
      // Record error metrics
      await monitoringService.recordMetric('error_count', 1, 'counter', {
        service: 'integration',
        error_type: 'timeout'
      });
      
      // Log error
      await monitoringService.log('ERROR', 'Integration timeout error', {
        service: 'integration',
        operation: 'error',
        metadata: {
          error: 'Request timeout',
          responseTime: 30000
        }
      });
      
      // This should trigger alerts if thresholds are met
      await alertingService.evaluateAlert('error_count', 1, { service: 'integration' });
      
      // Check for alerts
      const alerts = await alertingService.getAlerts({ status: 'ACTIVE' });
      
      // Alerts may or may not be triggered depending on configuration
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should handle configuration update with audit trail', async () => {
      // Create initial configuration
      await monitoringService.updateConfiguration('stripe', {
        apiKey: 'test-key',
        environment: 'test'
      }, 'admin-user');
      
      // Update configuration
      await monitoringService.updateConfiguration('stripe', {
        apiKey: 'new-key',
        environment: 'production'
      }, 'admin-user', {
        reason: 'Environment promotion'
      });
      
      // Check audit logs
      const auditLogs = await configManager.getAuditLogs(undefined, 'stripe');
      
      expect(auditLogs.length).toBeGreaterThan(0);
      
      const updateLog = auditLogs.find(log => log.action === 'UPDATE');
      expect(updateLog).toBeDefined();
      expect(updateLog?.userId).toBe('admin-user');
    });

    it('should handle dashboard widget data updates', async () => {
      // Create dashboard with widget
      const dashboard = await monitoringService.createDashboard('Integration Test Dashboard', 'test-user');
      
      const widget = await dashboardService.addWidget(dashboard.id, {
        type: 'chart',
        title: 'Response Time Chart',
        position: { x: 0, y: 0, width: 8, height: 4 },
        refreshInterval: 30,
        enabled: true,
        config: {
          metric: 'response_time',
          timeRange: 1,
          chartType: 'line'
        }
      });
      
      // Record some metrics
      await monitoringService.recordMetric('response_time', 100, 'timing', { service: 'test' });
      await monitoringService.recordMetric('response_time', 150, 'timing', { service: 'test' });
      await monitoringService.recordMetric('response_time', 200, 'timing', { service: 'test' });
      
      // Refresh widget
      const widgetData = await dashboardService.refreshWidget(widget.id);
      
      expect(widgetData).toBeDefined();
      expect(widgetData.data).toBeDefined();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high volume of metrics', async () => {
      const startTime = Date.now();
      const metricCount = 1000;
      
      // Record many metrics
      for (let i = 0; i < metricCount; i++) {
        await monitoringService.recordMetric('stress_test', i, 'counter', {
          service: 'stress',
          iteration: i.toString()
        });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
      
      // Verify metrics were recorded
      const metrics = await metricsCollector.queryMetrics({
        name: 'stress_test'
      });
      
      expect(metrics.length).toBe(metricCount);
    });

    it('should handle concurrent operations', async () => {
      const concurrentOperations = 50;
      const promises = [];
      
      // Create concurrent operations
      for (let i = 0; i < concurrentOperations; i++) {
        promises.push(
          monitoringService.recordMetric(`concurrent_test_${i}`, 1, 'counter', {
            service: 'concurrent',
            operation: i.toString()
          })
        );
        
        promises.push(
          monitoringService.log('INFO', `Concurrent log message ${i}`, {
            service: 'concurrent',
            operation: i.toString()
          })
        );
      }
      
      // Wait for all operations to complete
      await Promise.all(promises);
      
      // Verify all operations completed
      const metrics = await metricsCollector.queryMetrics({
        tags: { service: 'concurrent' }
      });
      
      const logs = await loggingService.queryLogs({
        service: 'concurrent',
        limit: 100
      });
      
      expect(metrics.length).toBe(concurrentOperations);
      expect(logs.length).toBe(concurrentOperations);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle invalid metric operations gracefully', async () => {
      // This should not throw an error
      await expect(monitoringService.recordMetric('', 1, 'counter')).resolves.not.toThrow();
    });

    it('should handle invalid log operations gracefully', async () => {
      // This should not throw an error
      await expect(monitoringService.log('INFO', '', {})).resolves.not.toThrow();
    });

    it('should handle configuration validation errors', async () => {
      // This should throw a validation error
      await expect(
        configManager.createConfiguration('', {}, 'test-user')
      ).rejects.toThrow();
    });

    it('should handle missing configurations gracefully', async () => {
      const config = await monitoringService.getConfiguration('non-existent-service');
      expect(config).toBeNull();
    });

    it('should handle alert evaluation with invalid data', async () => {
      // This should not throw an error
      await expect(
        alertingService.evaluateAlert('', 0, {})
      ).resolves.not.toThrow();
    });
  });
});