import * as crypto from 'crypto';
import integrationConfig from '../../config/integration';
import { IntegrationLoggerImplementation } from './logger';

export class ConfigManagerImplementation {
  private logger: IntegrationLoggerImplementation;
  private encryptedFields: string[] = [
    'apiKey',
    'clientSecret',
    'authToken',
    'secret',
    'webhookSecret'
  ];

  constructor() {
    this.logger = new IntegrationLoggerImplementation();
  }

  getServiceConfig(service: string): any {
    const config = (integrationConfig as any)[service];
    if (!config) {
      this.logger.warn('Service configuration not found', { service });
      return null;
    }

    if (!config.enabled) {
      this.logger.debug('Service disabled', { service });
      return null;
    }

    // Return a copy to prevent modification
    return JSON.parse(JSON.stringify(config));
  }

  getGatewayConfig(): any {
    return {
      ...integrationConfig.gateway,
      auth: integrationConfig.auth,
      logging: integrationConfig.logging
    };
  }

  getCircuitBreakerConfig(): any {
    return integrationConfig.circuitBreaker;
  }

  getRateLimitConfig(): any {
    return integrationConfig.rateLimit;
  }

  getCacheConfig(): any {
    return integrationConfig.cache;
  }

  getWebhookConfig(): any {
    return integrationConfig.webhooks;
  }

  async encryptValue(value: string, service: string): Promise<string> {
    try {
      const encryptionKey = this.getEncryptionKey(service);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', encryptionKey);
      
      let encrypted = cipher.update(value, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      this.logger.error('Encryption failed', { service, error });
      throw new Error('Failed to encrypt value');
    }
  }

  async decryptValue(encryptedValue: string, service: string): Promise<string> {
    try {
      const encryptionKey = this.getEncryptionKey(service);
      const parts = encryptedValue.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKey, iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', { service, error });
      throw new Error('Failed to decrypt value');
    }
  }

  async secureConfig(config: any, service: string): Promise<any> {
    const securedConfig = { ...config };
    
    for (const field of this.encryptedFields) {
      if (securedConfig[field] && typeof securedConfig[field] === 'string') {
        securedConfig[field] = await this.encryptValue(securedConfig[field], service);
      }
    }
    
    return securedConfig;
  }

  async revealConfig(securedConfig: any, service: string): Promise<any> {
    const revealedConfig = { ...securedConfig };
    
    for (const field of this.encryptedFields) {
      if (revealedConfig[field] && typeof revealedConfig[field] === 'string') {
        try {
          revealedConfig[field] = await this.decryptValue(revealedConfig[field], service);
        } catch (error) {
          this.logger.warn('Failed to decrypt field', { service, field, error });
          // Keep encrypted value if decryption fails
        }
      }
    }
    
    return revealedConfig;
  }

  validateConfig(config: any, service: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!config.enabled) {
      return { valid: true, errors: [] };
    }

    // Required fields validation
    const requiredFields = this.getRequiredFields(service);
    for (const field of requiredFields) {
      if (!config[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // URL validation
    const urlFields = this.getUrlFields(service);
    for (const field of urlFields) {
      if (config[field] && !this.isValidUrl(config[field])) {
        errors.push(`Invalid URL format for field: ${field}`);
      }
    }

    // Timeout validation
    if (config.timeout && (isNaN(config.timeout) || config.timeout <= 0)) {
      errors.push('Timeout must be a positive number');
    }

    if (errors.length > 0) {
      this.logger.warn('Configuration validation failed', { service, errors });
    }

    return { valid: errors.length === 0, errors };
  }

  private getEncryptionKey(service: string): string {
    const baseKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
    return crypto.createHash('sha256').update(baseKey + service).digest('hex');
  }

  private getRequiredFields(service: string): string[] {
    const requiredFieldsMap: Record<string, string[]> = {
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

  private getUrlFields(service: string): string[] {
    const urlFieldsMap: Record<string, string[]> = {
      pacer: ['baseUrl'],
      stateCourts: ['baseUrl'],
      lexisNexis: ['baseUrl'],
      westlaw: ['baseUrl'],
      paypal: ['baseUrl']
    };

    return urlFieldsMap[service] || [];
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  async rotateApiKey(service: string, oldKey: string, newKey: string): Promise<boolean> {
    try {
      const db = require('../../utils/database').Database;
      const database = new db();
      await database.connect();

      // Update API key in database
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

    } catch (error) {
      this.logger.error('API key rotation failed', { service, error });
      return false;
    }
  }

  async getActiveServices(): Promise<string[]> {
    const services: string[] = [];
    
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