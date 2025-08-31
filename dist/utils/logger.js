"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
class Logger {
    constructor() {
        this.logger = winston_1.default.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
            defaultMeta: { service: 'document-processing' },
            transports: [
                new winston_1.default.transports.Console({
                    format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple()),
                }),
                new winston_1.default.transports.File({
                    filename: path_1.default.join('logs', 'error.log'),
                    level: 'error',
                    maxsize: 5242880,
                    maxFiles: 5,
                }),
                new winston_1.default.transports.File({
                    filename: path_1.default.join('logs', 'combined.log'),
                    maxsize: 5242880,
                    maxFiles: 5,
                }),
            ],
        });
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    info(message, context) {
        this.logger.info(message, this.sanitizeContext(context));
    }
    warn(message, context) {
        this.logger.warn(message, this.sanitizeContext(context));
    }
    error(message, error, context) {
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
    debug(message, context) {
        this.logger.debug(message, this.sanitizeContext(context));
    }
    logDocumentOperation(operation, documentId, userId, additionalContext) {
        this.info(`Document operation: ${operation}`, {
            documentId,
            userId,
            operation,
            ...additionalContext,
        });
    }
    logTemplateOperation(operation, templateId, userId, additionalContext) {
        this.info(`Template operation: ${operation}`, {
            templateId,
            userId,
            operation,
            ...additionalContext,
        });
    }
    logOCROperation(operation, filePath, userId, additionalContext) {
        this.info(`OCR operation: ${operation}`, {
            filePath,
            userId,
            operation,
            ...additionalContext,
        });
    }
    logSearchOperation(query, userId, resultCount, processingTime) {
        this.info('Search operation performed', {
            query,
            userId,
            resultCount,
            processingTime,
        });
    }
    logPerformanceMetric(operation, duration, metadata) {
        this.info('Performance metric', {
            operation,
            duration,
            ...metadata,
        });
    }
    logSecurityEvent(event, userId, ipAddress, additionalContext) {
        this.warn(`Security event: ${event}`, {
            userId,
            ipAddress,
            event,
            ...additionalContext,
        });
    }
    sanitizeContext(context) {
        if (!context)
            return undefined;
        const sanitized = {};
        if (context.userId)
            sanitized.userId = context.userId;
        if (context.documentId)
            sanitized.documentId = context.documentId;
        if (context.templateId)
            sanitized.templateId = context.templateId;
        if (context.operation)
            sanitized.operation = context.operation;
        if (context.metadata) {
            sanitized.metadata = this.sanitizeMetadata(context.metadata);
        }
        if (context.error) {
            sanitized.error = {
                message: context.error.message,
                name: context.error.name,
                stack: context.error.stack,
            };
        }
        return sanitized;
    }
    sanitizeMetadata(metadata) {
        const sanitized = {};
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
            }
            else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeMetadata(value);
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    child(context) {
        return this.logger.child(this.sanitizeContext(context));
    }
}
exports.Logger = Logger;
exports.logger = Logger.getInstance();
//# sourceMappingURL=logger.js.map