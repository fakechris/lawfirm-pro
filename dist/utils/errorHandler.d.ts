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
export declare class DocumentProcessingError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly context?: ErrorContext;
    readonly retryable: boolean;
    constructor(message: string, code: string, statusCode?: number, context?: ErrorContext, retryable?: boolean);
}
export declare class ValidationError extends DocumentProcessingError {
    constructor(message: string, context?: ErrorContext);
}
export declare class FileNotFoundError extends DocumentProcessingError {
    constructor(filePath: string, context?: ErrorContext);
}
export declare class FormatNotSupportedError extends DocumentProcessingError {
    constructor(mimeType: string, context?: ErrorContext);
}
export declare class OCRProcessingError extends DocumentProcessingError {
    constructor(message: string, context?: ErrorContext, retryable?: boolean);
}
export declare class TemplateProcessingError extends DocumentProcessingError {
    constructor(message: string, context?: ErrorContext);
}
export declare class SearchIndexingError extends DocumentProcessingError {
    constructor(message: string, context?: ErrorContext, retryable?: boolean);
}
export declare class StorageError extends DocumentProcessingError {
    constructor(message: string, context?: ErrorContext, retryable?: boolean);
}
export declare class QuotaExceededError extends DocumentProcessingError {
    constructor(message: string, context?: ErrorContext);
}
export declare class SecurityError extends DocumentProcessingError {
    constructor(message: string, context?: ErrorContext);
}
export interface ErrorHandler {
    canHandle(error: Error): boolean;
    handle(error: Error, context?: ErrorContext): DocumentProcessingError;
}
export declare class DefaultErrorHandler implements ErrorHandler {
    canHandle(error: Error): boolean;
    handle(error: Error, context?: ErrorContext): DocumentProcessingError;
}
export declare class ValidationErrorHandler implements ErrorHandler {
    canHandle(error: Error): boolean;
    handle(error: Error, context?: ErrorContext): DocumentProcessingError;
}
export declare class FileNotFoundErrorHandler implements ErrorHandler {
    canHandle(error: Error): boolean;
    handle(error: Error, context?: ErrorContext): DocumentProcessingError;
}
export declare class TimeoutErrorHandler implements ErrorHandler {
    canHandle(error: Error): boolean;
    handle(error: Error, context?: ErrorContext): DocumentProcessingError;
}
export declare class RateLimitErrorHandler implements ErrorHandler {
    canHandle(error: Error): boolean;
    handle(error: Error, context?: ErrorContext): DocumentProcessingError;
}
export declare class ErrorHandlerRegistry {
    private handlers;
    addHandler(handler: ErrorHandler): void;
    handleError(error: Error, context?: ErrorContext): DocumentProcessingError;
}
export declare const errorHandlerRegistry: ErrorHandlerRegistry;
export declare function handleProcessingError(error: Error, context?: ErrorContext): DocumentProcessingError;
export declare function logAndThrowError(error: Error, context?: ErrorContext): never;
export declare function wrapAsyncFunction<T extends any[], R>(fn: (...args: T) => Promise<R>, context?: ErrorContext): (...args: T) => Promise<R>;
export declare function withRetry<T>(fn: () => Promise<T>, maxRetries?: number, delayMs?: number, context?: ErrorContext): Promise<T>;
export declare function createErrorContext(operation: string, userId?: string, documentId?: string, templateId?: string, metadata?: Record<string, any>): ErrorContext;
export declare function isRetryableError(error: Error): boolean;
export declare function getErrorStatusCode(error: Error): number;
export declare function getErrorCode(error: Error): string;
//# sourceMappingURL=errorHandler.d.ts.map