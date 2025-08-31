import { Logger } from '../../utils/logger';
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

export class MonitoringService {
  private logger: Logger;
  private metricsCollector: MetricsCollector;
  private alertingService: AlertingService;
  private configurationManager: ConfigurationManager;
  private loggingService: ComprehensiveLoggingService;
  private dashboardService: MonitoringDashboardService;
  private config: MonitoringServiceConfig;
  private startTime: Date;
  private healthChecks: Map<string, () => Promise<HealthCheck>>;

  constructor(config: Partial<MonitoringServiceConfig> = {}) {
    this.logger = new Logger('MonitoringService');
    this.startTime = new Date();
    
    // Initialize services
    this.metricsCollector = new MetricsCollector();
    this.alertingService = new AlertingService();
    this.configurationManager = new ConfigurationManager();
    this.loggingService = new ComprehensiveLoggingService();
    this.dashboardService = new MonitoringDashboardService(
      this.metricsCollector,
      this.alertingService,
      this.loggingService
    );

    // Configuration
    this.config = this.mergeConfig(config);
    
    // Health checks
    this.healthChecks = new Map();
    
    this.initializeServices();
    this.setupHealthChecks();
    this.startPeriodicTasks();
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing monitoring service');
      
      // Initialize default alert configurations
      await this.initializeDefaultAlerts();
      
      // Initialize default dashboard
      await this.initializeDefaultDashboard();
      
      // Initialize configuration policies
      await this.initializeConfigPolicies();
      
      this.logger.info('Monitoring service initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing monitoring service', { error });
      throw error;
    }
  }

  // Metrics methods
  getMetricsCollector(): MetricsCollector {
    return this.metricsCollector;
  }

  async recordMetric(
    name: string,
    value: number,
    type: 'counter' | 'gauge' | 'timing',
    tags: Record<string, string> = {}
  ): Promise<void> {
    if (!this.config.metrics.enabled) return;

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
    } catch (error) {
      this.logger.error('Error recording metric', { error, name, value, type, tags });
    }
  }

  // Alerting methods
  getAlertingService(): AlertingService {
    return this.alertingService;
  }

  async createAlert(config: any): Promise<any> {
    if (!this.config.alerts.enabled) {
      throw new Error('Alerting is disabled');
    }

    return this.alertingService.createAlertConfig(config);
  }

  async triggerAlert(type: string, message: string, severity: string, metadata?: any): Promise<void> {
    if (!this.config.alerts.enabled) return;

    try {
      this.loggingService.warn('Alert triggered', {
        service: 'monitoring',
        operation: 'alert',
        metadata: { type, message, severity, metadata },
        tags: ['alert', 'monitoring']
      });
    } catch (error) {
      this.logger.error('Error triggering alert', { error, type, message, severity });
    }
  }

  // Configuration methods
  getConfigurationManager(): ConfigurationManager {
    return this.configurationManager;
  }

  async getConfiguration(service: string): Promise<any> {
    if (!this.config.config.enabled) {
      throw new Error('Configuration management is disabled');
    }

    return this.configurationManager.getConfiguration(service);
  }

  async updateConfiguration(service: string, data: any, updatedBy: string): Promise<void> {
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

  // Logging methods
  getLoggingService(): ComprehensiveLoggingService {
    return this.loggingService;
  }

  async log(
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL',
    message: string,
    context: any
  ): Promise<void> {
    if (!this.config.logging.enabled) return;

    try {
      await this.loggingService.log(level, message, context);
    } catch (error) {
      this.logger.error('Error logging message', { error, level, message, context });
    }
  }

  async auditLog(action: string, resource: string, userId: string, details: any): Promise<void> {
    if (!this.config.logging.enabled) return;

    try {
      await this.loggingService.auditLog(action as any, resource, userId, {
        details,
        riskLevel: this.calculateRiskLevel(action, resource)
      });
    } catch (error) {
      this.logger.error('Error logging audit event', { error, action, resource, userId });
    }
  }

  // Dashboard methods
  getDashboardService(): MonitoringDashboardService {
    return this.dashboardService;
  }

  async createDashboard(name: string, createdBy: string): Promise<any> {
    if (!this.config.dashboard.enabled) {
      throw new Error('Dashboard is disabled');
    }

    return this.dashboardService.createDashboard(name, createdBy);
  }

  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const healthChecks: HealthCheck[] = [];
      
      // Run all health checks
      for (const [name, checkFn] of this.healthChecks.entries()) {
        try {
          const healthCheck = await checkFn();
          healthChecks.push(healthCheck);
        } catch (error) {
          healthChecks.push({
            name,
            status: 'UNHEALTHY',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date()
          });
        }
      }

      // Determine overall health
      const hasUnhealthy = healthChecks.some(h => h.status === 'UNHEALTHY');
      const hasDegraded = healthChecks.some(h => h.status === 'DEGRADED');
      
      const overall: SystemHealth['overall'] = hasUnhealthy 
        ? 'UNHEALTHY' 
        : hasDegraded 
          ? 'DEGRADED' 
          : 'HEALTHY';

      // Get system metrics
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
    } catch (error) {
      this.logger.error('Error getting system health', { error });
      throw error;
    }
  }

  async getMonitoringStats(): Promise<{
    uptime: number;
    metricsCount: number;
    alertsCount: number;
    logsCount: number;
    dashboardsCount: number;
    healthStatus: SystemHealth['overall'];
  }> {
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
    } catch (error) {
      this.logger.error('Error getting monitoring stats', { error });
      throw error;
    }
  }

  // Health check methods
  addHealthCheck(name: string, checkFn: () => Promise<HealthCheck>): void {
    this.healthChecks.set(name, checkFn);
    this.logger.info('Health check added', { name });
  }

  removeHealthCheck(name: string): void {
    this.healthChecks.delete(name);
    this.logger.info('Health check removed', { name });
  }

  // Configuration methods
  updateConfig(newConfig: Partial<MonitoringServiceConfig>): void {
    this.config = this.mergeConfig(newConfig);
    this.logger.info('Monitoring service configuration updated', { config: this.config });
  }

  getConfig(): MonitoringServiceConfig {
    return { ...this.config };
  }

  async shutdown(): Promise<void> {
    try {
      this.logger.info('Shutting down monitoring service');
      
      // Perform cleanup if needed
      await this.cleanup();
      
      this.logger.info('Monitoring service shutdown completed');
    } catch (error) {
      this.logger.error('Error during monitoring service shutdown', { error });
    }
  }

  private async initializeServices(): Promise<void> {
    // Log service initialization
    await this.loggingService.info('Monitoring services initialized', {
      service: 'monitoring',
      operation: 'initialization',
      metadata: {
        config: this.config,
        startTime: this.startTime
      }
    });
  }

  private async initializeDefaultAlerts(): Promise<void> {
    try {
      // Create default alert channels
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

      // Create default alert configurations
      await this.alertingService.createAlertConfig({
        id: 'high-error-rate',
        name: 'High Error Rate Alert',
        type: 'ERROR_RATE',
        severity: 'HIGH',
        condition: {
          metric: 'integration_error_count',
          operator: 'gt',
          threshold: 10,
          duration: 300 // 5 minutes
        },
        notificationChannels: ['monitoring-email'],
        enabled: true,
        cooldownPeriod: 600 // 10 minutes
      });

      await this.alertingService.createAlertConfig({
        id: 'slow-response-time',
        name: 'Slow Response Time Alert',
        type: 'PERFORMANCE',
        severity: 'MEDIUM',
        condition: {
          metric: 'integration_response_time',
          operator: 'gt',
          threshold: 5000, // 5 seconds
          duration: 60 // 1 minute
        },
        notificationChannels: ['monitoring-email'],
        enabled: true,
        cooldownPeriod: 300 // 5 minutes
      });

      this.logger.info('Default alerts initialized');
    } catch (error) {
      this.logger.error('Error initializing default alerts', { error });
    }
  }

  private async initializeDefaultDashboard(): Promise<void> {
    try {
      // Default dashboard is already created in the dashboard service
      this.logger.info('Default dashboard initialized');
    } catch (error) {
      this.logger.error('Error initializing default dashboard', { error });
    }
  }

  private async initializeConfigPolicies(): Promise<void> {
    try {
      // Set default retention policies
      await this.loggingService.setRetentionPolicy('integration', this.config.logging.retentionDays);
      
      // Set default rotation policies
      await this.configurationManager.setRotationPolicy({
        service: 'monitoring',
        rotationInterval: 90,
        warningDays: 7,
        autoRotate: false,
        notifyBeforeRotation: true,
        notificationChannels: ['monitoring-email']
      });

      this.logger.info('Configuration policies initialized');
    } catch (error) {
      this.logger.error('Error initializing configuration policies', { error });
    }
  }

  private setupHealthChecks(): void {
    // Database health check
    this.addHealthCheck('database', async () => {
      try {
        // In a real implementation, this would check database connectivity
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
      } catch (error) {
        return {
          name: 'database',
          status: 'UNHEALTHY',
          message: error instanceof Error ? error.message : 'Database connection failed',
          timestamp: new Date()
        };
      }
    });

    // Metrics service health check
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
      } catch (error) {
        return {
          name: 'metrics',
          status: 'UNHEALTHY',
          message: error instanceof Error ? error.message : 'Metrics service failed',
          timestamp: new Date()
        };
      }
    });

    // Alerting service health check
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
      } catch (error) {
        return {
          name: 'alerting',
          status: 'UNHEALTHY',
          message: error instanceof Error ? error.message : 'Alerting service failed',
          timestamp: new Date()
        };
      }
    });

    // Logging service health check
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
      } catch (error) {
        return {
          name: 'logging',
          status: 'UNHEALTHY',
          message: error instanceof Error ? error.message : 'Logging service failed',
          timestamp: new Date()
        };
      }
    });
  }

  private startPeriodicTasks(): void {
    // Health check every minute
    setInterval(async () => {
      try {
        await this.getSystemHealth();
      } catch (error) {
        this.logger.error('Error in periodic health check', { error });
      }
    }, 60000);

    // Metrics cleanup every hour
    setInterval(async () => {
      try {
        await this.cleanupMetrics();
      } catch (error) {
        this.logger.error('Error in metrics cleanup', { error });
      }
    }, 60 * 60 * 1000);

    // Generate monitoring report every 6 hours
    setInterval(async () => {
      try {
        await this.generateMonitoringReport();
      } catch (error) {
        this.logger.error('Error generating monitoring report', { error });
      }
    }, 6 * 60 * 60 * 1000);
  }

  private async cleanupMetrics(): Promise<void> {
    this.logger.info('Cleaning up old metrics');
    // Metrics cleanup is handled by the individual services
  }

  private async generateMonitoringReport(): Promise<void> {
    try {
      const stats = await this.getMonitoringStats();
      const health = await this.getSystemHealth();
      
      this.logger.info('Monitoring report generated', {
        stats,
        health,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error generating monitoring report', { error });
    }
  }

  private async cleanup(): Promise<void> {
    // Clear any pending timers
    // This would be implemented with actual timer management
  }

  private mergeConfig(config: Partial<MonitoringServiceConfig>): MonitoringServiceConfig {
    const defaultConfig: MonitoringServiceConfig = {
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

  private calculateRiskLevel(action: string, resource: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const highRiskActions = ['DELETE', 'UPDATE', 'CONFIG_CHANGE'];
    const criticalResources = ['configuration', 'credentials', 'users'];
    
    if (highRiskActions.includes(action) && criticalResources.includes(resource)) {
      return 'CRITICAL';
    } else if (highRiskActions.includes(action)) {
      return 'HIGH';
    } else if (criticalResources.includes(resource)) {
      return 'HIGH';
    } else {
      return 'MEDIUM';
    }
  }
}