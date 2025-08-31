export interface MetricData {
    name: string;
    value: number;
    timestamp: Date;
    tags: Record<string, string>;
    metadata?: Record<string, any>;
}
export interface MetricAggregation {
    name: string;
    type: 'sum' | 'avg' | 'min' | 'max' | 'count';
    period: number;
    tags: Record<string, string>;
}
export interface MetricQuery {
    name?: string;
    tags?: Record<string, string>;
    startTime?: Date;
    endTime?: Date;
    aggregation?: MetricAggregation;
}
export interface ServiceMetrics {
    serviceName: string;
    requestCount: number;
    errorCount: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    throughput: number;
    errorRate: number;
    lastRequestTime: Date;
    uptime: number;
}
export interface SystemMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    errorRate: number;
    activeConnections: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    uptime: number;
}
export declare class MetricsCollector {
    private logger;
    private metrics;
    private aggregations;
    private serviceMetrics;
    private startTime;
    constructor();
    recordCounter(name: string, value?: number, tags?: Record<string, string>, metadata?: Record<string, any>): void;
    recordGauge(name: string, value: number, tags?: Record<string, string>, metadata?: Record<string, any>): void;
    recordTiming(name: string, value: number, tags?: Record<string, string>, metadata?: Record<string, any>): void;
    incrementCounter(name: string, value?: number, tags?: Record<string, string>, metadata?: Record<string, any>): void;
    queryMetrics(query: MetricQuery): Promise<MetricData[]>;
    getServiceMetrics(serviceName: string): Promise<ServiceMetrics | null>;
    getAllServiceMetrics(): Promise<ServiceMetrics[]>;
    getSystemMetrics(): Promise<SystemMetrics>;
    createAggregation(aggregation: MetricAggregation): Promise<void>;
    removeAggregation(name: string, tags: Record<string, string>): Promise<void>;
    getAggregations(): Promise<MetricAggregation[]>;
    getTopMetrics(limit?: number): Promise<Array<{
        name: string;
        count: number;
    }>>;
    getMetricsByTimeRange(startTime: Date, endTime: Date, interval?: number): Promise<Array<{
        time: Date;
        metrics: MetricData[];
    }>>;
    private initializeServiceMetrics;
    private startPeriodicTasks;
    private updateServiceMetrics;
    private updateSystemMetrics;
    private calculatePercentiles;
    private cleanupOldMetrics;
    private aggregateMetrics;
    private calculateAggregation;
    private getAggregationKey;
    private getTimeBucketKey;
}
//# sourceMappingURL=MetricsCollector.d.ts.map