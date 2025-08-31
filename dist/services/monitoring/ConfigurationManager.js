"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationManager = void 0;
const logger_1 = require("../../utils/logger");
const crypto_1 = __importDefault(require("crypto"));
class ConfigurationManager {
    constructor() {
        this.logger = new logger_1.Logger('ConfigurationManager');
        this.configurations = new Map();
        this.auditLogs = [];
        this.backups = new Map();
        this.rotationPolicies = new Map();
        this.encryptionKey = process.env.CONFIG_ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
        this.sensitiveFields = new Set([
            'password', 'token', 'secret', 'key', 'apiKey', 'apiSecret',
            'privateKey', 'certificate', 'authToken', 'accessToken'
        ]);
        this.initializeDefaultConfigs();
        this.startPeriodicTasks();
    }
    async createConfiguration(service, data, createdBy, options = {}) {
        try {
            const validation = this.validateConfiguration(service, data);
            if (!validation.valid) {
                throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
            }
            if (this.configurations.has(service)) {
                throw new Error(`Configuration already exists for service: ${service}`);
            }
            const config = {
                id: this.generateConfigId(),
                service,
                version: 1,
                data: options.encrypt ? this.encryptData(data) : data,
                encrypted: options.encrypt || false,
                checksum: this.calculateChecksum(data),
                createdBy,
                createdAt: new Date(),
                metadata: options.metadata
            };
            this.configurations.set(service, config);
            await this.createBackup(config, createdBy);
            this.logAuditEvent({
                configId: config.id,
                action: 'CREATE',
                userId: createdBy,
                timestamp: new Date(),
                details: { service, version: config.version, encrypted: config.encrypted }
            });
            this.logger.info('Configuration created', {
                configId: config.id,
                service,
                version: config.version,
                encrypted: config.encrypted
            });
            return config;
        }
        catch (error) {
            this.logger.error('Error creating configuration', { error, service, createdBy });
            throw error;
        }
    }
    async updateConfiguration(service, update) {
        try {
            const existing = this.configurations.get(service);
            if (!existing) {
                throw new Error(`Configuration not found for service: ${service}`);
            }
            const validation = this.validateConfiguration(service, update.data);
            if (!validation.valid) {
                throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
            }
            await this.createBackup(existing, update.updatedBy);
            const updatedConfig = {
                ...existing,
                version: existing.version + 1,
                data: update.encrypt !== false ? this.encryptData(update.data) : update.data,
                encrypted: update.encrypt !== false,
                checksum: this.calculateChecksum(update.data),
                updatedBy: update.updatedBy,
                updatedAt: new Date()
            };
            this.configurations.set(service, updatedConfig);
            this.logAuditEvent({
                configId: updatedConfig.id,
                action: 'UPDATE',
                userId: update.updatedBy,
                timestamp: new Date(),
                details: {
                    service,
                    oldVersion: existing.version,
                    newVersion: updatedConfig.version,
                    reason: update.reason,
                    encrypted: updatedConfig.encrypted
                }
            });
            this.logger.info('Configuration updated', {
                configId: updatedConfig.id,
                service,
                version: updatedConfig.version,
                updatedBy: update.updatedBy
            });
            return updatedConfig;
        }
        catch (error) {
            this.logger.error('Error updating configuration', { error, service, update });
            throw error;
        }
    }
    async getConfiguration(service, userId) {
        try {
            const config = this.configurations.get(service);
            if (!config) {
                return null;
            }
            if (userId) {
                this.logAuditEvent({
                    configId: config.id,
                    action: 'VIEW',
                    userId,
                    timestamp: new Date(),
                    details: { service, version: config.version }
                });
            }
            const returnConfig = { ...config };
            if (config.encrypted) {
                returnConfig.data = this.decryptData(config.data);
            }
            return returnConfig;
        }
        catch (error) {
            this.logger.error('Error getting configuration', { error, service });
            throw error;
        }
    }
    async getAllConfigurations(userId) {
        const configs = Array.from(this.configurations.values());
        if (userId) {
            this.logAuditEvent({
                configId: 'all',
                action: 'VIEW',
                userId,
                timestamp: new Date(),
                details: { action: 'view_all' }
            });
        }
        return configs.map(config => {
            const returnConfig = { ...config };
            if (config.encrypted) {
                returnConfig.data = this.decryptData(config.data);
            }
            return returnConfig;
        });
    }
    async deleteConfiguration(service, deletedBy) {
        try {
            const config = this.configurations.get(service);
            if (!config) {
                throw new Error(`Configuration not found for service: ${service}`);
            }
            await this.createBackup(config, deletedBy);
            this.configurations.delete(service);
            this.logAuditEvent({
                configId: config.id,
                action: 'DELETE',
                userId: deletedBy,
                timestamp: new Date(),
                details: { service, version: config.version }
            });
            this.logger.info('Configuration deleted', {
                configId: config.id,
                service,
                deletedBy
            });
        }
        catch (error) {
            this.logger.error('Error deleting configuration', { error, service, deletedBy });
            throw error;
        }
    }
    async rotateCredentials(service, rotatedBy) {
        try {
            const config = this.configurations.get(service);
            if (!config) {
                throw new Error(`Configuration not found for service: ${service}`);
            }
            await this.createBackup(config, rotatedBy);
            const newData = await this.generateNewCredentials(config.data);
            const updatedConfig = {
                ...config,
                version: config.version + 1,
                data: this.encryptData(newData),
                checksum: this.calculateChecksum(newData),
                updatedBy: rotatedBy,
                updatedAt: new Date()
            };
            this.configurations.set(service, updatedConfig);
            this.logAuditEvent({
                configId: updatedConfig.id,
                action: 'ROTATE',
                userId: rotatedBy,
                timestamp: new Date(),
                details: { service, oldVersion: config.version, newVersion: updatedConfig.version }
            });
            this.logger.info('Credentials rotated', {
                configId: updatedConfig.id,
                service,
                version: updatedConfig.version,
                rotatedBy
            });
            return updatedConfig;
        }
        catch (error) {
            this.logger.error('Error rotating credentials', { error, service, rotatedBy });
            throw error;
        }
    }
    async validateConfiguration(service, data) {
        const result = {
            valid: true,
            errors: [],
            warnings: []
        };
        try {
            if (!service || typeof service !== 'string') {
                result.errors.push('Service name is required and must be a string');
            }
            if (!data || typeof data !== 'object') {
                result.errors.push('Configuration data is required and must be an object');
            }
            switch (service) {
                case 'stripe':
                    await this.validateStripeConfig(data, result);
                    break;
                case 'pacer':
                    await this.validatePacerConfig(data, result);
                    break;
                case 'twilio':
                    await this.validateTwilioConfig(data, result);
                    break;
                case 'sendgrid':
                    await this.validateSendGridConfig(data, result);
                    break;
                default:
                    this.validateGenericConfig(data, result);
            }
            const hasSensitiveData = Object.keys(data).some(key => this.sensitiveFields.has(key.toLowerCase()));
            if (hasSensitiveData) {
                result.warnings.push('Configuration contains sensitive data - consider enabling encryption');
            }
            result.valid = result.errors.length === 0;
        }
        catch (error) {
            result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            result.valid = false;
        }
        return result;
    }
    async getAuditLogs(configId, service, action, limit = 100) {
        let logs = [...this.auditLogs];
        if (configId) {
            logs = logs.filter(log => log.configId === configId);
        }
        if (service) {
            logs = logs.filter(log => this.configurations.get(service)?.id === log.configId);
        }
        if (action) {
            logs = logs.filter(log => log.action === action);
        }
        return logs
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }
    async getBackups(service, limit = 10) {
        const backups = this.backups.get(service) || [];
        return backups
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);
    }
    async restoreBackup(service, backupId, restoredBy) {
        try {
            const backups = this.backups.get(service) || [];
            const backup = backups.find(b => b.id === backupId);
            if (!backup) {
                throw new Error(`Backup not found: ${backupId}`);
            }
            const existing = this.configurations.get(service);
            if (existing) {
                await this.createBackup(existing, restoredBy);
            }
            const restoredConfig = {
                id: this.generateConfigId(),
                service,
                version: existing ? existing.version + 1 : 1,
                data: backup.data,
                encrypted: false,
                checksum: backup.checksum,
                createdBy: restoredBy,
                createdAt: new Date(),
                metadata: { restoredFrom: backupId, restoredAt: new Date() }
            };
            this.configurations.set(service, restoredConfig);
            this.logAuditEvent({
                configId: restoredConfig.id,
                action: 'UPDATE',
                userId: restoredBy,
                timestamp: new Date(),
                details: {
                    service,
                    action: 'restore',
                    backupId,
                    version: restoredConfig.version
                }
            });
            this.logger.info('Configuration restored from backup', {
                configId: restoredConfig.id,
                service,
                backupId,
                restoredBy
            });
            return restoredConfig;
        }
        catch (error) {
            this.logger.error('Error restoring backup', { error, service, backupId });
            throw error;
        }
    }
    async setRotationPolicy(policy) {
        this.rotationPolicies.set(policy.service, policy);
        this.logger.info('Rotation policy set', { service: policy.service });
    }
    async getRotationPolicies() {
        return Array.from(this.rotationPolicies.values());
    }
    async getCredentialRotationStatus() {
        const status = [];
        for (const [service, policy] of this.rotationPolicies.entries()) {
            const config = this.configurations.get(service);
            if (!config)
                continue;
            const lastRotation = config.updatedAt || config.createdAt;
            const daysSinceRotation = (Date.now() - lastRotation.getTime()) / (1000 * 60 * 60 * 24);
            const daysUntilRotation = policy.rotationInterval - daysSinceRotation;
            let status;
            if (daysUntilRotation <= 0) {
                status = 'OVERDUE';
            }
            else if (daysUntilRotation <= policy.warningDays) {
                status = 'WARNING';
            }
            else {
                status = 'OK';
            }
            status.push({
                service,
                daysUntilRotation: Math.max(0, Math.floor(daysUntilRotation)),
                status,
                lastRotation
            });
        }
        return status;
    }
    async validateStripeConfig(data, result) {
        if (!data.apiKey) {
            result.errors.push('Stripe API key is required');
        }
        if (!data.publishableKey) {
            result.errors.push('Stripe publishable key is required');
        }
        if (data.environment && !['test', 'production'].includes(data.environment)) {
            result.errors.push('Stripe environment must be either "test" or "production"');
        }
    }
    async validatePacerConfig(data, result) {
        if (!data.clientId) {
            result.errors.push('PACER client ID is required');
        }
        if (!data.apiKey) {
            result.errors.push('PACER API key is required');
        }
        if (!data.baseUrl) {
            result.errors.push('PACER base URL is required');
        }
    }
    async validateTwilioConfig(data, result) {
        if (!data.accountSid) {
            result.errors.push('Twilio account SID is required');
        }
        if (!data.authToken) {
            result.errors.push('Twilio auth token is required');
        }
        if (!data.phoneNumber) {
            result.errors.push('Twilio phone number is required');
        }
    }
    async validateSendGridConfig(data, result) {
        if (!data.apiKey) {
            result.errors.push('SendGrid API key is required');
        }
        if (!data.fromEmail) {
            result.errors.push('SendGrid from email is required');
        }
    }
    validateGenericConfig(data, result) {
        Object.entries(data).forEach(([key, value]) => {
            if (typeof value === 'string' && value.trim() === '') {
                result.warnings.push(`Empty string value for key: ${key}`);
            }
        });
        const potentialSecrets = Object.keys(data).filter(key => this.sensitiveFields.has(key.toLowerCase()));
        if (potentialSecrets.length > 0) {
            result.warnings.push(`Configuration contains potential secrets: ${potentialSecrets.join(', ')}`);
        }
    }
    encryptData(data) {
        const encrypted = {};
        for (const [key, value] of Object.entries(data)) {
            if (this.sensitiveFields.has(key.toLowerCase()) && typeof value === 'string') {
                encrypted[key] = this.encryptValue(value);
            }
            else {
                encrypted[key] = value;
            }
        }
        return encrypted;
    }
    decryptData(data) {
        const decrypted = {};
        for (const [key, value] of Object.entries(data)) {
            if (this.sensitiveFields.has(key.toLowerCase()) && typeof value === 'string') {
                decrypted[key] = this.decryptValue(value);
            }
            else {
                decrypted[key] = value;
            }
        }
        return decrypted;
    }
    encryptValue(value) {
        const algorithm = 'aes-256-cbc';
        const key = crypto_1.default.scryptSync(this.encryptionKey, 'salt', 32);
        const iv = crypto_1.default.randomBytes(16);
        const cipher = crypto_1.default.createCipher(algorithm, key);
        cipher.setAAD(Buffer.from('config-encryption'));
        let encrypted = cipher.update(value, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return `${iv.toString('hex')}:${encrypted}`;
    }
    decryptValue(encryptedValue) {
        try {
            const [ivHex, encrypted] = encryptedValue.split(':');
            const algorithm = 'aes-256-cbc';
            const key = crypto_1.default.scryptSync(this.encryptionKey, 'salt', 32);
            const iv = Buffer.from(ivHex, 'hex');
            const decipher = crypto_1.default.createDecipher(algorithm, key);
            decipher.setAAD(Buffer.from('config-encryption'));
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            this.logger.error('Error decrypting value', { error });
            return '[DECRYPTION_FAILED]';
        }
    }
    calculateChecksum(data) {
        const dataString = JSON.stringify(data, Object.keys(data).sort());
        return crypto_1.default.createHash('sha256').update(dataString).digest('hex');
    }
    async generateNewCredentials(currentData) {
        const newData = { ...currentData };
        for (const key of Object.keys(currentData)) {
            if (key.toLowerCase().includes('key') || key.toLowerCase().includes('secret')) {
                newData[key] = this.generateSecureToken();
            }
        }
        return newData;
    }
    generateSecureToken() {
        return crypto_1.default.randomBytes(32).toString('hex');
    }
    async createBackup(config, createdBy) {
        const backup = {
            id: this.generateBackupId(),
            configId: config.id,
            service: config.service,
            data: config.data,
            createdAt: new Date(),
            createdBy,
            checksum: config.checksum
        };
        if (!this.backups.has(config.service)) {
            this.backups.set(config.service, []);
        }
        this.backups.get(config.service).push(backup);
        const backups = this.backups.get(config.service);
        if (backups.length > 20) {
            backups.splice(0, backups.length - 20);
        }
    }
    logAuditEvent(event) {
        const auditEvent = {
            ...event,
            id: this.generateAuditId()
        };
        this.auditLogs.push(auditEvent);
        if (this.auditLogs.length > 10000) {
            this.auditLogs = this.auditLogs.slice(-10000);
        }
    }
    initializeDefaultConfigs() {
        const defaultPolicies = [
            {
                service: 'stripe',
                rotationInterval: 90,
                warningDays: 7,
                autoRotate: false,
                notifyBeforeRotation: true,
                notificationChannels: ['default-email', 'default-slack']
            },
            {
                service: 'pacer',
                rotationInterval: 180,
                warningDays: 14,
                autoRotate: false,
                notifyBeforeRotation: true,
                notificationChannels: ['default-email', 'default-slack']
            },
            {
                service: 'twilio',
                rotationInterval: 365,
                warningDays: 30,
                autoRotate: false,
                notifyBeforeRotation: true,
                notificationChannels: ['default-email', 'default-slack']
            }
        ];
        defaultPolicies.forEach(policy => {
            this.rotationPolicies.set(policy.service, policy);
        });
    }
    startPeriodicTasks() {
        setInterval(async () => {
            await this.checkCredentialRotation();
        }, 24 * 60 * 60 * 1000);
        setInterval(() => {
            this.cleanupOldAuditLogs();
        }, 7 * 24 * 60 * 60 * 1000);
        setInterval(() => {
            this.cleanupOldBackups();
        }, 30 * 24 * 60 * 60 * 1000);
    }
    async checkCredentialRotation() {
        const rotationStatus = await this.getCredentialRotationStatus();
        for (const status of rotationStatus) {
            if (status.status === 'OVERDUE') {
                this.logger.warn('Credential rotation overdue', {
                    service: status.service,
                    daysOverdue: Math.abs(status.daysUntilRotation)
                });
            }
            else if (status.status === 'WARNING') {
                this.logger.info('Credential rotation due soon', {
                    service: status.service,
                    daysUntilRotation: status.daysUntilRotation
                });
            }
        }
    }
    cleanupOldAuditLogs() {
        const cutoffTime = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        this.auditLogs = this.auditLogs.filter(log => log.timestamp > cutoffTime);
    }
    cleanupOldBackups() {
        const cutoffTime = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
        for (const [service, backups] of this.backups.entries()) {
            const filtered = backups.filter(backup => backup.createdAt > cutoffTime);
            this.backups.set(service, filtered);
        }
    }
    generateConfigId() {
        return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateBackupId() {
        return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateAuditId() {
        return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.ConfigurationManager = ConfigurationManager;
//# sourceMappingURL=ConfigurationManager.js.map