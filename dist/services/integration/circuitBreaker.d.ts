import { CircuitState, CircuitBreaker } from './types';
export declare class CircuitBreakerImplementation implements CircuitBreaker {
    private service;
    private state;
    private failureThreshold;
    private timeout;
    private resetTimeout;
    private logger;
    constructor(service: string);
    execute<T>(operation: () => Promise<T>): Promise<T>;
    private executeWithTimeout;
    private shouldAttemptReset;
    private attemptReset;
    private onSuccess;
    private onFailure;
    private open;
    getState(): CircuitState;
    reset(): void;
    forceOpen(): void;
    forceClose(): void;
}
//# sourceMappingURL=circuitBreaker.d.ts.map