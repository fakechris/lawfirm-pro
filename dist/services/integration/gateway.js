"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationGatewayService = void 0;
const circuitBreaker_1 = require("./circuitBreaker");
const rateLimiter_1 = require("./rateLimiter");
const logger_1 = require("./logger");
const configManager_1 = require("./configManager");
const integration_1 = __importDefault(require("../../config/integration"));
class IntegrationGatewayService {
    constructor() {
        this.circuitBreakers = new Map();
        this.rateLimiters = new Map();
        this.logger = new logger_1.IntegrationLoggerImplementation();
        this.config = new configManager_1.ConfigManagerImplementation();
        this.initializeCircuitBreakers();
        this.initializeRateLimiters();
    }
    initializeCircuitBreakers() {
        const services = ['pacer', 'stateCourts', 'stripe', 'paypal', 'lexisNexis', 'westlaw', 'googleDrive', 'dropbox', 'twilio', 'sendGrid'];
        services.forEach(service => {
            const config = this.config.getServiceConfig(service);
            if (config?.enabled) {
                this.circuitBreakers.set(service, new circuitBreaker_1.CircuitBreakerImplementation(service));
            }
        });
    }
    initializeRateLimiters() {
        const services = ['pacer', 'stateCourts', 'stripe', 'paypal', 'lexisNexis', 'westlaw', 'googleDrive', 'dropbox', 'twilio', 'sendGrid'];
        services.forEach(service => {
            const config = this.config.getServiceConfig(service);
            if (config?.enabled) {
                this.rateLimiters.set(service, new rateLimiter_1.RateLimiterImplementation(service));
            }
        });
    }
    async authenticate(request) {
        try {
            const apiKey = request.headers[integration_1.default.auth.apiKeyHeader];
            if (!apiKey) {
                return {
                    success: false,
                    error: 'API key required'
                };
            }
            const db = require('../../utils/database').Database;
            const database = new db();
            await database.connect();
            const apiKeyRecord = await database.client.apiKey.findUnique({
                where: { key: apiKey },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });
            await database.disconnect();
            if (!apiKeyRecord || !apiKeyRecord.isActive) {
                return {
                    success: false,
                    error: 'Invalid API key'
                };
            }
            if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
                return {
                    success: false,
                    error: 'API key expired'
                };
            }
            const updateDb = new db();
            await updateDb.connect();
            await updateDb.client.apiKey.update({
                where: { id: apiKeyRecord.id },
                data: { lastUsedAt: new Date() }
            });
            await updateDb.disconnect();
            return {
                success: true,
                user: apiKeyRecord.user
            };
        }
        catch (error) {
            this.logger.error('Authentication failed', { error, requestId: request.id });
            return {
                success: false,
                error: 'Authentication service unavailable'
            };
        }
    }
    async authorize(request, user) {
        try {
            const serviceConfig = this.config.getServiceConfig(request.service);
            if (!serviceConfig) {
                return false;
            }
            const db = require('../../utils/database').Database;
            const database = new db();
            await database.connect();
            const permission = await database.client.userPermission.findFirst({
                where: {
                    userId: user.id,
                    service: request.service,
                    action: { in: ['read', 'write', 'admin'] }
                }
            });
            await database.disconnect();
            return !!permission;
        }
        catch (error) {
            this.logger.error('Authorization failed', { error, requestId: request.id, userId: user.id });
            return false;
        }
    }
    async rateLimit(request) {
        const rateLimiter = this.rateLimiters.get(request.service);
        if (!rateLimiter) {
            return {
                allowed: true,
                remaining: Infinity,
                resetTime: new Date(Date.now() + 900000)
            };
        }
        return rateLimiter.checkLimit(request.user?.id || request.headers['x-forwarded-for'] || 'anonymous');
    }
    circuitBreaker(service) {
        return this.circuitBreakers.get(service) || new circuitBreaker_1.CircuitBreakerImplementation(service);
    }
    async execute(request) {
        const startTime = Date.now();
        const responseId = this.generateId();
        try {
            this.logger.info('Integration request started', {
                requestId: request.id,
                service: request.service,
                method: request.method,
                path: request.path,
                userId: request.user?.id
            });
            const authResult = await this.authenticate(request);
            if (!authResult.success) {
                return {
                    id: responseId,
                    status: 401,
                    headers: {},
                    body: {
                        success: false,
                        message: authResult.error || 'Authentication failed'
                    },
                    timestamp: new Date(),
                    duration: Date.now() - startTime,
                    service: request.service
                };
            }
            const isAuthorized = await this.authorize(request, authResult.user);
            if (!isAuthorized) {
                return {
                    id: responseId,
                    status: 403,
                    headers: {},
                    body: {
                        success: false,
                        message: 'Insufficient permissions'
                    },
                    timestamp: new Date(),
                    duration: Date.now() - startTime,
                    service: request.service
                };
            }
            const rateLimitResult = await this.rateLimit(request);
            if (!rateLimitResult.allowed) {
                return {
                    id: responseId,
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': rateLimitResult.remaining.toString(),
                        'X-RateLimit-Reset': rateLimitResult.resetTime.toISOString()
                    },
                    body: {
                        success: false,
                        message: rateLimitResult.error || 'Rate limit exceeded'
                    },
                    timestamp: new Date(),
                    duration: Date.now() - startTime,
                    service: request.service
                };
            }
            const circuitBreaker = this.circuitBreaker(request.service);
            const response = await circuitBreaker.execute(async () => {
                return this.executeServiceRequest(request, authResult.user);
            });
            this.logger.info('Integration request completed', {
                requestId: request.id,
                responseId,
                service: request.service,
                status: response.status,
                duration: Date.now() - startTime,
                userId: request.user?.id
            });
            return {
                ...response,
                id: responseId,
                timestamp: new Date(),
                duration: Date.now() - startTime,
                service: request.service
            };
        }
        catch (error) {
            this.logger.error('Integration request failed', {
                requestId: request.id,
                responseId,
                service: request.service,
                error,
                duration: Date.now() - startTime,
                userId: request.user?.id
            });
            return {
                id: responseId,
                status: 500,
                headers: {},
                body: {
                    success: false,
                    message: 'Internal server error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                },
                timestamp: new Date(),
                duration: Date.now() - startTime,
                service: request.service
            };
        }
    }
    async executeServiceRequest(request, user) {
        throw new Error('Service request execution not implemented');
    }
    generateId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.IntegrationGatewayService = IntegrationGatewayService;
//# sourceMappingURL=gateway.js.map