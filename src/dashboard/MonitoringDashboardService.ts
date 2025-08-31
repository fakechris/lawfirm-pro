import { Logger } from '../../utils/logger';
import { MetricsCollector } from '../monitoring/MetricsCollector';
import { AlertingService } from '../alerting/AlertingService';
import { ComprehensiveLoggingService } from '../logging/ComprehensiveLoggingService';

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  description?: string;
  config: WidgetConfig;
  position: { x: number; y: number; width: number; height: number };
  refreshInterval: number; // in seconds
  enabled: boolean;
}

export interface WidgetConfig {
  metric?: string;
  timeRange?: number; // in hours
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  filters?: Record<string, any>;
  chartType?: ChartType;
  limit?: number;
  threshold?: number;
  thresholdType?: 'above' | 'below';
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  layout: 'grid' | 'flex';
  theme: 'light' | 'dark';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  sharedWith?: string[];
  isPublic: boolean;
}

export interface WidgetData {
  widgetId: string;
  data: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface DashboardExport {
  dashboard: Dashboard;
  widgets: WidgetData[];
  exportFormat: 'json' | 'pdf' | 'png';
  timestamp: Date;
}

export type WidgetType = 
  | 'metric' | 'chart' | 'table' | 'gauge' | 'heatmap' 
  | 'log' | 'alert' | 'health' | 'map' | 'text';
export type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'timeline';

export class MonitoringDashboardService {
  private logger: Logger;
  private metricsCollector: MetricsCollector;
  private alertingService: AlertingService;
  private loggingService: ComprehensiveLoggingService;
  private dashboards: Map<string, Dashboard>;
  private widgetData: Map<string, WidgetData[]>;
  private refreshTimers: Map<string, NodeJS.Timeout>;
  private subscribers: Map<string, Set<(data: WidgetData) => void>>;

  constructor(
    metricsCollector: MetricsCollector,
    alertingService: AlertingService,
    loggingService: ComprehensiveLoggingService
  ) {
    this.logger = new Logger('MonitoringDashboardService');
    this.metricsCollector = metricsCollector;
    this.alertingService = alertingService;
    this.loggingService = loggingService;
    this.dashboards = new Map();
    this.widgetData = new Map();
    this.refreshTimers = new Map();
    this.subscribers = new Map();
    
    this.initializeDefaultDashboards();
    this.startPeriodicTasks();
  }

  async createDashboard(
    name: string,
    createdBy: string,
    options: {
      description?: string;
      layout?: Dashboard['layout'];
      theme?: Dashboard['theme'];
      isPublic?: boolean;
      sharedWith?: string[];
    } = {}
  ): Promise<Dashboard> {
    try {
      const dashboard: Dashboard = {
        id: this.generateDashboardId(),
        name,
        description: options.description,
        widgets: [],
        layout: options.layout || 'grid',
        theme: options.theme || 'light',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy,
        sharedWith: options.sharedWith || [],
        isPublic: options.isPublic || false
      };

      this.dashboards.set(dashboard.id, dashboard);
      
      this.logger.info('Dashboard created', { 
        dashboardId: dashboard.id, 
        name, 
        createdBy 
      });

      return dashboard;
    } catch (error) {
      this.logger.error('Error creating dashboard', { error, name, createdBy });
      throw error;
    }
  }

  async updateDashboard(
    id: string,
    updates: Partial<Dashboard>
  ): Promise<Dashboard> {
    try {
      const existing = this.dashboards.get(id);
      if (!existing) {
        throw new Error(`Dashboard not found: ${id}`);
      }

      const updated: Dashboard = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      };

      this.dashboards.set(id, updated);
      
      this.logger.info('Dashboard updated', { 
        dashboardId: id, 
        updates 
      });

      return updated;
    } catch (error) {
      this.logger.error('Error updating dashboard', { error, id, updates });
      throw error;
    }
  }

  async deleteDashboard(id: string): Promise<void> {
    try {
      const dashboard = this.dashboards.get(id);
      if (!dashboard) {
        throw new Error(`Dashboard not found: ${id}`);
      }

      this.dashboards.delete(id);
      
      // Clean up widget data
      dashboard.widgets.forEach(widget => {
        this.widgetData.delete(widget.id);
        
        // Clear refresh timers
        const timer = this.refreshTimers.get(widget.id);
        if (timer) {
          clearTimeout(timer);
          this.refreshTimers.delete(widget.id);
        }
      });

      this.logger.info('Dashboard deleted', { dashboardId: id });
    } catch (error) {
      this.logger.error('Error deleting dashboard', { error, id });
      throw error;
    }
  }

  async getDashboard(id: string): Promise<Dashboard | null> {
    return this.dashboards.get(id) || null;
  }

  async getAllDashboards(userId?: string): Promise<Dashboard[]> {
    const dashboards = Array.from(this.dashboards.values());
    
    if (userId) {
      return dashboards.filter(dashboard => 
        dashboard.createdBy === userId || 
        dashboard.isPublic || 
        dashboard.sharedWith?.includes(userId)
      );
    }
    
    return dashboards;
  }

  async addWidget(
    dashboardId: string,
    widget: Omit<DashboardWidget, 'id'> & { id?: string }
  ): Promise<DashboardWidget> {
    try {
      const dashboard = this.dashboards.get(dashboardId);
      if (!dashboard) {
        throw new Error(`Dashboard not found: ${dashboardId}`);
      }

      const newWidget: DashboardWidget = {
        ...widget,
        id: widget.id || this.generateWidgetId()
      };

      dashboard.widgets.push(newWidget);
      dashboard.updatedAt = new Date();
      
      this.dashboards.set(dashboardId, dashboard);
      
      // Initialize widget data
      this.widgetData.set(newWidget.id, []);
      
      // Start refresh timer if enabled
      if (newWidget.enabled && newWidget.refreshInterval > 0) {
        this.startWidgetRefresh(newWidget);
      }

      this.logger.info('Widget added to dashboard', { 
        dashboardId, 
        widgetId: newWidget.id,
        type: newWidget.type 
      });

      return newWidget;
    } catch (error) {
      this.logger.error('Error adding widget to dashboard', { error, dashboardId });
      throw error;
    }
  }

  async updateWidget(
    dashboardId: string,
    widgetId: string,
    updates: Partial<DashboardWidget>
  ): Promise<DashboardWidget> {
    try {
      const dashboard = this.dashboards.get(dashboardId);
      if (!dashboard) {
        throw new Error(`Dashboard not found: ${dashboardId}`);
      }

      const widgetIndex = dashboard.widgets.findIndex(w => w.id === widgetId);
      if (widgetIndex === -1) {
        throw new Error(`Widget not found: ${widgetId}`);
      }

      const existingWidget = dashboard.widgets[widgetIndex];
      const updatedWidget: DashboardWidget = {
        ...existingWidget,
        ...updates
      };

      dashboard.widgets[widgetIndex] = updatedWidget;
      dashboard.updatedAt = new Date();
      
      this.dashboards.set(dashboardId, dashboard);

      // Restart refresh timer if needed
      const timer = this.refreshTimers.get(widgetId);
      if (timer) {
        clearTimeout(timer);
        this.refreshTimers.delete(widgetId);
      }

      if (updatedWidget.enabled && updatedWidget.refreshInterval > 0) {
        this.startWidgetRefresh(updatedWidget);
      }

      this.logger.info('Widget updated', { 
        dashboardId, 
        widgetId,
        updates 
      });

      return updatedWidget;
    } catch (error) {
      this.logger.error('Error updating widget', { error, dashboardId, widgetId });
      throw error;
    }
  }

  async removeWidget(dashboardId: string, widgetId: string): Promise<void> {
    try {
      const dashboard = this.dashboards.get(dashboardId);
      if (!dashboard) {
        throw new Error(`Dashboard not found: ${dashboardId}`);
      }

      dashboard.widgets = dashboard.widgets.filter(w => w.id !== widgetId);
      dashboard.updatedAt = new Date();
      
      this.dashboards.set(dashboardId, dashboard);
      
      // Clean up widget data
      this.widgetData.delete(widgetId);
      
      // Clear refresh timer
      const timer = this.refreshTimers.get(widgetId);
      if (timer) {
        clearTimeout(timer);
        this.refreshTimers.delete(widgetId);
      }

      this.logger.info('Widget removed from dashboard', { 
        dashboardId, 
        widgetId 
      });
    } catch (error) {
      this.logger.error('Error removing widget from dashboard', { error, dashboardId, widgetId });
      throw error;
    }
  }

  async getWidgetData(widgetId: string, limit?: number): Promise<WidgetData[]> {
    const data = this.widgetData.get(widgetId) || [];
    return limit ? data.slice(-limit) : data;
  }

  async refreshWidget(widgetId: string): Promise<WidgetData> {
    try {
      const widget = this.findWidgetById(widgetId);
      if (!widget) {
        throw new Error(`Widget not found: ${widgetId}`);
      }

      const widgetData = await this.generateWidgetData(widget);
      
      // Store widget data
      const data = this.widgetData.get(widgetId) || [];
      data.push(widgetData);
      
      // Keep only last 100 data points
      if (data.length > 100) {
        data.splice(0, data.length - 100);
      }
      
      this.widgetData.set(widgetId, data);
      
      // Notify subscribers
      this.notifySubscribers(widgetId, widgetData);

      return widgetData;
    } catch (error) {
      this.logger.error('Error refreshing widget', { error, widgetId });
      throw error;
    }
  }

  async subscribeToWidget(widgetId: string, callback: (data: WidgetData) => void): Promise<void> {
    if (!this.subscribers.has(widgetId)) {
      this.subscribers.set(widgetId, new Set());
    }
    
    this.subscribers.get(widgetId)!.add(callback);
    
    this.logger.debug('Widget subscription added', { widgetId });
  }

  async unsubscribeFromWidget(widgetId: string, callback: (data: WidgetData) => void): Promise<void> {
    const subscribers = this.subscribers.get(widgetId);
    if (subscribers) {
      subscribers.delete(callback);
      
      if (subscribers.size === 0) {
        this.subscribers.delete(widgetId);
      }
    }
    
    this.logger.debug('Widget subscription removed', { widgetId });
  }

  async exportDashboard(
    dashboardId: string,
    format: DashboardExport['exportFormat']
  ): Promise<DashboardExport> {
    try {
      const dashboard = this.dashboards.get(dashboardId);
      if (!dashboard) {
        throw new Error(`Dashboard not found: ${dashboardId}`);
      }

      const widgets: WidgetData[] = [];
      
      for (const widget of dashboard.widgets) {
        const widgetData = await this.getWidgetData(widget.id, 10);
        widgets.push(...widgetData);
      }

      const exportData: DashboardExport = {
        dashboard,
        widgets,
        exportFormat: format,
        timestamp: new Date()
      };

      this.logger.info('Dashboard exported', { 
        dashboardId, 
        format,
        widgetCount: widgets.length 
      });

      return exportData;
    } catch (error) {
      this.logger.error('Error exporting dashboard', { error, dashboardId, format });
      throw error;
    }
  }

  async getDashboardStats(): Promise<{
    totalDashboards: number;
    totalWidgets: number;
    activeWidgets: number;
    popularWidgets: Array<{ type: WidgetType; count: number }>;
    dataPoints: number;
  }> {
    const dashboards = Array.from(this.dashboards.values());
    const allWidgets = dashboards.flatMap(d => d.widgets);
    
    const widgetTypes = new Map<WidgetType, number>();
    let totalDataPoints = 0;
    
    allWidgets.forEach(widget => {
      widgetTypes.set(widget.type, (widgetTypes.get(widget.type) || 0) + 1);
      totalDataPoints += this.widgetData.get(widget.id)?.length || 0;
    });

    const popularWidgets = Array.from(widgetTypes.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalDashboards: dashboards.length,
      totalWidgets: allWidgets.length,
      activeWidgets: allWidgets.filter(w => w.enabled).length,
      popularWidgets,
      dataPoints: totalDataPoints
    };
  }

  private async generateWidgetData(widget: DashboardWidget): Promise<WidgetData> {
    const now = new Date();
    let data: any;

    switch (widget.type) {
      case 'metric':
        data = await this.generateMetricData(widget);
        break;
      case 'chart':
        data = await this.generateChartData(widget);
        break;
      case 'table':
        data = await this.generateTableData(widget);
        break;
      case 'gauge':
        data = await this.generateGaugeData(widget);
        break;
      case 'heatmap':
        data = await this.generateHeatmapData(widget);
        break;
      case 'log':
        data = await this.generateLogData(widget);
        break;
      case 'alert':
        data = await this.generateAlertData(widget);
        break;
      case 'health':
        data = await this.generateHealthData(widget);
        break;
      default:
        data = { error: 'Unsupported widget type' };
    }

    return {
      widgetId: widget.id,
      data,
      timestamp: now,
      metadata: {
        type: widget.type,
        refreshInterval: widget.refreshInterval
      }
    };
  }

  private async generateMetricData(widget: DashboardWidget): Promise<any> {
    if (!widget.config.metric) {
      return { error: 'Metric not specified' };
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (widget.config.timeRange || 1) * 60 * 60 * 1000);

    const metrics = await this.metricsCollector.queryMetrics({
      name: widget.config.metric,
      startTime,
      endTime,
      tags: widget.config.filters
    });

    if (widget.config.aggregation) {
      const aggregated = metrics.reduce((acc, metric) => acc + metric.value, 0);
      return { value: aggregated, unit: this.getMetricUnit(widget.config.metric) };
    }

    const latest = metrics[metrics.length - 1];
    return { value: latest?.value || 0, unit: this.getMetricUnit(widget.config.metric) };
  }

  private async generateChartData(widget: DashboardWidget): Promise<any> {
    if (!widget.config.metric) {
      return { error: 'Metric not specified' };
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (widget.config.timeRange || 1) * 60 * 60 * 1000);

    const metrics = await this.metricsCollector.queryMetrics({
      name: widget.config.metric,
      startTime,
      endTime,
      tags: widget.config.filters
    });

    const chartData = metrics.map(metric => ({
      timestamp: metric.timestamp.toISOString(),
      value: metric.value,
      tags: metric.tags
    }));

    return {
      data: chartData,
      chartType: widget.config.chartType || 'line',
      metric: widget.config.metric
    };
  }

  private async generateTableData(widget: DashboardWidget): Promise<any> {
    const services = await this.metricsCollector.getAllServiceMetrics();
    
    return {
      columns: ['Service', 'Requests', 'Errors', 'Avg Response Time', 'Error Rate'],
      rows: services.map(service => [
        service.serviceName,
        service.requestCount,
        service.errorCount,
        `${service.averageResponseTime.toFixed(2)}ms`,
        `${(service.errorRate * 100).toFixed(2)}%`
      ])
    };
  }

  private async generateGaugeData(widget: DashboardWidget): Promise<any> {
    if (!widget.config.metric) {
      return { error: 'Metric not specified' };
    }

    const metrics = await this.metricsCollector.queryMetrics({
      name: widget.config.metric,
      tags: widget.config.filters
    });

    const latest = metrics[metrics.length - 1];
    const value = latest?.value || 0;
    const threshold = widget.config.threshold || 100;

    return {
      value,
      max: threshold * 1.2, // 20% headroom
      threshold,
      status: this.getGaugeStatus(value, threshold, widget.config.thresholdType)
    };
  }

  private async generateHeatmapData(widget: DashboardWidget): Promise<any> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (widget.config.timeRange || 24) * 60 * 60 * 1000);

    const timeRangeData = await this.metricsCollector.getMetricsByTimeRange(startTime, endTime, 3600);

    return {
      data: timeRangeData.map(({ time, metrics }) => ({
        time: time.toISOString(),
        count: metrics.length
      }))
    };
  }

  private async generateLogData(widget: DashboardWidget): Promise<any> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (widget.config.timeRange || 1) * 60 * 60 * 1000);

    const logs = await this.loggingService.queryLogs({
      startTime,
      endTime,
      limit: widget.config.limit || 50,
      level: widget.config.filters?.level
    });

    return {
      logs: logs.map(log => ({
        timestamp: log.timestamp.toISOString(),
        level: log.level,
        message: log.message,
        service: log.service
      }))
    };
  }

  private async generateAlertData(widget: DashboardWidget): Promise<any> {
    const alerts = await this.alertingService.getAlerts({
      status: 'ACTIVE'
    });

    return {
      alerts: alerts.slice(0, widget.config.limit || 10).map(alert => ({
        id: alert.id,
        name: alert.name,
        severity: alert.severity,
        triggeredAt: alert.triggeredAt.toISOString(),
        message: alert.message
      }))
    };
  }

  private async generateHealthData(widget: DashboardWidget): Promise<any> {
    const systemMetrics = await this.metricsCollector.getSystemMetrics();
    
    return {
      overall: systemMetrics.errorRate < 0.05 ? 'HEALTHY' : systemMetrics.errorRate < 0.1 ? 'DEGRADED' : 'UNHEALTHY',
      metrics: {
        uptime: `${Math.floor(systemMetrics.uptime / 1000 / 60)} minutes`,
        memoryUsage: `${Math.round(systemMetrics.memoryUsage.heapUsed / 1024 / 1024)}MB`,
        errorRate: `${(systemMetrics.errorRate * 100).toFixed(2)}%`,
        activeConnections: systemMetrics.activeConnections
      }
    };
  }

  private findWidgetById(widgetId: string): DashboardWidget | null {
    for (const dashboard of this.dashboards.values()) {
      const widget = dashboard.widgets.find(w => w.id === widgetId);
      if (widget) return widget;
    }
    return null;
  }

  private startWidgetRefresh(widget: DashboardWidget): void {
    const refresh = async () => {
      try {
        await this.refreshWidget(widget.id);
      } catch (error) {
        this.logger.error('Error in widget refresh', { error, widgetId: widget.id });
      }
      
      // Schedule next refresh
      const timer = setTimeout(refresh, widget.refreshInterval * 1000);
      this.refreshTimers.set(widget.id, timer);
    };

    // Start refresh
    const timer = setTimeout(refresh, widget.refreshInterval * 1000);
    this.refreshTimers.set(widget.id, timer);
  }

  private notifySubscribers(widgetId: string, data: WidgetData): void {
    const subscribers = this.subscribers.get(widgetId);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          this.logger.error('Error in widget subscriber callback', { error, widgetId });
        }
      });
    }
  }

  private getMetricUnit(metric: string): string {
    const unitMap: Record<string, string> = {
      'response_time': 'ms',
      'request_count': '',
      'error_count': '',
      'memory_usage': 'MB',
      'cpu_usage': '%',
      'throughput': 'req/s'
    };
    
    return unitMap[metric] || '';
  }

  private getGaugeStatus(value: number, threshold: number, type?: 'above' | 'below'): string {
    if (type === 'below') {
      return value <= threshold ? 'GOOD' : 'WARNING';
    } else {
      return value <= threshold ? 'GOOD' : value <= threshold * 1.5 ? 'WARNING' : 'CRITICAL';
    }
  }

  private initializeDefaultDashboards(): void {
    // Create default monitoring dashboard
    const defaultDashboard: Dashboard = {
      id: 'default-monitoring',
      name: 'System Monitoring',
      description: 'Default system monitoring dashboard',
      widgets: [
        {
          id: 'system-health',
          type: 'health',
          title: 'System Health',
          position: { x: 0, y: 0, width: 4, height: 2 },
          refreshInterval: 30,
          enabled: true,
          config: {}
        },
        {
          id: 'response-time-chart',
          type: 'chart',
          title: 'Response Time',
          position: { x: 4, y: 0, width: 8, height: 2 },
          refreshInterval: 60,
          enabled: true,
          config: {
            metric: 'response_time',
            timeRange: 1,
            chartType: 'line'
          }
        },
        {
          id: 'error-rate-gauge',
          type: 'gauge',
          title: 'Error Rate',
          position: { x: 0, y: 2, width: 4, height: 2 },
          refreshInterval: 60,
          enabled: true,
          config: {
            metric: 'error_count',
            threshold: 10,
            thresholdType: 'above'
          }
        },
        {
          id: 'active-alerts',
          type: 'alert',
          title: 'Active Alerts',
          position: { x: 4, y: 2, width: 8, height: 2 },
          refreshInterval: 30,
          enabled: true,
          config: {
            limit: 10
          }
        }
      ],
      layout: 'grid',
      theme: 'light',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      isPublic: true
    };

    this.dashboards.set(defaultDashboard.id, defaultDashboard);
    
    // Start refresh timers for default widgets
    defaultDashboard.widgets.forEach(widget => {
      if (widget.enabled) {
        this.startWidgetRefresh(widget);
      }
    });
  }

  private startPeriodicTasks(): void {
    // Clean up old widget data every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);

    // Generate dashboard statistics every 6 hours
    setInterval(() => {
      this.generateDashboardStatistics();
    }, 6 * 60 * 60 * 1000);
  }

  private cleanupOldData(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
    let cleanedCount = 0;

    for (const [widgetId, data] of this.widgetData.entries()) {
      const beforeCount = data.length;
      const filtered = data.filter(d => d.timestamp > cutoffTime);
      
      if (filtered.length < data.length) {
        this.widgetData.set(widgetId, filtered);
        cleanedCount += beforeCount - filtered.length;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info('Old widget data cleaned up', { cleanedCount });
    }
  }

  private generateDashboardStatistics(): void {
    try {
      const stats = {
        totalDashboards: this.dashboards.size,
        totalWidgets: Array.from(this.dashboards.values()).reduce((sum, d) => sum + d.widgets.length, 0),
        timestamp: new Date().toISOString()
      };

      this.logger.info('Dashboard statistics generated', stats);
    } catch (error) {
      this.logger.error('Error generating dashboard statistics', { error });
    }
  }

  private generateDashboardId(): string {
    return `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateWidgetId(): string {
    return `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}