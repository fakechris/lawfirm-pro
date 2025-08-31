"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringDashboardService = void 0;
const logger_1 = require("../../utils/logger");
class MonitoringDashboardService {
    constructor(metricsCollector, alertingService, loggingService) {
        this.logger = new logger_1.Logger('MonitoringDashboardService');
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
    async createDashboard(name, createdBy, options = {}) {
        try {
            const dashboard = {
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
        }
        catch (error) {
            this.logger.error('Error creating dashboard', { error, name, createdBy });
            throw error;
        }
    }
    async updateDashboard(id, updates) {
        try {
            const existing = this.dashboards.get(id);
            if (!existing) {
                throw new Error(`Dashboard not found: ${id}`);
            }
            const updated = {
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
        }
        catch (error) {
            this.logger.error('Error updating dashboard', { error, id, updates });
            throw error;
        }
    }
    async deleteDashboard(id) {
        try {
            const dashboard = this.dashboards.get(id);
            if (!dashboard) {
                throw new Error(`Dashboard not found: ${id}`);
            }
            this.dashboards.delete(id);
            dashboard.widgets.forEach(widget => {
                this.widgetData.delete(widget.id);
                const timer = this.refreshTimers.get(widget.id);
                if (timer) {
                    clearTimeout(timer);
                    this.refreshTimers.delete(widget.id);
                }
            });
            this.logger.info('Dashboard deleted', { dashboardId: id });
        }
        catch (error) {
            this.logger.error('Error deleting dashboard', { error, id });
            throw error;
        }
    }
    async getDashboard(id) {
        return this.dashboards.get(id) || null;
    }
    async getAllDashboards(userId) {
        const dashboards = Array.from(this.dashboards.values());
        if (userId) {
            return dashboards.filter(dashboard => dashboard.createdBy === userId ||
                dashboard.isPublic ||
                dashboard.sharedWith?.includes(userId));
        }
        return dashboards;
    }
    async addWidget(dashboardId, widget) {
        try {
            const dashboard = this.dashboards.get(dashboardId);
            if (!dashboard) {
                throw new Error(`Dashboard not found: ${dashboardId}`);
            }
            const newWidget = {
                ...widget,
                id: widget.id || this.generateWidgetId()
            };
            dashboard.widgets.push(newWidget);
            dashboard.updatedAt = new Date();
            this.dashboards.set(dashboardId, dashboard);
            this.widgetData.set(newWidget.id, []);
            if (newWidget.enabled && newWidget.refreshInterval > 0) {
                this.startWidgetRefresh(newWidget);
            }
            this.logger.info('Widget added to dashboard', {
                dashboardId,
                widgetId: newWidget.id,
                type: newWidget.type
            });
            return newWidget;
        }
        catch (error) {
            this.logger.error('Error adding widget to dashboard', { error, dashboardId });
            throw error;
        }
    }
    async updateWidget(dashboardId, widgetId, updates) {
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
            const updatedWidget = {
                ...existingWidget,
                ...updates
            };
            dashboard.widgets[widgetIndex] = updatedWidget;
            dashboard.updatedAt = new Date();
            this.dashboards.set(dashboardId, dashboard);
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
        }
        catch (error) {
            this.logger.error('Error updating widget', { error, dashboardId, widgetId });
            throw error;
        }
    }
    async removeWidget(dashboardId, widgetId) {
        try {
            const dashboard = this.dashboards.get(dashboardId);
            if (!dashboard) {
                throw new Error(`Dashboard not found: ${dashboardId}`);
            }
            dashboard.widgets = dashboard.widgets.filter(w => w.id !== widgetId);
            dashboard.updatedAt = new Date();
            this.dashboards.set(dashboardId, dashboard);
            this.widgetData.delete(widgetId);
            const timer = this.refreshTimers.get(widgetId);
            if (timer) {
                clearTimeout(timer);
                this.refreshTimers.delete(widgetId);
            }
            this.logger.info('Widget removed from dashboard', {
                dashboardId,
                widgetId
            });
        }
        catch (error) {
            this.logger.error('Error removing widget from dashboard', { error, dashboardId, widgetId });
            throw error;
        }
    }
    async getWidgetData(widgetId, limit) {
        const data = this.widgetData.get(widgetId) || [];
        return limit ? data.slice(-limit) : data;
    }
    async refreshWidget(widgetId) {
        try {
            const widget = this.findWidgetById(widgetId);
            if (!widget) {
                throw new Error(`Widget not found: ${widgetId}`);
            }
            const widgetData = await this.generateWidgetData(widget);
            const data = this.widgetData.get(widgetId) || [];
            data.push(widgetData);
            if (data.length > 100) {
                data.splice(0, data.length - 100);
            }
            this.widgetData.set(widgetId, data);
            this.notifySubscribers(widgetId, widgetData);
            return widgetData;
        }
        catch (error) {
            this.logger.error('Error refreshing widget', { error, widgetId });
            throw error;
        }
    }
    async subscribeToWidget(widgetId, callback) {
        if (!this.subscribers.has(widgetId)) {
            this.subscribers.set(widgetId, new Set());
        }
        this.subscribers.get(widgetId).add(callback);
        this.logger.debug('Widget subscription added', { widgetId });
    }
    async unsubscribeFromWidget(widgetId, callback) {
        const subscribers = this.subscribers.get(widgetId);
        if (subscribers) {
            subscribers.delete(callback);
            if (subscribers.size === 0) {
                this.subscribers.delete(widgetId);
            }
        }
        this.logger.debug('Widget subscription removed', { widgetId });
    }
    async exportDashboard(dashboardId, format) {
        try {
            const dashboard = this.dashboards.get(dashboardId);
            if (!dashboard) {
                throw new Error(`Dashboard not found: ${dashboardId}`);
            }
            const widgets = [];
            for (const widget of dashboard.widgets) {
                const widgetData = await this.getWidgetData(widget.id, 10);
                widgets.push(...widgetData);
            }
            const exportData = {
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
        }
        catch (error) {
            this.logger.error('Error exporting dashboard', { error, dashboardId, format });
            throw error;
        }
    }
    async getDashboardStats() {
        const dashboards = Array.from(this.dashboards.values());
        const allWidgets = dashboards.flatMap(d => d.widgets);
        const widgetTypes = new Map();
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
    async generateWidgetData(widget) {
        const now = new Date();
        let data;
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
    async generateMetricData(widget) {
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
    async generateChartData(widget) {
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
    async generateTableData(widget) {
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
    async generateGaugeData(widget) {
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
            max: threshold * 1.2,
            threshold,
            status: this.getGaugeStatus(value, threshold, widget.config.thresholdType)
        };
    }
    async generateHeatmapData(widget) {
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
    async generateLogData(widget) {
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
    async generateAlertData(widget) {
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
    async generateHealthData(widget) {
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
    findWidgetById(widgetId) {
        for (const dashboard of this.dashboards.values()) {
            const widget = dashboard.widgets.find(w => w.id === widgetId);
            if (widget)
                return widget;
        }
        return null;
    }
    startWidgetRefresh(widget) {
        const refresh = async () => {
            try {
                await this.refreshWidget(widget.id);
            }
            catch (error) {
                this.logger.error('Error in widget refresh', { error, widgetId: widget.id });
            }
            const timer = setTimeout(refresh, widget.refreshInterval * 1000);
            this.refreshTimers.set(widget.id, timer);
        };
        const timer = setTimeout(refresh, widget.refreshInterval * 1000);
        this.refreshTimers.set(widget.id, timer);
    }
    notifySubscribers(widgetId, data) {
        const subscribers = this.subscribers.get(widgetId);
        if (subscribers) {
            subscribers.forEach(callback => {
                try {
                    callback(data);
                }
                catch (error) {
                    this.logger.error('Error in widget subscriber callback', { error, widgetId });
                }
            });
        }
    }
    getMetricUnit(metric) {
        const unitMap = {
            'response_time': 'ms',
            'request_count': '',
            'error_count': '',
            'memory_usage': 'MB',
            'cpu_usage': '%',
            'throughput': 'req/s'
        };
        return unitMap[metric] || '';
    }
    getGaugeStatus(value, threshold, type) {
        if (type === 'below') {
            return value <= threshold ? 'GOOD' : 'WARNING';
        }
        else {
            return value <= threshold ? 'GOOD' : value <= threshold * 1.5 ? 'WARNING' : 'CRITICAL';
        }
    }
    initializeDefaultDashboards() {
        const defaultDashboard = {
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
        defaultDashboard.widgets.forEach(widget => {
            if (widget.enabled) {
                this.startWidgetRefresh(widget);
            }
        });
    }
    startPeriodicTasks() {
        setInterval(() => {
            this.cleanupOldData();
        }, 60 * 60 * 1000);
        setInterval(() => {
            this.generateDashboardStatistics();
        }, 6 * 60 * 60 * 1000);
    }
    cleanupOldData() {
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
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
    generateDashboardStatistics() {
        try {
            const stats = {
                totalDashboards: this.dashboards.size,
                totalWidgets: Array.from(this.dashboards.values()).reduce((sum, d) => sum + d.widgets.length, 0),
                timestamp: new Date().toISOString()
            };
            this.logger.info('Dashboard statistics generated', stats);
        }
        catch (error) {
            this.logger.error('Error generating dashboard statistics', { error });
        }
    }
    generateDashboardId() {
        return `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateWidgetId() {
        return `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.MonitoringDashboardService = MonitoringDashboardService;
//# sourceMappingURL=MonitoringDashboardService.js.map