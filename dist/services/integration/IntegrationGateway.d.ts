export interface IntegrationRequest {
    service: string;
    operation: string;
    parameters: Record<string, any>;
    headers?: Record<string, string>;
    timeout?: number;
}
export interface IntegrationResponse {
    success: boolean;
    data?: any;
    error?: string;
    statusCode?: number;
    headers?: Record<string, string>;
    timestamp: Date;
}
export interface AuthenticationResult {
    authenticated: boolean;
    token?: string;
    error?: string;
    expiresAt?: Date;
}
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime?: Date;
    error?: string;
}
export declare class IntegrationGateway {
    private logger;
    private rateLimiters;
    private circuitBreakers;
    constructor();
    routeRequest(request: IntegrationRequest): Promise<IntegrationResponse>;
    private validateRequest;
    private authenticate;
    private checkRateLimit;
    private executeWithCircuitBreaker;
    private executeRequest;
    private transformRequest;
    private transformResponse;
    private makeHttpRequest;
    private getServiceConfig;
    private initializeRateLimiters;
    private initializeCircuitBreakers;
}
//# sourceMappingURL=IntegrationGateway.d.ts.map