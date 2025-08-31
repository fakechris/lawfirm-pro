import * as winston from 'winston';
import integrationConfig from '../../config/integration';

export class IntegrationLoggerImplementation {
  private logger: winston.Logger;
  private sensitiveFields: string[];

  constructor() {
    this.sensitiveFields = integrationConfig.logging.fieldsToMask || [
      'password', 'token', 'secret', 'key', 'authorization', 'apikey'
    ];

    this.logger = winston.createLogger({
      level: integrationConfig.logging.level || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
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

    // Add console transport in development
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }));
    }
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, this.sanitizeMeta(meta));
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, this.sanitizeMeta(meta));
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, this.sanitizeMeta(meta));
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, this.sanitizeMeta(meta));
  }

  logRequest(request: any, response: any, duration: number): void {
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
    } else {
      this.info('Integration request completed', logEntry);
    }
  }

  logServiceCall(service: string, operation: string, success: boolean, duration: number, error?: any): void {
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
    } else {
      this.error('Service call failed', logEntry);
    }
  }

  logCircuitBreaker(service: string, action: string, state: any): void {
    this.info('Circuit breaker state change', {
      type: 'circuit_breaker',
      service,
      action,
      state,
      timestamp: new Date().toISOString()
    });
  }

  logRateLimit(service: string, identifier: string, action: string, data: any): void {
    this.info('Rate limit action', {
      type: 'rate_limit',
      service,
      identifier,
      action,
      data,
      timestamp: new Date().toISOString()
    });
  }

  logSecurityEvent(event: string, details: any): void {
    this.warn('Security event', {
      type: 'security',
      event,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  logPerformanceMetrics(metrics: any): void {
    this.info('Performance metrics', {
      type: 'performance',
      ...metrics,
      timestamp: new Date().toISOString()
    });
  }

  private sanitizeMeta(meta?: any): any {
    if (!meta || !integrationConfig.logging.sensitiveDataMasking) {
      return meta;
    }

    const sanitized = JSON.parse(JSON.stringify(meta));
    
    const maskSensitiveData = (obj: any): void => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          maskSensitiveData(obj[key]);
        } else if (this.sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '***MASKED***';
        }
      }
    };

    maskSensitiveData(sanitized);
    return sanitized;
  }

  async getMetrics(_timeRange: { start: Date; end: Date }): Promise<any> {
    // This would typically query a database or log aggregation service
    // For now, we'll return a basic structure
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

  async createAuditLog(entry: any): Promise<void> {
    const auditEntry = {
      type: 'audit',
      timestamp: new Date().toISOString(),
      ...entry
    };

    this.info('Audit log entry', auditEntry);
  }
}