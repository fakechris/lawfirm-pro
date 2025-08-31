import { logger } from './logger';

export interface ErrorContext {
  userId?: string;
  documentId?: string;
  templateId?: string;
  operation?: string;
  request?: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: any;
  };
  metadata?: Record<string, any>;
}

export class DocumentProcessingError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly context?: ErrorContext;
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    context?: ErrorContext,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'DocumentProcessingError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.retryable = retryable;
    
    // Ensure proper stack trace
    Error.captureStackTrace(this, DocumentProcessingError);
  }
}

export class ValidationError extends DocumentProcessingError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 'VALIDATION_ERROR', 400, context, false);
    this.name = 'ValidationError';
  }
}

export class FileNotFoundError extends DocumentProcessingError {
  constructor(filePath: string, context?: ErrorContext) {
    super(`File not found: ${filePath}`, 'FILE_NOT_FOUND', 404, context, false);
    this.name = 'FileNotFoundError';
  }
}

export class FormatNotSupportedError extends DocumentProcessingError {
  constructor(mimeType: string, context?: ErrorContext) {
    super(`Format not supported: ${mimeType}`, 'FORMAT_NOT_SUPPORTED', 415, context, false);
    this.name = 'FormatNotSupportedError';
  }
}

export class OCRProcessingError extends DocumentProcessingError {
  constructor(message: string, context?: ErrorContext, retryable: boolean = true) {
    super(message, 'OCR_PROCESSING_ERROR', 500, context, retryable);
    this.name = 'OCRProcessingError';
  }
}

export class TemplateProcessingError extends DocumentProcessingError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 'TEMPLATE_PROCESSING_ERROR', 500, context, false);
    this.name = 'TemplateProcessingError';
  }
}

export class SearchIndexingError extends DocumentProcessingError {
  constructor(message: string, context?: ErrorContext, retryable: boolean = true) {
    super(message, 'SEARCH_INDEXING_ERROR', 500, context, retryable);
    this.name = 'SearchIndexingError';
  }
}

export class StorageError extends DocumentProcessingError {
  constructor(message: string, context?: ErrorContext, retryable: boolean = true) {
    super(message, 'STORAGE_ERROR', 500, context, retryable);
    this.name = 'StorageError';
  }
}

export class QuotaExceededError extends DocumentProcessingError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 'QUOTA_EXCEEDED', 429, context, false);
    this.name = 'QuotaExceededError';
  }
}

export class SecurityError extends DocumentProcessingError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 'SECURITY_ERROR', 403, context, false);
    this.name = 'SecurityError';
  }
}

export interface ErrorHandler {
  canHandle(error: Error): boolean;
  handle(error: Error, context?: ErrorContext): DocumentProcessingError;
}

export class DefaultErrorHandler implements ErrorHandler {
  canHandle(error: Error): boolean {
    return !(error instanceof DocumentProcessingError);
  }

  handle(error: Error, context?: ErrorContext): DocumentProcessingError {
    logger.error('Unhandled error occurred', error, context);
    
    return new DocumentProcessingError(
      error.message,
      'INTERNAL_ERROR',
      500,
      context,
      false
    );
  }
}

export class ValidationErrorHandler implements ErrorHandler {
  canHandle(error: Error): boolean {
    return error.name === 'ValidationError' || 
           error.message.includes('validation') ||
           error.message.includes('invalid');
  }

  handle(error: Error, context?: ErrorContext): DocumentProcessingError {
    logger.warn('Validation error occurred', error, context);
    
    return new ValidationError(error.message, context);
  }
}

export class FileNotFoundErrorHandler implements ErrorHandler {
  canHandle(error: Error): boolean {
    return error.code === 'ENOENT' || 
           error.message.includes('not found') ||
           error.message.includes('ENOENT');
  }

  handle(error: Error, context?: ErrorContext): DocumentProcessingError {
    logger.warn('File not found error occurred', error, context);
    
    const filePath = context?.metadata?.filePath || 'unknown';
    return new FileNotFoundError(filePath, context);
  }
}

export class TimeoutErrorHandler implements ErrorHandler {
  canHandle(error: Error): boolean {
    return error.name === 'TimeoutError' || 
           error.message.includes('timeout') ||
           error.code === 'ETIMEDOUT';
  }

  handle(error: Error, context?: ErrorContext): DocumentProcessingError {
    logger.warn('Timeout error occurred', error, context);
    
    return new DocumentProcessingError(
      'Operation timed out',
      'TIMEOUT_ERROR',
      504,
      context,
      true
    );
  }
}

export class RateLimitErrorHandler implements ErrorHandler {
  canHandle(error: Error): boolean {
    return error.message.includes('rate limit') ||
           error.message.includes('too many requests') ||
           (error as any).statusCode === 429;
  }

  handle(error: Error, context?: ErrorContext): DocumentProcessingError {
    logger.warn('Rate limit exceeded', error, context);
    
    return new QuotaExceededError(
      'Rate limit exceeded. Please try again later.',
      context
    );
  }
}

export class ErrorHandlerRegistry {
  private handlers: ErrorHandler[] = [
    new ValidationErrorHandler(),
    new FileNotFoundErrorHandler(),
    new TimeoutErrorHandler(),
    new RateLimitErrorHandler(),
    new DefaultErrorHandler(),
  ];

  addHandler(handler: ErrorHandler): void {
    this.handlers.unshift(handler); // Add to beginning for priority
  }

  handleError(error: Error, context?: ErrorContext): DocumentProcessingError {
    const handler = this.handlers.find(h => h.canHandle(error));
    
    if (!handler) {
      logger.error('No handler found for error', error, context);
      return new DefaultErrorHandler().handle(error, context);
    }

    return handler.handle(error, context);
  }
}

export const errorHandlerRegistry = new ErrorHandlerRegistry();

// Utility functions for error handling
export function handleProcessingError(
  error: Error,
  context?: ErrorContext
): DocumentProcessingError {
  return errorHandlerRegistry.handleError(error, context);
}

export function logAndThrowError(
  error: Error,
  context?: ErrorContext
): never {
  const processedError = handleProcessingError(error, context);
  logger.error('Error occurred and will be thrown', processedError, context);
  throw processedError;
}

export function wrapAsyncFunction<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: ErrorContext
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const processedError = handleProcessingError(error as Error, context);
      logger.error('Async function error', processedError, context);
      throw processedError;
    }
  };
}

export function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  context?: ErrorContext
): Promise<T> {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    const attemptFn = async (): Promise<void> => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        attempt++;
        
        const processedError = handleProcessingError(error as Error, context);
        
        if (attempt >= maxRetries || !processedError.retryable) {
          logger.error(`Failed after ${attempt} attempts`, processedError, context);
          reject(processedError);
          return;
        }

        logger.warn(`Attempt ${attempt} failed, retrying...`, processedError, context);
        
        setTimeout(attemptFn, delayMs * Math.pow(2, attempt - 1)); // Exponential backoff
      }
    };

    attemptFn();
  });
}

export function createErrorContext(
  operation: string,
  userId?: string,
  documentId?: string,
  templateId?: string,
  metadata?: Record<string, any>
): ErrorContext {
  return {
    operation,
    userId,
    documentId,
    templateId,
    metadata,
  };
}

export function isRetryableError(error: Error): boolean {
  return error instanceof DocumentProcessingError && error.retryable;
}

export function getErrorStatusCode(error: Error): number {
  if (error instanceof DocumentProcessingError) {
    return error.statusCode;
  }
  return 500;
}

export function getErrorCode(error: Error): string {
  if (error instanceof DocumentProcessingError) {
    return error.code;
  }
  return 'INTERNAL_ERROR';
}