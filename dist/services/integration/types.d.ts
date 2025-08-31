export interface IntegrationGateway {
    authenticate(request: IntegrationRequest): Promise<AuthResult>;
    authorize(request: IntegrationRequest, user: any): Promise<boolean>;
    rateLimit(request: IntegrationRequest): Promise<RateLimitResult>;
    circuitBreaker(service: string): CircuitBreaker;
    execute(request: IntegrationRequest): Promise<IntegrationResponse>;
}
export interface CircuitBreaker {
    execute<T>(operation: () => Promise<T>): Promise<T>;
    getState(): CircuitState;
    reset(): void;
    forceOpen(): void;
    forceClose(): void;
}
export interface IntegrationRequest {
    id: string;
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: any;
    query?: Record<string, string>;
    user?: {
        id: string;
        email: string;
        role: string;
    };
    timestamp: Date;
    service: string;
}
export interface IntegrationResponse {
    id: string;
    status: number;
    headers: Record<string, string>;
    body?: any;
    timestamp: Date;
    duration: number;
    service: string;
}
export interface AuthResult {
    success: boolean;
    user?: {
        id: string;
        email: string;
        role: string;
    };
    error?: string;
}
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: Date;
    error?: string;
}
export interface CircuitState {
    isOpen: boolean;
    failureCount: number;
    lastFailureTime?: Date;
    nextAttemptTime?: Date;
}
//# sourceMappingURL=types.d.ts.map