"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseExternalService = void 0;
const logger_1 = require("../integration/logger");
const configManager_1 = require("../integration/configManager");
class BaseExternalService {
    constructor(serviceName) {
        this.requestCount = 0;
        this.errorCount = 0;
        this.lastRequestTime = new Date();
        this.startTime = new Date();
        this.logger = new logger_1.IntegrationLoggerImplementation();
        this.configManager = new configManager_1.ConfigManagerImplementation();
        this.config = this.getServiceConfig(serviceName);
        this.health = {
            status: 'healthy',
            timestamp: new Date(),
            uptime: 0,
            responseTime: 0,
            errorRate: 0,
            lastChecked: new Date()
        };
    }
    getServiceConfig(serviceName) {
        const serviceConfig = this.configManager.getServiceConfig(serviceName);
        if (!serviceConfig) {
            throw new Error(`Configuration not found for service: ${serviceName}`);
        }
        return {
            baseUrl: serviceConfig.baseUrl || '',
            timeout: serviceConfig.timeout || 30000,
            retries: serviceConfig.retries || 3,
            authentication: this.mapAuthConfig(serviceConfig.authentication),
            rateLimit: this.mapRateLimitConfig(serviceConfig.rateLimit),
            logging: this.mapLoggingConfig(serviceConfig.logging)
        };
    }
    mapAuthConfig(authConfig) {
        if (!authConfig) {
            return {
                type: 'none',
                credentials: {}
            };
        }
        return {
            type: authConfig.type || 'none',
            credentials: authConfig.credentials || {},
            tokenUrl: authConfig.tokenUrl,
            scopes: authConfig.scopes
        };
    }
    mapRateLimitConfig(rateLimitConfig) {
        if (!rateLimitConfig) {
            return {
                enabled: false,
                requestsPerMinute: 0,
                requestsPerHour: 0,
                requestsPerDay: 0
            };
        }
        return {
            enabled: rateLimitConfig.enabled || false,
            requestsPerMinute: rateLimitConfig.requestsPerMinute || 0,
            requestsPerHour: rateLimitConfig.requestsPerHour || 0,
            requestsPerDay: rateLimitConfig.requestsPerDay || 0
        };
    }
    mapLoggingConfig(loggingConfig) {
        if (!loggingConfig) {
            return {
                enabled: true,
                level: 'info',
                maskSensitiveData: true
            };
        }
        return {
            enabled: loggingConfig.enabled !== false,
            level: loggingConfig.level || 'info',
            maskSensitiveData: loggingConfig.maskSensitiveData !== false
        };
    }
    async makeRequest(url, options = {}, retryCount = 0) {
        const startTime = Date.now();
        const fullUrl = `${this.config.baseUrl}${url}`;
        try {
            this.logger.info(`Making request to ${this.constructor.name}`, {
                url: fullUrl,
                method: options.method || 'GET',
                retryCount
            });
            const headers = await this.getHeaders(options.headers);
            const requestConfig = {
                ...options,
                headers,
                signal: AbortSignal.timeout(this.config.timeout)
            };
            const response = await fetch(fullUrl, requestConfig);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            const responseTime = Date.now() - startTime;
            this.updateHealth(true, responseTime);
            this.logger.info(`Request successful`, {
                url: fullUrl,
                status: response.status,
                responseTime,
                dataSize: JSON.stringify(data).length
            });
            return data;
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            this.updateHealth(false, responseTime);
            this.logger.error(`Request failed`, {
                url: fullUrl,
                error: error instanceof Error ? error.message : 'Unknown error',
                responseTime,
                retryCount
            });
            if (retryCount < this.config.retries) {
                const delay = Math.pow(2, retryCount) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.makeRequest(url, options, retryCount + 1);
            }
            throw error;
        }
    }
    async getHeaders(customHeaders = {}) {
        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'LawFirmPro/1.0.0',
            ...customHeaders
        };
        switch (this.config.authentication.type) {
            case 'apiKey':
                headers['Authorization'] = `Bearer ${this.config.authentication.credentials.apiKey}`;
                break;
            case 'basic':
                const { username, password } = this.config.authentication.credentials;
                headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
                break;
            case 'bearer':
                headers['Authorization'] = `Bearer ${this.config.authentication.credentials.token}`;
                break;
            case 'oauth':
                const token = await this.getOAuthToken();
                headers['Authorization'] = `Bearer ${token}`;
                break;
        }
        return headers;
    }
    async getOAuthToken() {
        throw new Error('OAuth authentication not implemented');
    }
    updateHealth(success, responseTime) {
        this.requestCount++;
        if (!success) {
            this.errorCount++;
        }
        const uptime = Date.now() - this.startTime.getTime();
        const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
        this.health = {
            status: errorRate > 10 ? 'degraded' : errorRate > 20 ? 'unhealthy' : 'healthy',
            timestamp: new Date(),
            uptime,
            responseTime,
            errorRate,
            lastChecked: new Date()
        };
    }
    async getHealth() {
        return this.health;
    }
    async testConnection() {
        try {
            return true;
        }
        catch (error) {
            this.logger.error('Connection test failed', { error });
            return false;
        }
    }
    logRequest(method, url, data) {
        if (!this.config.logging.enabled)
            return;
        const logData = {
            method,
            url,
            timestamp: new Date(),
            service: this.constructor.name
        };
        if (this.config.logging.level === 'debug' && data) {
            Object.assign(logData, { data: this.maskSensitiveData(data) });
        }
        this.logger.info('Request initiated', logData);
    }
    logResponse(method, url, response, duration) {
        if (!this.config.logging.enabled)
            return;
        const logData = {
            method,
            url,
            duration,
            status: 'success',
            timestamp: new Date(),
            service: this.constructor.name
        };
        if (this.config.logging.level === 'debug') {
            Object.assign(logData, { response: this.maskSensitiveData(response) });
        }
        this.logger.info('Request completed', logData);
    }
    logError(method, url, error, duration) {
        if (!this.config.logging.enabled)
            return;
        this.logger.error('Request failed', {
            method,
            url,
            duration,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
            service: this.constructor.name
        });
    }
    maskSensitiveData(data) {
        if (!this.config.logging.maskSensitiveData)
            return data;
        if (typeof data !== 'object' || data === null)
            return data;
        const sensitiveFields = [
            'password', 'token', 'secret', 'key', 'api_key', 'auth_token',
            'credit_card', 'card_number', 'cvv', 'ssn', 'social_security'
        ];
        const masked = { ...data };
        for (const [key, value] of Object.entries(masked)) {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                masked[key] = '***MASKED***';
            }
            else if (typeof value === 'object' && value !== null) {
                masked[key] = this.maskSensitiveData(value);
            }
        }
        return masked;
    }
}
exports.BaseExternalService = BaseExternalService;
//# sourceMappingURL=BaseExternalService.js.map