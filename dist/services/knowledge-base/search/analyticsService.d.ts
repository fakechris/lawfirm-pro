export interface SearchMetrics {
    totalSearches: number;
    averageResponseTime: number;
    errorRate: number;
    topQueries: Array<{
        query: string;
        count: number;
    }>;
    searchDistribution: {
        byHour: number[];
        byDay: number[];
        byUser: Array<{
            userId: string;
            count: number;
        }>;
    };
    performanceMetrics: {
        p50ResponseTime: number;
        p95ResponseTime: number;
        p99ResponseTime: number;
    };
}
export interface SearchPerformanceAlert {
    id: string;
    type: 'slow_response' | 'high_error_rate' | 'low_result_count' | 'system_overload';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
    resolved: boolean;
    resolvedAt?: Date;
}
export interface SearchHealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    score: number;
    checks: {
        responseTime: boolean;
        errorRate: boolean;
        resultQuality: boolean;
        systemResources: boolean;
    };
    lastCheck: Date;
}
export interface SearchUsageReport {
    period: {
        start: Date;
        end: Date;
    };
    totalSearches: number;
    uniqueUsers: number;
    averageResultsPerSearch: number;
    clickThroughRate: number;
    topContentTypes: Array<{
        type: string;
        count: number;
    }>;
    userSatisfaction: number;
    recommendations: string[];
}
export declare class SearchAnalyticsService {
    private alerts;
    private metricsCache;
    private lastHealthCheck;
    constructor();
    recordSearch(searchData: {
        query: string;
        userId?: string;
        resultsCount: number;
        responseTime: number;
        success: boolean;
        filters?: any;
        sortBy?: string;
        clickedResults?: string[];
    }): Promise<void>;
    getSearchMetrics(period?: {
        start: Date;
        end: Date;
    }): Promise<SearchMetrics>;
    getSearchHealthStatus(): Promise<SearchHealthStatus>;
    getUsageReport(period: {
        start: Date;
        end: Date;
    }): Promise<SearchUsageReport>;
    getAlerts(activeOnly?: boolean): Promise<SearchPerformanceAlert[]>;
    resolveAlert(alertId: string): Promise<boolean>;
    private checkPerformanceAlerts;
    private updateMetricsCache;
    private getPercentile;
    private generateRecommendations;
    private startMonitoring;
    private startPeriodicHealthChecks;
    getRealTimeMetrics(): Promise<{
        activeSearches: number;
        averageResponseTime: number;
        errorRate: number;
        systemLoad: number;
    }>;
}
export declare const searchAnalyticsService: SearchAnalyticsService;
//# sourceMappingURL=analyticsService.d.ts.map