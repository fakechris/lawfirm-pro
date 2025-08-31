import { Request, Response, NextFunction } from 'express';
import { MetricsCollector } from '../monitoring/MetricsCollector';
import { AlertingService } from '../alerting/AlertingService';
import { ComprehensiveLoggingService } from '../logging/ComprehensiveLoggingService';
export interface IntegrationRequest extends Request {
    startTime?: number;
    traceId?: string;
    spanId?: string;
    userId?: string;
    service?: string;
    operation?: string;
}
export interface MonitoringConfig {
    enabled: boolean;
    logRequests: boolean;
    logResponses: boolean;
    logErrors: boolean;
    collectMetrics: boolean;
    enableAlerting: boolean;
    sampleRate: number;
    sensitiveHeaders: string[];
    sensitiveQueryParams: string[];
    maxBodySize: number;
}
export interface RequestMetrics {
    method: string;
    path: string;
    statusCode: number;
    responseTime: number;
    userId?: string;
    service?: string;
    operation?: string;
    userAgent?: string;
    ipAddress?: string;
    timestamp: Date;
}
export declare class IntegrationMonitoringMiddleware {
    private logger;
    private metricsCollector;
    private alertingService;
    private loggingService;
    private config;
    constructor(metricsCollector: MetricsCollector, alertingService: AlertingService, loggingService: ComprehensiveLoggingService, config?: Partial<MonitoringConfig>);
    middleware: (req: IntegrationRequest, res: Response, next: NextFunction) => void;
    private extractUserInfo;
    private wrapResponseMethods;
    private onResponse;
    private logRequest;
    private logResponse;
    private logError;
    private collectRequestMetrics;
    private checkForAlerts;
    private sanitizeHeaders;
    private sanitizeQueryParams;
    private sanitizeBody;
    private generateTraceId;
    private generateSpanId;
    updateConfig(newConfig: Partial<MonitoringConfig>): void;
    getConfig(): MonitoringConfig;
    enable(): void;
    disable(): void;
    setSampleRate(rate: number): void;
    addSensitiveHeader(header: string): void;
    removeSensitiveHeader(header: string): void;
    addSensitiveQueryParam(param: string): void;
    removeSensitiveQueryParam(param: string): void;
}
export declare function createIntegrationMonitoringMiddleware(metricsCollector: MetricsCollector, alertingService: AlertingService, loggingService: ComprehensiveLoggingService, config?: Partial<MonitoringConfig>): (req: IntegrationRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=integrationMonitoring.d.ts.map