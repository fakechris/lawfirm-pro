import { IntegrationGateway, IntegrationRequest, IntegrationResponse, AuthResult, RateLimitResult, CircuitBreaker } from './types';
export declare class IntegrationGatewayService implements IntegrationGateway {
    private circuitBreakers;
    private rateLimiters;
    private logger;
    private config;
    constructor();
    private initializeCircuitBreakers;
    private initializeRateLimiters;
    authenticate(request: IntegrationRequest): Promise<AuthResult>;
    authorize(request: IntegrationRequest, user: any): Promise<boolean>;
    rateLimit(request: IntegrationRequest): Promise<RateLimitResult>;
    circuitBreaker(service: string): CircuitBreaker;
    execute(request: IntegrationRequest): Promise<IntegrationResponse>;
    private executeServiceRequest;
    private generateId;
}
//# sourceMappingURL=gateway.d.ts.map