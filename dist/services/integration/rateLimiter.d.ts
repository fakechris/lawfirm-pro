import { RateLimitResult } from './types';
export declare class RateLimiterImplementation {
    private service;
    private limits;
    private windowMs;
    private maxRequests;
    private logger;
    constructor(service: string);
    checkLimit(identifier: string): RateLimitResult;
    private cleanup;
    getStats(): {
        totalEntries: number;
        activeEntries: number;
        service: string;
    };
    reset(identifier?: string): void;
}
//# sourceMappingURL=rateLimiter.d.ts.map