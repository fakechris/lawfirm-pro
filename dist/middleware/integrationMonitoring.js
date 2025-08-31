"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationMonitoringMiddleware = void 0;
exports.createIntegrationMonitoringMiddleware = createIntegrationMonitoringMiddleware;
const logger_1 = require("../../utils/logger");
class IntegrationMonitoringMiddleware {
    constructor(metricsCollector, alertingService, loggingService, config = {}) {
        this.middleware = (req, res, next) => {
            if (!this.config.enabled) {
                return next();
            }
            if (Math.random() > this.config.sampleRate) {
                return next();
            }
            req.startTime = Date.now();
            req.traceId = this.generateTraceId();
            req.spanId = this.generateSpanId();
            this.extractUserInfo(req);
            if (this.config.logRequests) {
                this.logRequest(req);
            }
            this.wrapResponseMethods(req, res);
            next();
        };
        this.logger = new logger_1.Logger('IntegrationMonitoringMiddleware');
        this.metricsCollector = metricsCollector;
        this.alertingService = alertingService;
        this.loggingService = loggingService;
        this.config = {
            enabled: true,
            logRequests: true,
            logResponses: true,
            logErrors: true,
            collectMetrics: true,
            enableAlerting: true,
            sampleRate: 1.0,
            sensitiveHeaders: ['authorization', 'cookie', 'token', 'api-key'],
            sensitiveQueryParams: ['password', 'token', 'secret', 'key'],
            maxBodySize: 1024 * 1024,
            ...config
        };
    }
    extractUserInfo(req) {
        req.userId = req.headers['x-user-id'] ||
            req.headers['user-id'] ||
            req.headers['userid'];
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.substring(7);
            }
            catch (error) {
                this.logger.debug('Failed to extract user from JWT', { error });
            }
        }
        const pathParts = req.path.split('/').filter(Boolean);
        if (pathParts.length >= 2) {
            req.service = pathParts[0];
            req.operation = pathParts[1];
        }
    }
    wrapResponseMethods(req, res) {
        const originalJson = res.json;
        const originalSend = res.send;
        const originalEnd = res.end;
        res.json = function (body) {
            if (req.startTime && this.config.enabled) {
                this.onResponse(req, this, body);
            }
            return originalJson.call(this, body);
        }.bind(this);
        res.send = function (body) {
            if (req.startTime && this.config.enabled) {
                this.onResponse(req, this, body);
            }
            return originalSend.call(this, body);
        }.bind(this);
        res.end = function (chunk, encoding) {
            if (req.startTime && this.config.enabled) {
                this.onResponse(req, this, chunk);
            }
            return originalEnd.call(this, chunk, encoding);
        }.bind(this);
    }
    onResponse(req, res, body) {
        try {
            const responseTime = Date.now() - (req.startTime || Date.now());
            if (this.config.collectMetrics) {
                this.collectRequestMetrics(req, res, responseTime);
            }
            if (this.config.logResponses) {
                this.logResponse(req, res, responseTime, body);
            }
            if (this.config.enableAlerting) {
                this.checkForAlerts(req, res, responseTime);
            }
            if (this.config.logErrors && res.statusCode >= 400) {
                this.logError(req, res, responseTime, body);
            }
        }
        catch (error) {
            this.logger.error('Error in response monitoring', { error });
        }
    }
    logRequest(req) {
        try {
            const sanitizedHeaders = this.sanitizeHeaders(req.headers);
            const sanitizedQuery = this.sanitizeQueryParams(req.query);
            const sanitizedBody = this.sanitizeBody(req.body);
            const logData = {
                method: req.method,
                path: req.path,
                headers: sanitizedHeaders,
                query: sanitizedQuery,
                body: sanitizedBody,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                traceId: req.traceId,
                spanId: req.spanId,
                userId: req.userId,
                service: req.service,
                operation: req.operation
            };
            this.loggingService.info('Integration request received', {
                service: req.service || 'integration',
                operation: req.operation || 'request',
                userId: req.userId,
                metadata: logData,
                tags: ['integration', 'request'],
                traceId: req.traceId,
                spanId: req.spanId
            });
        }
        catch (error) {
            this.logger.error('Error logging request', { error });
        }
    }
    logResponse(req, res, responseTime, body) {
        try {
            const sanitizedBody = this.sanitizeBody(body);
            const logData = {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                responseTime,
                headers: this.sanitizeHeaders(res.getHeaders()),
                body: sanitizedBody,
                traceId: req.traceId,
                spanId: req.spanId,
                userId: req.userId,
                service: req.service,
                operation: req.operation
            };
            this.loggingService.info('Integration response sent', {
                service: req.service || 'integration',
                operation: req.operation || 'response',
                userId: req.userId,
                metadata: logData,
                tags: ['integration', 'response'],
                traceId: req.traceId,
                spanId: req.spanId
            });
        }
        catch (error) {
            this.logger.error('Error logging response', { error });
        }
    }
    logError(req, res, responseTime, body) {
        try {
            const errorData = {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                responseTime,
                errorMessage: res.statusMessage,
                body: this.sanitizeBody(body),
                traceId: req.traceId,
                spanId: req.spanId,
                userId: req.userId,
                service: req.service,
                operation: req.operation
            };
            const logLevel = res.statusCode >= 500 ? 'ERROR' : 'WARN';
            this.loggingService.log(logLevel, `Integration ${res.statusCode >= 500 ? 'server' : 'client'} error`, {
                service: req.service || 'integration',
                operation: req.operation || 'error',
                userId: req.userId,
                metadata: errorData,
                tags: ['integration', 'error'],
                traceId: req.traceId,
                spanId: req.spanId
            });
        }
        catch (error) {
            this.logger.error('Error logging error', { error });
        }
    }
    collectRequestMetrics(req, res, responseTime) {
        try {
            const tags = {
                method: req.method,
                path: req.path,
                status_code: res.statusCode.toString(),
                service: req.service || 'integration'
            };
            if (req.userId) {
                tags.user_id = req.userId;
            }
            if (req.operation) {
                tags.operation = req.operation;
            }
            this.metricsCollector.recordTiming('integration_response_time', responseTime, tags);
            this.metricsCollector.incrementCounter('integration_request_count', 1, tags);
            if (res.statusCode >= 400) {
                this.metricsCollector.incrementCounter('integration_error_count', 1, tags);
            }
            this.metricsCollector.incrementCounter('integration_status_code', 1, {
                ...tags,
                status_code: res.statusCode.toString()
            });
        }
        catch (error) {
            this.logger.error('Error collecting metrics', { error });
        }
    }
    checkForAlerts(req, res, responseTime) {
        try {
            const tags = {
                service: req.service || 'integration',
                operation: req.operation || 'unknown',
                method: req.method,
                path: req.path
            };
            if (responseTime > 5000) {
                this.alertingService.evaluateAlert('response_time', responseTime, tags);
            }
            if (res.statusCode >= 500) {
                this.alertingService.evaluateAlert('server_error_count', 1, tags);
            }
            if (res.statusCode >= 400 && res.statusCode < 500) {
                this.alertingService.evaluateAlert('client_error_count', 1, tags);
            }
        }
        catch (error) {
            this.logger.error('Error checking alerts', { error });
        }
    }
    sanitizeHeaders(headers) {
        const sanitized = {};
        for (const [key, value] of Object.entries(headers)) {
            if (this.config.sensitiveHeaders.some(sensitive => key.toLowerCase().includes(sensitive.toLowerCase()))) {
                sanitized[key] = '[REDACTED]';
            }
            else {
                sanitized[key] = String(value);
            }
        }
        return sanitized;
    }
    sanitizeQueryParams(query) {
        const sanitized = {};
        for (const [key, value] of Object.entries(query)) {
            if (this.config.sensitiveQueryParams.some(sensitive => key.toLowerCase().includes(sensitive.toLowerCase()))) {
                sanitized[key] = '[REDACTED]';
            }
            else {
                sanitized[key] = String(value);
            }
        }
        return sanitized;
    }
    sanitizeBody(body) {
        if (!body || typeof body !== 'object') {
            return body;
        }
        const sanitized = {};
        for (const [key, value] of Object.entries(body)) {
            if (this.config.sensitiveQueryParams.some(sensitive => key.toLowerCase().includes(sensitive.toLowerCase()))) {
                sanitized[key] = '[REDACTED]';
            }
            else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeBody(value);
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    generateTraceId() {
        return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateSpanId() {
        return `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logger.info('Monitoring middleware configuration updated', { config: this.config });
    }
    getConfig() {
        return { ...this.config };
    }
    enable() {
        this.config.enabled = true;
        this.logger.info('Monitoring middleware enabled');
    }
    disable() {
        this.config.enabled = false;
        this.logger.info('Monitoring middleware disabled');
    }
    setSampleRate(rate) {
        if (rate < 0 || rate > 1) {
            throw new Error('Sample rate must be between 0 and 1');
        }
        this.config.sampleRate = rate;
        this.logger.info('Sample rate updated', { rate });
    }
    addSensitiveHeader(header) {
        if (!this.config.sensitiveHeaders.includes(header)) {
            this.config.sensitiveHeaders.push(header);
            this.logger.info('Sensitive header added', { header });
        }
    }
    removeSensitiveHeader(header) {
        const index = this.config.sensitiveHeaders.indexOf(header);
        if (index > -1) {
            this.config.sensitiveHeaders.splice(index, 1);
            this.logger.info('Sensitive header removed', { header });
        }
    }
    addSensitiveQueryParam(param) {
        if (!this.config.sensitiveQueryParams.includes(param)) {
            this.config.sensitiveQueryParams.push(param);
            this.logger.info('Sensitive query parameter added', { param });
        }
    }
    removeSensitiveQueryParam(param) {
        const index = this.config.sensitiveQueryParams.indexOf(param);
        if (index > -1) {
            this.config.sensitiveQueryParams.splice(index, 1);
            this.logger.info('Sensitive query parameter removed', { param });
        }
    }
}
exports.IntegrationMonitoringMiddleware = IntegrationMonitoringMiddleware;
function createIntegrationMonitoringMiddleware(metricsCollector, alertingService, loggingService, config) {
    const middleware = new IntegrationMonitoringMiddleware(metricsCollector, alertingService, loggingService, config);
    return middleware.middleware;
}
//# sourceMappingURL=integrationMonitoring.js.map