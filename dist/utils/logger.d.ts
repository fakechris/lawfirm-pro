import winston from 'winston';
export interface LogContext {
    userId?: string;
    documentId?: string;
    templateId?: string;
    operation?: string;
    error?: Error;
    metadata?: Record<string, any>;
}
export declare class Logger {
    private static instance;
    private logger;
    private constructor();
    static getInstance(): Logger;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, error?: Error, context?: LogContext): void;
    debug(message: string, context?: LogContext): void;
    logDocumentOperation(operation: string, documentId: string, userId: string, additionalContext?: Record<string, any>): void;
    logTemplateOperation(operation: string, templateId: string, userId: string, additionalContext?: Record<string, any>): void;
    logOCROperation(operation: string, filePath: string, userId: string, additionalContext?: Record<string, any>): void;
    logSearchOperation(query: string, userId: string, resultCount: number, processingTime: number): void;
    logPerformanceMetric(operation: string, duration: number, metadata?: Record<string, any>): void;
    logSecurityEvent(event: string, userId?: string, ipAddress?: string, additionalContext?: Record<string, any>): void;
    private sanitizeContext;
    private sanitizeMetadata;
    child(context: LogContext): winston.Logger;
}
export declare const logger: Logger;
//# sourceMappingURL=logger.d.ts.map