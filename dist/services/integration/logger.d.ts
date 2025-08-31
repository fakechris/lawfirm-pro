export declare class IntegrationLoggerImplementation {
    private logger;
    private sensitiveFields;
    constructor();
    info(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
    logRequest(request: any, response: any, duration: number): void;
    logServiceCall(service: string, operation: string, success: boolean, duration: number, error?: any): void;
    logCircuitBreaker(service: string, action: string, state: any): void;
    logRateLimit(service: string, identifier: string, action: string, data: any): void;
    logSecurityEvent(event: string, details: any): void;
    logPerformanceMetrics(metrics: any): void;
    private sanitizeMeta;
    getMetrics(_timeRange: {
        start: Date;
        end: Date;
    }): Promise<any>;
    createAuditLog(entry: any): Promise<void>;
}
//# sourceMappingURL=logger.d.ts.map