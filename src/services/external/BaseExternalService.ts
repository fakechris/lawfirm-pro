import { ServiceConfig, ServiceHealth, AuthConfig, RateLimitConfig, LoggingConfig } from './types';
import { IntegrationLoggerImplementation } from '../integration/logger';
import { ConfigManagerImplementation } from '../integration/configManager';

export abstract class BaseExternalService {
  protected config: ServiceConfig;
  protected logger: IntegrationLoggerImplementation;
  protected configManager: ConfigManagerImplementation;
  protected health: ServiceHealth;
  protected requestCount: number = 0;
  protected errorCount: number = 0;
  protected lastRequestTime: Date = new Date();
  protected startTime: Date = new Date();

  constructor(serviceName: string) {
    this.logger = new IntegrationLoggerImplementation();
    this.configManager = new ConfigManagerImplementation();
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

  protected getServiceConfig(serviceName: string): ServiceConfig {
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

  private mapAuthConfig(authConfig: any): AuthConfig {
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

  private mapRateLimitConfig(rateLimitConfig: any): RateLimitConfig {
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

  private mapLoggingConfig(loggingConfig: any): LoggingConfig {
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

  protected async makeRequest<T>(
    url: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<T> {
    const startTime = Date.now();
    const fullUrl = `${this.config.baseUrl}${url}`;

    try {
      this.logger.info(`Making request to ${this.constructor.name}`, {
        url: fullUrl,
        method: options.method || 'GET',
        retryCount
      });

      const headers = await this.getHeaders(options.headers as Record<string, string>);
      const requestConfig: RequestInit = {
        ...options,
        headers,
        signal: AbortSignal.timeout(this.config.timeout)
      };

      const response = await fetch(fullUrl, requestConfig);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as T;
      const responseTime = Date.now() - startTime;

      this.updateHealth(true, responseTime);
      this.logger.info(`Request successful`, {
        url: fullUrl,
        status: response.status,
        responseTime,
        dataSize: JSON.stringify(data).length
      });

      return data;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateHealth(false, responseTime);
      
      this.logger.error(`Request failed`, {
        url: fullUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime,
        retryCount
      });

      if (retryCount < this.config.retries) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest<T>(url, options, retryCount + 1);
      }

      throw error;
    }
  }

  protected async getHeaders(customHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
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

  protected async getOAuthToken(): Promise<string> {
    // Implement OAuth token refresh logic
    // This should be cached and refreshed when expired
    throw new Error('OAuth authentication not implemented');
  }

  protected updateHealth(success: boolean, responseTime: number): void {
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

  async getHealth(): Promise<ServiceHealth> {
    return this.health;
  }

  async testConnection(): Promise<boolean> {
    try {
      // Override in subclasses to implement specific health check
      return true;
    } catch (error) {
      this.logger.error('Connection test failed', { error });
      return false;
    }
  }

  protected logRequest(method: string, url: string, data?: any): void {
    if (!this.config.logging.enabled) return;

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

  protected logResponse(method: string, url: string, response: any, duration: number): void {
    if (!this.config.logging.enabled) return;

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

  protected logError(method: string, url: string, error: any, duration: number): void {
    if (!this.config.logging.enabled) return;

    this.logger.error('Request failed', {
      method,
      url,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
      service: this.constructor.name
    });
  }

  private maskSensitiveData(data: any): any {
    if (!this.config.logging.maskSensitiveData) return data;

    if (typeof data !== 'object' || data === null) return data;

    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'api_key', 'auth_token',
      'credit_card', 'card_number', 'cvv', 'ssn', 'social_security'
    ];

    const masked = { ...data };
    
    for (const [key, value] of Object.entries(masked)) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        masked[key] = '***MASKED***';
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.maskSensitiveData(value);
      }
    }

    return masked;
  }
}