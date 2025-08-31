import { Logger } from '../../utils/logger';
import crypto from 'crypto';

export interface Configuration {
  id: string;
  service: string;
  version: number;
  data: Record<string, any>;
  encrypted: boolean;
  checksum: string;
  createdBy: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt?: Date;
  metadata?: Record<string, any>;
}

export interface ConfigUpdateRequest {
  service: string;
  data: Record<string, any>;
  updatedBy: string;
  reason?: string;
  encrypt?: boolean;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConfigAuditLog {
  id: string;
  configId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ROTATE' | 'VIEW';
  userId: string;
  timestamp: Date;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface CredentialRotationPolicy {
  service: string;
  rotationInterval: number; // in days
  warningDays: number;
  autoRotate: boolean;
  notifyBeforeRotation: boolean;
  notificationChannels: string[];
}

export interface ConfigBackup {
  id: string;
  configId: string;
  service: string;
  data: Record<string, any>;
  createdAt: Date;
  createdBy: string;
  checksum: string;
}

export class ConfigurationManager {
  private logger: Logger;
  private configurations: Map<string, Configuration>;
  private auditLogs: ConfigAuditLog[];
  private backups: Map<string, ConfigBackup[]>;
  private rotationPolicies: Map<string, CredentialRotationPolicy>;
  private encryptionKey: string;
  private sensitiveFields: Set<string>;

  constructor() {
    this.logger = new Logger('ConfigurationManager');
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

  async createConfiguration(
    service: string,
    data: Record<string, any>,
    createdBy: string,
    options: { encrypt?: boolean; metadata?: Record<string, any> } = {}
  ): Promise<Configuration> {
    try {
      // Validate configuration
      const validation = this.validateConfiguration(service, data);
      if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if configuration already exists
      if (this.configurations.has(service)) {
        throw new Error(`Configuration already exists for service: ${service}`);
      }

      const config: Configuration = {
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
      
      // Create backup
      await this.createBackup(config, createdBy);
      
      // Log audit event
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
    } catch (error) {
      this.logger.error('Error creating configuration', { error, service, createdBy });
      throw error;
    }
  }

  async updateConfiguration(
    service: string,
    update: ConfigUpdateRequest
  ): Promise<Configuration> {
    try {
      const existing = this.configurations.get(service);
      if (!existing) {
        throw new Error(`Configuration not found for service: ${service}`);
      }

      // Validate configuration
      const validation = this.validateConfiguration(service, update.data);
      if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }

      // Create backup before update
      await this.createBackup(existing, update.updatedBy);

      // Update configuration
      const updatedConfig: Configuration = {
        ...existing,
        version: existing.version + 1,
        data: update.encrypt !== false ? this.encryptData(update.data) : update.data,
        encrypted: update.encrypt !== false,
        checksum: this.calculateChecksum(update.data),
        updatedBy: update.updatedBy,
        updatedAt: new Date()
      };

      this.configurations.set(service, updatedConfig);

      // Log audit event
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
    } catch (error) {
      this.logger.error('Error updating configuration', { error, service, update });
      throw error;
    }
  }

  async getConfiguration(service: string, userId?: string): Promise<Configuration | null> {
    try {
      const config = this.configurations.get(service);
      if (!config) {
        return null;
      }

      // Log view access
      if (userId) {
        this.logAuditEvent({
          configId: config.id,
          action: 'VIEW',
          userId,
          timestamp: new Date(),
          details: { service, version: config.version }
        });
      }

      // Return decrypted data if encrypted
      const returnConfig = { ...config };
      if (config.encrypted) {
        returnConfig.data = this.decryptData(config.data);
      }

      return returnConfig;
    } catch (error) {
      this.logger.error('Error getting configuration', { error, service });
      throw error;
    }
  }

  async getAllConfigurations(userId?: string): Promise<Configuration[]> {
    const configs = Array.from(this.configurations.values());
    
    // Log view access
    if (userId) {
      this.logAuditEvent({
        configId: 'all',
        action: 'VIEW',
        userId,
        timestamp: new Date(),
        details: { action: 'view_all' }
      });
    }

    // Return decrypted data for encrypted configs
    return configs.map(config => {
      const returnConfig = { ...config };
      if (config.encrypted) {
        returnConfig.data = this.decryptData(config.data);
      }
      return returnConfig;
    });
  }

  async deleteConfiguration(service: string, deletedBy: string): Promise<void> {
    try {
      const config = this.configurations.get(service);
      if (!config) {
        throw new Error(`Configuration not found for service: ${service}`);
      }

      // Create backup before deletion
      await this.createBackup(config, deletedBy);

      this.configurations.delete(service);

      // Log audit event
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
    } catch (error) {
      this.logger.error('Error deleting configuration', { error, service, deletedBy });
      throw error;
    }
  }

  async rotateCredentials(service: string, rotatedBy: string): Promise<Configuration> {
    try {
      const config = this.configurations.get(service);
      if (!config) {
        throw new Error(`Configuration not found for service: ${service}`);
      }

      // Create backup before rotation
      await this.createBackup(config, rotatedBy);

      // Generate new credentials
      const newData = await this.generateNewCredentials(config.data);
      
      // Update configuration
      const updatedConfig: Configuration = {
        ...config,
        version: config.version + 1,
        data: this.encryptData(newData),
        checksum: this.calculateChecksum(newData),
        updatedBy: rotatedBy,
        updatedAt: new Date()
      };

      this.configurations.set(service, updatedConfig);

      // Log audit event
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
    } catch (error) {
      this.logger.error('Error rotating credentials', { error, service, rotatedBy });
      throw error;
    }
  }

  async validateConfiguration(service: string, data: Record<string, any>): Promise<ConfigValidationResult> {
    const result: ConfigValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    try {
      // Basic validation
      if (!service || typeof service !== 'string') {
        result.errors.push('Service name is required and must be a string');
      }

      if (!data || typeof data !== 'object') {
        result.errors.push('Configuration data is required and must be an object');
      }

      // Service-specific validation
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
          // Generic validation
          this.validateGenericConfig(data, result);
      }

      // Check for sensitive data that should be encrypted
      const hasSensitiveData = Object.keys(data).some(key => 
        this.sensitiveFields.has(key.toLowerCase())
      );
      
      if (hasSensitiveData) {
        result.warnings.push('Configuration contains sensitive data - consider enabling encryption');
      }

      result.valid = result.errors.length === 0;
    } catch (error) {
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.valid = false;
    }

    return result;
  }

  async getAuditLogs(
    configId?: string,
    service?: string,
    action?: ConfigAuditLog['action'],
    limit: number = 100
  ): Promise<ConfigAuditLog[]> {
    let logs = [...this.auditLogs];

    if (configId) {
      logs = logs.filter(log => log.configId === configId);
    }

    if (service) {
      logs = logs.filter(log => 
        this.configurations.get(service)?.id === log.configId
      );
    }

    if (action) {
      logs = logs.filter(log => log.action === action);
    }

    return logs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async getBackups(service: string, limit: number = 10): Promise<ConfigBackup[]> {
    const backups = this.backups.get(service) || [];
    return backups
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async restoreBackup(service: string, backupId: string, restoredBy: string): Promise<Configuration> {
    try {
      const backups = this.backups.get(service) || [];
      const backup = backups.find(b => b.id === backupId);
      
      if (!backup) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      const existing = this.configurations.get(service);
      if (existing) {
        // Create backup of current state before restore
        await this.createBackup(existing, restoredBy);
      }

      // Restore from backup
      const restoredConfig: Configuration = {
        id: this.generateConfigId(),
        service,
        version: existing ? existing.version + 1 : 1,
        data: backup.data,
        encrypted: false, // Backups are stored unencrypted
        checksum: backup.checksum,
        createdBy: restoredBy,
        createdAt: new Date(),
        metadata: { restoredFrom: backupId, restoredAt: new Date() }
      };

      this.configurations.set(service, restoredConfig);

      // Log audit event
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
    } catch (error) {
      this.logger.error('Error restoring backup', { error, service, backupId });
      throw error;
    }
  }

  async setRotationPolicy(policy: CredentialRotationPolicy): Promise<void> {
    this.rotationPolicies.set(policy.service, policy);
    this.logger.info('Rotation policy set', { service: policy.service });
  }

  async getRotationPolicies(): Promise<CredentialRotationPolicy[]> {
    return Array.from(this.rotationPolicies.values());
  }

  async getCredentialRotationStatus(): Promise<Array<{
    service: string;
    daysUntilRotation: number;
    status: 'OK' | 'WARNING' | 'OVERDUE';
    lastRotation?: Date;
  }>> {
    const status: Array<{
      service: string;
      daysUntilRotation: number;
      status: 'OK' | 'WARNING' | 'OVERDUE';
      lastRotation?: Date;
    }> = [];

    for (const [service, policy] of this.rotationPolicies.entries()) {
      const config = this.configurations.get(service);
      if (!config) continue;

      const lastRotation = config.updatedAt || config.createdAt;
      const daysSinceRotation = (Date.now() - lastRotation.getTime()) / (1000 * 60 * 60 * 24);
      const daysUntilRotation = policy.rotationInterval - daysSinceRotation;

      let status: 'OK' | 'WARNING' | 'OVERDUE';
      if (daysUntilRotation <= 0) {
        status = 'OVERDUE';
      } else if (daysUntilRotation <= policy.warningDays) {
        status = 'WARNING';
      } else {
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

  private async validateStripeConfig(data: Record<string, any>, result: ConfigValidationResult): Promise<void> {
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

  private async validatePacerConfig(data: Record<string, any>, result: ConfigValidationResult): Promise<void> {
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

  private async validateTwilioConfig(data: Record<string, any>, result: ConfigValidationResult): Promise<void> {
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

  private async validateSendGridConfig(data: Record<string, any>, result: ConfigValidationResult): Promise<void> {
    if (!data.apiKey) {
      result.errors.push('SendGrid API key is required');
    }

    if (!data.fromEmail) {
      result.errors.push('SendGrid from email is required');
    }
  }

  private validateGenericConfig(data: Record<string, any>, result: ConfigValidationResult): void {
    // Check for empty string values
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'string' && value.trim() === '') {
        result.warnings.push(`Empty string value for key: ${key}`);
      }
    });

    // Check for potential secrets in config
    const potentialSecrets = Object.keys(data).filter(key => 
      this.sensitiveFields.has(key.toLowerCase())
    );

    if (potentialSecrets.length > 0) {
      result.warnings.push(`Configuration contains potential secrets: ${potentialSecrets.join(', ')}`);
    }
  }

  private encryptData(data: Record<string, any>): Record<string, any> {
    const encrypted: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (this.sensitiveFields.has(key.toLowerCase()) && typeof value === 'string') {
        encrypted[key] = this.encryptValue(value);
      } else {
        encrypted[key] = value;
      }
    }
    
    return encrypted;
  }

  private decryptData(data: Record<string, any>): Record<string, any> {
    const decrypted: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (this.sensitiveFields.has(key.toLowerCase()) && typeof value === 'string') {
        decrypted[key] = this.decryptValue(value);
      } else {
        decrypted[key] = value;
      }
    }
    
    return decrypted;
  }

  private encryptValue(value: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    cipher.setAAD(Buffer.from('config-encryption'));
    
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }

  private decryptValue(encryptedValue: string): string {
    try {
      const [ivHex, encrypted] = encryptedValue.split(':');
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const iv = Buffer.from(ivHex, 'hex');
      
      const decipher = crypto.createDecipher(algorithm, key);
      decipher.setAAD(Buffer.from('config-encryption'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      this.logger.error('Error decrypting value', { error });
      return '[DECRYPTION_FAILED]';
    }
  }

  private calculateChecksum(data: Record<string, any>): string {
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  private async generateNewCredentials(currentData: Record<string, any>): Promise<Record<string, any>> {
    const newData = { ...currentData };
    
    // Generate new API keys for services that support it
    for (const key of Object.keys(currentData)) {
      if (key.toLowerCase().includes('key') || key.toLowerCase().includes('secret')) {
        // In a real implementation, this would call the service API to generate new credentials
        newData[key] = this.generateSecureToken();
      }
    }
    
    return newData;
  }

  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private async createBackup(config: Configuration, createdBy: string): Promise<void> {
    const backup: ConfigBackup = {
      id: this.generateBackupId(),
      configId: config.id,
      service: config.service,
      data: config.data, // Store as-is (encrypted or not)
      createdAt: new Date(),
      createdBy,
      checksum: config.checksum
    };

    if (!this.backups.has(config.service)) {
      this.backups.set(config.service, []);
    }

    this.backups.get(config.service)!.push(backup);

    // Keep only last 20 backups per service
    const backups = this.backups.get(config.service)!;
    if (backups.length > 20) {
      backups.splice(0, backups.length - 20);
    }
  }

  private logAuditEvent(event: Omit<ConfigAuditLog, 'id'>): void {
    const auditEvent: ConfigAuditLog = {
      ...event,
      id: this.generateAuditId()
    };

    this.auditLogs.push(auditEvent);

    // Keep only last 10,000 audit logs
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-10000);
    }
  }

  private initializeDefaultConfigs(): void {
    // Initialize default rotation policies
    const defaultPolicies: CredentialRotationPolicy[] = [
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

  private startPeriodicTasks(): void {
    // Check for credential rotation every day
    setInterval(async () => {
      await this.checkCredentialRotation();
    }, 24 * 60 * 60 * 1000);

    // Clean up old audit logs every week
    setInterval(() => {
      this.cleanupOldAuditLogs();
    }, 7 * 24 * 60 * 60 * 1000);

    // Clean up old backups every month
    setInterval(() => {
      this.cleanupOldBackups();
    }, 30 * 24 * 60 * 60 * 1000);
  }

  private async checkCredentialRotation(): Promise<void> {
    const rotationStatus = await this.getCredentialRotationStatus();
    
    for (const status of rotationStatus) {
      if (status.status === 'OVERDUE') {
        this.logger.warn('Credential rotation overdue', { 
          service: status.service, 
          daysOverdue: Math.abs(status.daysUntilRotation) 
        });
      } else if (status.status === 'WARNING') {
        this.logger.info('Credential rotation due soon', { 
          service: status.service, 
          daysUntilRotation: status.daysUntilRotation 
        });
      }
    }
  }

  private cleanupOldAuditLogs(): void {
    const cutoffTime = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days
    this.auditLogs = this.auditLogs.filter(log => log.timestamp > cutoffTime);
  }

  private cleanupOldBackups(): void {
    const cutoffTime = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000); // 180 days
    
    for (const [service, backups] of this.backups.entries()) {
      const filtered = backups.filter(backup => backup.createdAt > cutoffTime);
      this.backups.set(service, filtered);
    }
  }

  private generateConfigId(): string {
    return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}