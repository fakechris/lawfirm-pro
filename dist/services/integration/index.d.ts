export { IntegrationGateway } from './IntegrationGateway';
export { IntegrationOrchestrator } from './IntegrationOrchestrator';
export { IntegrationMonitor } from './IntegrationMonitor';
export type { IntegrationRequest, IntegrationResponse, AuthenticationResult, RateLimitResult } from './IntegrationGateway';
export type { WorkflowContext, WorkflowResult, ServiceCall, CoordinationResult, RetryConfig, TransactionalOperation, TransactionResult } from './IntegrationOrchestrator';
export type { IntegrationMetric, IntegrationEvent, HealthCheckResult, SystemHealthResult, Alert, Report, HealthStatus } from './IntegrationMonitor';
export interface BaseIntegrationService {
    getServiceInfo(): Promise<ServiceInfo>;
    healthCheck(): Promise<HealthStatus>;
    getConfiguration(): Promise<ServiceConfiguration>;
    updateConfiguration(config: ServiceConfiguration): Promise<void>;
    executeOperation(operation: string, params: any): Promise<ServiceResult>;
}
export interface ServiceInfo {
    name: string;
    version: string;
    description: string;
    baseUrl: string;
    documentation?: string;
    supportedOperations: string[];
    capabilities: string[];
}
export interface ServiceConfiguration {
    enabled: boolean;
    baseUrl: string;
    timeout: number;
    retries: number;
    authentication: AuthenticationConfig;
    rateLimit: RateLimitConfig;
    circuitBreaker: CircuitBreakerConfig;
    cache: CacheConfig;
}
export interface AuthenticationConfig {
    type: 'API_KEY' | 'OAUTH2' | 'BASIC' | 'BEARER';
    credentials: Record<string, string>;
    tokenUrl?: string;
    scopes?: string[];
}
export interface RateLimitConfig {
    enabled: boolean;
    windowMs: number;
    max: number;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}
export interface CircuitBreakerConfig {
    enabled: boolean;
    timeout: number;
    errorThresholdPercentage: number;
    resetTimeout: number;
    monitoringPeriod?: number;
}
export interface CacheConfig {
    enabled: boolean;
    ttl: number;
    maxSize: number;
    strategy: 'LRU' | 'FIFO' | 'TTL';
}
export interface ServiceResult {
    success: boolean;
    data?: any;
    error?: string;
    statusCode?: number;
    headers?: Record<string, string>;
    metadata?: Record<string, any>;
}
export declare class IntegrationServiceFactory {
    static createService(serviceType: string, config: ServiceConfiguration): BaseIntegrationService;
}
//# sourceMappingURL=index.d.ts.map