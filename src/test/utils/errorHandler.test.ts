import {
  DocumentProcessingError,
  ValidationError,
  FileNotFoundError,
  FormatNotSupportedError,
  OCRProcessingError,
  TemplateProcessingError,
  SearchIndexingError,
  StorageError,
  QuotaExceededError,
  SecurityError,
  ErrorHandlerRegistry,
  DefaultErrorHandler,
  ValidationErrorHandler,
  FileNotFoundErrorHandler,
  TimeoutErrorHandler,
  RateLimitErrorHandler,
  handleProcessingError,
  createErrorContext,
  withRetry,
  wrapAsyncFunction,
  isRetryableError,
  getErrorStatusCode,
  getErrorCode,
} from '../../../src/utils/errorHandler';
import { logger } from '../../../src/utils/logger';

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('ErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DocumentProcessingError', () => {
    it('should create error with correct properties', () => {
      const error = new DocumentProcessingError(
        'Test error',
        'TEST_ERROR',
        400,
        { operation: 'test' },
        true
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.context).toEqual({ operation: 'test' });
      expect(error.retryable).toBe(true);
      expect(error.name).toBe('DocumentProcessingError');
      expect(error.stack).toBeDefined();
    });

    it('should have default values', () => {
      const error = new DocumentProcessingError('Test error', 'TEST_ERROR');

      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(false);
      expect(error.context).toBeUndefined();
    });
  });

  describe('Specific Error Types', () => {
    it('should create ValidationError correctly', () => {
      const error = new ValidationError('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(false);
    });

    it('should create FileNotFoundError correctly', () => {
      const error = new FileNotFoundError('/test/file.txt');
      expect(error.code).toBe('FILE_NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('File not found: /test/file.txt');
    });

    it('should create FormatNotSupportedError correctly', () => {
      const error = new FormatNotSupportedError('application/xyz');
      expect(error.code).toBe('FORMAT_NOT_SUPPORTED');
      expect(error.statusCode).toBe(415);
    });

    it('should create OCRProcessingError correctly', () => {
      const error = new OCRProcessingError('OCR failed');
      expect(error.code).toBe('OCR_PROCESSING_ERROR');
      expect(error.retryable).toBe(true);
    });

    it('should create TemplateProcessingError correctly', () => {
      const error = new TemplateProcessingError('Template error');
      expect(error.code).toBe('TEMPLATE_PROCESSING_ERROR');
      expect(error.retryable).toBe(false);
    });

    it('should create SearchIndexingError correctly', () => {
      const error = new SearchIndexingError('Search error');
      expect(error.code).toBe('SEARCH_INDEXING_ERROR');
      expect(error.retryable).toBe(true);
    });

    it('should create StorageError correctly', () => {
      const error = new StorageError('Storage error');
      expect(error.code).toBe('STORAGE_ERROR');
      expect(error.retryable).toBe(true);
    });

    it('should create QuotaExceededError correctly', () => {
      const error = new QuotaExceededError('Quota exceeded');
      expect(error.code).toBe('QUOTA_EXCEEDED');
      expect(error.statusCode).toBe(429);
    });

    it('should create SecurityError correctly', () => {
      const error = new SecurityError('Security violation');
      expect(error.code).toBe('SECURITY_ERROR');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('ErrorHandlerRegistry', () => {
    let registry: ErrorHandlerRegistry;

    beforeEach(() => {
      registry = new ErrorHandlerRegistry();
    });

    it('should handle ValidationError', () => {
      const error = new Error('validation failed');
      error.name = 'ValidationError';
      
      const result = registry.handleError(error);
      expect(result).toBeInstanceOf(ValidationError);
      expect(result.message).toBe('validation failed');
    });

    it('should handle file not found errors', () => {
      const error = new Error('ENOENT: no such file');
      error.code = 'ENOENT';
      
      const result = registry.handleError(error);
      expect(result).toBeInstanceOf(FileNotFoundError);
    });

    it('should handle timeout errors', () => {
      const error = new Error('timeout occurred');
      error.name = 'TimeoutError';
      
      const result = registry.handleError(error);
      expect(result.code).toBe('TIMEOUT_ERROR');
      expect(result.retryable).toBe(true);
    });

    it('should handle rate limit errors', () => {
      const error = new Error('rate limit exceeded');
      
      const result = registry.handleError(error);
      expect(result).toBeInstanceOf(QuotaExceededError);
    });

    it('should handle unknown errors with default handler', () => {
      const error = new Error('unknown error');
      
      const result = registry.handleError(error);
      expect(result).toBeInstanceOf(DocumentProcessingError);
      expect(result.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('Utility Functions', () => {
    describe('handleProcessingError', () => {
      it('should handle ValidationError', () => {
        const error = new Error('validation failed');
        error.name = 'ValidationError';
        
        const result = handleProcessingError(error);
        expect(result).toBeInstanceOf(ValidationError);
      });

      it('should handle unknown errors', () => {
        const error = new Error('unknown error');
        
        const result = handleProcessingError(error);
        expect(result).toBeInstanceOf(DocumentProcessingError);
        expect(result.code).toBe('INTERNAL_ERROR');
      });
    });

    describe('createErrorContext', () => {
      it('should create context with all properties', () => {
        const context = createErrorContext(
          'testOperation',
          'user123',
          'doc456',
          'template789',
          { custom: 'value' }
        );

        expect(context.operation).toBe('testOperation');
        expect(context.userId).toBe('user123');
        expect(context.documentId).toBe('doc456');
        expect(context.templateId).toBe('template789');
        expect(context.metadata).toEqual({ custom: 'value' });
      });

      it('should create minimal context', () => {
        const context = createErrorContext('testOperation');
        expect(context.operation).toBe('testOperation');
        expect(context.userId).toBeUndefined();
      });
    });

    describe('withRetry', () => {
      it('should succeed on first attempt', async () => {
        const fn = jest.fn().mockResolvedValue('success');
        
        const result = await withRetry(fn, 3, 100);
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should retry on retryable error', async () => {
        const retryableError = new DocumentProcessingError('retryable', 'RETRYABLE', 500, undefined, true);
        const fn = jest.fn()
          .mockRejectedValueOnce(retryableError)
          .mockResolvedValue('success');
        
        const result = await withRetry(fn, 3, 10);
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('should not retry on non-retryable error', async () => {
        const nonRetryableError = new DocumentProcessingError('non-retryable', 'NON_RETRYABLE', 500, undefined, false);
        const fn = jest.fn().mockRejectedValue(nonRetryableError);
        
        await expect(withRetry(fn, 3, 10)).rejects.toThrow(nonRetryableError);
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should fail after max retries', async () => {
        const retryableError = new DocumentProcessingError('retryable', 'RETRYABLE', 500, undefined, true);
        const fn = jest.fn().mockRejectedValue(retryableError);
        
        await expect(withRetry(fn, 2, 10)).rejects.toThrow(retryableError);
        expect(fn).toHaveBeenCalledTimes(2);
      });
    });

    describe('wrapAsyncFunction', () => {
      it('should wrap successful function', async () => {
        const fn = jest.fn().mockResolvedValue('success');
        const wrapped = wrapAsyncFunction(fn);
        
        const result = await wrapped('arg1', 'arg2');
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
      });

      it('should handle errors in wrapped function', async () => {
        const error = new Error('wrapped error');
        const fn = jest.fn().mockRejectedValue(error);
        const wrapped = wrapAsyncFunction(fn);
        
        await expect(wrapped()).rejects.toThrow(DocumentProcessingError);
      });
    });

    describe('isRetryableError', () => {
      it('should return true for retryable errors', () => {
        const error = new DocumentProcessingError('retryable', 'RETRYABLE', 500, undefined, true);
        expect(isRetryableError(error)).toBe(true);
      });

      it('should return false for non-retryable errors', () => {
        const error = new DocumentProcessingError('non-retryable', 'NON_RETRYABLE', 500, undefined, false);
        expect(isRetryableError(error)).toBe(false);
      });

      it('should return false for non-DocumentProcessingError', () => {
        const error = new Error('regular error');
        expect(isRetryableError(error)).toBe(false);
      });
    });

    describe('getErrorStatusCode', () => {
      it('should return status code for DocumentProcessingError', () => {
        const error = new DocumentProcessingError('test', 'TEST', 422);
        expect(getErrorStatusCode(error)).toBe(422);
      });

      it('should return 500 for regular Error', () => {
        const error = new Error('regular error');
        expect(getErrorStatusCode(error)).toBe(500);
      });
    });

    describe('getErrorCode', () => {
      it('should return code for DocumentProcessingError', () => {
        const error = new DocumentProcessingError('test', 'TEST_CODE');
        expect(getErrorCode(error)).toBe('TEST_CODE');
      });

      it('should return INTERNAL_ERROR for regular Error', () => {
        const error = new Error('regular error');
        expect(getErrorCode(error)).toBe('INTERNAL_ERROR');
      });
    });
  });

  describe('Error Handlers', () => {
    describe('ValidationErrorHandler', () => {
      let handler: ValidationErrorHandler;

      beforeEach(() => {
        handler = new ValidationErrorHandler();
      });

      it('should handle validation errors', () => {
        const error = new Error('validation failed');
        error.name = 'ValidationError';
        
        expect(handler.canHandle(error)).toBe(true);
        
        const result = handler.handle(error);
        expect(result).toBeInstanceOf(ValidationError);
      });

      it('should not handle other errors', () => {
        const error = new Error('other error');
        
        expect(handler.canHandle(error)).toBe(false);
      });
    });

    describe('FileNotFoundErrorHandler', () => {
      let handler: FileNotFoundErrorHandler;

      beforeEach(() => {
        handler = new FileNotFoundErrorHandler();
      });

      it('should handle ENOENT errors', () => {
        const error = new Error('ENOENT: file not found');
        error.code = 'ENOENT';
        
        expect(handler.canHandle(error)).toBe(true);
        
        const result = handler.handle(error);
        expect(result).toBeInstanceOf(FileNotFoundError);
      });
    });

    describe('TimeoutErrorHandler', () => {
      let handler: TimeoutErrorHandler;

      beforeEach(() => {
        handler = new TimeoutErrorHandler();
      });

      it('should handle timeout errors', () => {
        const error = new Error('timeout occurred');
        error.name = 'TimeoutError';
        
        expect(handler.canHandle(error)).toBe(true);
        
        const result = handler.handle(error);
        expect(result.code).toBe('TIMEOUT_ERROR');
        expect(result.retryable).toBe(true);
      });
    });

    describe('RateLimitErrorHandler', () => {
      let handler: RateLimitErrorHandler;

      beforeEach(() => {
        handler = new RateLimitErrorHandler();
      });

      it('should handle rate limit errors', () => {
        const error = new Error('rate limit exceeded');
        
        expect(handler.canHandle(error)).toBe(true);
        
        const result = handler.handle(error);
        expect(result).toBeInstanceOf(QuotaExceededError);
      });

      it('should handle 429 status code', () => {
        const error = new Error('too many requests');
        (error as any).statusCode = 429;
        
        expect(handler.canHandle(error)).toBe(true);
      });
    });

    describe('DefaultErrorHandler', () => {
      let handler: DefaultErrorHandler;

      beforeEach(() => {
        handler = new DefaultErrorHandler();
      });

      it('should handle any error', () => {
        const error = new Error('any error');
        
        expect(handler.canHandle(error)).toBe(true);
        
        const result = handler.handle(error);
        expect(result).toBeInstanceOf(DocumentProcessingError);
        expect(result.code).toBe('INTERNAL_ERROR');
      });
    });
  });
});