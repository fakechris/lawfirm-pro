"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationGateway = void 0;
const integration_1 = require("../../config/integration");
const logger_1 = require("../../utils/logger");
class IntegrationGateway {
    constructor() {
        this.logger = new logger_1.Logger('IntegrationGateway');
        this.rateLimiters = new Map();
        this.circuitBreakers = new Map();
        this.initializeRateLimiters();
        this.initializeCircuitBreakers();
    }
    async routeRequest(request) {
        try {
            this.logger.info('Routing integration request', {
                service: request.service,
                operation: request.operation
            });
            const validationResult = await this.validateRequest(request);
            if (!validationResult.valid) {
                return {
                    success: false,
                    error: validationResult.error,
                    statusCode: 400,
                    timestamp: new Date()
                };
            }
            const rateLimitResult = await this.checkRateLimit(request.service, 'default');
            if (!rateLimitResult.allowed) {
                return {
                    success: false,
                    error: `Rate limit exceeded. Try again after ${rateLimitResult.resetTime}`,
                    statusCode: 429,
                    timestamp: new Date()
                };
            }
            const authResult = await this.authenticate(request);
            if (!authResult.authenticated) {
                return {
                    success: false,
                    error: authResult.error || 'Authentication failed',
                    statusCode: 401,
                    timestamp: new Date()
                };
            }
            const response = await this.executeWithCircuitBreaker(request.service, async () => {
                return await this.executeRequest(request, authResult.token);
            });
            return response;
        }
        catch (error) {
            this.logger.error('Error routing integration request', { error, request });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                statusCode: 500,
                timestamp: new Date()
            };
        }
    }
    async validateRequest(request) {
        if (!request.service || !request.operation) {
            return { valid: false, error: 'Service and operation are required' };
        }
        if (!integration_1.integrationConfig.gateway.enabled) {
            return { valid: false, error: 'Integration gateway is disabled' };
        }
        return { valid: true };
    }
    async authenticate(request) {
        const serviceConfig = this.getServiceConfig(request.service);
        if (!serviceConfig) {
            return { authenticated: false, error: 'Service not configured' };
        }
        const apiKey = request.headers?.[integration_1.integrationConfig.auth.apiKeyHeader];
        if (!apiKey) {
            return { authenticated: false, error: 'API key required' };
        }
        return {
            authenticated: true,
            token: apiKey,
            expiresAt: new Date(Date.now() + 3600000)
        };
    }
    async checkRateLimit(service, clientId) {
        const rateLimiter = this.rateLimiters.get(service);
        if (!rateLimiter) {
            return { allowed: true, remaining: 1000 };
        }
        return rateLimiter.checkLimit(clientId);
    }
    async executeWithCircuitBreaker(service, operation) {
        const circuitBreaker = this.circuitBreakers.get(service);
        if (!circuitBreaker) {
            return operation();
        }
        return circuitBreaker.execute(operation);
    }
    async executeRequest(request, token) {
        const serviceConfig = this.getServiceConfig(request.service);
        if (!serviceConfig) {
            return {
                success: false,
                error: 'Service not configured',
                statusCode: 404,
                timestamp: new Date()
            };
        }
        const transformedRequest = await this.transformRequest(request);
        const result = await this.makeHttpRequest(transformedRequest, token);
        return this.transformResponse(result);
    }
    async transformRequest(request) {
        return request;
    }
    async transformResponse(response) {
        return {
            success: true,
            data: response,
            timestamp: new Date()
        };
    }
    async makeHttpRequest(request, token) {
        this.logger.info('Making HTTP request', { service: request.service, operation: request.operation });
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
            success: true,
            data: { message: 'Request processed successfully' }
        };
    }
    getServiceConfig(service) {
        switch (service) {
            case 'pacer':
                return integration_1.integrationConfig.courtSystems.pacer;
            case 'stripe':
                return integration_1.integrationConfig.payment.stripe;
            case 'lexisnexis':
                return integration_1.integrationConfig.legalResearch.lexisNexis;
            default:
                return null;
        }
    }
    initializeRateLimiters() {
        Object.keys(integration_1.integrationConfig.courtSystems).forEach(service => {
            this.rateLimiters.set(service, new RateLimiter({
                windowMs: 900000,
                max: 1000
            }));
        });
        Object.keys(integration_1.integrationConfig.payment).forEach(service => {
            this.rateLimiters.set(service, new RateLimiter({
                windowMs: 900000,
                max: 2000
            }));
        });
        Object.keys(integration_1.integrationConfig.legalResearch).forEach(service => {
            this.rateLimiters.set(service, new RateLimiter({
                windowMs: 900000,
                max: 500
            }));
        });
    }
    initializeCircuitBreakers() {
        Object.keys(integration_1.integrationConfig.courtSystems).forEach(service => {
            this.circuitBreakers.set(service, new CircuitBreaker({
                timeout: 30000,
                errorThresholdPercentage: 50,
                resetTimeout: 30000
            }));
        });
        Object.keys(integration_1.integrationConfig.payment).forEach(service => {
            this.circuitBreakers.set(service, new CircuitBreaker({
                timeout: 10000,
                errorThresholdPercentage: 30,
                resetTimeout: 60000
            }));
        });
        Object.keys(integration_1.integrationConfig.legalResearch).forEach(service => {
            this.circuitBreakers.set(service, new CircuitBreaker({
                timeout: 45000,
                errorThresholdPercentage: 40,
                resetTimeout: 45000
            }));
        });
    }
}
exports.IntegrationGateway = IntegrationGateway;
class RateLimiter {
    constructor(config) {
        this.requests = new Map();
        this.windowMs = config.windowMs;
        this.max = config.max;
    }
    checkLimit(clientId) {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        let clientRequests = this.requests.get(clientId) || [];
        clientRequests = clientRequests.filter(time => time > windowStart);
        if (clientRequests.length >= this.max) {
            return {
                allowed: false,
                remaining: 0,
                resetTime: new Date(clientRequests[0] + this.windowMs)
            };
        }
        clientRequests.push(now);
        this.requests.set(clientId, clientRequests);
        return {
            allowed: true,
            remaining: this.max - clientRequests.length
        };
    }
}
class CircuitBreaker {
    constructor(config) {
        this.config = config;
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.lastFailureTime = 0;
    }
    async execute(operation) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
                this.state = 'HALF_OPEN';
            }
            else {
                throw new Error('Circuit breaker is OPEN');
            }
        }
        try {
            const result = await Promise.race([
                operation(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), this.config.timeout))
            ]);
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    onSuccess() {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }
    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.failureCount >= this.config.errorThresholdPercentage) {
            this.state = 'OPEN';
        }
    }
    getState() {
        return this.state;
    }
    reset() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.lastFailureTime = 0;
    }
}
//# sourceMappingURL=IntegrationGateway.js.map