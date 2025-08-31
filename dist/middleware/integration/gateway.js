"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationMiddleware = exports.IntegrationMiddleware = void 0;
const gateway_1 = require("../../services/integration/gateway");
class IntegrationMiddleware {
    constructor() {
        this.handleIntegration = (service) => {
            return async (req, res, next) => {
                try {
                    const integrationRequest = {
                        id: this.generateRequestId(),
                        method: req.method,
                        path: req.path,
                        headers: this.sanitizeHeaders(req.headers),
                        body: req.body,
                        query: req.query,
                        user: req.user,
                        timestamp: new Date(),
                        service
                    };
                    req.integrationRequest = integrationRequest;
                    const response = await this.gateway.execute(integrationRequest);
                    Object.entries(response.headers).forEach(([key, value]) => {
                        res.setHeader(key, value);
                    });
                    if (response.headers['X-RateLimit-Limit']) {
                        res.setHeader('X-RateLimit-Limit', response.headers['X-RateLimit-Limit']);
                        res.setHeader('X-RateLimit-Remaining', response.headers['X-RateLimit-Remaining']);
                        res.setHeader('X-RateLimit-Reset', response.headers['X-RateLimit-Reset']);
                    }
                    res.setHeader('X-Request-ID', response.id);
                    res.setHeader('X-Service', response.service);
                    res.setHeader('X-Response-Time', response.duration.toString());
                    res.status(response.status).json(response.body);
                }
                catch (error) {
                    next(error);
                }
            };
        };
        this.validateApiKey = (req, res, next) => {
            const apiKey = req.headers['x-api-key'];
            if (!apiKey) {
                return res.status(401).json({
                    success: false,
                    message: 'API key required'
                });
            }
            next();
        };
        this.validateServiceAccess = (service) => {
            return (req, res, next) => {
                if (!req.user) {
                    return res.status(401).json({
                        success: false,
                        message: 'Authentication required'
                    });
                }
                next();
            };
        };
        this.logRequest = (req, res, next) => {
            const startTime = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - startTime;
                if (req.integrationRequest) {
                    console.log(`Integration Request: ${req.integrationRequest.id} - ${req.integrationRequest.service} - ${duration}ms`);
                }
            });
            next();
        };
        this.gateway = new gateway_1.IntegrationGatewayService();
    }
    generateRequestId() {
        return `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    sanitizeHeaders(headers) {
        const sanitized = {};
        for (const [key, value] of Object.entries(headers)) {
            if (typeof value === 'string') {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
}
exports.IntegrationMiddleware = IntegrationMiddleware;
exports.integrationMiddleware = new IntegrationMiddleware();
//# sourceMappingURL=gateway.js.map