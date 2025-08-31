"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationLoggerImplementation = void 0;
const winston = __importStar(require("winston"));
const integration_1 = __importDefault(require("../../config/integration"));
class IntegrationLoggerImplementation {
    constructor() {
        this.sensitiveFields = integration_1.default.logging.fieldsToMask || [
            'password', 'token', 'secret', 'key', 'authorization', 'apikey'
        ];
        this.logger = winston.createLogger({
            level: integration_1.default.logging.level || 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
            defaultMeta: { service: 'integration-gateway' },
            transports: [
                new winston.transports.File({
                    filename: 'logs/integration-error.log',
                    level: 'error'
                }),
                new winston.transports.File({
                    filename: 'logs/integration-combined.log'
                })
            ]
        });
        if (process.env.NODE_ENV !== 'production') {
            this.logger.add(new winston.transports.Console({
                format: winston.format.combine(winston.format.colorize(), winston.format.simple())
            }));
        }
    }
    info(message, meta) {
        this.logger.info(message, this.sanitizeMeta(meta));
    }
    warn(message, meta) {
        this.logger.warn(message, this.sanitizeMeta(meta));
    }
    error(message, meta) {
        this.logger.error(message, this.sanitizeMeta(meta));
    }
    debug(message, meta) {
        this.logger.debug(message, this.sanitizeMeta(meta));
    }
    logRequest(request, response, duration) {
        const logEntry = {
            type: 'request',
            method: request.method,
            path: request.path,
            service: request.service,
            statusCode: response.status,
            duration,
            userId: request.user?.id,
            requestId: request.id,
            responseId: response.id,
            userAgent: request.headers['user-agent'],
            ip: request.headers['x-forwarded-for'] || request.headers['x-real-ip'] || request.connection.remoteAddress,
            timestamp: new Date().toISOString()
        };
        if (response.status >= 400) {
            this.error('Integration request failed', logEntry);
        }
        else {
            this.info('Integration request completed', logEntry);
        }
    }
    logServiceCall(service, operation, success, duration, error) {
        const logEntry = {
            type: 'service_call',
            service,
            operation,
            success,
            duration,
            error: error ? error.message || error : undefined,
            timestamp: new Date().toISOString()
        };
        if (success) {
            this.info('Service call completed', logEntry);
        }
        else {
            this.error('Service call failed', logEntry);
        }
    }
    logCircuitBreaker(service, action, state) {
        this.info('Circuit breaker state change', {
            type: 'circuit_breaker',
            service,
            action,
            state,
            timestamp: new Date().toISOString()
        });
    }
    logRateLimit(service, identifier, action, data) {
        this.info('Rate limit action', {
            type: 'rate_limit',
            service,
            identifier,
            action,
            data,
            timestamp: new Date().toISOString()
        });
    }
    logSecurityEvent(event, details) {
        this.warn('Security event', {
            type: 'security',
            event,
            ...details,
            timestamp: new Date().toISOString()
        });
    }
    logPerformanceMetrics(metrics) {
        this.info('Performance metrics', {
            type: 'performance',
            ...metrics,
            timestamp: new Date().toISOString()
        });
    }
    sanitizeMeta(meta) {
        if (!meta || !integration_1.default.logging.sensitiveDataMasking) {
            return meta;
        }
        const sanitized = JSON.parse(JSON.stringify(meta));
        const maskSensitiveData = (obj) => {
            for (const key in obj) {
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    maskSensitiveData(obj[key]);
                }
                else if (this.sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                    obj[key] = '***MASKED***';
                }
            }
        };
        maskSensitiveData(sanitized);
        return sanitized;
    }
    async getMetrics(_timeRange) {
        return {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            topServices: [],
            errorRates: {},
            performanceMetrics: {}
        };
    }
    async createAuditLog(entry) {
        const auditEntry = {
            type: 'audit',
            timestamp: new Date().toISOString(),
            ...entry
        };
        this.info('Audit log entry', auditEntry);
    }
}
exports.IntegrationLoggerImplementation = IntegrationLoggerImplementation;
//# sourceMappingURL=logger.js.map