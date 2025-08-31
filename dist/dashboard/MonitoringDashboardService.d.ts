import { MetricsCollector } from '../monitoring/MetricsCollector';
import { AlertingService } from '../alerting/AlertingService';
import { ComprehensiveLoggingService } from '../logging/ComprehensiveLoggingService';
export interface DashboardWidget {
    id: string;
    type: WidgetType;
    title: string;
    description?: string;
    config: WidgetConfig;
    position: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    refreshInterval: number;
    enabled: boolean;
}
export interface WidgetConfig {
    metric?: string;
    timeRange?: number;
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
export type WidgetType = 'metric' | 'chart' | 'table' | 'gauge' | 'heatmap' | 'log' | 'alert' | 'health' | 'map' | 'text';
export type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'timeline';
export declare class MonitoringDashboardService {
    private logger;
    private metricsCollector;
    private alertingService;
    private loggingService;
    private dashboards;
    private widgetData;
    private refreshTimers;
    private subscribers;
    constructor(metricsCollector: MetricsCollector, alertingService: AlertingService, loggingService: ComprehensiveLoggingService);
    createDashboard(name: string, createdBy: string, options?: {
        description?: string;
        layout?: Dashboard['layout'];
        theme?: Dashboard['theme'];
        isPublic?: boolean;
        sharedWith?: string[];
    }): Promise<Dashboard>;
    updateDashboard(id: string, updates: Partial<Dashboard>): Promise<Dashboard>;
    deleteDashboard(id: string): Promise<void>;
    getDashboard(id: string): Promise<Dashboard | null>;
    getAllDashboards(userId?: string): Promise<Dashboard[]>;
    addWidget(dashboardId: string, widget: Omit<DashboardWidget, 'id'> & {
        id?: string;
    }): Promise<DashboardWidget>;
    updateWidget(dashboardId: string, widgetId: string, updates: Partial<DashboardWidget>): Promise<DashboardWidget>;
    removeWidget(dashboardId: string, widgetId: string): Promise<void>;
    getWidgetData(widgetId: string, limit?: number): Promise<WidgetData[]>;
    refreshWidget(widgetId: string): Promise<WidgetData>;
    subscribeToWidget(widgetId: string, callback: (data: WidgetData) => void): Promise<void>;
    unsubscribeFromWidget(widgetId: string, callback: (data: WidgetData) => void): Promise<void>;
    exportDashboard(dashboardId: string, format: DashboardExport['exportFormat']): Promise<DashboardExport>;
    getDashboardStats(): Promise<{
        totalDashboards: number;
        totalWidgets: number;
        activeWidgets: number;
        popularWidgets: Array<{
            type: WidgetType;
            count: number;
        }>;
        dataPoints: number;
    }>;
    private generateWidgetData;
    private generateMetricData;
    private generateChartData;
    private generateTableData;
    private generateGaugeData;
    private generateHeatmapData;
    private generateLogData;
    private generateAlertData;
    private generateHealthData;
    private findWidgetById;
    private startWidgetRefresh;
    private notifySubscribers;
    private getMetricUnit;
    private getGaugeStatus;
    private initializeDefaultDashboards;
    private startPeriodicTasks;
    private cleanupOldData;
    private generateDashboardStatistics;
    private generateDashboardId;
    private generateWidgetId;
}
//# sourceMappingURL=MonitoringDashboardService.d.ts.map