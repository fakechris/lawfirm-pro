import { logger } from './logger';
export class DocumentProcessingError extends Error {
    constructor(message, code, statusCode = 500, context, retryable = false) {
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
    constructor(message, context) {
        super(message, 'VALIDATION_ERROR', 400, context, false);
        this.name = 'ValidationError';
    }
}
export class FileNotFoundError extends DocumentProcessingError {
    constructor(filePath, context) {
        super(`File not found: ${filePath}`, 'FILE_NOT_FOUND', 404, context, false);
        this.name = 'FileNotFoundError';
    }
}
export class FormatNotSupportedError extends DocumentProcessingError {
    constructor(mimeType, context) {
        super(`Format not supported: ${mimeType}`, 'FORMAT_NOT_SUPPORTED', 415, context, false);
        this.name = 'FormatNotSupportedError';
    }
}
export class OCRProcessingError extends DocumentProcessingError {
    constructor(message, context, retryable = true) {
        super(message, 'OCR_PROCESSING_ERROR', 500, context, retryable);
        this.name = 'OCRProcessingError';
    }
}
export class TemplateProcessingError extends DocumentProcessingError {
    constructor(message, context) {
        super(message, 'TEMPLATE_PROCESSING_ERROR', 500, context, false);
        this.name = 'TemplateProcessingError';
    }
}
export class SearchIndexingError extends DocumentProcessingError {
    constructor(message, context, retryable = true) {
        super(message, 'SEARCH_INDEXING_ERROR', 500, context, retryable);
        this.name = 'SearchIndexingError';
    }
}
export class StorageError extends DocumentProcessingError {
    constructor(message, context, retryable = true) {
        super(message, 'STORAGE_ERROR', 500, context, retryable);
        this.name = 'StorageError';
    }
}
export class QuotaExceededError extends DocumentProcessingError {
    constructor(message, context) {
        super(message, 'QUOTA_EXCEEDED', 429, context, false);
        this.name = 'QuotaExceededError';
    }
}
export class SecurityError extends DocumentProcessingError {
    constructor(message, context) {
        super(message, 'SECURITY_ERROR', 403, context, false);
        this.name = 'SecurityError';
    }
}
export class DefaultErrorHandler {
    canHandle(error) {
        return !(error instanceof DocumentProcessingError);
    }
    handle(error, context) {
        logger.error('Unhandled error occurred', error, context);
        return new DocumentProcessingError(error.message, 'INTERNAL_ERROR', 500, context, false);
    }
}
export class ValidationErrorHandler {
    canHandle(error) {
        return error.name === 'ValidationError' ||
            error.message.includes('validation') ||
            error.message.includes('invalid');
    }
    handle(error, context) {
        logger.warn('Validation error occurred', error, context);
        return new ValidationError(error.message, context);
    }
}
export class FileNotFoundErrorHandler {
    canHandle(error) {
        return error.code === 'ENOENT' ||
            error.message.includes('not found') ||
            error.message.includes('ENOENT');
    }
    handle(error, context) {
        logger.warn('File not found error occurred', error, context);
        const filePath = context?.metadata?.filePath || 'unknown';
        return new FileNotFoundError(filePath, context);
    }
}
export class TimeoutErrorHandler {
    canHandle(error) {
        return error.name === 'TimeoutError' ||
            error.message.includes('timeout') ||
            error.code === 'ETIMEDOUT';
    }
    handle(error, context) {
        logger.warn('Timeout error occurred', error, context);
        return new DocumentProcessingError('Operation timed out', 'TIMEOUT_ERROR', 504, context, true);
    }
}
export class RateLimitErrorHandler {
    canHandle(error) {
        return error.message.includes('rate limit') ||
            error.message.includes('too many requests') ||
            error.statusCode === 429;
    }
    handle(error, context) {
        logger.warn('Rate limit exceeded', error, context);
        return new QuotaExceededError('Rate limit exceeded. Please try again later.', context);
    }
}
export class ErrorHandlerRegistry {
    constructor() {
        this.handlers = [
            new ValidationErrorHandler(),
            new FileNotFoundErrorHandler(),
            new TimeoutErrorHandler(),
            new RateLimitErrorHandler(),
            new DefaultErrorHandler(),
        ];
    }
    addHandler(handler) {
        this.handlers.unshift(handler); // Add to beginning for priority
    }
    handleError(error, context) {
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
export function handleProcessingError(error, context) {
    return errorHandlerRegistry.handleError(error, context);
}
export function logAndThrowError(error, context) {
    const processedError = handleProcessingError(error, context);
    logger.error('Error occurred and will be thrown', processedError, context);
    throw processedError;
}
export function wrapAsyncFunction(fn, context) {
    return async (...args) => {
        try {
            return await fn(...args);
        }
        catch (error) {
            const processedError = handleProcessingError(error, context);
            logger.error('Async function error', processedError, context);
            throw processedError;
        }
    };
}
export function withRetry(fn, maxRetries = 3, delayMs = 1000, context) {
    return new Promise((resolve, reject) => {
        let attempt = 0;
        const attemptFn = async () => {
            try {
                const result = await fn();
                resolve(result);
            }
            catch (error) {
                attempt++;
                const processedError = handleProcessingError(error, context);
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
export function createErrorContext(operation, userId, documentId, templateId, metadata) {
    return {
        operation,
        userId,
        documentId,
        templateId,
        metadata,
    };
}
export function isRetryableError(error) {
    return error instanceof DocumentProcessingError && error.retryable;
}
export function getErrorStatusCode(error) {
    if (error instanceof DocumentProcessingError) {
        return error.statusCode;
    }
    return 500;
}
export function getErrorCode(error) {
    if (error instanceof DocumentProcessingError) {
        return error.code;
    }
    return 'INTERNAL_ERROR';
}
