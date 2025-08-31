import winston from 'winston';
import path from 'path';

export interface LogContext {
  userId?: string;
  documentId?: string;
  templateId?: string;
  operation?: string;
  error?: Error;
  metadata?: Record<string, any>;
}

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;

  private constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'document-processing' },
      transports: [
        // Console transport for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
        // File transport for errors
        new winston.transports.File({
          filename: path.join('logs', 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        // File transport for all logs
        new winston.transports.File({
          filename: path.join('logs', 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
      ],
    });
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(message, this.sanitizeContext(context));
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, this.sanitizeContext(context));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const logContext = {
      ...context,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : undefined,
    };
    
    this.logger.error(message, this.sanitizeContext(logContext));
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, this.sanitizeContext(context));
  }

  logDocumentOperation(operation: string, documentId: string, userId: string, additionalContext?: Record<string, any>): void {
    this.info(`Document operation: ${operation}`, {
      documentId,
      userId,
      operation,
      ...additionalContext,
    });
  }

  logTemplateOperation(operation: string, templateId: string, userId: string, additionalContext?: Record<string, any>): void {
    this.info(`Template operation: ${operation}`, {
      templateId,
      userId,
      operation,
      ...additionalContext,
    });
  }

  logOCROperation(operation: string, filePath: string, userId: string, additionalContext?: Record<string, any>): void {
    this.info(`OCR operation: ${operation}`, {
      filePath,
      userId,
      operation,
      ...additionalContext,
    });
  }

  logSearchOperation(query: string, userId: string, resultCount: number, processingTime: number): void {
    this.info('Search operation performed', {
      query,
      userId,
      resultCount,
      processingTime,
    });
  }

  logPerformanceMetric(operation: string, duration: number, metadata?: Record<string, any>): void {
    this.info('Performance metric', {
      operation,
      duration,
      ...metadata,
    });
  }

  logSecurityEvent(event: string, userId?: string, ipAddress?: string, additionalContext?: Record<string, any>): void {
    this.warn(`Security event: ${event}`, {
      userId,
      ipAddress,
      event,
      ...additionalContext,
    });
  }

  private sanitizeContext(context?: LogContext): LogContext | undefined {
    if (!context) return undefined;

    const sanitized: LogContext = {};
    
    // Copy safe properties
    if (context.userId) sanitized.userId = context.userId;
    if (context.documentId) sanitized.documentId = context.documentId;
    if (context.templateId) sanitized.templateId = context.templateId;
    if (context.operation) sanitized.operation = context.operation;
    
    // Sanitize metadata
    if (context.metadata) {
      sanitized.metadata = this.sanitizeMetadata(context.metadata);
    }
    
    // Sanitize error
    if (context.error) {
      sanitized.error = {
        message: context.error.message,
        name: context.error.name,
        stack: context.error.stack,
      };
    }
    
    return sanitized;
  }

  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'credit_card',
      'ssn',
      'personal_id',
    ];

    for (const [key, value] of Object.entries(metadata)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  // Create child logger with specific context
  child(context: LogContext): winston.Logger {
    return this.logger.child(this.sanitizeContext(context));
  }
}

export const logger = Logger.getInstance();