export interface AnalyticsFilter {
    dateRange?: {
        start: Date;
        end: Date;
    };
    contentType?: string[];
    categories?: string[];
    tags?: string[];
    users?: string[];
    interactionTypes?: string[];
}
export interface AnalyticsAggregation {
    groupBy: 'day' | 'week' | 'month' | 'year' | 'category' | 'contentType' | 'user';
    metric: 'views' | 'interactions' | 'searches' | 'users' | 'completionRate';
    aggregation: 'sum' | 'average' | 'count' | 'max' | 'min';
}
export interface ExportOptions {
    format: 'json' | 'csv' | 'xlsx' | 'pdf';
    includeCharts?: boolean;
    dateRange?: {
        start: Date;
        end: Date;
    };
    metrics: string[];
}
export interface ProcessedData {
    labels: string[];
    datasets: Array<{
        label: string;
        data: number[];
        backgroundColor?: string[];
        borderColor?: string;
    }>;
    summary: {
        total: number;
        average: number;
        min: number;
        max: number;
        trend: 'up' | 'down' | 'stable';
    };
}
export declare class AnalyticsDataProcessor {
    private cache;
    constructor();
    processTimeSeriesData(metric: 'views' | 'interactions' | 'searches' | 'users', filter: AnalyticsFilter, aggregation: AnalyticsAggregation): Promise<ProcessedData>;
    processCategoryData(filter: AnalyticsFilter): Promise<ProcessedData>;
    processUserEngagementData(filter: AnalyticsFilter): Promise<ProcessedData>;
    processSearchPerformanceData(filter: AnalyticsFilter): Promise<ProcessedData>;
    exportData(options: ExportOptions): Promise<string | Buffer>;
    generateInsights(filter: AnalyticsFilter): Promise<string[]>;
    private getViewData;
    private getInteractionData;
    private getSearchData;
    private getUserData;
    private aggregateTimeSeries;
    private buildFilter;
    private calculateTrend;
    private generateColors;
    private getExportData;
    private convertToCSV;
    private convertToXLSX;
    private convertToPDF;
    private getFromCache;
    private setToCache;
    private startCacheCleanup;
}
export declare const analyticsDataProcessor: AnalyticsDataProcessor;
//# sourceMappingURL=processor.d.ts.map