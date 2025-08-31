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
exports.ConfigManagerImplementation = void 0;
const crypto = __importStar(require("crypto"));
const integration_1 = __importDefault(require("../../config/integration"));
const logger_1 = require("./logger");
class ConfigManagerImplementation {
    constructor() {
        this.encryptedFields = [
            'apiKey',
            'clientSecret',
            'authToken',
            'secret',
            'webhookSecret'
        ];
        this.logger = new logger_1.IntegrationLoggerImplementation();
    }
    getServiceConfig(service) {
        const config = integration_1.default[service];
        if (!config) {
            this.logger.warn('Service configuration not found', { service });
            return null;
        }
        if (!config.enabled) {
            this.logger.debug('Service disabled', { service });
            return null;
        }
        return JSON.parse(JSON.stringify(config));
    }
    getGatewayConfig() {
        return {
            ...integration_1.default.gateway,
            auth: integration_1.default.auth,
            logging: integration_1.default.logging
        };
    }
    getCircuitBreakerConfig() {
        return integration_1.default.circuitBreaker;
    }
    getRateLimitConfig() {
        return integration_1.default.rateLimit;
    }
    getCacheConfig() {
        return integration_1.default.cache;
    }
    getWebhookConfig() {
        return integration_1.default.webhooks;
    }
    async encryptValue(value, service) {
        try {
            const encryptionKey = this.getEncryptionKey(service);
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher('aes-256-cbc', encryptionKey);
            let encrypted = cipher.update(value, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            return iv.toString('hex') + ':' + encrypted;
        }
        catch (error) {
            this.logger.error('Encryption failed', { service, error });
            throw new Error('Failed to encrypt value');
        }
    }
    async decryptValue(encryptedValue, service) {
        try {
            const encryptionKey = this.getEncryptionKey(service);
            const parts = encryptedValue.split(':');
            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = parts[1];
            const decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKey, iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            this.logger.error('Decryption failed', { service, error });
            throw new Error('Failed to decrypt value');
        }
    }
    async secureConfig(config, service) {
        const securedConfig = { ...config };
        for (const field of this.encryptedFields) {
            if (securedConfig[field] && typeof securedConfig[field] === 'string') {
                securedConfig[field] = await this.encryptValue(securedConfig[field], service);
            }
        }
        return securedConfig;
    }
    async revealConfig(securedConfig, service) {
        const revealedConfig = { ...securedConfig };
        for (const field of this.encryptedFields) {
            if (revealedConfig[field] && typeof revealedConfig[field] === 'string') {
                try {
                    revealedConfig[field] = await this.decryptValue(revealedConfig[field], service);
                }
                catch (error) {
                    this.logger.warn('Failed to decrypt field', { service, field, error });
                }
            }
        }
        return revealedConfig;
    }
    validateConfig(config, service) {
        const errors = [];
        if (!config.enabled) {
            return { valid: true, errors: [] };
        }
        const requiredFields = this.getRequiredFields(service);
        for (const field of requiredFields) {
            if (!config[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        }
        const urlFields = this.getUrlFields(service);
        for (const field of urlFields) {
            if (config[field] && !this.isValidUrl(config[field])) {
                errors.push(`Invalid URL format for field: ${field}`);
            }
        }
        if (config.timeout && (isNaN(config.timeout) || config.timeout <= 0)) {
            errors.push('Timeout must be a positive number');
        }
        if (errors.length > 0) {
            this.logger.warn('Configuration validation failed', { service, errors });
        }
        return { valid: errors.length === 0, errors };
    }
    getEncryptionKey(service) {
        const baseKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
        return crypto.createHash('sha256').update(baseKey + service).digest('hex');
    }
    getRequiredFields(service) {
        const requiredFieldsMap = {
            pacer: ['apiKey', 'clientId'],
            stripe: ['apiKey'],
            paypal: ['clientId', 'clientSecret'],
            lexisNexis: ['apiKey'],
            westlaw: ['apiKey'],
            googleDrive: ['clientId', 'clientSecret'],
            dropbox: ['apiKey', 'appSecret'],
            twilio: ['accountSid', 'authToken'],
            sendGrid: ['apiKey']
        };
        return requiredFieldsMap[service] || [];
    }
    getUrlFields(service) {
        const urlFieldsMap = {
            pacer: ['baseUrl'],
            stateCourts: ['baseUrl'],
            lexisNexis: ['baseUrl'],
            westlaw: ['baseUrl'],
            paypal: ['baseUrl']
        };
        return urlFieldsMap[service] || [];
    }
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        }
        catch {
            return false;
        }
    }
    async rotateApiKey(service, oldKey, newKey) {
        try {
            const db = require('../../utils/database').Database;
            const database = new db();
            await database.connect();
            const result = await database.client.apiKey.updateMany({
                where: {
                    service: service,
                    key: oldKey
                },
                data: {
                    key: newKey,
                    updatedAt: new Date()
                }
            });
            await database.disconnect();
            if (result.count > 0) {
                this.logger.info('API key rotated successfully', { service });
                return true;
            }
            this.logger.warn('API key rotation failed - key not found', { service });
            return false;
        }
        catch (error) {
            this.logger.error('API key rotation failed', { service, error });
            return false;
        }
    }
    async getActiveServices() {
        const services = [];
        const serviceNames = [
            'pacer', 'stateCourts', 'stripe', 'paypal',
            'lexisNexis', 'westlaw', 'googleDrive', 'dropbox',
            'twilio', 'sendGrid'
        ];
        for (const service of serviceNames) {
            const config = this.getServiceConfig(service);
            if (config) {
                services.push(service);
            }
        }
        return services;
    }
}
exports.ConfigManagerImplementation = ConfigManagerImplementation;
//# sourceMappingURL=configManager.js.map