import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../utils/logger';
import { MetricsCollector } from '../monitoring/MetricsCollector';
import { AlertingService } from '../alerting/AlertingService';
import { ComprehensiveLoggingService } from '../logging/ComprehensiveLoggingService';

export interface IntegrationRequest extends Request {
  startTime?: number;
  traceId?: string;
  spanId?: string;
  userId?: string;
  service?: string;
  operation?: string;
}

export interface MonitoringConfig {
  enabled: boolean;
  logRequests: boolean;
  logResponses: boolean;
  logErrors: boolean;
  collectMetrics: boolean;
  enableAlerting: boolean;
  sampleRate: number; // 0-1, percentage of requests to monitor
  sensitiveHeaders: string[];
  sensitiveQueryParams: string[];
  maxBodySize: number; // in bytes
}

export interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  userId?: string;
  service?: string;
  operation?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp: Date;
}

export class IntegrationMonitoringMiddleware {
  private logger: Logger;
  private metricsCollector: MetricsCollector;
  private alertingService: AlertingService;
  private loggingService: ComprehensiveLoggingService;
  private config: MonitoringConfig;

  constructor(
    metricsCollector: MetricsCollector,
    alertingService: AlertingService,
    loggingService: ComprehensiveLoggingService,
    config: Partial<MonitoringConfig> = {}
  ) {
    this.logger = new Logger('IntegrationMonitoringMiddleware');
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
      maxBodySize: 1024 * 1024, // 1MB
      ...config
    };
  }

  middleware = (req: IntegrationRequest, res: Response, next: NextFunction): void => {
    if (!this.config.enabled) {
      return next();
    }

    // Skip monitoring based on sample rate
    if (Math.random() > this.config.sampleRate) {
      return next();
    }

    // Add monitoring data to request
    req.startTime = Date.now();
    req.traceId = this.generateTraceId();
    req.spanId = this.generateSpanId();
    
    // Extract user info from request
    this.extractUserInfo(req);

    // Log request if enabled
    if (this.config.logRequests) {
      this.logRequest(req);
    }

    // Override response methods to capture response data
    this.wrapResponseMethods(req, res);

    // Continue to next middleware
    next();
  };

  private extractUserInfo(req: IntegrationRequest): void {
    // Extract from headers
    req.userId = req.headers['x-user-id'] as string || 
                 req.headers['user-id'] as string || 
                 req.headers['userid'] as string;
    
    // Extract from JWT token if present
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        // In a real implementation, this would decode the JWT
        const token = authHeader.substring(7);
        // req.userId = this.extractUserIdFromToken(token);
      } catch (error) {
        this.logger.debug('Failed to extract user from JWT', { error });
      }
    }

    // Extract service and operation from path
    const pathParts = req.path.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      req.service = pathParts[0];
      req.operation = pathParts[1];
    }
  }

  private wrapResponseMethods(req: IntegrationRequest, res: Response): void {
    const originalJson = res.json;
    const originalSend = res.send;
    const originalEnd = res.end;

    // Override json method
    res.json = function(this: Response, body: any): Response {
      if (req.startTime && this.config.enabled) {
        this.onResponse(req, this, body);
      }
      return originalJson.call(this, body);
    }.bind(this);

    // Override send method
    res.send = function(this: Response, body: any): Response {
      if (req.startTime && this.config.enabled) {
        this.onResponse(req, this, body);
      }
      return originalSend.call(this, body);
    }.bind(this);

    // Override end method
    res.end = function(this: Response, chunk?: any, encoding?: any): Response {
      if (req.startTime && this.config.enabled) {
        this.onResponse(req, this, chunk);
      }
      return originalEnd.call(this, chunk, encoding);
    }.bind(this);
  }

  private onResponse(req: IntegrationRequest, res: Response, body?: any): void {
    try {
      const responseTime = Date.now() - (req.startTime || Date.now());
      
      // Collect metrics if enabled
      if (this.config.collectMetrics) {
        this.collectRequestMetrics(req, res, responseTime);
      }

      // Log response if enabled
      if (this.config.logResponses) {
        this.logResponse(req, res, responseTime, body);
      }

      // Check for alerts if enabled
      if (this.config.enableAlerting) {
        this.checkForAlerts(req, res, responseTime);
      }

      // Log errors if enabled
      if (this.config.logErrors && res.statusCode >= 400) {
        this.logError(req, res, responseTime, body);
      }
    } catch (error) {
      this.logger.error('Error in response monitoring', { error });
    }
  }

  private logRequest(req: IntegrationRequest): void {
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
    } catch (error) {
      this.logger.error('Error logging request', { error });
    }
  }

  private logResponse(req: IntegrationRequest, res: Response, responseTime: number, body?: any): void {
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
    } catch (error) {
      this.logger.error('Error logging response', { error });
    }
  }

  private logError(req: IntegrationRequest, res: Response, responseTime: number, body?: any): void {
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
    } catch (error) {
      this.logger.error('Error logging error', { error });
    }
  }

  private collectRequestMetrics(req: IntegrationRequest, res: Response, responseTime: number): void {
    try {
      const tags: Record<string, string> = {
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

      // Record response time metric
      this.metricsCollector.recordTiming(
        'integration_response_time',
        responseTime,
        tags
      );

      // Record request count metric
      this.metricsCollector.incrementCounter(
        'integration_request_count',
        1,
        tags
      );

      // Record error count metric for errors
      if (res.statusCode >= 400) {
        this.metricsCollector.incrementCounter(
          'integration_error_count',
          1,
          tags
        );
      }

      // Record status code metric
      this.metricsCollector.incrementCounter(
        'integration_status_code',
        1,
        {
          ...tags,
          status_code: res.statusCode.toString()
        }
      );
    } catch (error) {
      this.logger.error('Error collecting metrics', { error });
    }
  }

  private checkForAlerts(req: IntegrationRequest, res: Response, responseTime: number): void {
    try {
      const tags = {
        service: req.service || 'integration',
        operation: req.operation || 'unknown',
        method: req.method,
        path: req.path
      };

      // Check for slow response times
      if (responseTime > 5000) { // 5 seconds
        this.alertingService.evaluateAlert('response_time', responseTime, tags);
      }

      // Check for high error rates (this would be done at a higher level)
      if (res.statusCode >= 500) {
        this.alertingService.evaluateAlert('server_error_count', 1, tags);
      }

      // Check for 4xx errors
      if (res.statusCode >= 400 && res.statusCode < 500) {
        this.alertingService.evaluateAlert('client_error_count', 1, tags);
      }
    } catch (error) {
      this.logger.error('Error checking alerts', { error });
    }
  }

  private sanitizeHeaders(headers: any): Record<string, string> {
    const sanitized: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      if (this.config.sensitiveHeaders.some(sensitive => 
        key.toLowerCase().includes(sensitive.toLowerCase())
      )) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = String(value);
      }
    }
    
    return sanitized;
  }

  private sanitizeQueryParams(query: any): Record<string, string> {
    const sanitized: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(query)) {
      if (this.config.sensitiveQueryParams.some(sensitive => 
        key.toLowerCase().includes(sensitive.toLowerCase())
      )) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = String(value);
      }
    }
    
    return sanitized;
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(body)) {
      if (this.config.sensitiveQueryParams.some(sensitive => 
        key.toLowerCase().includes(sensitive.toLowerCase())
      )) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeBody(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSpanId(): string {
    return `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Configuration methods
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Monitoring middleware configuration updated', { config: this.config });
  }

  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  enable(): void {
    this.config.enabled = true;
    this.logger.info('Monitoring middleware enabled');
  }

  disable(): void {
    this.config.enabled = false;
    this.logger.info('Monitoring middleware disabled');
  }

  setSampleRate(rate: number): void {
    if (rate < 0 || rate > 1) {
      throw new Error('Sample rate must be between 0 and 1');
    }
    this.config.sampleRate = rate;
    this.logger.info('Sample rate updated', { rate });
  }

  addSensitiveHeader(header: string): void {
    if (!this.config.sensitiveHeaders.includes(header)) {
      this.config.sensitiveHeaders.push(header);
      this.logger.info('Sensitive header added', { header });
    }
  }

  removeSensitiveHeader(header: string): void {
    const index = this.config.sensitiveHeaders.indexOf(header);
    if (index > -1) {
      this.config.sensitiveHeaders.splice(index, 1);
      this.logger.info('Sensitive header removed', { header });
    }
  }

  addSensitiveQueryParam(param: string): void {
    if (!this.config.sensitiveQueryParams.includes(param)) {
      this.config.sensitiveQueryParams.push(param);
      this.logger.info('Sensitive query parameter added', { param });
    }
  }

  removeSensitiveQueryParam(param: string): void {
    const index = this.config.sensitiveQueryParams.indexOf(param);
    if (index > -1) {
      this.config.sensitiveQueryParams.splice(index, 1);
      this.logger.info('Sensitive query parameter removed', { param });
    }
  }
}

// Factory function for easier integration
export function createIntegrationMonitoringMiddleware(
  metricsCollector: MetricsCollector,
  alertingService: AlertingService,
  loggingService: ComprehensiveLoggingService,
  config?: Partial<MonitoringConfig>
) {
  const middleware = new IntegrationMonitoringMiddleware(
    metricsCollector,
    alertingService,
    loggingService,
    config
  );
  
  return middleware.middleware;
}