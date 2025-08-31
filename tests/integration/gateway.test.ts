import { IntegrationGatewayService } from '../../src/services/integration/gateway';
import { IntegrationLoggerImplementation } from '../../src/services/integration/logger';
import { ConfigManagerImplementation } from '../../src/services/integration/configManager';

// Mock dependencies
jest.mock('../../src/services/integration/logger');
jest.mock('../../src/services/integration/configManager');
jest.mock('../../src/utils/database');

describe('Integration Gateway Service', () => {
  let gateway: IntegrationGatewayService;
  let mockLogger: jest.Mocked<IntegrationLoggerImplementation>;
  let mockConfig: jest.Mocked<ConfigManagerImplementation>;

  beforeEach(() => {
    mockLogger = new IntegrationLoggerImplementation() as jest.Mocked<IntegrationLoggerImplementation>;
    mockConfig = new ConfigManagerImplementation() as jest.Mocked<ConfigManagerImplementation>;
    gateway = new IntegrationGatewayService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    test('should authenticate with valid API key', async () => {
      const mockRequest = {
        id: 'req_123',
        method: 'GET',
        path: '/test',
        headers: {
          'X-API-Key': 'valid-api-key'
        },
        timestamp: new Date(),
        service: 'test'
      };

      // Mock database responses
      const mockDb = require('../../src/utils/database').Database;
      const mockDatabase = new mockDb();
      
      mockDatabase.client = {
        apiKey: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'key_123',
            key: 'valid-api-key',
            isActive: true,
            user: {
              id: 'user_123',
              email: 'test@example.com',
              role: 'admin'
            }
          })
        },
        apiKey: {
          update: jest.fn().mockResolvedValue({})
        }
      };

      mockDatabase.connect = jest.fn().mockResolvedValue(undefined);
      mockDatabase.disconnect = jest.fn().mockResolvedValue(undefined);

      const result = await gateway.authenticate(mockRequest);
      
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
    });

    test('should reject missing API key', async () => {
      const mockRequest = {
        id: 'req_123',
        method: 'GET',
        path: '/test',
        headers: {},
        timestamp: new Date(),
        service: 'test'
      };

      const result = await gateway.authenticate(mockRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('API key required');
    });

    test('should reject invalid API key', async () => {
      const mockRequest = {
        id: 'req_123',
        method: 'GET',
        path: '/test',
        headers: {
          'X-API-Key': 'invalid-api-key'
        },
        timestamp: new Date(),
        service: 'test'
      };

      // Mock database to return null
      const mockDb = require('../../src/utils/database').Database;
      const mockDatabase = new mockDb();
      
      mockDatabase.client = {
        apiKey: {
          findUnique: jest.fn().mockResolvedValue(null)
        }
      };

      mockDatabase.connect = jest.fn().mockResolvedValue(undefined);
      mockDatabase.disconnect = jest.fn().mockResolvedValue(undefined);

      const result = await gateway.authenticate(mockRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });

    test('should reject expired API key', async () => {
      const mockRequest = {
        id: 'req_123',
        method: 'GET',
        path: '/test',
        headers: {
          'X-API-Key': 'expired-api-key'
        },
        timestamp: new Date(),
        service: 'test'
      };

      // Mock database to return expired key
      const mockDb = require('../../src/utils/database').Database;
      const mockDatabase = new mockDb();
      
      mockDatabase.client = {
        apiKey: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'key_123',
            key: 'expired-api-key',
            isActive: true,
            expiresAt: new Date(Date.now() - 1000), // Expired
            user: {
              id: 'user_123',
              email: 'test@example.com',
              role: 'admin'
            }
          })
        }
      };

      mockDatabase.connect = jest.fn().mockResolvedValue(undefined);
      mockDatabase.disconnect = jest.fn().mockResolvedValue(undefined);

      const result = await gateway.authenticate(mockRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('API key expired');
    });
  });

  describe('Authorization', () => {
    test('should authorize user with valid permissions', async () => {
      const mockRequest = {
        id: 'req_123',
        method: 'GET',
        path: '/test',
        headers: {},
        timestamp: new Date(),
        service: 'pacer'
      };

      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        role: 'admin'
      };

      // Mock database to return permission
      const mockDb = require('../../src/utils/database').Database;
      const mockDatabase = new mockDb();
      
      mockDatabase.client = {
        userPermission: {
          findFirst: jest.fn().mockResolvedValue({
            userId: 'user_123',
            service: 'pacer',
            action: 'read'
          })
        }
      };

      mockDatabase.connect = jest.fn().mockResolvedValue(undefined);
      mockDatabase.disconnect = jest.fn().mockResolvedValue(undefined);

      const result = await gateway.authorize(mockRequest, mockUser);
      
      expect(result).toBe(true);
    });

    test('should reject user without permissions', async () => {
      const mockRequest = {
        id: 'req_123',
        method: 'GET',
        path: '/test',
        headers: {},
        timestamp: new Date(),
        service: 'pacer'
      };

      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        role: 'user'
      };

      // Mock database to return no permission
      const mockDb = require('../../src/utils/database').Database;
      const mockDatabase = new mockDb();
      
      mockDatabase.client = {
        userPermission: {
          findFirst: jest.fn().mockResolvedValue(null)
        }
      };

      mockDatabase.connect = jest.fn().mockResolvedValue(undefined);
      mockDatabase.disconnect = jest.fn().mockResolvedValue(undefined);

      const result = await gateway.authorize(mockRequest, mockUser);
      
      expect(result).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    test('should allow requests within rate limit', async () => {
      const mockRequest = {
        id: 'req_123',
        method: 'GET',
        path: '/test',
        headers: {},
        timestamp: new Date(),
        service: 'pacer',
        user: {
          id: 'user_123',
          email: 'test@example.com',
          role: 'admin'
        }
      };

      // Mock rate limiter to allow request
      const mockRateLimiter = {
        checkLimit: jest.fn().mockResolvedValue({
          allowed: true,
          remaining: 999,
          resetTime: new Date(Date.now() + 900000)
        })
      };

      jest.spyOn(gateway as any, 'rateLimiters', 'get').mockReturnValue(mockRateLimiter);

      const result = await gateway.rateLimit(mockRequest);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(999);
    });

    test('should reject requests exceeding rate limit', async () => {
      const mockRequest = {
        id: 'req_123',
        method: 'GET',
        path: '/test',
        headers: {},
        timestamp: new Date(),
        service: 'pacer',
        user: {
          id: 'user_123',
          email: 'test@example.com',
          role: 'admin'
        }
      };

      // Mock rate limiter to reject request
      const mockRateLimiter = {
        checkLimit: jest.fn().mockResolvedValue({
          allowed: false,
          remaining: 0,
          resetTime: new Date(Date.now() + 900000),
          error: 'Rate limit exceeded'
        })
      };

      jest.spyOn(gateway as any, 'rateLimiters', 'get').mockReturnValue(mockRateLimiter);

      const result = await gateway.rateLimit(mockRequest);
      
      expect(result.allowed).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
    });
  });

  describe('Circuit Breaker', () => {
    test('should return circuit breaker for service', () => {
      const mockCircuitBreaker = {
        execute: jest.fn(),
        getState: jest.fn(),
        reset: jest.fn(),
        forceOpen: jest.fn(),
        forceClose: jest.fn()
      };

      jest.spyOn(gateway as any, 'circuitBreakers', 'get').mockReturnValue(mockCircuitBreaker);

      const result = gateway.circuitBreaker('pacer');
      
      expect(result).toBe(mockCircuitBreaker);
    });

    test('should create new circuit breaker if not exists', () => {
      jest.spyOn(gateway as any, 'circuitBreakers', 'get').mockReturnValue(undefined);

      const result = gateway.circuitBreaker('pacer');
      
      expect(result).toBeDefined();
      expect(typeof result.execute).toBe('function');
    });
  });

  describe('Request Execution', () => {
    test('should execute successful request', async () => {
      const mockRequest = {
        id: 'req_123',
        method: 'GET',
        path: '/test',
        headers: {
          'X-API-Key': 'valid-api-key'
        },
        timestamp: new Date(),
        service: 'pacer'
      };

      // Mock authentication
      jest.spyOn(gateway, 'authenticate').mockResolvedValue({
        success: true,
        user: {
          id: 'user_123',
          email: 'test@example.com',
          role: 'admin'
        }
      });

      // Mock authorization
      jest.spyOn(gateway, 'authorize').mockResolvedValue(true);

      // Mock rate limiting
      jest.spyOn(gateway, 'rateLimit').mockResolvedValue({
        allowed: true,
        remaining: 999,
        resetTime: new Date(Date.now() + 900000)
      });

      // Mock circuit breaker
      const mockCircuitBreaker = {
        execute: jest.fn().mockResolvedValue({
          status: 200,
          headers: {},
          body: { success: true, data: 'test data' }
        })
      };

      jest.spyOn(gateway as any, 'circuitBreakers', 'get').mockReturnValue(mockCircuitBreaker);

      const result = await gateway.execute(mockRequest);
      
      expect(result.status).toBe(200);
      expect(result.body.success).toBe(true);
      expect(result.service).toBe('pacer');
    });

    test('should handle authentication failure', async () => {
      const mockRequest = {
        id: 'req_123',
        method: 'GET',
        path: '/test',
        headers: {},
        timestamp: new Date(),
        service: 'pacer'
      };

      // Mock authentication failure
      jest.spyOn(gateway, 'authenticate').mockResolvedValue({
        success: false,
        error: 'Invalid API key'
      });

      const result = await gateway.execute(mockRequest);
      
      expect(result.status).toBe(401);
      expect(result.body.success).toBe(false);
      expect(result.body.message).toBe('Authentication failed');
    });

    test('should handle authorization failure', async () => {
      const mockRequest = {
        id: 'req_123',
        method: 'GET',
        path: '/test',
        headers: {
          'X-API-Key': 'valid-api-key'
        },
        timestamp: new Date(),
        service: 'pacer'
      };

      // Mock authentication success
      jest.spyOn(gateway, 'authenticate').mockResolvedValue({
        success: true,
        user: {
          id: 'user_123',
          email: 'test@example.com',
          role: 'admin'
        }
      });

      // Mock authorization failure
      jest.spyOn(gateway, 'authorize').mockResolvedValue(false);

      const result = await gateway.execute(mockRequest);
      
      expect(result.status).toBe(403);
      expect(result.body.success).toBe(false);
      expect(result.body.message).toBe('Insufficient permissions');
    });

    test('should handle rate limit exceeded', async () => {
      const mockRequest = {
        id: 'req_123',
        method: 'GET',
        path: '/test',
        headers: {
          'X-API-Key': 'valid-api-key'
        },
        timestamp: new Date(),
        service: 'pacer'
      };

      // Mock authentication success
      jest.spyOn(gateway, 'authenticate').mockResolvedValue({
        success: true,
        user: {
          id: 'user_123',
          email: 'test@example.com',
          role: 'admin'
        }
      });

      // Mock authorization success
      jest.spyOn(gateway, 'authorize').mockResolvedValue(true);

      // Mock rate limit exceeded
      jest.spyOn(gateway, 'rateLimit').mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: new Date(Date.now() + 900000),
        error: 'Rate limit exceeded'
      });

      const result = await gateway.execute(mockRequest);
      
      expect(result.status).toBe(429);
      expect(result.body.success).toBe(false);
      expect(result.body.message).toBe('Rate limit exceeded');
    });

    test('should handle service errors', async () => {
      const mockRequest = {
        id: 'req_123',
        method: 'GET',
        path: '/test',
        headers: {
          'X-API-Key': 'valid-api-key'
        },
        timestamp: new Date(),
        service: 'pacer'
      };

      // Mock authentication success
      jest.spyOn(gateway, 'authenticate').mockResolvedValue({
        success: true,
        user: {
          id: 'user_123',
          email: 'test@example.com',
          role: 'admin'
        }
      });

      // Mock authorization success
      jest.spyOn(gateway, 'authorize').mockResolvedValue(true);

      // Mock rate limiting success
      jest.spyOn(gateway, 'rateLimit').mockResolvedValue({
        allowed: true,
        remaining: 999,
        resetTime: new Date(Date.now() + 900000)
      });

      // Mock circuit breaker error
      const mockCircuitBreaker = {
        execute: jest.fn().mockRejectedValue(new Error('Service unavailable'))
      };

      jest.spyOn(gateway as any, 'circuitBreakers', 'get').mockReturnValue(mockCircuitBreaker);

      const result = await gateway.execute(mockRequest);
      
      expect(result.status).toBe(500);
      expect(result.body.success).toBe(false);
      expect(result.body.message).toBe('Internal server error');
    });
  });

  describe('Logging', () => {
    test('should log request start', async () => {
      const mockRequest = {
        id: 'req_123',
        method: 'GET',
        path: '/test',
        headers: {
          'X-API-Key': 'valid-api-key'
        },
        timestamp: new Date(),
        service: 'pacer'
      };

      // Mock authentication success
      jest.spyOn(gateway, 'authenticate').mockResolvedValue({
        success: true,
        user: {
          id: 'user_123',
          email: 'test@example.com',
          role: 'admin'
        }
      });

      // Mock authorization success
      jest.spyOn(gateway, 'authorize').mockResolvedValue(true);

      // Mock rate limiting success
      jest.spyOn(gateway, 'rateLimit').mockResolvedValue({
        allowed: true,
        remaining: 999,
        resetTime: new Date(Date.now() + 900000)
      });

      // Mock circuit breaker
      const mockCircuitBreaker = {
        execute: jest.fn().mockResolvedValue({
          status: 200,
          headers: {},
          body: { success: true, data: 'test data' }
        })
      };

      jest.spyOn(gateway as any, 'circuitBreakers', 'get').mockReturnValue(mockCircuitBreaker);

      await gateway.execute(mockRequest);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Integration request started',
        expect.objectContaining({
          requestId: 'req_123',
          service: 'pacer',
          method: 'GET',
          path: '/test'
        })
      );
    });

    test('should log successful response', async () => {
      const mockRequest = {
        id: 'req_123',
        method: 'GET',
        path: '/test',
        headers: {
          'X-API-Key': 'valid-api-key'
        },
        timestamp: new Date(),
        service: 'pacer'
      };

      // Mock authentication success
      jest.spyOn(gateway, 'authenticate').mockResolvedValue({
        success: true,
        user: {
          id: 'user_123',
          email: 'test@example.com',
          role: 'admin'
        }
      });

      // Mock authorization success
      jest.spyOn(gateway, 'authorize').mockResolvedValue(true);

      // Mock rate limiting success
      jest.spyOn(gateway, 'rateLimit').mockResolvedValue({
        allowed: true,
        remaining: 999,
        resetTime: new Date(Date.now() + 900000)
      });

      // Mock circuit breaker
      const mockCircuitBreaker = {
        execute: jest.fn().mockResolvedValue({
          status: 200,
          headers: {},
          body: { success: true, data: 'test data' }
        })
      };

      jest.spyOn(gateway as any, 'circuitBreakers', 'get').mockReturnValue(mockCircuitBreaker);

      await gateway.execute(mockRequest);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Integration request completed',
        expect.objectContaining({
          requestId: 'req_123',
          service: 'pacer',
          status: 200
        })
      );
    });

    test('should log errors', async () => {
      const mockRequest = {
        id: 'req_123',
        method: 'GET',
        path: '/test',
        headers: {},
        timestamp: new Date(),
        service: 'pacer'
      };

      // Mock authentication failure
      jest.spyOn(gateway, 'authenticate').mockResolvedValue({
        success: false,
        error: 'Invalid API key'
      });

      await gateway.execute(mockRequest);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Integration request failed',
        expect.objectContaining({
          requestId: 'req_123',
          service: 'pacer'
        })
      );
    });
  });
});