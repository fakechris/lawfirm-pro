import { ServiceConfig, ServiceHealth } from './types';
import { IntegrationLoggerImplementation } from '../integration/logger';
import { ConfigManagerImplementation } from '../integration/configManager';
export declare abstract class BaseExternalService {
    protected config: ServiceConfig;
    protected logger: IntegrationLoggerImplementation;
    protected configManager: ConfigManagerImplementation;
    protected health: ServiceHealth;
    protected requestCount: number;
    protected errorCount: number;
    protected lastRequestTime: Date;
    protected startTime: Date;
    constructor(serviceName: string);
    protected getServiceConfig(serviceName: string): ServiceConfig;
    private mapAuthConfig;
    private mapRateLimitConfig;
    private mapLoggingConfig;
    protected makeRequest<T>(url: string, options?: RequestInit, retryCount?: number): Promise<T>;
    protected getHeaders(customHeaders?: Record<string, string>): Promise<Record<string, string>>;
    protected getOAuthToken(): Promise<string>;
    protected updateHealth(success: boolean, responseTime: number): void;
    getHealth(): Promise<ServiceHealth>;
    testConnection(): Promise<boolean>;
    protected logRequest(method: string, url: string, data?: any): void;
    protected logResponse(method: string, url: string, response: any, duration: number): void;
    protected logError(method: string, url: string, error: any, duration: number): void;
    private maskSensitiveData;
}
//# sourceMappingURL=BaseExternalService.d.ts.map