"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandlerRegistry = exports.ErrorHandlerRegistry = exports.RateLimitErrorHandler = exports.TimeoutErrorHandler = exports.FileNotFoundErrorHandler = exports.ValidationErrorHandler = exports.DefaultErrorHandler = exports.SecurityError = exports.QuotaExceededError = exports.StorageError = exports.SearchIndexingError = exports.TemplateProcessingError = exports.OCRProcessingError = exports.FormatNotSupportedError = exports.FileNotFoundError = exports.ValidationError = exports.DocumentProcessingError = void 0;
exports.handleProcessingError = handleProcessingError;
exports.logAndThrowError = logAndThrowError;
exports.wrapAsyncFunction = wrapAsyncFunction;
exports.withRetry = withRetry;
exports.createErrorContext = createErrorContext;
exports.isRetryableError = isRetryableError;
exports.getErrorStatusCode = getErrorStatusCode;
exports.getErrorCode = getErrorCode;
const logger_1 = require("./logger");
class DocumentProcessingError extends Error {
    constructor(message, code, statusCode = 500, context, retryable = false) {
        super(message);
        this.name = 'DocumentProcessingError';
        this.code = code;
        this.statusCode = statusCode;
        this.context = context;
        this.retryable = retryable;
        Error.captureStackTrace(this, DocumentProcessingError);
    }
}
exports.DocumentProcessingError = DocumentProcessingError;
class ValidationError extends DocumentProcessingError {
    constructor(message, context) {
        super(message, 'VALIDATION_ERROR', 400, context, false);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class FileNotFoundError extends DocumentProcessingError {
    constructor(filePath, context) {
        super(`File not found: ${filePath}`, 'FILE_NOT_FOUND', 404, context, false);
        this.name = 'FileNotFoundError';
    }
}
exports.FileNotFoundError = FileNotFoundError;
class FormatNotSupportedError extends DocumentProcessingError {
    constructor(mimeType, context) {
        super(`Format not supported: ${mimeType}`, 'FORMAT_NOT_SUPPORTED', 415, context, false);
        this.name = 'FormatNotSupportedError';
    }
}
exports.FormatNotSupportedError = FormatNotSupportedError;
class OCRProcessingError extends DocumentProcessingError {
    constructor(message, context, retryable = true) {
        super(message, 'OCR_PROCESSING_ERROR', 500, context, retryable);
        this.name = 'OCRProcessingError';
    }
}
exports.OCRProcessingError = OCRProcessingError;
class TemplateProcessingError extends DocumentProcessingError {
    constructor(message, context) {
        super(message, 'TEMPLATE_PROCESSING_ERROR', 500, context, false);
        this.name = 'TemplateProcessingError';
    }
}
exports.TemplateProcessingError = TemplateProcessingError;
class SearchIndexingError extends DocumentProcessingError {
    constructor(message, context, retryable = true) {
        super(message, 'SEARCH_INDEXING_ERROR', 500, context, retryable);
        this.name = 'SearchIndexingError';
    }
}
exports.SearchIndexingError = SearchIndexingError;
class StorageError extends DocumentProcessingError {
    constructor(message, context, retryable = true) {
        super(message, 'STORAGE_ERROR', 500, context, retryable);
        this.name = 'StorageError';
    }
}
exports.StorageError = StorageError;
class QuotaExceededError extends DocumentProcessingError {
    constructor(message, context) {
        super(message, 'QUOTA_EXCEEDED', 429, context, false);
        this.name = 'QuotaExceededError';
    }
}
exports.QuotaExceededError = QuotaExceededError;
class SecurityError extends DocumentProcessingError {
    constructor(message, context) {
        super(message, 'SECURITY_ERROR', 403, context, false);
        this.name = 'SecurityError';
    }
}
exports.SecurityError = SecurityError;
class DefaultErrorHandler {
    canHandle(error) {
        return !(error instanceof DocumentProcessingError);
    }
    handle(error, context) {
        logger_1.logger.error('Unhandled error occurred', error, context);
        return new DocumentProcessingError(error.message, 'INTERNAL_ERROR', 500, context, false);
    }
}
exports.DefaultErrorHandler = DefaultErrorHandler;
class ValidationErrorHandler {
    canHandle(error) {
        return error.name === 'ValidationError' ||
            error.message.includes('validation') ||
            error.message.includes('invalid');
    }
    handle(error, context) {
        logger_1.logger.warn('Validation error occurred', error, context);
        return new ValidationError(error.message, context);
    }
}
exports.ValidationErrorHandler = ValidationErrorHandler;
class FileNotFoundErrorHandler {
    canHandle(error) {
        return error.code === 'ENOENT' ||
            error.message.includes('not found') ||
            error.message.includes('ENOENT');
    }
    handle(error, context) {
        logger_1.logger.warn('File not found error occurred', error, context);
        const filePath = context?.metadata?.filePath || 'unknown';
        return new FileNotFoundError(filePath, context);
    }
}
exports.FileNotFoundErrorHandler = FileNotFoundErrorHandler;
class TimeoutErrorHandler {
    canHandle(error) {
        return error.name === 'TimeoutError' ||
            error.message.includes('timeout') ||
            error.code === 'ETIMEDOUT';
    }
    handle(error, context) {
        logger_1.logger.warn('Timeout error occurred', error, context);
        return new DocumentProcessingError('Operation timed out', 'TIMEOUT_ERROR', 504, context, true);
    }
}
exports.TimeoutErrorHandler = TimeoutErrorHandler;
class RateLimitErrorHandler {
    canHandle(error) {
        return error.message.includes('rate limit') ||
            error.message.includes('too many requests') ||
            error.statusCode === 429;
    }
    handle(error, context) {
        logger_1.logger.warn('Rate limit exceeded', error, context);
        return new QuotaExceededError('Rate limit exceeded. Please try again later.', context);
    }
}
exports.RateLimitErrorHandler = RateLimitErrorHandler;
class ErrorHandlerRegistry {
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
        this.handlers.unshift(handler);
    }
    handleError(error, context) {
        const handler = this.handlers.find(h => h.canHandle(error));
        if (!handler) {
            logger_1.logger.error('No handler found for error', error, context);
            return new DefaultErrorHandler().handle(error, context);
        }
        return handler.handle(error, context);
    }
}
exports.ErrorHandlerRegistry = ErrorHandlerRegistry;
exports.errorHandlerRegistry = new ErrorHandlerRegistry();
function handleProcessingError(error, context) {
    return exports.errorHandlerRegistry.handleError(error, context);
}
function logAndThrowError(error, context) {
    const processedError = handleProcessingError(error, context);
    logger_1.logger.error('Error occurred and will be thrown', processedError, context);
    throw processedError;
}
function wrapAsyncFunction(fn, context) {
    return async (...args) => {
        try {
            return await fn(...args);
        }
        catch (error) {
            const processedError = handleProcessingError(error, context);
            logger_1.logger.error('Async function error', processedError, context);
            throw processedError;
        }
    };
}
function withRetry(fn, maxRetries = 3, delayMs = 1000, context) {
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
                    logger_1.logger.error(`Failed after ${attempt} attempts`, processedError, context);
                    reject(processedError);
                    return;
                }
                logger_1.logger.warn(`Attempt ${attempt} failed, retrying...`, processedError, context);
                setTimeout(attemptFn, delayMs * Math.pow(2, attempt - 1));
            }
        };
        attemptFn();
    });
}
function createErrorContext(operation, userId, documentId, templateId, metadata) {
    return {
        operation,
        userId,
        documentId,
        templateId,
        metadata,
    };
}
function isRetryableError(error) {
    return error instanceof DocumentProcessingError && error.retryable;
}
function getErrorStatusCode(error) {
    if (error instanceof DocumentProcessingError) {
        return error.statusCode;
    }
    return 500;
}
function getErrorCode(error) {
    if (error instanceof DocumentProcessingError) {
        return error.code;
    }
    return 'INTERNAL_ERROR';
}
//# sourceMappingURL=errorHandler.js.map